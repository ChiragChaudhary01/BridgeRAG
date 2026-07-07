import os
import shutil
from fastapi import UploadFile
# pyrefly: ignore [missing-import]
from pypdf import PdfReader

class PDFService:
    """Service class for handling PDF file operations, including saving, text extraction, and chunking."""

    def __init__(self, upload_dir: str = "data/storage"):
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_file(self, file: UploadFile, filename: str) -> str:
        """Saves the uploaded file to local disk storage with a specific filename."""
        file_path = os.path.join(self.upload_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return file_path

    def extract_text_with_metadata(self, file_path: str) -> list[dict]:
        """
        Extracts raw text page by page from the PDF, returning a dictionary
        containing the text content and corresponding page metadata.
        """
        reader = PdfReader(file_path)
        pages_data = []
        for index, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages_data.append({
                    "page_number": index + 1,
                    "text": text
                })
        return pages_data

    def chunk_text(self, pages_data: list[dict], title: str, chunk_size: int = 800, chunk_overlap: int = 150) -> list[dict]:
        """
        Splits extracted text into smaller structured chunks with sliding overlaps,
        ensuring page number properties are carried along with each chunk and uses
        a unique doc hash prefix for chunk IDs.
        """
        import hashlib
        doc_hash = hashlib.md5(title.encode("utf-8")).hexdigest()[:8]
        chunks = []
        chunk_id_counter = 0

        for page in pages_data:
            text = page["text"]
            page_num = page["page_number"]
            
            start = 0
            while start < len(text):
                end = start + chunk_size
                chunk_slice = text[start:end]
                
                chunks.append({
                    "chunk_id": f"chk_{doc_hash}_{chunk_id_counter}",
                    "text": chunk_slice,
                    "metadata": {
                        "page_number": page_num
                    }
                })
                chunk_id_counter += 1
                # Slide window forward minus overlap
                start += (chunk_size - chunk_overlap)
                
        return chunks

pdf_service = PDFService()