import chromadb
from google import genai
from config.config import settings

class VectorStoreManager:
    def __init__(self):
        # Establish persistence path on disk
        self.chroma_client = chromadb.PersistentClient(path="data/chroma")
        # Initialize Gemini Client natively using our configuration values
        self.ai_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        # Fetch or create the specific collection
        self.collection = self.chroma_client.get_or_create_collection(name="document_collection")

    def _generate_embedding(self, text: str) -> list[float]:
        """Generates dense vector embeddings using a Gemini embedding model."""
        response = self.ai_client.models.embed_content(
            model="gemini-embedding-001",
            contents=text
        )
        return response.embeddings[0].values

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

vector_store_manager = VectorStoreManager()