export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: string | null;
}

export interface DocumentProfile {
  document_id: string;
  title: string;
  description: string;
  filename: string;
  file_size_mb: number;
  total_pages: number;
}

export interface ChunkDetails {
  chunk_id: string;
  text: string;
  metadata: {
    document_id: string;
    title: string;
    description: string;
    filename: string;
    page_number: number;
    file_size_mb: number;
    total_pages: number;
  };
}

export interface Message {
  sender: 'user' | 'assistant';
  text: string;
  sources?: {
    chunk_id: string;
    document_id: string;
    page_number: number;
    filename: string;
    title: string;
  }[];
  isStreaming?: boolean;
}
