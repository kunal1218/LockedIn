import type { RequestCard } from "@lockedin/shared";

export const requests: RequestCard[] = [
  {
    id: "request-1",
    title: "Anyone down to shoot hoops?",
    description: "Casual run, all skill levels. Bring music.",
    location: "Rec Center Courts",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    tags: ["sports", "fun"],
    urgency: "low",
  },
  {
    id: "request-2",
    title: "Need help carrying a desk",
    description: "One flight of stairs, pizza on me.",
    location: "North Quad",
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    tags: ["help", "moving"],
    urgency: "high",
  },
  {
    id: "request-3",
    title: "Looking for a hackathon teammate",
    description: "You bring design or ML. I bring snacks + backend.",
    location: "Engineering Hall",
    createdAt: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    tags: ["build", "cofounder"],
    urgency: "medium",
  },
  {
    id: "request-4",
    title: "Need a photographer for club pics",
    description: "30 minutes, golden hour lighting.",
    location: "Student Union Steps",
    createdAt: new Date(Date.now() - 1000 * 60 * 160).toISOString(),
    tags: ["creative", "help"],
    urgency: "low",
  },
];
