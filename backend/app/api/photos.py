import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.database.db import get_db
from backend.app.models.event import Event
from backend.app.models.photo import Photo
from backend.app.models.photo_analysis import PhotoAnalysis
from backend.app.schemas.photo import (
    PhotoRead,
    AnalysisRead,
    PhotoWithAnalysis,
    AnalysisSummary,
    DecisionRequest,
    DecisionRead,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Allowed MIME types.  We check the Content-Type header reported by the
# browser AND the file extension to add two layers of validation.
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}

# Maximum upload size: 20 MB.
# Files larger than this are rejected before being written to disk.
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB

# Storage root: always relative to the project root, not to this file.
# Path(__file__) → backend/app/api/photos.py
# .parents[3]    → SerendibSuite/
STORAGE_ROOT = Path(__file__).parents[3] / "storage"

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/api/photos", tags=["photos"])


# ---------------------------------------------------------------------------
# POST /api/photos/  — Upload a photo for an event
# ---------------------------------------------------------------------------
@router.post(
    "/",
    response_model=PhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_photo(
    event_id: int = Form(...),          # sent as a form field alongside the file
    file: UploadFile = File(...),       # the actual image file
    db: Session = Depends(get_db),
):
    """
    Upload a photo and attach it to an existing event.

    The request must be multipart/form-data (not JSON) because it carries
    a binary file.  FastAPI's UploadFile + Form handles this automatically.

    Validation steps:
      1. Verify the event exists (404 if not).
      2. Check MIME type is JPEG or PNG (415 if not).
      3. Check file extension matches the MIME type (415 if not).
      4. Read the file into memory and check the size (413 if too large).
      5. Generate a UUID-based filename — never trust the original name.
      6. Write to storage/events/{event_id}/
      7. Create a Photo database record.
      8. Return the saved record via PhotoRead.
    """

    # ------------------------------------------------------------------
    # 1. Verify the event exists.
    # ------------------------------------------------------------------
    event = db.query(Event).filter(Event.id == event_id).first()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with id={event_id} does not exist.",
        )

    # ------------------------------------------------------------------
    # 2. Validate MIME type (from the browser's Content-Type header).
    # ------------------------------------------------------------------
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                f"Only JPEG and PNG are accepted."
            ),
        )

    # ------------------------------------------------------------------
    # 3. Validate file extension (second layer — never trust the MIME alone).
    # ------------------------------------------------------------------
    original_name = file.filename or "upload"
    suffix = Path(original_name).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File extension '{suffix}' is not allowed. "
                f"Use .jpg, .jpeg, or .png."
            ),
        )

    # ------------------------------------------------------------------
    # 4. Read file content and check size.
    #    We read the whole file into memory here (fine for photos up to
    #    20 MB; for very large files you'd stream to disk instead).
    # ------------------------------------------------------------------
    contents = await file.read()
    file_size = len(contents)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File is too large ({file_size:,} bytes). "
                f"Maximum allowed size is {MAX_FILE_SIZE_BYTES:,} bytes (20 MB)."
            ),
        )

    # ------------------------------------------------------------------
    # 5. Generate a safe, unique filename using UUID4.
    #    We keep the correct extension but discard the original name.
    #    This prevents directory traversal and filename collision attacks.
    # ------------------------------------------------------------------
    stored_filename = f"{uuid.uuid4()}{suffix}"

    # ------------------------------------------------------------------
    # 6. Build the destination path and write the file.
    #    Directory structure: storage/events/{event_id}/
    # ------------------------------------------------------------------
    event_dir = STORAGE_ROOT / "events" / str(event_id)
    event_dir.mkdir(parents=True, exist_ok=True)  # create dirs if needed

    dest_path = event_dir / stored_filename
    dest_path.write_bytes(contents)

    # Relative path stored in DB — keeps it portable across machines.
    relative_path = f"events/{event_id}/{stored_filename}"

    # ------------------------------------------------------------------
    # 7. Create the Photo database record.
    # ------------------------------------------------------------------
    new_photo = Photo(
        event_id=event_id,
        original_filename=original_name,
        stored_filename=stored_filename,
        file_path=relative_path,
        mime_type=file.content_type,
        file_size=file_size,
    )

    db.add(new_photo)
    db.commit()
    db.refresh(new_photo)

    return new_photo


