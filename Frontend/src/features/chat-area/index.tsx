import React, { useState, useRef, useEffect } from 'react';
import { Send, Cpu, User, FileText, Sparkles, Loader, Menu, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { DocumentProfile, Message } from '../../types';

interface ChatAreaProps {
  activeDocument: DocumentProfile | null;
  messages: Message[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onCitationClick: (chunkId: string) => void;
  onToggleLeftDrawer: () => void;
  onToggleRightDrawer: () => void;
  hasInspectedChunk: boolean;
}

export function ChatArea({
  activeDocument,
  messages,
  isStreaming,
  onSendMessage,
  onCitationClick,
  onToggleLeftDrawer,
  onToggleRightDrawer,
  hasInspectedChunk,
}: ChatAreaProps) {
  const [input, setInput] = useState('');
  const [thinkToggled, setThinkToggled] = useState<Record<number, boolean>>({});
  const chatThreadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages list updates or active streaming is happening
  useEffect(() => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Handle auto-resizing of text area on input
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming || !activeDocument) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Render inline styles like **bold** headings and [Page X] badges
  const parseInlineStyle = (text: string, sources: any[] | undefined) => {
    const boldAndCitationRegex = /(\*\*.*?\*\*|\[Page \d+\])/g;
    const parts = text.split(boldAndCitationRegex);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const cleanText = part.slice(2, -2);
        const isHeading = cleanText === "Analyze User Input:" || cleanText.endsWith(':');
        
        return (
          <strong
            key={index}
            className={
              isHeading
                ? "text-xs font-black text-slate-800 block mt-3 mb-1"
                : "font-bold text-slate-900"
            }
          >
            {cleanText}
          </strong>
        );
      }
      if (part.match(/^\[Page \d+\]$/)) {
        const pageNum = parseInt(part.replace(/\D/g, ''), 10);
        const matchingSource = sources?.find((src) => src.page_number === pageNum);
        
        return (
          <button
            key={index}
            onClick={() => matchingSource && onCitationClick(matchingSource.chunk_id)}
            disabled={!matchingSource}
            className={`mx-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all duration-200 ${
              matchingSource
                ? 'bg-slate-100 hover:bg-slate-205 text-slate-500 border-slate-200 cursor-pointer active:scale-95'
                : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-50'
            }`}
            title={matchingSource ? 'Click to inspect source chunk context' : 'Reference details unavailable'}
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  // Render reasoning thinking blocks and main Markdown contents line by line
  const renderMessageContent = (text: string, sources: any[] | undefined, msgIndex: number) => {
    const thinkStartIndex = text.indexOf('<think>');
    const thinkEndIndex = text.indexOf('</think>');
    
    let thinkText = "";
    let mainText = text;
    
    if (thinkStartIndex !== -1) {
      if (thinkEndIndex !== -1) {
        thinkText = text.substring(thinkStartIndex + 7, thinkEndIndex).trim();
        mainText = (text.substring(0, thinkStartIndex) + text.substring(thinkEndIndex + 8)).trim();
      } else {
        thinkText = text.substring(thinkStartIndex + 7).trim();
        mainText = text.substring(0, thinkStartIndex).trim();
      }
    }
    
    const isThinkOpen = thinkToggled[msgIndex] !== undefined ? thinkToggled[msgIndex] : true;
    const lines = mainText.split('\n');
    
    return (
      <div className="space-y-2 text-xs leading-relaxed">
        {/* Collapsible Thinking Process Block */}
        {thinkText && (
          <div className="mb-3 border border-slate-200/50 bg-slate-50/50 rounded-xl p-2.5 animate-fadeIn">
            <button
              onClick={() => setThinkToggled(prev => ({ ...prev, [msgIndex]: !isThinkOpen }))}
              className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              {isThinkOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span>Thinking Process</span>
            </button>
            {isThinkOpen && (
              <div className="border-l-2 border-slate-300 pl-3 text-slate-400 font-mono text-[9px] whitespace-pre-wrap mt-2 leading-relaxed">
                {thinkText}
              </div>
            )}
          </div>
        )}
        
        {/* Message main text */}
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={lIdx} className="h-1.5" />;
          
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const listText = trimmed.substring(2);
            return (
              <ul key={lIdx} className="list-disc pl-4 mt-0.5 space-y-0.5">
                <li className="text-slate-600">{parseInlineStyle(listText, sources)}</li>
              </ul>
            );
          }
          
          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            const listText = numMatch[2];
            return (
              <ol key={lIdx} className="list-decimal pl-4 mt-0.5 space-y-0.5">
                <li className="text-slate-600">{parseInlineStyle(listText, sources)}</li>
              </ol>
            );
          }
          
          return (
            <p key={lIdx} className="text-slate-700">
              {parseInlineStyle(line, sources)}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white/90 shadow-[0_0_45px_rgba(0,0,0,0.03)] border-x border-slate-200/40">
      {/* Chat Area Header */}
      <header className="p-4 border-b border-white/20 bg-white/40 flex items-center justify-between flex-shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2 truncate">
          {/* Mobile Library Toggle */}
          <button
            onClick={onToggleLeftDrawer}
            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 lg:hidden mr-1 transition-all active:scale-95"
            title="Toggle Library Hub"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <FileText className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div className="truncate">
            <h2 className="text-xs font-bold text-slate-800 truncate">
              {activeDocument ? activeDocument.title : 'Select a document to begin'}
            </h2>
            {activeDocument && (
              <div className="flex items-center gap-1 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-medium text-slate-500">Context Synchronized</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Inspector Toggle */}
        <div className="flex items-center">
          <button
            onClick={onToggleRightDrawer}
            disabled={!hasInspectedChunk}
            className={`p-1.5 rounded-lg lg:hidden transition-all active:scale-95 ${
              hasInspectedChunk
                ? 'text-indigo-600 hover:bg-indigo-50 cursor-pointer'
                : 'text-slate-300 cursor-not-allowed opacity-50'
            }`}
            title="Inspect Selected Reference Chunk"
          >
            <Info className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Message Thread Scroll View */}
      <div
        ref={chatThreadRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <Sparkles className="h-12 w-12 text-slate-300 mb-2 animate-bounce" />
            <h3 className="text-sm font-bold text-slate-600 mb-1">
              {activeDocument ? 'Ask anything about this document' : 'No document selected'}
            </h3>
            <p className="text-xs max-w-sm">
              {activeDocument
                ? 'Type your query below. The assistant will retrieve semantic chunks from this PDF and generate answers with page-level citations.'
                : 'Select a PDF from your library hub on the left to start a citation-based context conversation.'}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={index}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn`}
              >
                <div
                  className={`flex gap-2 max-w-[85%] ${
                    isUser ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white'
                        : 'bg-white border border-slate-200 text-indigo-600'
                    }`}
                  >
                    {isUser ? <User className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                  </div>

                  {/* Bubble content */}
                  <div
                    className={`p-3 rounded-2xl shadow-sm border ${
                      isUser
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-700/10 rounded-tr-none'
                        : 'bg-white/80 border-slate-200/50 text-slate-700 rounded-tl-none'
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1 mb-1.5 text-indigo-600">
                        <span className="text-[8px] font-extrabold uppercase tracking-widest">
                          {msg.isStreaming ? 'BridgeRAG (Generating...)' : 'BridgeRAG Assistant'}
                        </span>
                        {msg.isStreaming && <Loader className="h-3 w-3 animate-spin" />}
                      </div>
                    )}
                    <div className="text-xs leading-relaxed">
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        renderMessageContent(msg.text, msg.sources, index)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Form Box */}
      <div className="p-4 border-t border-white/20 bg-white/40 flex-shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className={`flex items-end gap-2 bg-white/70 border rounded-xl p-2 transition-all duration-300 ${
          activeDocument
            ? 'border-slate-200/60 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20'
            : 'border-slate-200 bg-slate-100/50 cursor-not-allowed'
        }`}>
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={!activeDocument || isStreaming}
            placeholder={
              activeDocument
                ? "Ask about this document..."
                : "Select a document to ask questions..."
            }
            className="w-full text-xs bg-transparent border-none focus:outline-none focus:ring-0 text-slate-700 resize-none py-1.5 px-2 outline-none max-h-24 leading-relaxed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming || !activeDocument}
            className={`p-2 rounded-lg transition-all duration-300 flex-shrink-0 shadow-md ${
              !input.trim() || isStreaming || !activeDocument
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 active:scale-95'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-center mt-2 text-[8px] font-medium text-slate-400 uppercase tracking-widest opacity-80">
          AI models can make mistakes. Please verify inline citations.
        </p>
      </div>
    </div>
  );
}
