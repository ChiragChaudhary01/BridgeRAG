import json
from typing import AsyncGenerator
from google import genai
from google.genai import types
from config.config import settings
from vectorstore.chroma_store import vector_store_manager

class AIService:
    def __init__(self):
        # Native google-genai Client using Google API Key
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    async def stream_chat_response(self, title: str, message: str) -> AsyncGenerator[str, None]:
        """
        Retrieves top context chunks filtered by title from ChromaDB and streams
        an answer from Gemini-2.5-flash with inline page citations. If Gemini APIs are
        unavailable or unauthenticated, it gracefully falls back to local embeddings and
        a local rule-based context-generation stream.
        """
        # 1. Generate query embedding using text-embedding-004, fallback if Gemini fails
        query_vector = None
        try:
            embed_resp = await self.client.aio.models.embed_content(
                model="text-embedding-004",
                contents=message
            )
            query_vector = embed_resp.embeddings[0].values
            print("[INFO] Successfully generated query embedding using text-embedding-004")
        except Exception as e:
            print(f"[WARNING] Gemini embedding generation failed: {e}. Falling back to deterministic local embedding.")
            # Match the local fallback embedding used in vector_store_manager
            query_vector = vector_store_manager._create_fallback_embedding(message)

        # 2. Query ChromaDB for top 4 chunks, strictly filtered by document title
        try:
            results = vector_store_manager.collection.query(
                query_embeddings=[query_vector],
                n_results=4,
                where={"title": title}
            )
        except Exception as e:
            print(f"[ERROR] ChromaDB query failed: {e}")
            raise Exception(f"Failed to query document vector store: {str(e)}")

        ids = results.get("ids", [[]])[0] if results else []
        docs = results.get("documents", [[]])[0] if results else []
        metadatas = results.get("metadatas", [[]])[0] if results else []

        # 3. Yield the source chunks metadata list as the very first chunk
        source_chunks = []
        for chunk_id, meta in zip(ids, metadatas):
            source_chunks.append({
                "chunk_id": chunk_id,
                "document_id": meta.get("document_id"),
                "page_number": meta.get("page_number"),
                "filename": meta.get("filename"),
                "title": meta.get("title")
            })

        yield json.dumps(source_chunks) + "\n"

        # 4. Construct context and prompts
        context_str = ""
        for i, (doc, meta) in enumerate(zip(docs, metadatas)):
            page_num = meta.get("page_number", "Unknown")
            context_str += f"--- Chunk {i+1} (Page {page_num}) ---\n{doc}\n\n"

        system_instruction = (
            "You are a helpful AI assistant. Your primary task is to answer user questions based ONLY on the provided context.\n"
            "Follow these rules strictly:\n"
            "1. Answer the question using ONLY the provided context blocks. Do not make assumptions, extrapolate, or use external knowledge.\n"
            "2. If the answer cannot be found or inferred from the provided context blocks, answer exactly: "
            "'I cannot answer this question as the information is not present in the document.'\n"
            "3. You MUST provide inline page citations for any facts or details you mention from the context. "
            "Use the format [Page X], where X is the exact page number indicated in the context headers (e.g., 'Page 3' -> [Page 3]). "
            "Do not cite a page if it is not present in the context chunk."
        )

        prompt = (
            f"Context from the document '{title}':\n\n{context_str}\n"
            f"User Question: {message}\n\n"
            f"Please answer the user question strictly based on the provided context."
        )

        # 5. Initiate asynchronous content streaming using Gemini 2.5 Flash with fallback
        try:
            response_stream = self.client.aio.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                )
            )

            async for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            print(f"[WARNING] Gemini generation stream failed: {e}. Executing local fallback response builder.")
            
            # Simulated text generation fallback using the retrieved context to keep system operational
            if docs:
                yield "Here is the information retrieved from the document:\n"
                for i, (doc, meta) in enumerate(zip(docs, metadatas)):
                    page_num = meta.get("page_number", "Unknown")
                    # Try to extract the first full sentence of the context block for a concise snippet
                    sentences = [s.strip() for s in doc.split('.') if s.strip()]
                    snippet = sentences[0] if sentences else doc[:150]
                    yield f"- {snippet}. [Page {page_num}]\n"
            else:
                yield "I cannot answer this question as the information is not present in the document."

ai_service = AIService()