# ---------------------------------------------------------------------------
# GET /api/photos/?event_id={event_id}  — List photos for an event
# ---------------------------------------------------------------------------
@router.get(
    "/",
    response_model=List[PhotoRead],
)
def list_photos(event_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Return photos, optionally filtered by event.

    GET /api/photos/            → all photos (useful for debugging)
    GET /api/photos/?event_id=3 → only photos belonging to event 3

    If event_id is provided, we first verify the event exists.
    """
    if event_id is not None:
        event = db.query(Event).filter(Event.id == event_id).first()
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id={event_id} does not exist.",
            )
        photos = db.query(Photo).filter(Photo.event_id == event_id).all()
    else:
        photos = db.query(Photo).all()

    return photos


# ---------------------------------------------------------------------------
# GET /api/photos/with-analysis?event_id={id}  — Photos + embedded analysis
# ---------------------------------------------------------------------------
@router.get(
    "/with-analysis",
    response_model=List[PhotoWithAnalysis],
)
def list_photos_with_analysis(
    event_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Return photos for an event with their analysis embedded.

    Eliminates the N+1 per-photo analysis requests from the frontend.
    Each photo carries an 'analysis' key that is either null (not yet
    analysed) or an AnalysisSummary object.
    """
    if event_id is not None:
        event = db.query(Event).filter(Event.id == event_id).first()
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Event with id={event_id} does not exist.",
            )
        photos = db.query(Photo).filter(Photo.event_id == event_id).all()
    else:
        photos = db.query(Photo).all()

    result = []
    for photo in photos:
        analysis = (
            db.query(PhotoAnalysis)
            .filter(PhotoAnalysis.photo_id == photo.id)
            .first()
        )
        analysis_summary = None
        if analysis is not None:
            analysis_summary = AnalysisSummary(
                blur_score=analysis.blur_score,
                is_blurry=analysis.is_blurry,
                face_detected=analysis.face_detected,
                eyes_status=analysis.eyes_status,
                ai_recommendation=analysis.ai_recommendation,
                photographer_decision=analysis.photographer_decision,
                reason=None,   # reason is a pipeline artefact, not stored
            )
        result.append(
            PhotoWithAnalysis(
                id=photo.id,
                event_id=photo.event_id,
                original_filename=photo.original_filename,
                file_size=photo.file_size,
                created_at=photo.created_at,
                analysis=analysis_summary,
            )
        )
    return result


# ---------------------------------------------------------------------------
# GET /api/photos/{photo_id}  — Get one photo's metadata
# ---------------------------------------------------------------------------
@router.get(
    "/{photo_id}",
    response_model=PhotoRead,
)
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    """
    Return metadata for one photo by its primary key.

    Note: this returns the database record only, not the image binary.
    Serving the actual image file will be added when the frontend
    photo gallery is implemented.
    """
    photo = db.query(Photo).filter(Photo.id == photo_id).first()

    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Photo with id={photo_id} does not exist.",
        )

    return photo


# ---------------------------------------------------------------------------
# GET /api/photos/{photo_id}/file  — Serve the actual image binary
# ---------------------------------------------------------------------------
@router.get("/{photo_id}/file")
def serve_photo_file(photo_id: int, db: Session = Depends(get_db)):
    """
    Stream the stored image file for a given photo_id.

    Security:
      - The file path is never taken from the request — it is always
        looked up from the database using photo_id.
      - STORAGE_ROOT / photo.file_path is resolved; we confirm the
        result still sits under STORAGE_ROOT to prevent path traversal.
      - The correct Content-Type is returned from the database record.

    The browser uses this URL as the <img src="..."> for thumbnails.
    """
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Photo with id={photo_id} does not exist.",
        )

    abs_path = (STORAGE_ROOT / photo.file_path).resolve()

    # Path-traversal guard: the resolved path must still be inside STORAGE_ROOT.
    try:
        abs_path.relative_to(STORAGE_ROOT.resolve())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied.",
        )

    if not abs_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image file not found on disk.",
        )

    return FileResponse(
        path=str(abs_path),
        media_type=photo.mime_type,
        filename=photo.original_filename,
    )


