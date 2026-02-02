import { io, type Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4001";

const readToken = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const raw = window.localStorage.getItem("lockedin_auth");
  if (!raw) {
    return "";
  }
  try {
    const parsed = JSON.parse(raw) as { token?: string };
    return parsed.token ?? "";
  } catch {
    return "";
  }
};

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  auth: { token: readToken() },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

export const connectSocket = (token?: string | null) => {
  socket.auth = { token: token ?? readToken() };
  if (!socket.connected) {
    socket.connect();
    return;
  }

  if (token) {
    socket.disconnect();
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export const onFriendLocationUpdate = (
  callback: (payload: {
    userId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
  }) => void
) => {
  socket.on("friend-location-update", callback);
  return () => socket.off("friend-location-update", callback);
};
