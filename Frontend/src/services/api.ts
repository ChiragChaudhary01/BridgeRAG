import type { APIResponse, DocumentProfile, ChunkDetails } from '../types';

const BASE_URL = 'http://localhost:8000/api/v1';

export async function fetchDocuments(): Promise<DocumentProfile[]> {
  const response = await fetch(`${BASE_URL}/documents`);
  if (!response.ok) {
    throw new Error(`Failed to fetch documents: ${response.statusText}`);
  }
  const result: APIResponse<DocumentProfile[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Failed to fetch documents');
  }
  return result.data;
}

export async function uploadDocument(
  file: File,
  title?: string,
  description?: string
): Promise<DocumentProfile> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) {
    formData.append('title', title);
  }
  if (description) {
    formData.append('description', description);
  }

  const response = await fetch(`${BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
  }

  const result: APIResponse<DocumentProfile> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Upload failed');
  }
  return result.data;
}

export async function fetchChunk(chunkId: string): Promise<ChunkDetails> {
  const response = await fetch(`${BASE_URL}/chunks/${chunkId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch chunk: ${response.statusText}`);
  }
  const result: APIResponse<ChunkDetails> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Failed to fetch chunk details');
  }
  return result.data;
}

export function getDownloadUrl(documentId: string): string {
  return `${BASE_URL}/documents/${documentId}/download`;
}
