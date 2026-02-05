import type { Server as HttpServer } from "http";
import { randomUUID } from "crypto";
import { Server, type Socket } from "socket.io";
import { getUserFromToken } from "./authService";
import {
  applyPokerAction,
  getPokerStateForUser,
  getPokerStatesForTable,
  leavePokerTable,
  type PokerAction,
  queuePokerPlayer,
  rebuyPoker,
} from "./pokerService";

let io: Server | null = null;
const userSocketMap = new Map<string, string>();

type EventChatMessage = {
  id: string;
  eventId: number;
  message: string;
  createdAt: string;
  sender: { id: string; name: string; handle?: string | null };
};

const MAX_EVENT_CHAT_MESSAGES = 50;
const eventChatHistory = new Map<number, EventChatMessage[]>();

type PokerChatMessage = {
  id: string;
  tableId: string;
  message: string;
  createdAt: string;
  sender: { id: string; name: string; handle?: string | null };
};

const MAX_POKER_CHAT_MESSAGES = 50;
const pokerChatHistory = new Map<string, PokerChatMessage[]>();

const addEventChatMessage = (eventId: number, message: EventChatMessage) => {
  const current = eventChatHistory.get(eventId) ?? [];
  const next = [...current, message].slice(-MAX_EVENT_CHAT_MESSAGES);
  eventChatHistory.set(eventId, next);
  return next;
};

const getEventChatHistory = (eventId: number) =>
  eventChatHistory.get(eventId) ?? [];

const addPokerChatMessage = (tableId: string, message: PokerChatMessage) => {
  const current = pokerChatHistory.get(tableId) ?? [];
  const next = [...current, message].slice(-MAX_POKER_CHAT_MESSAGES);
  pokerChatHistory.set(tableId, next);
  return next;
};

const getPokerChatHistory = (tableId: string) =>
  pokerChatHistory.get(tableId) ?? [];

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

    const emitPokerStatesForTable = async (tableId: string) => {
      const states = await getPokerStatesForTable(tableId);
      states.forEach(({ userId: targetUserId, state }) => {
        const socketId = userSocketMap.get(targetUserId);
        if (socketId) {
          io?.to(socketId).emit("poker:state", { state });
        }
      });
    };

    const emitPokerErrorsForUsers = (userIds: readonly string[], message: string) => {
      userIds.forEach((targetUserId) => {
        const socketId = userSocketMap.get(targetUserId);
        if (socketId) {
          io?.to(socketId).emit("poker:error", { error: message });
        }
      });
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
      if (result.queued) {
        socket.emit("poker:queued", { queuePosition: result.queuePosition });
      }
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
        if (result.tableId) {
          socket.join(pokerRoomForTable(result.tableId));
        }
        if (result.queued) {
          socket.emit("poker:queued", { queuePosition: result.queuePosition });
        }
        const tableIds = result.updatedTableIds?.length
          ? result.updatedTableIds
          : result.tableId
            ? [result.tableId]
            : [];
        await Promise.all(tableIds.map((tableId) => emitPokerStatesForTable(tableId)));
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
          if (!"fold check call bet raise".split(" ").includes(actionType)) {
            throw new Error("Invalid poker action.");
          }
          const normalizedAction = actionType as PokerAction["action"];
          const action: PokerAction =
            normalizedAction === "bet" || normalizedAction === "raise"
              ? { action: normalizedAction, amount: Number(payload?.amount ?? 0) }
              : { action: normalizedAction };
          const result = await applyPokerAction({ userId, action });
          const tableIds = result.updatedTableIds?.length
            ? result.updatedTableIds
            : [result.tableId];
          await Promise.all(tableIds.map((tableId) => emitPokerStatesForTable(tableId)));
          if (result.failedUserIds?.length) {
            emitPokerErrorsForUsers(
              result.failedUserIds,
              "Not enough coins for that buy-in."
            );
          }
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
        await emitPokerStatesForTable(result.tableId);
      } catch (error) {
        emitPokerError(
          error instanceof Error ? error.message : "Unable to rebuy."
        );
      }
    });

    socket.on("poker:chat", async (payload?: { message?: string }) => {
      try {
        const message = payload?.message?.trim() ?? "";
        if (!message) {
          return;
        }
        const result = await getPokerStateForUser(userId);
        if (!result.tableId || !userProfile) {
          return;
        }
        const chatMessage: PokerChatMessage = {
          id: randomUUID(),
          tableId: result.tableId,
          message: message.slice(0, 500),
          createdAt: new Date().toISOString(),
          sender: {
            id: userProfile.id,
            name: userProfile.name,
            handle: userProfile.handle,
          },
        };
        addPokerChatMessage(result.tableId, chatMessage);
        io?.to(pokerRoomForTable(result.tableId)).emit("poker:chat", {
          message: chatMessage,
        });
      } catch (error) {
        emitPokerError(
          error instanceof Error ? error.message : "Unable to send chat."
        );
      }
    });

    socket.on("poker:chat:history", async () => {
      const result = await getPokerStateForUser(userId);
      if (!result.tableId) {
        return;
      }
      socket.emit("poker:chat:history", {
        tableId: result.tableId,
        messages: getPokerChatHistory(result.tableId),
      });
    });

    socket.on("poker:leave", async () => {
      try {
        const result = await leavePokerTable(userId);
        socket.emit("poker:state", { state: null });
        if (result.queued) {
          socket.emit("poker:queued", { queuePosition: result.queuePosition });
        }
        const tableIds = result.updatedTableIds?.length
          ? result.updatedTableIds
          : [];
        await Promise.all(tableIds.map((tableId) => emitPokerStatesForTable(tableId)));
        if (result.failedUserIds?.length) {
          emitPokerErrorsForUsers(
            result.failedUserIds,
            "Not enough coins for that buy-in."
          );
        }
      } catch (error) {
        emitPokerError(
          error instanceof Error ? error.message : "Unable to leave the table."
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

    socket.on(
      "event:chat",
      (payload?: { eventId?: number | string; message?: string }) => {
        const parsedId = Number(payload?.eventId);
        const message = payload?.message?.trim() ?? "";
        if (!Number.isFinite(parsedId) || !message) {
          return;
        }
        if (!userProfile) {
          return;
        }
        const chatMessage: EventChatMessage = {
          id: randomUUID(),
          eventId: parsedId,
          message: message.slice(0, 500),
          createdAt: new Date().toISOString(),
          sender: {
            id: userProfile.id,
            name: userProfile.name,
            handle: userProfile.handle,
          },
        };
        addEventChatMessage(parsedId, chatMessage);
        io?.to(`event-${parsedId}`).emit("event:chat", {
          eventId: parsedId,
          message: chatMessage,
        });
      }
    );

    socket.on(
      "event:chat:history",
      (payload?: { eventId?: number | string }) => {
        const parsedId = Number(payload?.eventId);
        if (!Number.isFinite(parsedId)) {
          return;
        }
        socket.emit("event:chat:history", {
          eventId: parsedId,
          messages: getEventChatHistory(parsedId),
        });
      }
    );

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
