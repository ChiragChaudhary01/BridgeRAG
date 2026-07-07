
import uvicorn
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from config.config import settings
from api.v1.endpoints import router as document_router
from schema.response import success_response, APIResponse

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Document-Based AI Assistant (RAG)",
    version="1.0.0"
)

# Enable CORS so your React frontend can seamlessly talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the document router for all API v1 endpoints
app.include_router(document_router)

@app.get("/api/v1/health", response_model=APIResponse, status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    """
    System health check endpoint using a unified response layout.
    """
    health_data = {
        "project": settings.PROJECT_NAME,
        "version": "1.0.0"
    }
    return success_response(message="System is healthy", data=health_data)

if __name__ == "__main__":
    uvicorn.run("main.py:app", host="0.0.0.0", port=8000, reload=True)