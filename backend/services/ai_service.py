import os
import json
from typing import AsyncGenerator
from google import genai
from google.genai import types
from groq import AsyncGroq
from config.config import settings
from vectorstore.chroma_store import vector_store_manager

class AIService:
    def __init__(self):
        # Native google-genai Client using Google API Key
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        
        # Async Groq Client using Groq API Key
        groq_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY") or "DUMMY_KEY"
        self.groq_client = AsyncGroq(api_key=groq_key)

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

        # 2. Query ChromaDB for top 10 candidates, strictly filtered by document title, including embeddings
        try:
            results = vector_store_manager.collection.query(
                query_embeddings=[query_vector],
                n_results=10,
                where={"title": title},
                include=["documents", "metadatas", "embeddings"]
            )
        except Exception as e:
            print(f"[ERROR] ChromaDB query failed: {e}")
            raise Exception(f"Failed to query document vector store: {str(e)}")

        cand_ids = results.get("ids", [[]])[0] if results else []
        cand_docs = results.get("documents", [[]])[0] if results else []
        cand_metadatas = results.get("metadatas", [[]])[0] if results else []
        cand_embeddings = results.get("embeddings", [[]])[0] if results else []

        # 3. Perform Maximal Marginal Relevance (MMR) selection to choose top 4 diverse chunks
        selected_indices = self.maximal_marginal_relevance(
            query_embedding=query_vector,
            chunk_embeddings=cand_embeddings,
            n_results=min(4, len(cand_ids))
        )

        ids = [cand_ids[idx] for idx in selected_indices]
        docs = [cand_docs[idx] for idx in selected_indices]
        metadatas = [cand_metadatas[idx] for idx in selected_indices]

        # 3.5. Yield the source chunks metadata list as the very first chunk
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
            "You are an AI study assistant that helps users learn from uploaded PDFs.\n\n"
            "Rules:\n\n"
            "1. Treat a message as casual conversation ONLY if it is like one of these:\n"
            "   - greeting: 'hi', 'hello', 'hey', 'good morning', 'good evening', 'hiii', 'whatsapp'\n"
            "   - thanks: 'thank you', 'thanks'\n"
            "   - goodbye: 'bye', 'goodbye'\n"
            "   - small talk: 'how are you'\n\n"
            "2. Do NOT treat subject-related phrases as greetings or casual conversation.\n"
            "   Examples that are NOT greetings:\n"
            "   - 'love machine learning'\n"
            "   - 'love to math'\n"
            "   - 'I like Python'\n"
            "   - 'tell me about AI'\n"
            "   - 'machine learning'\n"
            "   - 'math'\n\n"
            "3. If the message is casual conversation, respond naturally and briefly without using context.\n\n"
            "4. For all other messages, answer ONLY using the provided context.\n\n"
            "5. If the context contains enough information:\n"
            "   - Give a clear, beginner-friendly explanation.\n"
            "   - Combine information from all relevant context blocks.\n"
            "   - Ignore context blocks that are not directly relevant.\n\n"
            "6. If the answer cannot be found in the provided context, respond exactly with:\n"
            "   'I couldn't find relevant content in the uploaded PDFs.'\n\n"
            "7. Do not use outside knowledge.\n"
            "8. Do not make up information.\n"
            "9. Do not mention the context or retrieval process.\n"
            "10. Do not include a 'Sources' section.\n"
            "11. Format the answer in Markdown.\n"
            "12. You MUST provide inline page citations for any facts or details you mention from the context. "
            "Use the format [Page X], where X is the exact page number indicated in the context headers (e.g., 'Page 3' -> [Page 3]). "
            "Do not cite a page if it is not present in the context chunk.\n"
            "13. Keep your thinking process (inside <think> tags) extremely brief, concise, and focused. "
            "Limit your thoughts to 2-3 short sentences maximum, so that more output tokens remain for the actual comprehensive response."
        )

        prompt = (
            f"Context:\n{context_str}\n\n"
            f"Question:\n{message}\n"
        )

        # 5. Initiate asynchronous content completions streaming using Groq (qwen/qwen3.6-27b)
        try:
            chat_completion = await self.groq_client.chat.completions.create(
                model="qwen/qwen3.6-27b",
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=4096,
                stream=True,
            )

            async for chunk in chat_completion:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            print(f"[WARNING] Groq generation stream failed: {e}. Executing local fallback response builder.")
            
            # Robust local fallback responder for greetings and offline modes
            normalized_msg = message.strip().lower().rstrip("?!. ")
            greetings = {"hello", "hi", "hiii", "hey", "whatsapp", "yo", "hello there", "hi there"}
            if normalized_msg in greetings or any(g in normalized_msg for g in ["hello", "hiii", "whatsapp"]):
                yield "Hello, I am assistant for you, how can I help you?"
                return

            # Check if this is a general document query
            if docs:
                # Select the first one or two sentences from each of the best chunks
                unified_sentences = []
                for doc in docs:
                    sentences = [s.strip() for s in doc.split('.') if s.strip()]
                    if sentences:
                        unified_sentences.append(sentences[0])
                
                # Combine sentences into a fluid conversation paragraph
                joined_response = ". ".join(unified_sentences) + "."
                
                # Include page numbers naturally
                yield (
                    f"Based on the uploaded documents, {joined_response} "
                    f"This information was retrieved from [Page {metadatas[0].get('page_number', '1')}]."
                )
            else:
                yield "I couldn't find relevant content in the uploaded PDFs."

    def maximal_marginal_relevance(
        self,
        query_embedding: list,
        chunk_embeddings: list,
        n_results: int = 4,
        lambda_mult: float = 0.5
    ) -> list[int]:
        """
        Performs MMR selection on chunk embeddings to balance relevance and diversity.
        Returns indices of selected chunks.
        """
        if not chunk_embeddings or len(chunk_embeddings) == 0:
            return []
        
        import numpy as np

        query_emb = np.array(query_embedding)
        chunk_embs = np.array(chunk_embeddings)
        
        # Calculate norm of query
        q_norm = np.linalg.norm(query_emb)
        if q_norm == 0:
            q_norm = 1.0
        query_emb_norm = query_emb / q_norm
        
        # Calculate norms of chunk candidates
        chunk_norms = np.linalg.norm(chunk_embs, axis=1, keepdims=True)
        chunk_norms[chunk_norms == 0] = 1.0
        chunk_embs_norm = chunk_embs / chunk_norms
        
        # Calculate similarities to query
        sim_to_query = np.dot(chunk_embs_norm, query_emb_norm)
        
        selected_indices = []
        unselected_indices = list(range(len(chunk_embeddings)))
        
        # Add the first candidate
        first_idx = int(np.argmax(sim_to_query))
        selected_indices.append(first_idx)
        unselected_indices.remove(first_idx)
        
        while len(selected_indices) < n_results and len(unselected_indices) > 0:
            scores = []
            for idx in unselected_indices:
                sim_q = sim_to_query[idx]
                
                # Cosine similarities to already selected chunks
                sim_selected = [np.dot(chunk_embs_norm[idx], chunk_embs_norm[sel]) for sel in selected_indices]
                max_sim_selected = max(sim_selected) if sim_selected else 0.0
                
                # MMR formula score
                score = lambda_mult * sim_q - (1.0 - lambda_mult) * max_sim_selected
                scores.append((score, idx))
                
            best_idx = max(scores, key=lambda x: x[0])[1]
            selected_indices.append(best_idx)
            unselected_indices.remove(best_idx)
            
        return selected_indices

ai_service = AIService()
