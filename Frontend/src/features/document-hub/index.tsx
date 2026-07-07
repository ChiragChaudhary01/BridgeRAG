import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, ArrowDownToLine, AlertCircle, Search, Library, Bot } from 'lucide-react';
import type { DocumentProfile } from '../../types';
import { uploadDocument, getDownloadUrl } from '../../services/api';

interface DocumentHubProps {
  documents: DocumentProfile[];
  selectedDocument: DocumentProfile | null;
  onSelectDocument: (doc: DocumentProfile) => void;
  onUploadSuccess: () => void;
}

export function DocumentHub({
  documents,
  selectedDocument,
  onSelectDocument,
  onUploadSuccess,
}: DocumentHubProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Input Validation Rules
  const validateInputs = (): boolean => {
    setValidationError(null);
    
    // Normalize default title extraction logic if title is empty
    let activeTitle = title.trim();
    if (!activeTitle && fileInputRef.current?.files?.[0]) {
      const filename = fileInputRef.current.files[0].name;
      activeTitle = filename.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
    }

    if (!activeTitle) {
      setValidationError('Please select a file or provide a title.');
      return false;
    }

    // Title constraint: 3 to 50 characters, only alphanumeric, spaces, and dashes
    if (activeTitle.length < 4 || activeTitle.length > 49) {
      setValidationError(`Title must be strictly between 3 and 50 characters long. Got length ${activeTitle.length}.`);
      return false;
    }

    const titleRegex = /^[a-zA-Z0-9 -]+$/;
    if (!titleRegex.test(activeTitle)) {
      setValidationError('Title can only contain alphanumeric characters, spaces, and dashes.');
      return false;
    }

    // Description constraint: Optional, max 250 characters
    if (description.length > 250) {
      setValidationError(`Description must not exceed 250 characters. Got length ${description.length}.`);
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !title) {
      // Default title matching filename minus extension, replace underscores
      const defaultTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
      setTitle(defaultTitle);
    }
    setUploadError(null);
    setValidationError(null);
  };

  const executeUpload = async (file: File) => {
    if (!validateInputs()) return;
    
    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(file, title.trim(), description.trim());
      setTitle('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess();
    } catch (err: any) {
      setUploadError(err.message || 'File ingestion failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pdf')) {
        setValidationError('Invalid file format. Only PDF files are supported.');
        return;
      }
      if (!title) {
        const defaultTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
        setTitle(defaultTitle);
      }
      executeUpload(file);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setValidationError('Please select a PDF file first.');
      return;
    }
    executeUpload(file);
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Upload Zone & Form Container */}
      <div className="p-4 border-b border-white/20 bg-white/20 backdrop-blur-md flex-shrink-0">
        {/* Branding header */}
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200/50 pb-3">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
            <Bot className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-sm font-black tracking-tight text-slate-800">BridgeRAG</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Library className="h-5 w-5 text-indigo-600" />
          <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Document Hub</h2>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-3">
          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? 'border-indigo-600 bg-indigo-50/50'
                : 'border-slate-300 hover:border-indigo-500 bg-white/40 hover:bg-white/60'
            }`}
          >
            <input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <UploadCloud className="h-8 w-8 mx-auto text-slate-500 mb-2 transition-transform group-hover:scale-110" />
            <p className="text-xs font-medium text-slate-600">
              {fileInputRef.current?.files?.[0]
                ? fileInputRef.current.files[0].name
                : 'Drag & drop PDF or click to browse'}
            </p>
          </div>

          {/* Form Fields */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Document Title (3-50 chars)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none text-slate-700"
            />
            <textarea
              placeholder="Description (max 250)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none resize-none text-slate-700"
            />
          </div>

          {/* Validation & Ingestion Error Alerts */}
          {validationError && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/50 text-rose-600 text-[10px] flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {uploadError && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200/50 text-rose-600 text-[10px] flex items-center gap-1.5 animate-fadeIn">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isUploading}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold text-white shadow-md transition-all duration-300 ${
              isUploading
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95'
            }`}
          >
            {isUploading ? 'Extracting & Indexing Vectors...' : 'Upload & Process Document'}
          </button>
        </form>

        {/* Ingestion Loader */}
        {isUploading && (
          <div className="mt-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-2 animate-pulse">
            <div className="h-2 w-2 rounded-full bg-indigo-600"></div>
            <span className="text-[10px] font-medium text-indigo-700">Generating dense vector embeddings...</span>
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="p-3 bg-white/10 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200/60 bg-white/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 outline-none text-slate-700"
          />
        </div>
      </div>

      {/* Scrollable Library List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Your Library</h3>
        {filteredDocuments.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No documents found.
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const isSelected = selectedDocument?.document_id === doc.document_id;
            return (
              <div
                key={doc.document_id}
                onClick={() => onSelectDocument(doc)}
                className={`group border rounded-xl p-3 cursor-pointer relative transition-all duration-300 ${
                  isSelected
                    ? 'border-indigo-600 bg-white/90 shadow-md ring-1 ring-indigo-500'
                    : 'border-slate-200/50 hover:border-indigo-400 bg-white/50 hover:bg-white/70 shadow-sm hover:shadow'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                    <h4 className="text-xs font-bold text-slate-700 truncate pr-6">{doc.title}</h4>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-indigo-600 flex-shrink-0 animate-fadeIn" />
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{doc.description || 'No description provided.'}</p>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex gap-1">
                    <span className="bg-slate-100/80 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-medium">{doc.file_size_mb} MB</span>
                    <span className="bg-slate-100/80 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-medium">{doc.total_pages} Pages</span>
                  </div>
                  <a
                    href={getDownloadUrl(doc.document_id)}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center"
                    title="Download original PDF"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
