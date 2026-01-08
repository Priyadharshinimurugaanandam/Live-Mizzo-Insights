import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: 'surgery_update' | 'surgery_complete';
  surgery: any;
  is_live?: boolean;
}

export function useWebSocket(url: string, onMessage: (data: WebSocketMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
      };

      ws.current.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (e) {
          console.error('WebSocket message error:', e);
        }
      };

      ws.current.onclose = () => {
        console.log('🔌 WebSocket disconnected, reconnecting...');
        setIsConnected(false);
        setTimeout(connect, 3000);
      };

      ws.current.onerror = (error: Event) => {
        console.error('WebSocket error:', error);
      };
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [url, onMessage]);

  return { isConnected };
}