"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileLogout } from "./ProfileLogout";
import { ProfileQuestionCard } from "./ProfileQuestionCard";
import { ProfileAnswersProvider, useProfileAnswers } from "./ProfileAnswersContext";
import { ProfileQuestionnaireModal } from "./ProfileQuestionnaireModal";
import { ProfileCrewCard, ProfileCurrentlyCard } from "./ProfileSidePanel";
import { useAuth } from "@/features/auth";

type MovementMode = "relative" | "absolute";

type BlockDefinition = {
  id: string;
  columns: number;
  layout: {
    default: { x: number; y: number };
    compact: { x: number; y: number };
  };
  render: (params: { isEditing: boolean }) => ReactNode;
};

type BlockTemplate = Omit<BlockDefinition, "render">;

type BlockPosition = {
  x: number;
  y: number;
};

type BlockSizes = Record<string, number>;

const GRID_COLUMNS = 12;
const GRID_GAP = 20;
const GRID_SNAP = 1;

const layoutStorageKey = (userId: string) => `lockedin_profile_layout:${userId}`;

const rectsOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

const isInteractiveElement = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("button, a, input, textarea, select, [data-drag-ignore]")
  );
};

const BLOCK_TEMPLATES: BlockTemplate[] = [
  {
    id: "profile-header",
    columns: 12,
    layout: {
      default: { x: 0, y: 0 },
      compact: { x: 0, y: 0 },
    },
  },
  {
    id: "question-career",
    columns: 4,
    layout: {
      default: { x: 0, y: 3 },
      compact: { x: 0, y: 3 },
    },
  },
  {
    id: "question-madlib",
    columns: 4,
    layout: {
      default: { x: 4, y: 3 },
      compact: { x: 0, y: 6 },
    },
  },
  {
    id: "question-memory",
    columns: 4,
    layout: {
      default: { x: 8, y: 3 },
      compact: { x: 0, y: 9 },
    },
  },
  {
    id: "currently",
    columns: 6,
    layout: {
      default: { x: 0, y: 6 },
      compact: { x: 0, y: 12 },
    },
  },
  {
    id: "crew",
    columns: 6,
    layout: {
      default: { x: 6, y: 6 },
      compact: { x: 0, y: 15 },
    },
  },
  {
    id: "logout",
    columns: 12,
    layout: {
      default: { x: 0, y: 9 },
      compact: { x: 0, y: 18 },
    },
  },
];

