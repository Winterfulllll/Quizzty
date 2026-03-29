import { io, type Socket } from 'socket.io-client';

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(
  /\/api\/?$/,
  '',
);

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${WS_URL}/session`, {
      transports: ['websocket'],
      autoConnect: false,
      withCredentials: true,
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
