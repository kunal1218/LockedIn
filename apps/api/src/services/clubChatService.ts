import { randomUUID } from "crypto";

export type ClubChatSender = {
  id: string;
  name: string;
  handle?: string | null;
  isGuest?: boolean;
};

export type ClubChatMessage = {
  id: string;
  clubId: string;
  channel: "general" | "announcements";
  message: string;
  createdAt: string;
  sender: ClubChatSender;
};

const MAX_CLUB_CHAT_MESSAGES = 200;
const clubChatHistory = new Map<string, ClubChatMessage[]>();

const channelKey = (clubId: string, channel: ClubChatMessage["channel"]) =>
  `${clubId}:${channel}`;

export const normalizeClubChannel = (value?: string | null) =>
  value === "announcements" ? "announcements" : "general";

export const addClubChatMessage = (params: {
  clubId: string;
  channel: ClubChatMessage["channel"];
  message: string;
  sender: ClubChatSender;
}): ClubChatMessage => {
  const entry: ClubChatMessage = {
    id: randomUUID(),
    clubId: params.clubId,
    channel: params.channel,
    message: params.message.slice(0, 500),
    createdAt: new Date().toISOString(),
    sender: params.sender,
  };
  const key = channelKey(params.clubId, params.channel);
  const current = clubChatHistory.get(key) ?? [];
  const next = [...current, entry].slice(-MAX_CLUB_CHAT_MESSAGES);
  clubChatHistory.set(key, next);
  return entry;
};

export const getClubChatHistory = (clubId: string, channel: ClubChatMessage["channel"]) =>
  clubChatHistory.get(channelKey(clubId, channel)) ?? [];

const guestAdjectives = [
  "Sunny",
  "Brisk",
  "Amber",
  "Nova",
  "Indie",
  "Hushed",
  "Silver",
  "Velvet",
  "Neon",
  "Cosmic",
];

const guestNouns = [
  "Fox",
  "Comet",
  "Pine",
  "River",
  "Atlas",
  "Meadow",
  "Cedar",
  "Orbit",
  "Breeze",
  "Echo",
];

export const generateGuestName = () => {
  const adjective =
    guestAdjectives[Math.floor(Math.random() * guestAdjectives.length)];
  const noun = guestNouns[Math.floor(Math.random() * guestNouns.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${adjective} ${noun} ${suffix}`;
};
