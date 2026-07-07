# BridgeRAG Document AI Assistant 🚀

A premium, single-page full-stack RAG application built with FastAPI and React (Vite + TypeScript) utilizing local ChromaDB vector indexing and native Google Gemini streaming AI models.

---

## ✨ Features Breakdown

* 🪟 **Multi-Panel Glassy Workspace**: An ultra-modern responsive UI crafted with Tailwind CSS v4, supporting a three-column layout on desktop screens and slide-over drawers on mobile viewports.
* 📄 **Dynamic PDF Chunking & Tracking**: Page-by-page document ingestion using a custom **Recursive Character Splitter** to maintain sentence structure, word boundaries, and page numbers.
* 🔒 **Document-Isolated Chat Loops**: Grounded conversational loops restricted to the context of individual selected files to prevent cross-document confusion.
* 🌊 **Token-by-Token Streaming**: Direct asynchronous server-sent event (SSE) streaming for real-time text delivery.
* 🏷️ **Interactive Inline Citations**: Clickable page citation badges (e.g., `[Page X]`) rendered inside messages to seamlessly inspect source contexts.
* 🔍 **Chunk Verification Inspector**: A dedicated viewer panel displaying complete raw context chunks, document IDs, titles, and download options.

---

## 🔑 Obtaining Your API Keys

To run the application, you will need to provision API credentials for the embedding and reasoning engines:

### 1. Google Gemini API Key (`GOOGLE_API_KEY`)
* used to run the `text-embedding-004` model to index documents and query the vector database.
* Navigate to the **[Google AI Studio Console](https://aistudio.google.com/)**.
* Log in with your Google account, click **"Get API key"**, and select **"Create API key"**.
* Copy the key string securely.

### 2. Groq API Key (`GROQ_API_KEY`)
* Used to stream text responses from the **Qwen-3.6-27b** reasoning model.
* Navigate to the **[Groq Console API Keys](https://console.groq.com/keys)** dashboard.
* Click **"Create API Key"**, enter a description name, and click **"Generate"**.
* Copy the secret key string immediately as it will not be shown again.

---

## ⚙️ Environment Configuration

Create a file named `.env` in the `backend/` directory of the project and populate it with your API keys:

```env
# backend/.env
GOOGLE_API_KEY=AIzaSyYourActualGeminiKeyHere
GROQ_API_KEY=gsk_YourActualGroqKeyHere
PROJECT_NAME="BridgeRAG Document AI Assistant"
```

> [!WARNING]
> Always ensure that the `.env` file is added to your local `.gitignore` configuration so your private model credentials are never exposed or pushed to public repositories.

---

## ⚡ Quick Start / Installation Guide

Follow these commands to install dependencies and run the servers locally.

### 🐍 Backend Setup

1. Navigate into the backend root directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```

3. Activate the virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   * **macOS / Linux**:
     ```bash
     source .venv/bin/activate
     ```

4. Install the backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Run the FastAPI server:
   ```bash
   python main.py
   ```

---

### ⚛️ Frontend Setup

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd Frontend
   ```

2. Install node packages:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

Open your browser to `http://localhost:5173` to explore the workspace!

---

## 🔌 Core API Reference Summary

Below is a summary of the core backend endpoints used by the React workspace:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/upload` | Ingest/Upload Document |
| `GET` | `/api/v1/documents` | List Unique Document Profiles |
| `POST` | `/api/v1/chat/stream` | Streaming Chat Session (RAG Query) |
| `GET` | `/api/v1/chunks/{chunk_id}` | Fetch Chunk Reference Details |
