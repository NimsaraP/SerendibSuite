"""
backend/app/api/export_xmp.py — XMP sidecar generator for Lightroom / Photo Mechanic.

Generates standard Adobe XMP metadata files and packages them into a ZIP archive.
Compatible with:
  - Adobe Lightroom Classic
  - Adobe Lightroom CC
  - Camera Raw
  - Photo Mechanic
"""

import io
import zipfile
from typing import List, Dict, Any


def generate_xmp_content(original_filename: str, decision: str, analysis: Dict[str, Any] = None) -> str:
    """
    Generate Adobe XMP sidecar XML content.
    """
    decision = (decision or "undecided").lower()

    if decision == "keep":
        rating = "5"
        label = "Green"
        tag = "Kept"
        urgency = "1"
    elif decision == "reject":
        rating = "0"
        label = "Red"
        tag = "Rejected"
        urgency = "8"
    else:
        rating = "2"
        label = "Yellow"
        tag = "Review"
        urgency = "4"

    ai_rec = (analysis.get("ai_recommendation") if analysis else "unknown") or "none"
    blur_score = str(analysis.get("blur_score", "n/a")) if analysis else "n/a"

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="SerendibSuite AI Culling 1.0">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmp:Rating="{rating}"
    xmp:Label="{label}">
   <photoshop:Urgency>{urgency}</photoshop:Urgency>
   <dc:subject>
    <rdf:Bag>
     <rdf:li>SerendibSuite</rdf:li>
     <rdf:li>{tag}</rdf:li>
     <rdf:li>AI_Rec_{ai_rec.upper()}</rdf:li>
    </rdf:Bag>
   </dc:subject>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">Culling decision: {tag}. AI recommendation: {ai_rec}. Sharpness: {blur_score}</rdf:li>
    </rdf:Alt>
   </dc:description>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
"""


def create_xmp_zip_bundle(event_name: str, photo_items: List[Dict[str, Any]]) -> bytes:
    """
    Bundles XMP sidecar files for all photos in an event into an in-memory ZIP archive.
    """
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        kept_count = 0
        rejected_count = 0
        undecided_count = 0

        for item in photo_items:
            orig_name = item["original_filename"]
            decision = (item.get("analysis") or {}).get("photographer_decision") or "undecided"
            analysis = item.get("analysis") or {}

            if decision == "keep":
                kept_count += 1
            elif decision == "reject":
                rejected_count += 1
            else:
                undecided_count += 1

            xmp_str = generate_xmp_content(orig_name, decision, analysis)

            # Lightroom accepts both <filename>.xmp and <basename>.xmp
            # We save as <original_filename>.xmp which is the industry standard
            zf.writestr(f"{orig_name}.xmp", xmp_str)

        # Add helpful summary readme inside the zip
        summary_text = (
            f"SerendibSuite XMP Culling Export\n"
            f"Event: {event_name}\n"
            f"Total Photos: {len(photo_items)}\n"
            f"  - Kept (5 Stars / Green Label): {kept_count}\n"
            f"  - Rejected (0 Stars / Red Label): {rejected_count}\n"
            f"  - Pending/Review: {undecided_count}\n\n"
            f"HOW TO USE IN LIGHTROOM CLASSIC:\n"
            f"1. Extract these .xmp files into the same folder as your RAW / JPEG photos.\n"
            f"2. In Lightroom Classic, select all photos -> right click -> 'Metadata' -> 'Read Metadata from Files'.\n"
            f"3. Your 5-star ratings and color labels will instantly appear!\n\n"
            f"HOW TO USE IN PHOTO MECHANIC:\n"
            f"1. Put .xmp sidecars next to your photos.\n"
            f"2. Photo Mechanic will automatically read the color labels and star ratings.\n"
        )
        zf.writestr("README_LIGHTROOM_IMPORT.txt", summary_text)

    return zip_buffer.getvalue()
