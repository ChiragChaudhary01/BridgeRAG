import { useState } from 'react';

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);

  const streamMessage = async (
    title: string,
    message: string,
    onSources: (sources: any[]) => void,
    onContent: (content: string) => void,
    onError: (error: string) => void
  ) => {
    setIsStreaming(true);
    try {
      const response = await fetch('http://localhost:8000/api/v1/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, message }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server error: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let isFirstLineProcessed = false;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decoded = decoder.decode(value, { stream: true });
        
        if (!isFirstLineProcessed) {
          buffer += decoded;
          const newlineIndex = buffer.indexOf('\n');
          if (newlineIndex !== -1) {
            const firstLine = buffer.substring(0, newlineIndex);
            const remaining = buffer.substring(newlineIndex + 1);
            
            try {
              const sources = JSON.parse(firstLine.trim());
              onSources(sources);
            } catch (err) {
              console.error('Failed to parse sources JSON:', err, 'Line was:', firstLine);
              // If JSON parsing fails, treat it as general content
              onContent(firstLine);
            }
            
            isFirstLineProcessed = true;
            if (remaining) {
              onContent(remaining);
            }
            buffer = '';
          }
        } else {
          onContent(decoded);
        }
      }

      // Flush remaining buffer if first line was never resolved (e.g. no newline received)
      if (!isFirstLineProcessed && buffer.trim()) {
        try {
          const sources = JSON.parse(buffer.trim());
          onSources(sources);
        } catch (err) {
          onContent(buffer);
        }
      }

    } catch (error: any) {
      console.error('Chat stream failed:', error);
      onError(error.message || 'Stream processing error');
    } finally {
      setIsStreaming(false);
    }
  };

  return { streamMessage, isStreaming };
}
