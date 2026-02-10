import { randomUUID } from "crypto";
import { db } from "../db";
import { ensureUsersTable } from "./authService";
import { ensureListingsTable } from "./marketplaceService";
import {
  createMarketplaceMessageNotification,
  markMarketplaceMessageNotificationsRead,
} from "./notificationService";
import type { ListingCategory, ListingCondition, ListingStatus } from "./marketplaceService";

export type MarketplaceUser = {
  id: string;
  name: string;
  handle: string;
};

export type MarketplaceListingSummary = {
  id: string;
  title: string;
  price: number;
  images: string[];
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
};

export type MarketplaceMessage = {
  id: string;
  content: string;
  createdAt: string;
  sender: MarketplaceUser;
  read: boolean;
};

export type MarketplaceConversation = {
  id: string;
  listing: MarketplaceListingSummary;
  buyer: MarketplaceUser;
  seller: MarketplaceUser;
  otherUser: MarketplaceUser;
  lastMessage: MarketplaceMessage | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export class MarketplaceConversationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const toIsoString = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

let marketplaceMessagingReady: Promise<void> | null = null;

const ensureMarketplaceMessagingTables = async () => {
  if (marketplaceMessagingReady) {
    return marketplaceMessagingReady;
  }

  marketplaceMessagingReady = (async () => {
    await ensureUsersTable();
    await ensureListingsTable();

    await db.query(`
      CREATE TABLE IF NOT EXISTS marketplace_conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (listing_id, buyer_id)
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS marketplace_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        read boolean NOT NULL DEFAULT false
      );
    `);

    await db.query(
      `CREATE INDEX IF NOT EXISTS marketplace_conversations_buyer_idx
       ON marketplace_conversations (buyer_id, updated_at DESC);`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS marketplace_conversations_seller_idx
       ON marketplace_conversations (seller_id, updated_at DESC);`
    );
    await db.query(
      `CREATE INDEX IF NOT EXISTS marketplace_messages_conversation_idx
       ON marketplace_messages (conversation_id, created_at ASC);`
    );
  })();

  return marketplaceMessagingReady;
};

type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string | Date;
  updated_at: string | Date;
  title: string;
  price: string | number;
  images: string[] | null;
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
  buyer_name: string;
  buyer_handle: string;
  seller_name: string;
  seller_handle: string;
  last_message_id: string | null;
  last_message_content: string | null;
  last_message_created_at: string | Date | null;
  last_message_sender_id: string | null;
  last_message_sender_name: string | null;
  last_message_sender_handle: string | null;
  unread_count: number | null;
};

const mapConversation = (row: ConversationRow, viewerId: string): MarketplaceConversation => {
  const buyer: MarketplaceUser = {
    id: row.buyer_id,
    name: row.buyer_name,
    handle: row.buyer_handle,
  };
  const seller: MarketplaceUser = {
    id: row.seller_id,
    name: row.seller_name,
    handle: row.seller_handle,
  };
  const otherUser = viewerId === buyer.id ? seller : buyer;
  const lastMessage: MarketplaceMessage | null = row.last_message_id
    ? {
        id: row.last_message_id,
        content: row.last_message_content ?? "",
        createdAt: toIsoString(row.last_message_created_at ?? new Date()),
        sender: {
          id: row.last_message_sender_id ?? "",
          name: row.last_message_sender_name ?? "",
          handle: row.last_message_sender_handle ?? "",
        },
        read: false,
      }
    : null;

  return {
    id: row.id,
    listing: {
      id: row.listing_id,
      title: row.title,
      price: Number(row.price),
      images: row.images ?? [],
      category: row.category,
      condition: row.condition,
      status: row.status,
    },
    buyer,
    seller,
    otherUser,
    lastMessage,
    unreadCount: row.unread_count ?? 0,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
};

type MessageRow = {
  id: string;
  content: string;
  created_at: string | Date;
  read: boolean;
  sender_id: string;
  sender_name: string;
  sender_handle: string;
};

const mapMessage = (row: MessageRow): MarketplaceMessage => ({
  id: row.id,
  content: row.content,
  createdAt: toIsoString(row.created_at),
  read: row.read,
  sender: {
    id: row.sender_id,
    name: row.sender_name,
    handle: row.sender_handle,
  },
});

export const createOrGetConversation = async (params: {
  listingId: string;
  buyerId: string;
}) => {
  await ensureMarketplaceMessagingTables();

  const listingId = params.listingId?.trim();
  if (!listingId) {
    throw new MarketplaceConversationError("Listing id is required", 400);
  }
  if (!params.buyerId) {
    throw new MarketplaceConversationError("Buyer id is required", 400);
  }

  const listingResult = await db.query(
    `SELECT id, user_id, title
     FROM listings
     WHERE id = $1 AND status != 'deleted'
     LIMIT 1`,
    [listingId]
  );

  if ((listingResult.rowCount ?? 0) === 0) {
    throw new MarketplaceConversationError("Listing not found", 404);
  }

  const listingRow = listingResult.rows[0] as {
    id: string;
    user_id: string;
    title: string;
  };

  if (listingRow.user_id === params.buyerId) {
    throw new MarketplaceConversationError("Cannot message yourself", 400);
  }

  const conversationResult = await db.query(
    `INSERT INTO marketplace_conversations (listing_id, buyer_id, seller_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (listing_id, buyer_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, listing_id, buyer_id, seller_id`,
    [listingRow.id, params.buyerId, listingRow.user_id]
  );

  const conversation = conversationResult.rows[0] as {
    id: string;
    listing_id: string;
    buyer_id: string;
    seller_id: string;
  };

  return {
    conversationId: conversation.id,
    listingId: listingRow.id,
    listingTitle: listingRow.title,
    buyerId: conversation.buyer_id,
    sellerId: conversation.seller_id,
  };
};

export const getConversations = async (userId: string): Promise<MarketplaceConversation[]> => {
  await ensureMarketplaceMessagingTables();

  if (!userId) {
    throw new MarketplaceConversationError("User id is required", 400);
  }

  const result = await db.query(
    `SELECT c.id,
            c.listing_id,
            c.buyer_id,
            c.seller_id,
            c.created_at,
            c.updated_at,
            l.title,
            l.price,
            l.images,
            l.category,
            l.condition,
            l.status,
            buyer.name AS buyer_name,
            buyer.handle AS buyer_handle,
            seller.name AS seller_name,
            seller.handle AS seller_handle,
            last_msg.id AS last_message_id,
            last_msg.content AS last_message_content,
            last_msg.created_at AS last_message_created_at,
            last_msg.sender_id AS last_message_sender_id,
            last_sender.name AS last_message_sender_name,
            last_sender.handle AS last_message_sender_handle,
            unread.count AS unread_count
     FROM marketplace_conversations c
     JOIN listings l ON l.id = c.listing_id
     JOIN users buyer ON buyer.id = c.buyer_id
     JOIN users seller ON seller.id = c.seller_id
     LEFT JOIN LATERAL (
       SELECT m.id, m.content, m.created_at, m.sender_id
       FROM marketplace_messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC
       LIMIT 1
     ) last_msg ON true
     LEFT JOIN users last_sender ON last_sender.id = last_msg.sender_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS count
       FROM marketplace_messages m
       WHERE m.conversation_id = c.id
         AND m.sender_id != $1
         AND m.read = false
     ) unread ON true
     WHERE (c.buyer_id = $1 OR c.seller_id = $1)
       AND l.status != 'deleted'
     ORDER BY c.updated_at DESC`,
    [userId]
  );

  return (result.rows as ConversationRow[]).map((row) => mapConversation(row, userId));
};

export const getConversationById = async (
  conversationId: string,
  userId: string
): Promise<MarketplaceConversation> => {
  await ensureMarketplaceMessagingTables();

  if (!conversationId) {
    throw new MarketplaceConversationError("Conversation id is required", 400);
  }

  const result = await db.query(
    `SELECT c.id,
            c.listing_id,
            c.buyer_id,
            c.seller_id,
            c.created_at,
            c.updated_at,
            l.title,
            l.price,
            l.images,
            l.category,
            l.condition,
            l.status,
            buyer.name AS buyer_name,
            buyer.handle AS buyer_handle,
            seller.name AS seller_name,
            seller.handle AS seller_handle,
            last_msg.id AS last_message_id,
            last_msg.content AS last_message_content,
            last_msg.created_at AS last_message_created_at,
            last_msg.sender_id AS last_message_sender_id,
            last_sender.name AS last_message_sender_name,
            last_sender.handle AS last_message_sender_handle,
            unread.count AS unread_count
     FROM marketplace_conversations c
     JOIN listings l ON l.id = c.listing_id
     JOIN users buyer ON buyer.id = c.buyer_id
     JOIN users seller ON seller.id = c.seller_id
     LEFT JOIN LATERAL (
       SELECT m.id, m.content, m.created_at, m.sender_id
       FROM marketplace_messages m
       WHERE m.conversation_id = c.id
       ORDER BY m.created_at DESC
       LIMIT 1
     ) last_msg ON true
     LEFT JOIN users last_sender ON last_sender.id = last_msg.sender_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS count
       FROM marketplace_messages m
       WHERE m.conversation_id = c.id
         AND m.sender_id != $1
         AND m.read = false
     ) unread ON true
     WHERE c.id = $2
       AND (c.buyer_id = $1 OR c.seller_id = $1)
       AND l.status != 'deleted'
     LIMIT 1`,
    [userId, conversationId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new MarketplaceConversationError("Conversation not found", 404);
  }

  return mapConversation(result.rows[0] as ConversationRow, userId);
};

export const getMessages = async (conversationId: string, userId: string) => {
  await ensureMarketplaceMessagingTables();

  const conversationResult = await db.query(
    `SELECT id, buyer_id, seller_id
     FROM marketplace_conversations
     WHERE id = $1
     LIMIT 1`,
    [conversationId]
  );

  if ((conversationResult.rowCount ?? 0) === 0) {
    throw new MarketplaceConversationError("Conversation not found", 404);
  }

  const conversation = conversationResult.rows[0] as {
    id: string;
    buyer_id: string;
    seller_id: string;
  };

  if (conversation.buyer_id !== userId && conversation.seller_id !== userId) {
    throw new MarketplaceConversationError("Not authorized", 403);
  }

  const result = await db.query(
    `SELECT m.id,
            m.content,
            m.created_at,
            m.read,
            sender.id AS sender_id,
            sender.name AS sender_name,
            sender.handle AS sender_handle
     FROM marketplace_messages m
     JOIN users sender ON sender.id = m.sender_id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationId]
  );

  await db.query(
    `UPDATE marketplace_messages
     SET read = true
     WHERE conversation_id = $1
       AND sender_id != $2
       AND read = false`,
    [conversationId, userId]
  );

  await markMarketplaceMessageNotificationsRead(userId, conversationId);

  return (result.rows as MessageRow[]).map(mapMessage);
};

export const sendMessage = async (params: {
  conversationId: string;
  senderId: string;
  content: string;
}): Promise<MarketplaceMessage> => {
  await ensureMarketplaceMessagingTables();

  const trimmed = params.content.trim();
  if (!trimmed) {
    throw new MarketplaceConversationError("Message content is required", 400);
  }
  if (trimmed.length > 2000) {
    throw new MarketplaceConversationError("Message is too long", 400);
  }

  const conversationResult = await db.query(
    `SELECT c.id, c.buyer_id, c.seller_id, c.listing_id, l.title
     FROM marketplace_conversations c
     JOIN listings l ON l.id = c.listing_id
     WHERE c.id = $1
     LIMIT 1`,
    [params.conversationId]
  );

  if ((conversationResult.rowCount ?? 0) === 0) {
    throw new MarketplaceConversationError("Conversation not found", 404);
  }

  const conversation = conversationResult.rows[0] as {
    id: string;
    buyer_id: string;
    seller_id: string;
    listing_id: string;
    title: string;
  };

  if (
    conversation.buyer_id !== params.senderId &&
    conversation.seller_id !== params.senderId
  ) {
    throw new MarketplaceConversationError("Not authorized", 403);
  }

  const messageId = randomUUID();

  await db.query(
    `INSERT INTO marketplace_messages (id, conversation_id, sender_id, content)
     VALUES ($1, $2, $3, $4)`,
    [messageId, conversation.id, params.senderId, trimmed]
  );

  await db.query(
    `UPDATE marketplace_conversations
     SET updated_at = NOW()
     WHERE id = $1`,
    [conversation.id]
  );

  const messageResult = await db.query(
    `SELECT m.id,
            m.content,
            m.created_at,
            m.read,
            sender.id AS sender_id,
            sender.name AS sender_name,
            sender.handle AS sender_handle
     FROM marketplace_messages m
     JOIN users sender ON sender.id = m.sender_id
     WHERE m.id = $1`,
    [messageId]
  );

  const message = mapMessage(messageResult.rows[0] as MessageRow);

  const recipientId =
    conversation.buyer_id === params.senderId
      ? conversation.seller_id
      : conversation.buyer_id;

  await createMarketplaceMessageNotification({
    recipientId,
    actorId: params.senderId,
    messageId,
    messageBody: trimmed,
    conversationId: conversation.id,
    listingTitle: conversation.title,
  });

  return message;
};
