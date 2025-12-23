export type User = {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  campus?: string;
  year?: string;
  vibes?: string[];
};

export type FeedPostType = "text" | "poll" | "prompt" | "update";

export type PollOption = {
  id: string;
  label: string;
  votes: number;
};

export type FeedPost = {
  id: string;
  author: User;
  type: FeedPostType;
  content: string;
  createdAt: string;
  tags?: string[];
  pollOptions?: PollOption[];
  likeCount: number;
  likedByUser?: boolean;
};

export type FeedComment = {
  id: string;
  postId: string;
  author: User;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByUser?: boolean;
};

export type DailyChallenge = {
  id: string;
  title: string;
  description: string;
  endsAt: string;
  participants: number;
};

export type ChatMessage = {
  id: string;
  author: User;
  message: string;
  createdAt: string;
};

export type RequestCard = {
  id: string;
  title: string;
  description: string;
  location: string;
  createdAt: string;
  tags: string[];
  urgency?: "low" | "medium" | "high";
};

export type MapEvent = {
  id: string;
  title: string;
  location: string;
  startsAt: string;
  endsAt?: string;
  category: string;
  attendees: number;
  vibe: string;
};

export type Profile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatarUrl?: string;
  interests: string[];
  downTo: string[];
  needsHelpWith: string[];
  vibes: string[];
  badges: string[];
};
