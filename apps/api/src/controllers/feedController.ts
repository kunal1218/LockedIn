import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  addComment,
  createPost,
  deletePost,
  deleteComment,
  fetchComments,
  fetchFeed,
  fetchPostById,
  FeedError,
  toggleCommentLike,
  toggleLike,
  updatePost,
  updateComment,
  voteOnPollOption,
} from "../services/feedService";

const allowedTypes = ["text", "poll", "prompt", "update"] as const;
type AllowedType = (typeof allowedTypes)[number];

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const asStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const parseTags = (value: unknown) =>
  asStringArray(value)
    .map((tag) => tag.trim())
    .filter(Boolean);

const parsePollOptions = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option) => {
      if (typeof option === "string") {
        return option;
      }
      if (typeof option === "object" && option && "label" in option) {
        const label = (option as { label?: unknown }).label;
        return typeof label === "string" ? label : "";
      }
      return "";
    })
    .map((option) => option.trim())
    .filter(Boolean);
};

const getToken = (req: Request) => {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }

  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

const requireUser = async (req: Request) => {
  const token = getToken(req);
  if (!token) {
    throw new AuthError("Missing session token", 401);
  }

  const user = await getUserFromToken(token);
  if (!user) {
    throw new AuthError("Invalid session", 401);
  }

  return user;
};

const getOptionalUser = async (req: Request) => {
  const token = getToken(req);
  if (!token) {
    return null;
  }

  try {
    return await getUserFromToken(token);
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
};

const parseSort = (value: unknown) =>
  value === "top" ? "top" : "fresh";

const parsePostType = (value: unknown): AllowedType => {
  if (allowedTypes.includes(value as AllowedType)) {
    return value as AllowedType;
  }
  throw new FeedError("Invalid post type", 400);
};

const requirePostId = (value: unknown) => {
  const postId = asString(value).trim();
  if (!postId) {
    throw new FeedError("Post ID is required", 400);
  }
  if (!isUuid(postId)) {
    throw new FeedError("Invalid post ID", 400);
  }
  return postId;
};

const requireCommentId = (value: unknown) => {
  const commentId = asString(value).trim();
  if (!commentId) {
    throw new FeedError("Comment ID is required", 400);
  }
  if (!isUuid(commentId)) {
    throw new FeedError("Invalid comment ID", 400);
  }
  return commentId;
};

const parsePostPayload = (body: Request["body"]) => {
  const type = parsePostType(body?.type);
  const content = asString(body?.content).trim();
  if (!content) {
    throw new FeedError("Post content is required", 400);
  }

  const tags = parseTags(body?.tags);
  const pollOptions = parsePollOptions(body?.pollOptions);

  if (type === "poll" && pollOptions.length < 2) {
    throw new FeedError("Polls need at least two options", 400);
  }

  return { type, content, tags, pollOptions };
};

const parseUpdatePayload = (body: Request["body"]) => {
  const content = asString(body?.content).trim();
  if (!content) {
    throw new FeedError("Post content is required", 400);
  }

  const tags = Object.prototype.hasOwnProperty.call(body ?? {}, "tags")
    ? parseTags(body?.tags)
    : undefined;
  const pollOptions = Object.prototype.hasOwnProperty.call(
    body ?? {},
    "pollOptions"
  )
    ? parsePollOptions(body?.pollOptions)
    : undefined;

  return { content, tags, pollOptions };
};

const parseCommentPayload = (body: Request["body"]) => {
  const content = asString(body?.content).trim();
  if (!content) {
    throw new FeedError("Comment content is required", 400);
  }
  return { content };
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof FeedError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Feed error:", error);
  res.status(500).json({ error: "Unable to process feed request" });
};

export const getFeed = async (req: Request, res: Response) => {
  try {
    const viewer = await getOptionalUser(req);
    const sort = parseSort(req.query?.sort);
    const posts = await fetchFeed({ sort, viewerId: viewer?.id ?? null });
    res.json({ posts });
  } catch (error) {
    handleError(res, error);
  }
};

export const getPost = async (req: Request, res: Response) => {
  try {
    const viewer = await getOptionalUser(req);
    const postId = requirePostId(req.params?.postId);

    const post = await fetchPostById(postId, viewer?.id ?? null);
    if (!post) {
      throw new FeedError("Post not found", 404);
    }

    res.json({ post });
  } catch (error) {
    handleError(res, error);
  }
};

export const votePoll = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const postId = requirePostId(req.params?.postId);
    const optionId = requireCommentId(req.params?.optionId); // reuse validator for UUID
    const options = await voteOnPollOption({ postId, optionId, userId: user.id });
    res.json({ options });
  } catch (error) {
    handleError(res, error);
  }
};

export const createFeedPost = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const payload = parsePostPayload(req.body);
    const post = await createPost({
      userId: user.id,
      ...payload,
    });
    res.status(201).json({ post });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateFeedPost = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const postId = requirePostId(req.params?.postId);
    const payload = parseUpdatePayload(req.body);
    const post = await updatePost({ userId: user.id, postId, ...payload });
    res.json({ post });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteFeedPost = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const postId = requirePostId(req.params?.postId);
    await deletePost({ userId: user.id, postId });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
};

export const likeFeedPost = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const postId = requirePostId(req.params?.postId);
    const result = await toggleLike({ userId: user.id, postId });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const likeFeedComment = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const commentId = requireCommentId(req.params?.commentId);
    const result = await toggleCommentLike({ userId: user.id, commentId });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const getComments = async (req: Request, res: Response) => {
  try {
    const viewer = await getOptionalUser(req);
    const postId = requirePostId(req.params?.postId);
    const comments = await fetchComments(postId, viewer?.id ?? null);
    res.json({ comments });
  } catch (error) {
    handleError(res, error);
  }
};

export const createComment = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const postId = requirePostId(req.params?.postId);
    const { content } = parseCommentPayload(req.body);

    const comment = await addComment({
      userId: user.id,
      postId,
      content,
    });

    res.status(201).json({ comment });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateFeedComment = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const commentId = requireCommentId(req.params?.commentId);
    const { content } = parseCommentPayload(req.body);

    const comment = await updateComment({
      userId: user.id,
      commentId,
      content,
    });

    res.json({ comment });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteFeedComment = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const commentId = requireCommentId(req.params?.commentId);

    await deleteComment({ userId: user.id, commentId });
    res.status(204).send();
  } catch (error) {
    handleError(res, error);
  }
};
