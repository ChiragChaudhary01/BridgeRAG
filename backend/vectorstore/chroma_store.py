import hashlib
import chromadb
from typing import Optional
from google import genai
from config.config import settings


class VectorStoreManager:
    def __init__(self):
        self.chroma_client = chromadb.PersistentClient(path="data/chroma")
        self.ai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        self.collection = self.chroma_client.get_or_create_collection(
            name="document_collection",
            metadata={"hnsw:space": "cosine"},
        )

    def _create_fallback_embedding(self, text: str) -> list[float]:
        """Create a deterministic local embedding vector when the Gemini API is unavailable."""
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        values = []
        for byte in digest:
            values.append((byte / 255.0) * 2 - 1)

        while len(values) < 3072:
            values.extend(values[:3072 - len(values)])

        return values[:3072]

    def _generate_embedding(self, text: str) -> list[float]:
        """Generate dense vector embeddings using Gemini when available, else use a local fallback."""
        try:
            response = self.ai_client.models.embed_content(
                model="gemini-embedding-001",
                contents=text
            )
            return response.embeddings[0].values
        except Exception:
            return self._create_fallback_embedding(text)

    def add_documents(self, chunks: list[dict]):
        """Generates vectors for all document pieces and persists them in ChromaDB."""
        ids = []
        embeddings = []
        documents = []
        metadatas = []

        for item in chunks:
            vector = self._generate_embedding(item["text"])
            
            ids.append(item["chunk_id"])
            embeddings.append(vector)
            documents.append(item["text"])
            metadatas.append(item["metadata"])

        # Batch write elements into local Chroma storage unit
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

    def title_exists(self, title: str) -> bool:
        """Check if a document with the given title already exists in the collection."""
        results = self.collection.get(
            where={"title": title},
            limit=1,
            include=["metadatas"]
        )
        return results is not None and len(results.get("ids", [])) > 0

    def get_all_documents(self) -> list[dict]:
        """Retrieves unique document metadata profiles from the collection."""
        results = self.collection.get(include=["metadatas"])
        metadatas = results.get("metadatas", [])
        
        unique_docs = {}
        for meta in metadatas:
            if not meta or "title" not in meta:
                continue
            title = meta["title"]
            if title not in unique_docs:
                unique_docs[title] = {
                    "document_id": meta.get("document_id", ""),
                    "title": title,
                    "description": meta.get("description", ""),
                    "filename": meta.get("filename", ""),
                    "file_size_mb": meta.get("file_size_mb", 0.0),
                    "total_pages": meta.get("total_pages", 0)
                }
        return list(unique_docs.values())

    def get_chunk_by_id(self, chunk_id: str) -> Optional[dict]:
        """Retrieves full text and metadata for a specific chunk ID."""
        result = self.collection.get(ids=[chunk_id], include=["documents", "metadatas"])
        if result and result.get("ids"):
            return {
                "chunk_id": chunk_id,
                "text": result["documents"][0],
                "metadata": result["metadatas"][0]
            }
        return None

    def get_document_metadata_by_id(self, document_id: str) -> Optional[dict]:
        """Retrieves file metadata associated with a given unique document ID."""
        result = self.collection.get(
            where={"document_id": document_id},
            limit=1,
            include=["metadatas"]
        )
        if result and result.get("metadatas") and len(result["metadatas"]) > 0:
            return result["metadatas"][0]
        return None


vector_store_manager = VectorStoreManager()