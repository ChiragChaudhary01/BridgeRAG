import os
import re
import hashlib
from typing import Optional
from fastapi import UploadFile, HTTPException, status
from pypdf import PdfReader
from services.pdf_service import pdf_service
from vectorstore.chroma_store import vector_store_manager

class DocumentService:
    def __init__(self):
        # 10 MB in bytes (10 * 1024 * 1024)
        self.MAX_FILE_SIZE = 10 * 1024 * 1024  
        self.MAX_PAGE_COUNT = 50

    async def process_and_index_pdf(self, file: UploadFile, title: Optional[str] = None, description: Optional[str] = None) -> dict:
        """
        Orchestrates the entire PDF pipeline with size, format, 
        and structural page validations before VectorDB ingestion.
        """
        # Validation 1: Format Check
        if not file.filename.endswith('.pdf'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Invalid file format. Only PDF files are supported."
            )

        # Validation 2: File Size Check (Before writing to disk)
        file.file.seek(0, 2)  # Seek to the end of the file
        file_size = file.file.tell()  # Get current position (size in bytes)
        file.file.seek(0)  # Reset back to the beginning for downstream reading

        if file_size > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds the 10MB limit. Uploaded file is {round(file_size / (1024 * 1024), 2)}MB."
            )

        # Title Rule: If empty, extract the filename minus its extension.
        if not title or not title.strip():
            title = os.path.splitext(file.filename)[0]
        
        # Normalize underscores to spaces to help make snake_case filenames valid titles
        title = title.replace('_', ' ').strip()

        # Validate Title: must be strictly between 3 and 50 characters.
        if not (3 < len(title) < 50):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Title must be strictly between 3 and 50 characters long. Got length {len(title)}."
            )

        # Validate Title chars: allows only alphanumeric characters, spaces, and dashes.
        if not re.match(r"^[a-zA-Z0-9 -]+$", title):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title can only contain alphanumeric characters, spaces, and dashes."
            )

        # Description Rule: Optional. If provided, must not exceed 250 characters.
        desc_str = ""
        if description and description.strip():
            desc_str = description.strip()
            if len(desc_str) > 250:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Description must not exceed 250 characters. Got length {len(desc_str)}."
                )

        # Duplicate Check: Query ChromaDB metadata before processing.
        if vector_store_manager.title_exists(title):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Change the title; this title already exists."
            )

        # Generate Unique Document ID based on title hash
        document_id = f"doc_{hashlib.md5(title.encode('utf-8')).hexdigest()[:8]}"

        # 1. Save uploaded document to local directory disk storage as {document_id}.pdf
        friendly_filename = f"{title}.pdf"
        target_filename = f"{document_id}.pdf"
        saved_path = await pdf_service.save_file(file, target_filename)

        # Validation 3: Page Count Check
        try:
            reader = PdfReader(saved_path)
            total_pages = len(reader.pages)
        except Exception:
            if os.path.exists(saved_path):
                os.remove(saved_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to parse the PDF. The file might be corrupted."
            )

        if total_pages > self.MAX_PAGE_COUNT:
            if os.path.exists(saved_path):
                os.remove(saved_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The document exceeds the maximum limit of {self.MAX_PAGE_COUNT} pages (Found {total_pages} pages)."
            )

        # 2. Extract text per page
        extracted_pages = pdf_service.extract_text_with_metadata(saved_path)
        if not extracted_pages:
            if os.path.exists(saved_path):
                os.remove(saved_path)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The uploaded PDF contains no valid or readable text layout."
            )

        # 3. Create logical chunks
        text_chunks = pdf_service.chunk_text(extracted_pages, title)

        # Enrichment: Add metadata expansion to all chunk dictionaries
        file_size_mb = round(file_size / (1024 * 1024), 2)
        for chunk in text_chunks:
            chunk["metadata"].update({
                "document_id": document_id,
                "title": title,
                "description": desc_str,
                "filename": friendly_filename,
                "file_size_mb": file_size_mb,
                "total_pages": total_pages
            })

        # 4. Map embeddings and populate local persistent Vector Database
        vector_store_manager.add_documents(text_chunks)

        return {
            "document_id": document_id,
            "title": title,
            "description": desc_str,
            "filename": friendly_filename,
            "file_size_mb": file_size_mb,
            "total_pages": total_pages,
            "total_chunks_processed": len(text_chunks)
        }

document_service = DocumentService()