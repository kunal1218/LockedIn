import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createClub, getClubs, joinClub, leaveClub } from "../../api/actions";
import { ActionButton } from "../../components/ActionButton";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import type { SessionProps } from "../../types/session";
import { styles } from "../../styles/ui";

type ClubCategory = "social" | "study" | "build" | "sports" | "creative" | "wellness";
type ClubJoinPolicy = "open" | "application";
type ClubApplicationStatus = "pending" | "approved" | "denied" | null;

type GroupSummary = {
  id: string;
  title: string;
  description: string;
  category: ClubCategory;
  location: string;
  city: string | null;
  isRemote: boolean;
  joinPolicy: ClubJoinPolicy;
  memberCount: number;
  joinedByUser: boolean;
  applicationStatus: ClubApplicationStatus;
  creator: {
    id: string;
    name: string;
    handle: string;
  };
};

const groupCategories: ClubCategory[] = [
  "social",
  "study",
  "build",
  "sports",
  "creative",
  "wellness",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseGroup = (value: unknown): GroupSummary | null => {
  if (!isObject(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string"
  ) {
    return null;
  }

  const creator = isObject(value.creator) ? value.creator : {};

  const categoryRaw = typeof value.category === "string" ? value.category.toLowerCase() : "social";
  const category = (groupCategories.includes(categoryRaw as ClubCategory)
    ? categoryRaw
    : "social") as ClubCategory;

  const joinPolicy: ClubJoinPolicy = value.joinPolicy === "application" ? "application" : "open";
  const applicationStatus =
    value.applicationStatus === "pending" ||
    value.applicationStatus === "approved" ||
    value.applicationStatus === "denied"
      ? value.applicationStatus
      : null;

  const city = typeof value.city === "string" && value.city.trim().length > 0 ? value.city : null;
  const isRemote = Boolean(value.isRemote);
  const location =
    typeof value.location === "string" && value.location.trim().length > 0
      ? value.location
      : isRemote
      ? "Remote"
      : city ?? "Campus";

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    category,
    location,
    city,
    isRemote,
    joinPolicy,
    memberCount: typeof value.memberCount === "number" ? value.memberCount : 0,
    joinedByUser: Boolean(value.joinedByUser),
    applicationStatus,
    creator: {
      id: typeof creator.id === "string" ? creator.id : "",
      name: typeof creator.name === "string" ? creator.name : "Unknown",
      handle: typeof creator.handle === "string" ? creator.handle : "@unknown",
    },
  };
};

const parseGroups = (payload: unknown): GroupSummary[] => {
  const list = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.clubs)
    ? payload.clubs
    : [];

  return list.map(parseGroup).filter((item): item is GroupSummary => item !== null);
};

export const GroupsTab = ({ token, onAuthExpired }: SessionProps) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ClubCategory>("social");
  const [city, setCity] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState<ClubJoinPolicy>("open");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getClubs(token);
      setGroups(parseGroups(payload));
    } catch (loadError) {
      if (isAuthError(loadError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(loadError));
    } finally {
      setLoading(false);
    }
  }, [onAuthExpired, token]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const submitGroup = async () => {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const normalizedCity = city.trim();

    if (!normalizedTitle || !normalizedDescription || (!isRemote && !normalizedCity)) {
      setError("Name, description, and city (or remote) are required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      await createClub(
        {
          title: normalizedTitle,
          description: normalizedDescription,
          category,
          city: isRemote ? null : normalizedCity,
          location: isRemote ? "Remote" : normalizedCity,
          isRemote,
          joinPolicy,
        },
        token
      );
      setTitle("");
      setDescription("");
      setCategory("social");
      setCity("");
      setIsRemote(false);
      setJoinPolicy("open");
      await loadGroups();
    } catch (submitError) {
      if (isAuthError(submitError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(submitError));
    } finally {
      setCreating(false);
    }
  };

  const handleMembershipToggle = async (group: GroupSummary) => {
    setJoiningIds((prev) => new Set(prev).add(group.id));
    setError(null);
    try {
      if (group.joinedByUser) {
        await leaveClub(group.id, token);
      } else {
        await joinClub(group.id, token);
      }
      await loadGroups();
    } catch (membershipError) {
      if (isAuthError(membershipError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(membershipError));
    } finally {
      setJoiningIds((prev) => {
        const next = new Set(prev);
        next.delete(group.id);
        return next;
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.sectionTitle}>Create Group</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Late-night chess club"
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="What your group does and how often you meet."
          multiline
        />
        <Text style={styles.label}>Category</Text>
        <View style={styles.inlineActions}>
          {groupCategories.map((option) => (
            <Pressable
              key={option}
              style={[styles.chip, category === option && styles.chipActive]}
              onPress={() => setCategory(option)}
            >
              <Text style={[styles.chipLabel, category === option && styles.chipLabelActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Join Access</Text>
        <View style={styles.inlineActions}>
          {(["open", "application"] as const).map((option) => (
            <Pressable
              key={option}
              style={[styles.chip, joinPolicy === option && styles.chipActive]}
              onPress={() => setJoinPolicy(option)}
            >
              <Text style={[styles.chipLabel, joinPolicy === option && styles.chipLabelActive]}>
                {option === "open" ? "Open" : "Application"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.mutedText}>Remote group</Text>
          <ActionButton
            label={isRemote ? "Yes" : "No"}
            tone="muted"
            onPress={() => setIsRemote((prev) => !prev)}
          />
        </View>

        {!isRemote ? (
          <>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="Campus city"
            />
          </>
        ) : null}

        <ActionButton
          label={creating ? "Creating..." : "Create group"}
          onPress={() => {
            void submitGroup();
          }}
          disabled={creating}
        />
      </Card>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Groups</Text>
        <ActionButton
          label={loading ? "Refreshing..." : "Refresh"}
          onPress={() => {
            void loadGroups();
          }}
          disabled={loading}
          tone="muted"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#2563eb" /> : null}

      {!loading && groups.length === 0 ? (
        <Text style={styles.emptyText}>No groups yet. Start one above.</Text>
      ) : null}

      {groups.map((group) => {
        const isPending =
          group.joinPolicy === "application" &&
          group.applicationStatus === "pending" &&
          !group.joinedByUser;
        const joinLabel = group.joinedByUser
          ? "Leave"
          : isPending
          ? "Pending"
          : group.joinPolicy === "application"
          ? group.applicationStatus === "denied"
            ? "Reapply"
            : "Apply"
          : "Join";
        const locationLabel = group.isRemote
          ? "Remote"
          : group.city
          ? `${group.city} • ${group.location}`
          : group.location;

        return (
          <Card key={group.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{group.title}</Text>
              <Text style={styles.mutedText}>{group.memberCount} members</Text>
            </View>
            <Text style={styles.cardBody}>{group.description}</Text>
            <Text style={styles.mutedText}>
              {group.category} • {group.joinPolicy === "application" ? "application" : "open"}
            </Text>
            <Text style={styles.mutedText}>{locationLabel}</Text>
            <Text style={styles.mutedText}>By {group.creator.handle}</Text>
            <View style={styles.inlineActions}>
              <ActionButton
                label={joiningIds.has(group.id) ? "Working..." : joinLabel}
                onPress={() => {
                  void handleMembershipToggle(group);
                }}
                disabled={joiningIds.has(group.id) || isPending}
                tone={group.joinedByUser ? "muted" : "default"}
              />
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
};

