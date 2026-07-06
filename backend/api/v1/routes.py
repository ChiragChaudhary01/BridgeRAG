from fastapi import APIRouter, UploadFile, File, HTTPException, status
from services.document_service import document_service
from schema.response import success_response, error_response, APIResponse

router = APIRouter(prefix="/api/v1", tags=["Documents"])

@router.post("/upload", response_model=APIResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...)):
    """
    Ingests local PDF file uploads through the unified document service pipeline.
    """
    try:
        result = await document_service.process_and_index_pdf(file)
        return success_response(
            message="Document uploaded and indexed successfully",
            data=result
        )
    except HTTPException as http_ex:
        # Re-raise known operational HTTP exceptions (like invalid format or unprocessable text)
        raise http_ex
    except Exception as e:
        print(f"[ERROR]: File processing pipeline failed due to: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during file ingestion: {str(e)}"
        )