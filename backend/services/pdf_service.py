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
        Splits extracted text into semantic chunks page-by-page using a hierarchical recursive splitting algorithm.
        Separates text on paragraph breaks, line breaks, and space boundaries to maintain context integrity and
        includes backtrack overlapping.
        """
        import hashlib
        doc_hash = hashlib.md5(title.encode("utf-8")).hexdigest()[:8]
        chunks = []
        chunk_id_counter = 0

        # Hierarchical separators
        separators = ["\n\n", "\n", " ", ""]

        def split_text(text: str, current_seps: list[str]) -> list[str]:
            if len(text) <= chunk_size:
                return [text]
            
            if not current_seps:
                # Fallback to character split if no separators are left
                return [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
            
            sep = current_seps[0]
            next_seps = current_seps[1:]
            
            if sep == "":
                splits = list(text)
            else:
                splits = text.split(sep)
            
            final_chunks = []
            current_chunk = []
            current_len = 0
            
            for part in splits:
                part_len = len(part)
                # If a single split segment is larger than chunk_size, split recursively using next separators
                if part_len > chunk_size:
                    if current_chunk:
                        final_chunks.append(sep.join(current_chunk))
                        current_chunk = []
                        current_len = 0
                    sub_splits = split_text(part, next_seps)
                    final_chunks.extend(sub_splits)
                # If adding this segment exceeds chunk_size, flush the current chunk and backtrack to calculate overlap
                elif current_len + part_len + (len(sep) if current_chunk else 0) > chunk_size:
                    if current_chunk:
                        final_chunks.append(sep.join(current_chunk))
                    
                    # Backtrack to maintain sliding overlap
                    overlap_chunk = []
                    overlap_len = 0
                    for prev_part in reversed(current_chunk):
                        if overlap_len + len(prev_part) + (len(sep) if overlap_chunk else 0) <= chunk_overlap:
                            overlap_chunk.insert(0, prev_part)
                            overlap_len += len(prev_part) + len(sep)
                        else:
                            break
                    
                    current_chunk = overlap_chunk
                    current_chunk.append(part)
                    current_len = sum(len(p) for p in current_chunk) + (len(sep) * (len(current_chunk) - 1))
                else:
                    current_chunk.append(part)
                    current_len += part_len + (len(sep) if len(current_chunk) > 1 else 0)
            
            if current_chunk:
                final_chunks.append(sep.join(current_chunk))
            return final_chunks

        for page in pages_data:
            text = page["text"]
            page_num = page["page_number"]
            
            page_splits = split_text(text, separators)
            for split in page_splits:
                cleaned_split = split.strip()
                if cleaned_split:
                    chunks.append({
                        "chunk_id": f"chk_{doc_hash}_{chunk_id_counter}",
                        "text": cleaned_split,
                        "metadata": {
                            "page_number": page_num
                        }
                    })
                    chunk_id_counter += 1
                    
        return chunks

pdf_service = PDFService()