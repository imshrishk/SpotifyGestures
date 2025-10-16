import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta as any)?.env?.VITE_SOCKET_URL ?? null;

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!SOCKET_URL) {
      console.warn('Socket URL not set, skipping socket connection.');
      return;
    }
    try {
      const newSocket = io(SOCKET_URL, {
        timeout: 5000,
        forceNew: true,
      });
      
      newSocket.on('connect', () => {
        console.log('Socket connected successfully');
      });
      
      newSocket.on('connect_error', (error) => {
        console.warn('Socket connection failed:', error.message);
      });
      
      setSocket(newSocket);

      return () => {
        try {
          newSocket.close();
        } catch (error) {
          console.warn('Error closing socket:', error);
        }
      };
    } catch (error) {
      console.warn('Failed to initialize socket:', error);
    }
  }, []);

  return socket;
};
