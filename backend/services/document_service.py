from fastapi import UploadFile, HTTPException, status
from services.pdf_service import pdf_service
from vectorstore.chroma_store import vector_store_manager

class DocumentService:
    async def process_and_index_pdf(self, file: UploadFile) -> dict:
        """
        Orchestrates the entire PDF pipeline: validation, storage, 
        extraction, chunking, and vector database ingestion.
        """
        if not file.filename.endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Invalid file format. Only PDF files are supported."
            )

        # 1. Save uploaded document to local directory disk storage
        saved_path = await pdf_service.save_file(file)

        # 2. Extract text per page
        extracted_pages = pdf_service.extract_text_with_metadata(saved_path)
        if not extracted_pages:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The uploaded PDF contains no valid or readable text layout."
            )

        # 3. Create logical chunks
        text_chunks = pdf_service.chunk_text(extracted_pages)

        # 4. Map embeddings and populate local persistent Vector Database
        vector_store_manager.add_documents(text_chunks)

        return {
            "filename": file.filename,
            "total_chunks_processed": len(text_chunks)
        }

document_service = DocumentService()