# ---------------------------------------------------------------------------
@router.post(
    "/{photo_id}/analyse",
    response_model=AnalysisRead,
)
def analyse_photo(photo_id: int, db: Session = Depends(get_db)):
    """
    Run the AI / CV analysis pipeline on a previously uploaded photo.

    Steps:
      1. Look up the Photo record — 404 if not found.
      2. Resolve the absolute file path — 404 if the file is missing.
      3. Run the pipeline (blur + face/eye + hash + recommendation).
      4. Create or UPDATE the PhotoAnalysis record (never duplicates).
      5. Return the analysis result with a human-readable reason.

    This endpoint is safe to call more than once — it updates the existing
    PhotoAnalysis row rather than inserting a duplicate.
    """
    from datetime import datetime, timezone
    import sys

    # ------------------------------------------------------------------
    # 1. Verify the Photo record exists.
    # ------------------------------------------------------------------
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Photo with id={photo_id} does not exist.",
        )

    # ------------------------------------------------------------------
    # 2. Resolve the absolute path to the stored file.
    #    STORAGE_ROOT is defined at the top of this module.
    # ------------------------------------------------------------------
    abs_path = STORAGE_ROOT / photo.file_path
    if not abs_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Stored file for photo id={photo_id} could not be found. "
                f"The file may have been moved or deleted outside the application."
            ),
        )

    # ------------------------------------------------------------------
    # 3. Run the AI pipeline.
    #    Import lazily so the AI packages are only loaded when this
    #    endpoint is actually called (keeps startup fast).
    # ------------------------------------------------------------------
    try:
        # sys.path manipulation ensures the project root is on the path.
        project_root = str(STORAGE_ROOT.parent)
        if project_root not in sys.path:
            sys.path.insert(0, project_root)

        from ai.pipeline import run_pipeline
        result = run_pipeline(abs_path)

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Image could not be processed: {exc}",
        )
    except Exception as exc:
        # Catch-all: log and return a controlled 500 without leaking internals.
        print(f"[analyse] Pipeline error for photo_id={photo_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI pipeline encountered an error. Check server logs.",
        )

    # ------------------------------------------------------------------
    # 4. Create or UPDATE the PhotoAnalysis row.
    #    unique=True on photo_id means at most one row exists per photo.
    #    We use filter().first() to check for an existing record.
    # ------------------------------------------------------------------
    analysis = db.query(PhotoAnalysis).filter(
        PhotoAnalysis.photo_id == photo_id
    ).first()

    if analysis is None:
        # First time — create a new record.
        analysis = PhotoAnalysis(photo_id=photo_id)
        db.add(analysis)

    # Apply pipeline results (works for both create and update).
    analysis.blur_score          = result.blur_score
    analysis.is_blurry           = result.is_blurry
    analysis.face_detected       = result.face_detected
    analysis.eyes_status         = result.eyes_status
    analysis.similarity_group    = result.similarity_group
    analysis.ai_recommendation   = result.ai_recommendation
    analysis.analyzed_at         = datetime.now(timezone.utc)

    db.commit()
    db.refresh(analysis)

    # ------------------------------------------------------------------
    # 5. Build and return the response.
    #    Include 'reason' from the pipeline (not stored in DB).
    # ------------------------------------------------------------------
    return AnalysisRead(
        photo_id=photo_id,
        original_filename=photo.original_filename,
        blur_score=analysis.blur_score,
        is_blurry=analysis.is_blurry,
        face_detected=analysis.face_detected,
        eyes_status=analysis.eyes_status,
        similarity_group=analysis.similarity_group,
        ai_recommendation=analysis.ai_recommendation,
        photographer_decision=analysis.photographer_decision,
        reason=result.reason,
    )


# ---------------------------------------------------------------------------
# PATCH /api/photos/{photo_id}/decision  — Set photographer decision
# ---------------------------------------------------------------------------
@router.patch(
    "/{photo_id}/decision",
    response_model=DecisionRead,
)
def set_photographer_decision(
    photo_id: int,
    body: DecisionRequest,
    db: Session = Depends(get_db),
):
    """
    Record the photographer's decision (keep / reject) for a photo.

    Rules:
      - The photo must exist  (404 if not).
      - An analysis record must already exist (400 if not analysed yet).
      - Only "keep" and "reject" are accepted (enforced by Pydantic Literal).
      - The AI recommendation is never modified — only photographer_decision.
      - Safe to call multiple times: calling again changes the decision.
    """
    # 1. Photo must exist.
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Photo with id={photo_id} does not exist.",
        )

    # 2. Analysis must exist — cannot decide on an unanalysed photo.
    analysis = (
        db.query(PhotoAnalysis)
        .filter(PhotoAnalysis.photo_id == photo_id)
        .first()
    )
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Photo must be analysed before setting a photographer decision.",
        )

    # 3. Apply the decision (Pydantic already validated it is keep|reject).
    analysis.photographer_decision = body.decision
    db.commit()
    db.refresh(analysis)

    return DecisionRead(
        photo_id=photo_id,
        original_filename=photo.original_filename,
        ai_recommendation=analysis.ai_recommendation,
        photographer_decision=analysis.photographer_decision,
    )
