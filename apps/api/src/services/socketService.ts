import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { getUserFromToken } from "./authService";

let io: Server | null = null;
const userSocketMap = new Map<string, string>();

const allowedOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const initializeSocketServer = (httpServer: HttpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string } | undefined)?.token ?? "";
      if (!token) {
        return next(new Error("Unauthorized"));
      }

      const user = await getUserFromToken(token);
      if (!user) {
        return next(new Error("Unauthorized"));
      }

      socket.data.userId = user.id;
      return next();
    } catch (error) {
      console.warn("[socket] auth error", error);
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    const existingSocketId = userSocketMap.get(userId);
    if (existingSocketId && existingSocketId !== socket.id) {
      const existingSocket = io?.sockets.sockets.get(existingSocketId);
      existingSocket?.disconnect(true);
    }

    userSocketMap.set(userId, socket.id);
    socket.join("location-updates");
    console.info(`[socket] user ${userId} connected`);

    socket.on("join-event", (eventId: number | string) => {
      const parsed = Number(eventId);
      if (!Number.isFinite(parsed)) {
        return;
      }
      socket.join(`event-${parsed}`);
    });

    socket.on("leave-event", (eventId: number | string) => {
      const parsed = Number(eventId);
      if (!Number.isFinite(parsed)) {
        return;
      }
      socket.leave(`event-${parsed}`);
    });

    socket.on("join-event-room", (eventId: number | string) => {
      const parsed = Number(eventId);
      if (!Number.isFinite(parsed)) {
        return;
      }
      socket.join(`event-${parsed}`);
    });

    socket.on("leave-event-room", (eventId: number | string) => {
      const parsed = Number(eventId);
      if (!Number.isFinite(parsed)) {
        return;
      }
      socket.leave(`event-${parsed}`);
    });

    socket.on("disconnect", () => {
      if (userSocketMap.get(userId) === socket.id) {
        userSocketMap.delete(userId);
      }
      socket.leave("location-updates");
      console.info(`[socket] user ${userId} disconnected`);
    });
  });

  return io;
};

export const getSocketServer = () => io;
