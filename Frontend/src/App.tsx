import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import type { DocumentProfile, Message } from './types';
import { fetchDocuments } from './services/api';
import { DocumentHub } from './features/document-hub';
import { ChatArea } from './features/chat-area';
import { ChunkInspector } from './features/chunk-inspector';
import { useChatStream } from './features/chat-area/hooks/useChatStream';

export default function App() {
  const [documents, setDocuments] = useState<DocumentProfile[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentProfile | null>(null);
  const [inspectedChunkId, setInspectedChunkId] = useState<string | null>(null);
  const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>({});
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);

  // Responsive Drawer states
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  const { streamMessage, isStreaming } = useChatStream();

  // Load document registry on mount
  const loadDocuments = async () => {
    setErrorDocs(null);
    try {
      const data = await fetchDocuments();
      setDocuments(data);
      // Auto-select the first document if none is selected
      if (data.length > 0 && !selectedDocument) {
        setSelectedDocument(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load documents:', err);
      setErrorDocs(err.message || 'Failed to sync library documents.');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleSelectDocument = (doc: DocumentProfile) => {
    setSelectedDocument(doc);
    setInspectedChunkId(null); // Reset reference details panel on document switch
    setIsLeftDrawerOpen(false);
    setIsRightDrawerOpen(false);
  };

  const handleUploadSuccess = () => {
    loadDocuments();
  };

  // Open right drawer when a citation chunk is clicked
  const handleCitationClick = (chunkId: string) => {
    setInspectedChunkId(chunkId);
    setIsRightDrawerOpen(true);
  };

  // Retrieve message history for active document
  const activeDocId = selectedDocument?.document_id || '';
  const currentMessages = activeDocId ? chatHistories[activeDocId] || [] : [];

  const handleSendMessage = (text: string) => {
    if (!selectedDocument || !activeDocId) return;

    // 1. Append user message to thread
    const userMsg: Message = { sender: 'user', text };
    const updatedMessages = [...currentMessages, userMsg];

    setChatHistories((prev) => ({
      ...prev,
      [activeDocId]: updatedMessages,
    }));

    // 2. Append empty streaming bot message to thread
    const botStreamingMsg: Message = {
      sender: 'assistant',
      text: '',
      sources: [],
      isStreaming: true,
    };

    setChatHistories((prev) => ({
      ...prev,
      [activeDocId]: [...updatedMessages, botStreamingMsg],
    }));

    // 3. Initiate the streaming conversation query
    streamMessage(
      selectedDocument.title,
      text,
      // Callback for retrieved source chunks metadata list (emitted as 1st line)
      (sources) => {
        setChatHistories((prev) => {
          const thread = prev[activeDocId] || [];
          if (thread.length === 0) return prev;
          const lastMsg = { ...thread[thread.length - 1] };
          lastMsg.sources = sources;
          return {
            ...prev,
            [activeDocId]: [...thread.slice(0, -1), lastMsg],
          };
        });
      },
      // Callback for streaming raw text tokens
      (contentChunk) => {
        setChatHistories((prev) => {
          const thread = prev[activeDocId] || [];
          if (thread.length === 0) return prev;
          const lastMsg = { ...thread[thread.length - 1] };
          lastMsg.text += contentChunk;
          return {
            ...prev,
            [activeDocId]: [...thread.slice(0, -1), lastMsg],
          };
        });
      },
      // Callback for stream processing errors
      (errMessage) => {
        setChatHistories((prev) => {
          const thread = prev[activeDocId] || [];
          if (thread.length === 0) return prev;
          const lastMsg = { ...thread[thread.length - 1] };
          lastMsg.text = `\n[ERROR]: ${errMessage}`;
          lastMsg.isStreaming = false;
          return {
            ...prev,
            [activeDocId]: [...thread.slice(0, -1), lastMsg],
          };
        });
      }
    ).then(() => {
      // Mark active bot message streaming as false when finished
      setChatHistories((prev) => {
        const thread = prev[activeDocId] || [];
        if (thread.length === 0) return prev;
        const lastMsg = { ...thread[thread.length - 1] };
        lastMsg.isStreaming = false;
        return {
          ...prev,
          [activeDocId]: [...thread.slice(0, -1), lastMsg],
        };
      });
    });
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-tr from-slate-50 via-slate-100 to-indigo-50/40 flex flex-col overflow-hidden font-sans select-none antialiased">
      {/* Mobile Drawer Overlay Backdrop */}
      {(isLeftDrawerOpen || (isRightDrawerOpen && inspectedChunkId)) && (
        <div
          onClick={() => {
            setIsLeftDrawerOpen(false);
            setIsRightDrawerOpen(false);
          }}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30 lg:hidden transition-all duration-300 animate-fadeIn"
        />
      )}

      {/* Main Responsive Grid Layout (Edge-to-Edge) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Column 1: Document Hub Sidebar (25% on desktop, slide-over drawer on mobile/tablet) */}
        <aside
          className={`fixed lg:relative inset-y-0 left-0 w-80 lg:w-1/4 h-full border-r border-white/20 flex-shrink-0 bg-white/95 lg:bg-white/15 backdrop-blur-xl lg:backdrop-blur-md z-40 lg:z-auto transform lg:transform-none transition-transform duration-300 ${
            isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {isLoadingDocs ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center animate-pulse">
              <div className="h-2 w-24 bg-slate-200 rounded mb-2"></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Loading Library...</span>
            </div>
          ) : errorDocs ? (
            <div className="p-4 text-center">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
              <p className="text-xs text-rose-600 font-semibold mb-2">{errorDocs}</p>
              <button
                onClick={loadDocuments}
                className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg hover:bg-indigo-100 transition-all"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <DocumentHub
              documents={documents}
              selectedDocument={selectedDocument}
              onSelectDocument={handleSelectDocument}
              onUploadSuccess={handleUploadSuccess}
            />
          )}
        </aside>

        {/* Column 2: Central Chat Thread Area (50% on desktop, 100% on mobile/tablet) */}
        <main className="flex-1 h-full border-r border-white/20 min-w-0">
          <ChatArea
            activeDocument={selectedDocument}
            messages={currentMessages}
            isStreaming={isStreaming}
            onSendMessage={handleSendMessage}
            onCitationClick={handleCitationClick}
            onToggleLeftDrawer={() => setIsLeftDrawerOpen(!isLeftDrawerOpen)}
            onToggleRightDrawer={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
            hasInspectedChunk={!!inspectedChunkId}
          />
        </main>

        {/* Column 3: Chunk Inspector Sidebar Drawer (25% on desktop, slide-over drawer on mobile/tablet) */}
        <aside
          className={`fixed lg:relative inset-y-0 right-0 w-80 lg:w-1/4 h-full bg-white/95 lg:bg-white/15 backdrop-blur-xl lg:backdrop-blur-md flex-shrink-0 z-40 lg:z-auto border-l lg:border-l-0 border-white/20 lg:border-none transform lg:transform-none transition-transform duration-300 ${
            isRightDrawerOpen && inspectedChunkId ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <ChunkInspector
            chunkId={inspectedChunkId}
            onClose={() => {
              setInspectedChunkId(null);
              setIsRightDrawerOpen(false);
            }}
          />
        </aside>
      </div>
    </div>
  );
}
