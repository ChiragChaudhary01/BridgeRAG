import { useState, useEffect } from 'react';
import { SearchCode, Download, X, AlertCircle, Loader, FileText } from 'lucide-react';
import type { ChunkDetails } from '../../types';
import { fetchChunk, getDownloadUrl } from '../../services/api';

interface ChunkInspectorProps {
  chunkId: string | null;
  onClose: () => void;
}

export function ChunkInspector({ chunkId, onClose }: ChunkInspectorProps) {
  const [chunk, setChunk] = useState<ChunkDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chunkId) {
      setChunk(null);
      setError(null);
      return;
    }

    const loadChunkDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const details = await fetchChunk(chunkId);
        setChunk(details);
      } catch (err: any) {
        console.error('Failed to load chunk details:', err);
        setError(err.message || 'Failed to retrieve chunk context.');
      } finally {
        setIsLoading(false);
      }
    };

    loadChunkDetails();
  }, [chunkId]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Inspector Header */}
      <header className="p-4 border-b border-white/20 bg-white/40 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <SearchCode className="h-5 w-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800">Chunk Inspector</h2>
        </div>
        {chunkId && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* Content panel */}
      <div className="flex-1 overflow-y-auto relative p-4 flex flex-col">
        {/* Empty State */}
        {!chunkId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="bg-slate-100 rounded-full p-4 mb-3 border border-slate-200/50 shadow-inner">
              <SearchCode className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xs font-bold text-slate-700 mb-1">No Chunk Selected</h3>
            <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed">
              Click on any active citation badge in the chat thread to view the raw semantic source segment.
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white/50 backdrop-blur-sm z-20">
            <Loader className="h-8 w-8 text-indigo-600 animate-spin mb-2" />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest animate-pulse">
              Retrieving context...
            </span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="p-3 bg-rose-50 border border-rose-200/50 rounded-xl text-rose-600 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-rose-800">Lookup Error</h4>
              <p className="text-[10px] mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Active Context Details */}
        {chunk && !isLoading && !error && (
          <div className="flex-1 flex flex-col h-full fade-in">
            {/* Header info */}
            <div className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[9px] font-bold shadow-sm">
                  PAGE {chunk.metadata.page_number}
                </span>
                <span className="text-[9px] font-mono text-slate-400 select-all bg-slate-100 px-1.5 py-0.5 rounded">
                  ID: {chunk.chunk_id}
                </span>
              </div>
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span className="truncate" title={chunk.metadata.title}>{chunk.metadata.title}</span>
              </h3>
            </div>

            {/* Document Content Display Box */}
            <div className="flex-1 bg-white/70 border border-slate-200/60 rounded-xl p-3.5 mb-4 overflow-y-auto text-xs text-slate-600 leading-relaxed font-mono whitespace-pre-wrap shadow-inner select-text">
              {chunk.text}
            </div>

            {/* Download Action shortcut */}
            <a
              href={getDownloadUrl(chunk.metadata.document_id)}
              download
              className="w-full py-2.5 px-4 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              Download Source PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
