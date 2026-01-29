import type {
  ChatMessage,
  DailyChallenge,
  FeedPost,
  MapEvent,
  Profile,
  RequestCard,
  User,
} from "@lockedin/shared";

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
  title: "Pitch your wildest weekend side quest",
  description:
    "Drop a 2-sentence idea. Find a partner. Ship a tiny version by Sunday.",
  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
  participants: 86,
};

export const feedPosts: FeedPost[] = [
  {
    id: "post-1",
    author: users[0],
    type: "text",
    content:
      "Anyone down to build a tiny campus event finder? Need a design brain + one backend pal.",
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    tags: ["build", "cofounder", "web"],
    likeCount: 14,
  },
  {
    id: "post-2",
    author: users[1],
    type: "poll",
    content: "Best spontaneous hangout?",
    createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    tags: ["chaos", "social"],
    likeCount: 25,
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
    likeCount: 5,
  },
  {
    id: "post-4",
    author: users[0],
    type: "update",
    content:
      "We just shipped a roommate swap spreadsheet. It is chaotic but it works. Anyone wanna help make it pretty?",
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    tags: ["project", "help"],
    likeCount: 19,
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

export const requests: RequestCard[] = [
  {
    id: "request-1",
    title: "Anyone down to shoot hoops?",
    description: "Casual run, all skill levels. Bring music.",
    location: "Rec Center Courts",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    tags: ["sports", "fun"],
    urgency: "low",
    creator: users[2],
    likeCount: 7,
  },
  {
    id: "request-2",
    title: "Need help carrying a desk",
    description: "One flight of stairs, pizza on me.",
    location: "North Quad",
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    tags: ["help", "moving"],
    urgency: "high",
    creator: users[0],
    likeCount: 18,
  },
  {
    id: "request-3",
    title: "Looking for a hackathon teammate",
    description: "You bring design or ML. I bring snacks + backend.",
    location: "Engineering Hall",
    createdAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    tags: ["build", "cofounder"],
    urgency: "medium",
    creator: users[1],
    likeCount: 12,
  },
];

export const events: MapEvent[] = [
  {
    id: "event-1",
    title: "Sunset picnic club",
    location: "Hilltop Lawn",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
    category: "social",
    attendees: 14,
    vibe: "low-key",
  },
  {
    id: "event-2",
    title: "Founders brainstorm",
    location: "Innovation Hub",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    category: "build",
    attendees: 9,
    vibe: "high-energy",
  },
  {
    id: "event-3",
    title: "Open mic chaos",
    location: "Student Union",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    category: "creative",
    attendees: 22,
    vibe: "playful",
  },
];

export const profile: Profile = {
  id: "profile-1",
  name: "Avery Cho",
  handle: "@averycodes",
  bio: "Builder energy. I make little tools that solve campus chaos.",
  interests: ["maker nights", "product design", "basketball"],
  downTo: ["ship MVPs", "co-work sprints", "random adventures"],
  needsHelpWith: ["finding a designer", "marketing brainstorms"],
  vibes: ["curious", "low-ego", "fast"],
  badges: ["Daily Challenge Regular", "Hackathon Gremlin"],
};