const ProfileLayoutInner = () => {
  const { user } = useAuth();
  const { answers, madlibAnswer } = useProfileAnswers();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gridUnit, setGridUnit] = useState(0);
  const [positions, setPositions] = useState<Record<string, BlockPosition>>({});
  const [savedPositions, setSavedPositions] = useState<Record<string, BlockPosition>>(
    {}
  );
  const [blockHeights, setBlockHeights] = useState<BlockSizes>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [movementMode, setMovementMode] = useState<MovementMode>("relative");
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const gridStep = useMemo(() => gridUnit + GRID_GAP, [gridUnit]);

  const isCompact = useMemo(() => {
    if (!containerRef.current) {
      return false;
    }
    return containerRef.current.offsetWidth < 768;
  }, [gridUnit]);

  const blocks: BlockDefinition[] = useMemo(
    () => [
      {
        id: "profile-header",
        columns: 12,
        layout: {
          default: { x: 0, y: 0 },
          compact: { x: 0, y: 0 },
        },
        render: ({ isEditing: editing }) => (
          <ProfileHeader
            isEditing={editing}
            movementMode={movementMode}
            onEditToggle={() => setIsEditing(true)}
            onSaveLayout={() => handleSave()}
            onCancelLayout={() => handleCancel()}
            onMovementModeChange={(mode) => handleMovementMode(mode)}
            layoutError={layoutError}
          />
        ),
      },
      {
        id: "question-career",
        columns: 4,
        layout: {
          default: { x: 0, y: 3 },
          compact: { x: 0, y: 3 },
        },
        render: () => (
          <ProfileQuestionCard
            title="If you guaranteed success, what career would you chose?"
            answer={answers?.career}
          />
        ),
      },
      {
        id: "question-madlib",
        columns: 4,
        layout: {
          default: { x: 4, y: 3 },
          compact: { x: 0, y: 6 },
        },
        render: () => (
          <ProfileQuestionCard
            title="Whenever I'm ____, my ____ stop and ____."
            answer={madlibAnswer}
          />
        ),
      },
      {
        id: "question-memory",
        columns: 4,
        layout: {
          default: { x: 8, y: 3 },
          compact: { x: 0, y: 9 },
        },
        render: () => (
          <ProfileQuestionCard
            title="What's your favorite memory?"
            answer={answers?.memory}
          />
        ),
      },
      {
        id: "currently",
        columns: 6,
        layout: {
          default: { x: 0, y: 6 },
          compact: { x: 0, y: 12 },
        },
        render: () => <ProfileCurrentlyCard />,
      },
      {
        id: "crew",
        columns: 6,
        layout: {
          default: { x: 6, y: 6 },
          compact: { x: 0, y: 15 },
        },
        render: () => <ProfileCrewCard />,
      },
      {
        id: "logout",
        columns: 12,
        layout: {
          default: { x: 0, y: 9 },
          compact: { x: 0, y: 18 },
        },
        render: () => <ProfileLogout />,
      },
    ],
    [answers?.career, answers?.memory, handleCancel, handleSave, layoutError, madlibAnswer, movementMode]
  );

  const defaultPositions = useMemo(() => {
    const initial: Record<string, BlockPosition> = {};
    blocks.forEach((block) => {
      const layout = isCompact ? block.layout.compact : block.layout.default;
      initial[block.id] = { x: layout.x, y: layout.y };
    });
    return initial;
  }, [blocks, isCompact]);

  const updateGridUnit = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const width = containerRef.current.offsetWidth;
    const nextUnit = (width - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
    setGridUnit(Math.max(40, nextUnit));
  }, []);

  useEffect(() => {
    updateGridUnit();
    const observer = new ResizeObserver(() => updateGridUnit());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [updateGridUnit]);

  useEffect(() => {
    if (!user?.id) {
      setPositions(defaultPositions);
      setSavedPositions(defaultPositions);
      return;
    }

    const raw = typeof window !== "undefined"
      ? window.localStorage.getItem(layoutStorageKey(user.id))
      : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { positions?: Record<string, BlockPosition> };
        if (parsed?.positions) {
          setPositions(parsed.positions);
          setSavedPositions(parsed.positions);
          return;
        }
      } catch {
        // Ignore malformed stored layouts.
      }
    }

    setPositions(defaultPositions);
    setSavedPositions(defaultPositions);
  }, [defaultPositions, user?.id]);

  const saveLayout = (next: Record<string, BlockPosition>) => {
    if (!user?.id || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      layoutStorageKey(user.id),
      JSON.stringify({ positions: next })
    );
  };

  const handleSave = useCallback(() => {
    const collisions = blocks.some((block) => {
      const rect = getRect(block.id, positions[block.id]);
      return blocks.some((other) => {
        if (block.id === other.id) {
          return false;
        }
        const otherRect = getRect(other.id, positions[other.id]);
        return rectsOverlap(rect, otherRect);
      });
    });

    if (collisions) {
      setLayoutError("Resolve overlaps before saving the layout.");
      return;
    }

    setLayoutError(null);
    setSavedPositions(positions);
    saveLayout(positions);
    setIsEditing(false);
  }, [blocks, positions]);

  const handleCancel = useCallback(() => {
    setLayoutError(null);
    setPositions(savedPositions);
    setIsEditing(false);
  }, [savedPositions]);

  const handleMovementMode = useCallback((mode: MovementMode) => {
    setMovementMode(mode);
    if (mode === "relative") {
      setPositions((prev) => {
        const next: Record<string, BlockPosition> = {};
        Object.entries(prev).forEach(([key, value]) => {
          next[key] = {
            x: Math.round(value.x / GRID_SNAP) * GRID_SNAP,
            y: Math.round(value.y / GRID_SNAP) * GRID_SNAP,
          };
        });
        return next;
      });
    }
  }, []);

  const getBlockWidth = useCallback(
    (block: BlockDefinition) =>
      block.columns * gridUnit + (block.columns - 1) * GRID_GAP,
    [gridUnit]
  );

  const getRect = useCallback(
    (id: string, position?: BlockPosition) => {
      const block = blocks.find((item) => item.id === id);
      const width = block ? getBlockWidth(block) : 0;
      const height = blockHeights[id] ?? gridStep * 2;
      const pos = position ?? positions[id] ?? { x: 0, y: 0 };

      return {
        x: pos.x * gridStep,
        y: pos.y * gridStep,
        width,
        height,
      };
    },
    [blockHeights, blocks, getBlockWidth, gridStep, positions]
  );

  const canvasHeight = useMemo(() => {
    const bottoms = blocks.map((block) => {
      const rect = getRect(block.id, positions[block.id]);
      return rect.y + rect.height;
    });
    return Math.max(...bottoms, 200) + gridStep;
  }, [blocks, getRect, gridStep, positions]);

  const handlePointerDown = (
    id: string,
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isEditing || !containerRef.current) {
      return;
    }
    if (event.button !== 0 || isInteractiveElement(event.target)) {
      return;
    }

    const rect = getRect(id);
    dragOffsetRef.current = {
      x: event.clientX - (containerRef.current.getBoundingClientRect().left + rect.x),
      y: event.clientY - (containerRef.current.getBoundingClientRect().top + rect.y),
    };
    setDraggingId(id);
  };

  useEffect(() => {
    if (!draggingId || !containerRef.current) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      if (!containerRef.current) {
        return;
      }
      const containerRect = containerRef.current.getBoundingClientRect();
      const block = blocks.find((item) => item.id === draggingId);
      if (!block) {
        return;
      }
      const width = getBlockWidth(block);
      const height = blockHeights[block.id] ?? gridStep * 2;

      let nextX =
        (event.clientX - containerRect.left - dragOffsetRef.current.x) / gridStep;
      let nextY =
        (event.clientY - containerRect.top - dragOffsetRef.current.y) / gridStep;

      if (movementMode === "relative") {
        nextX = Math.round(nextX / GRID_SNAP) * GRID_SNAP;
        nextY = Math.round(nextY / GRID_SNAP) * GRID_SNAP;
      }

      const maxX = Math.max(0, (containerRect.width - width) / gridStep);
      nextX = Math.min(Math.max(0, nextX), maxX);
      nextY = Math.max(0, nextY);

      const candidateRect = {
        x: nextX * gridStep,
        y: nextY * gridStep,
        width,
        height,
      };

      const hasCollision = blocks.some((other) => {
        if (other.id === draggingId) {
          return false;
        }
        const otherRect = getRect(other.id, positions[other.id]);
        return rectsOverlap(candidateRect, otherRect);
      });

      if (!hasCollision) {
        setPositions((prev) => ({
          ...prev,
          [draggingId]: { x: nextX, y: nextY },
        }));
        setLayoutError(null);
      }
    };

    const handleUp = () => {
      setDraggingId(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    blockHeights,
    blocks,
    draggingId,
    getBlockWidth,
    getRect,
    gridStep,
    movementMode,
    positions,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div
        ref={containerRef}
        className="relative"
        style={{ height: canvasHeight }}
      >
        {isEditing && movementMode === "relative" && gridStep > 0 && (
          <div
            className="pointer-events-none absolute inset-0 rounded-[32px] opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,134,88,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,134,88,0.08) 1px, transparent 1px)",
              backgroundSize: `${gridStep}px ${gridStep}px`,
            }}
          />
        )}

        {blocks.map((block) => {
          const pos = positions[block.id] ?? { x: 0, y: 0 };
          const width = getBlockWidth(block);
          const height = blockHeights[block.id] ?? "auto";
          const style = {
            left: pos.x * gridStep,
            top: pos.y * gridStep,
            width,
            height,
          } as const;

          return (
            <div
              key={block.id}
              className={`absolute transition ${
                isEditing ? "cursor-grab" : ""
              } ${draggingId === block.id ? "z-30" : "z-10"}`}
              style={style}
              onPointerDown={(event) => handlePointerDown(block.id, event)}
            >
              <BlockSizer
                blockId={block.id}
                onResize={(nextHeight) =>
                  setBlockHeights((prev) => ({
                    ...prev,
                    [block.id]: nextHeight,
                  }))
                }
              >
                {block.render({ isEditing })}
              </BlockSizer>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BlockSizer = ({
  blockId,
  onResize,
  children,
}: {
  blockId: string;
  onResize: (height: number) => void;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const element = ref.current;
    const update = () => {
      const rect = element.getBoundingClientRect();
      onResize(rect.height);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [blockId, onResize]);

  return <div ref={ref}>{children}</div>;
};

export const ProfileLayout = () => {
  return (
    <ProfileAnswersProvider>
      <ProfileLayoutInner />
      <ProfileQuestionnaireModal />
    </ProfileAnswersProvider>
  );
};
