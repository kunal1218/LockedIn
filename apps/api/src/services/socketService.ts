import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { getUserFromToken } from "./authService";
import {
  applyPokerAction,
  getPokerStateForUser,
  queuePokerPlayer,
  rebuyPoker,
} from "./pokerService";

let io: Server | null = null;
const userSocketMap = new Map<string, string>();

const normalizeOrigin = (value: string) => value.replace(/\/$/, "");
const allowedOrigins = (process.env.FRONTEND_URLS ??
  process.env.FRONTEND_URL ??
  "http://localhost:3000")
  .split(",")
  .map((value) => normalizeOrigin(value.trim()))
  .filter(Boolean);
const allowedOriginSet = new Set(allowedOrigins);
const isAllowedOrigin = (origin?: string) => {
  if (!origin) {
    return true;
  }
  const normalized = normalizeOrigin(origin);
  if (allowedOriginSet.has(normalized)) {
    return true;
  }
  if (normalized.endsWith(".vercel.app")) {
    return true;
  }
  if (normalized.startsWith("http://localhost") || normalized.startsWith("http://127.0.0.1")) {
    return true;
  }
  return false;
};

export const initializeSocketServer = (httpServer: HttpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: (
        origin: string | undefined,
        callback: (error: Error | null, allow?: boolean) => void
      ) => {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    },
  });

  io.use(async (socket: Socket, next: (error?: Error) => void) => {
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
      socket.data.userProfile = {
        id: user.id,
        name: user.name,
        handle: user.handle,
      };
      return next();
    } catch (error) {
      console.warn("[socket] auth error", error);
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string | undefined;
    const userProfile = socket.data.userProfile as
      | { id: string; name: string; handle: string }
      | undefined;
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

    const pokerRoomForTable = (tableId: string) => `poker:table:${tableId}`;

    const emitPokerState = (tableId: string, state: unknown) => {
      io?.to(pokerRoomForTable(tableId)).emit("poker:state", { state });
    };

    const emitPokerError = (message: string) => {
      socket.emit("poker:error", { error: message });
    };

    const joinPokerTableRoom = async () => {
      const result = await getPokerStateForUser(userId);
      if (result.tableId) {
        socket.join(pokerRoomForTable(result.tableId));
      }
      socket.emit("poker:state", { state: result.state });
    };

    socket.on("poker:state", async () => {
      try {
        await joinPokerTableRoom();
      } catch (error) {
        emitPokerError(
          error instanceof Error ? error.message : "Unable to load poker table."
        );
      }
    });

    socket.on("poker:queue", async (payload?: { amount?: number }) => {
      try {
        if (!userProfile) {
          throw new Error("Missing user profile");
        }
        const result = await queuePokerPlayer({
          userId,
          name: userProfile.name,
          handle: userProfile.handle,
          amount: payload?.amount,
        });
        socket.join(pokerRoomForTable(result.tableId));
        emitPokerState(result.tableId, result.state);
      } catch (error) {
        emitPokerError(
          error instanceof Error ? error.message : "Unable to join poker table."
        );
      }
    });

    socket.on(
      "poker:action",
      async (payload?: { action?: string; amount?: number }) => {
        try {
          const actionType =
            typeof payload?.action === "string"
              ? payload.action.toLowerCase()
              : "";
          if (!\"fold check call bet raise\".split(\" \").includes(actionType)) {
            throw new Error("Invalid poker action.");
          }
          const action =
            actionType === "bet" || actionType === "raise"
              ? { action: actionType, amount: payload?.amount ?? 0 }
              : { action: actionType };
          const result = await applyPokerAction({ userId, action });
          emitPokerState(result.tableId, result.state);
        } catch (error) {
          emitPokerError(
            error instanceof Error ? error.message : "Unable to act in poker."
          );
        }
      }
    );

    socket.on("poker:rebuy", async (payload?: { amount?: number }) => {
      try {
        const amount =
          typeof payload?.amount === "number"
            ? payload.amount
            : Number(payload?.amount);
        const result = await rebuyPoker({ userId, amount });
        emitPokerState(result.tableId, result.state);
      } catch (error) {
        emitPokerError(
          error instanceof Error ? error.message : "Unable to rebuy."
        );
      }
    });

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
