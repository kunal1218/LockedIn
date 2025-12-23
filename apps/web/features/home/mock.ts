import type { ChatMessage, DailyChallenge, FeedPost, User } from "@lockedin/shared";

const users: User[] = [
  {
    id: "user-1",
    name: "Avery Cho",
    handle: "@averycodes",
    campus: "North Quad",
    year: "Junior",
    vibes: ["builder", "chaotic-good"],
  },
  {
    id: "user-2",
    name: "Samira Patel",
    handle: "@samirawins",
    campus: "West Hall",
    year: "Sophomore",
    vibes: ["designer", "warm"],
  },
  {
    id: "user-3",
    name: "Miles Grant",
    handle: "@milesmoves",
    campus: "River House",
    year: "Senior",
    vibes: ["sports", "optimist"],
  },
];

export const dailyChallenge: DailyChallenge = {
  id: "challenge-1",
  title: "Start a new micro-club in 24 hours",
  description:
    "Find 3 people. Pick a silly theme. Meet tonight. Post proof.",
  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
  participants: 86,
};

export const feedPosts: FeedPost[] = [
  {
    id: "post-1",
    author: users[0],
    type: "text",
    content:
      "Looking for a cofounder to build a campus hangout radar. We ship fast, we eat snacks, we actually finish things.",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    tags: ["build", "cofounder", "web"],
    likeCount: 12,
  },
  {
    id: "post-2",
    author: users[1],
    type: "poll",
    content: "Best spontaneous hangout?",
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    tags: ["chaos", "social"],
    likeCount: 22,
    pollOptions: [
      { id: "opt-1", label: "Late-night diner run", votes: 18 },
      { id: "opt-2", label: "Grass field picnic", votes: 26 },
      { id: "opt-3", label: "Board game marathon", votes: 12 },
    ],
  },
  {
    id: "post-3",
    author: users[2],
    type: "prompt",
    content: "Need a gym buddy for 6am tomorrow. I bribe with coffee.",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    tags: ["fitness", "accountability"],
    likeCount: 8,
  },
  {
    id: "post-4",
    author: users[0],
    type: "update",
    content:
      "We just shipped a roommate swap spreadsheet. It is chaotic but it works. Anyone wanna help make it pretty?",
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    tags: ["project", "help"],
    likeCount: 17,
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: "chat-1",
    author: users[1],
    message: "Daily challenge: pitching a campus snack club. Need ops + memes.",
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
  {
    id: "chat-2",
    author: users[2],
    message: "Anyone want to co-work at the library in 30?",
    createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: "chat-3",
    author: users[0],
    message: "Trying to start a midnight pancake society. Yes this is serious.",
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
];
