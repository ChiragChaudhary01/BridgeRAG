from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from fastapi.responses import StreamingResponse, FileResponse
import os
from typing import Optional
from services.document_service import document_service
from services.ai_service import ai_service
from vectorstore.chroma_store import vector_store_manager
from schema.response import success_response, error_response, APIResponse
from schema.chat import ChatRequest

router = APIRouter(prefix="/api/v1", tags=["Documents"])

@router.post("/upload", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None)
):
    """
    Ingests local PDF file uploads through the unified document service pipeline
    with metadata expansion, validation, and duplicate checks.
    """
    try:
        result = await document_service.process_and_index_pdf(
            file=file,
            title=title,
            description=description
        )
        return success_response(
            message="Document uploaded and indexed successfully",
            data=result
        )
    except HTTPException as http_ex:
        # Re-raise known HTTP exceptions (like validation or duplicate check failures)
        raise http_ex
    except Exception as e:
        print(f"[ERROR]: File processing pipeline failed due to: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during file ingestion: {str(e)}"
        )

@router.get("/documents", response_model=APIResponse, status_code=status.HTTP_200_OK)
async def get_documents():
    """
    Retrieves unique document metadata profiles currently stored within the local ChromaDB collection.
    """
    try:
        documents = vector_store_manager.get_all_documents()
        return success_response(
            message="Unique document profiles retrieved successfully",
            data=documents
        )
    except Exception as e:
        print(f"[ERROR]: Retrieving document profiles failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while retrieving document profiles: {str(e)}"
        )

@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Initiates a streaming chat session query for a specific document title,
    yielding sources first, followed by Gemini's generation content fragments.
    """
    # 1. Enforce strict query isolation check by checking if title exists in index
    if not vector_store_manager.title_exists(request.title):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No indexed document found matching title: '{request.title}'."
        )

    # 2. Return streaming text event stream
    try:
        generator = ai_service.stream_chat_response(title=request.title, message=request.message)
        return StreamingResponse(generator, media_type="text/event-stream")
    except Exception as e:
        print(f"[ERROR]: Chat stream session failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while processing the chat stream: {str(e)}"
        )

@router.get("/chunks/{chunk_id}", response_model=APIResponse, status_code=status.HTTP_200_OK)
async def get_chunk(chunk_id: str):
    """
    Retrieves full text and metadata for a specific document chunk.
    """
    try:
        chunk = vector_store_manager.get_chunk_by_id(chunk_id)
        if not chunk:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chunk reference ID '{chunk_id}' not found."
            )
        return success_response(
            message="Chunk context retrieved successfully",
            data=chunk
        )
    except HTTPException as http_ex:
        raise http_ex
    except Exception as e:
        print(f"[ERROR]: Retrieving chunk detail failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while retrieving chunk details: {str(e)}"
        )

@router.get("/documents/{document_id}/download")
async def download_document(document_id: str):
    """
    Serves the physical PDF file associated with a unique document ID as an attachment.
    """
    # 1. Verify existence in index and get friendly filename
    meta = vector_store_manager.get_document_metadata_by_id(document_id)
    if not meta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document ID not found in system registry."
        )
    
    friendly_filename = meta.get("filename", "document.pdf")
    file_path = os.path.join("data/storage", f"{document_id}.pdf")
    
    if not os.path.exists(file_path):
        print(f"[ERROR]: PDF file missing on disk at path: {file_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source PDF file is missing on local disk storage."
        )
        
    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=friendly_filename
    )
