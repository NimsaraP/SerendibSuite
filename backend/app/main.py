from fastapi import FastAPI

# Create the FastAPI application instance.
# The title and version appear in the auto-generated Swagger docs at /docs.
app = FastAPI(
    title="SerendibSuite API",
    version="0.1.0",
)


@app.get("/api/health")
def health_check():
    """
    Health check endpoint.
    Call this to verify the API server is running correctly.
    """
    return {
        "status": "ok",
        "service": "SerendibSuite API",
    }
