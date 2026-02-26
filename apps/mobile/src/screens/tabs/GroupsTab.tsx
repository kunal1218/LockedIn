import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createClub, getClubs, joinClub, leaveClub } from "../../api/actions";
import { ActionButton } from "../../components/ActionButton";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import type { SessionProps } from "../../types/session";
import { styles } from "../../styles/ui";

type ClubCategory = "social" | "study" | "build" | "sports" | "creative" | "wellness";
type ClubJoinPolicy = "open" | "application";
type ClubApplicationStatus = "pending" | "approved" | "denied" | null;
type ClubRecencyFilter = "all" | "24h" | "168h";
type ClubCategoryFilter = "all" | ClubCategory;
type ClubSortOption = "recency" | "members" | "distance";
type ClubProximityFilter = "all" | "nearby" | "remote";
type ExpandedFilterSection = "recency" | "category" | "proximity" | "sort";

type GroupSummary = {
  id: string;
  title: string;
  description: string;
  category: ClubCategory;
  location: string;
  city: string | null;
  isRemote: boolean;
  joinPolicy: ClubJoinPolicy;
  imageUrl: string | null;
  createdAt: string;
  memberCount: number;
  joinedByUser: boolean;
  applicationStatus: ClubApplicationStatus;
  distanceKm: number | null;
  creator: {
    id: string;
    name: string;
    handle: string;
  };
};

const RECENCY_TO_HOURS: Record<Exclude<ClubRecencyFilter, "all">, number> = {
  "24h": 24,
  "168h": 168,
};

const groupCategories: ClubCategory[] = [
  "social",
  "study",
  "build",
  "sports",
  "creative",
  "wellness",
];

const recencyOptions: Array<{ label: string; value: ClubRecencyFilter }> = [
  { label: "Today", value: "24h" },
  { label: "This week", value: "168h" },
  { label: "All time", value: "all" },
];

const categoryOptions: Array<{ label: string; value: ClubCategoryFilter }> = [
  { label: "All categories", value: "all" },
  { label: "Social", value: "social" },
  { label: "Study", value: "study" },
  { label: "Build", value: "build" },
  { label: "Sports", value: "sports" },
  { label: "Creative", value: "creative" },
  { label: "Wellness", value: "wellness" },
];

const proximityOptions: Array<{ label: string; value: ClubProximityFilter }> = [
  { label: "All", value: "all" },
  { label: "Nearby", value: "nearby" },
  { label: "Remote", value: "remote" },
];

const sortOptions: Array<{ label: string; value: ClubSortOption }> = [
  { label: "Newest", value: "recency" },
  { label: "Most members", value: "members" },
  { label: "Closest", value: "distance" },
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getOptionLabel = <T extends string>(
  options: Array<{ label: string; value: T }>,
  value: T
) => options.find((option) => option.value === value)?.label ?? value;

const formatRelativeTime = (value: string) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

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
  const createdAt =
    typeof value.createdAt === "string" && value.createdAt.trim().length > 0
      ? value.createdAt
      : new Date().toISOString();
  const imageUrl =
    typeof value.imageUrl === "string" && value.imageUrl.trim().length > 0 ? value.imageUrl : null;

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    category,
    location,
    city,
    isRemote,
    joinPolicy,
    imageUrl,
    createdAt,
    memberCount: toNumber(value.memberCount, 0),
    joinedByUser: Boolean(value.joinedByUser),
    applicationStatus,
    distanceKm: value.distanceKm == null ? null : toNumber(value.distanceKm, Number.NaN),
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

export const GroupsTab = ({ token, user, onAuthExpired }: SessionProps) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [isComposerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ClubCategory>("social");
  const [city, setCity] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [joinPolicy, setJoinPolicy] = useState<ClubJoinPolicy>("open");

  const [recency, setRecency] = useState<ClubRecencyFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<ClubCategoryFilter>("all");
  const [proximity, setProximity] = useState<ClubProximityFilter>("all");
  const [sortBy, setSortBy] = useState<ClubSortOption>("members");
  const [expandedFilter, setExpandedFilter] = useState<ExpandedFilterSection | null>(null);

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

  const visibleGroups = useMemo(() => {
    const now = Date.now();
    const byRecency =
      recency === "all"
        ? groups
        : groups.filter((group) => {
            const createdAt = Date.parse(group.createdAt);
            if (!Number.isFinite(createdAt)) {
              return true;
            }
            return now - createdAt <= RECENCY_TO_HOURS[recency] * 60 * 60 * 1000;
          });

    const byCategory =
      categoryFilter === "all"
        ? byRecency
        : byRecency.filter((group) => group.category === categoryFilter);

    const byProximity =
      proximity === "all"
        ? byCategory
        : byCategory.filter((group) => (proximity === "remote" ? group.isRemote : !group.isRemote));

    const sortByRecency = (a: GroupSummary, b: GroupSummary) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt);
    const sortByMembers = (a: GroupSummary, b: GroupSummary) => {
      if (b.memberCount !== a.memberCount) {
        return b.memberCount - a.memberCount;
      }
      return sortByRecency(a, b);
    };
    const sortByDistance = (a: GroupSummary, b: GroupSummary) => {
      const distanceA = Number.isFinite(a.distanceKm ?? Number.NaN)
        ? (a.distanceKm as number)
        : Number.POSITIVE_INFINITY;
      const distanceB = Number.isFinite(b.distanceKm ?? Number.NaN)
        ? (b.distanceKm as number)
        : Number.POSITIVE_INFINITY;
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      return sortByRecency(a, b);
    };

    const comparator =
      sortBy === "members" ? sortByMembers : sortBy === "distance" ? sortByDistance : sortByRecency;
    return [...byProximity].sort(comparator);
  }, [categoryFilter, groups, proximity, recency, sortBy]);

  const selectedRecencyLabel = useMemo(
    () => getOptionLabel(recencyOptions, recency),
    [recency]
  );
  const selectedCategoryLabel = useMemo(
    () => getOptionLabel(categoryOptions, categoryFilter),
    [categoryFilter]
  );
  const selectedProximityLabel = useMemo(
    () => getOptionLabel(proximityOptions, proximity),
    [proximity]
  );
  const selectedSortLabel = useMemo(() => getOptionLabel(sortOptions, sortBy), [sortBy]);

  const toggleFilterSection = (section: ExpandedFilterSection) => {
    setExpandedFilter((prev) => (prev === section ? null : section));
  };

  const submitGroup = async () => {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const normalizedCity = city.trim();

    if (!normalizedTitle || !normalizedDescription || (!isRemote && !normalizedCity)) {
      setError("Add a group name, description, and a city (or set remote).");
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
      setComposerOpen(false);
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
    <ScrollView
      contentContainerStyle={[styles.tabContainer, groupsStyles.container]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={groupsStyles.headerRow}>
        <View style={groupsStyles.headerTextWrap}>
          <Text style={groupsStyles.headerTitle}>Groups</Text>
          <Text style={groupsStyles.headerSubtitle}>
            Discover nearby groups and join with a single tap.
          </Text>
        </View>
        <ActionButton
          label={isComposerOpen ? "Close" : "Create"}
          tone="muted"
          onPress={() => setComposerOpen((prev) => !prev)}
        />
      </View>

      {isComposerOpen ? (
        <Card style={groupsStyles.composerCard}>
          <Text style={groupsStyles.composerTitle}>Create Group</Text>
          <Text style={styles.label}>Group name</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Late-night chess group"
          />
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="What this group does and how often people meet."
            multiline
          />
          <Text style={styles.label}>Category</Text>
          <View style={groupsStyles.optionRow}>
            {categoryOptions
              .filter((option) => option.value !== "all")
              .map((option) => (
                <Pressable
                  key={option.value}
                  style={[groupsStyles.filterChip, category === option.value && groupsStyles.filterChipActive]}
                  onPress={() => setCategory(option.value as ClubCategory)}
                >
                  <Text
                    style={[
                      groupsStyles.filterChipLabel,
                      category === option.value && groupsStyles.filterChipLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
          </View>
          <Text style={styles.label}>Join access</Text>
          <View style={groupsStyles.optionRow}>
            {(["open", "application"] as const).map((option) => (
              <Pressable
                key={option}
                style={[groupsStyles.filterChip, joinPolicy === option && groupsStyles.filterChipActive]}
                onPress={() => setJoinPolicy(option)}
              >
                <Text
                  style={[
                    groupsStyles.filterChipLabel,
                    joinPolicy === option && groupsStyles.filterChipLabelActive,
                  ]}
                >
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
                placeholder="Where the group meets"
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
      ) : null}

      <Card style={groupsStyles.filtersCard}>
        <View style={groupsStyles.filterDropdownSection}>
          <Pressable
            style={[
              groupsStyles.filterDropdownHeader,
              expandedFilter === "recency" && groupsStyles.filterDropdownHeaderOpen,
            ]}
            onPress={() => toggleFilterSection("recency")}
          >
            <View style={groupsStyles.filterDropdownTitleWrap}>
              <Text style={groupsStyles.filterLabel}>Recency</Text>
              <Text style={groupsStyles.filterDropdownValue}>{selectedRecencyLabel}</Text>
            </View>
            <Text style={groupsStyles.filterChevron}>{expandedFilter === "recency" ? "▾" : "▸"}</Text>
          </Pressable>
          {expandedFilter === "recency" ? (
            <View style={groupsStyles.filterOptionsList}>
              {recencyOptions.map((option, index) => (
                <Pressable
                  key={option.value}
                  style={[
                    groupsStyles.filterOptionRow,
                    recency === option.value && groupsStyles.filterOptionRowActive,
                    index === recencyOptions.length - 1 && groupsStyles.filterOptionRowLast,
                  ]}
                  onPress={() => {
                    setRecency(option.value);
                    setExpandedFilter(null);
                  }}
                >
                  <Text
                    style={[
                      groupsStyles.filterOptionLabel,
                      recency === option.value && groupsStyles.filterOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={groupsStyles.filterDropdownSection}>
          <Pressable
            style={[
              groupsStyles.filterDropdownHeader,
              expandedFilter === "category" && groupsStyles.filterDropdownHeaderOpen,
            ]}
            onPress={() => toggleFilterSection("category")}
          >
            <View style={groupsStyles.filterDropdownTitleWrap}>
              <Text style={groupsStyles.filterLabel}>Category</Text>
              <Text style={groupsStyles.filterDropdownValue}>{selectedCategoryLabel}</Text>
            </View>
            <Text style={groupsStyles.filterChevron}>{expandedFilter === "category" ? "▾" : "▸"}</Text>
          </Pressable>
          {expandedFilter === "category" ? (
            <View style={groupsStyles.filterOptionsList}>
              {categoryOptions.map((option, index) => (
                <Pressable
                  key={option.value}
                  style={[
                    groupsStyles.filterOptionRow,
                    categoryFilter === option.value && groupsStyles.filterOptionRowActive,
                    index === categoryOptions.length - 1 && groupsStyles.filterOptionRowLast,
                  ]}
                  onPress={() => {
                    setCategoryFilter(option.value);
                    setExpandedFilter(null);
                  }}
                >
                  <Text
                    style={[
                      groupsStyles.filterOptionLabel,
                      categoryFilter === option.value && groupsStyles.filterOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={groupsStyles.filterDropdownSection}>
          <Pressable
            style={[
              groupsStyles.filterDropdownHeader,
              expandedFilter === "proximity" && groupsStyles.filterDropdownHeaderOpen,
            ]}
            onPress={() => toggleFilterSection("proximity")}
          >
            <View style={groupsStyles.filterDropdownTitleWrap}>
              <Text style={groupsStyles.filterLabel}>Proximity</Text>
              <Text style={groupsStyles.filterDropdownValue}>{selectedProximityLabel}</Text>
            </View>
            <Text style={groupsStyles.filterChevron}>{expandedFilter === "proximity" ? "▾" : "▸"}</Text>
          </Pressable>
          {expandedFilter === "proximity" ? (
            <View style={groupsStyles.filterOptionsList}>
              {proximityOptions.map((option, index) => (
                <Pressable
                  key={option.value}
                  style={[
                    groupsStyles.filterOptionRow,
                    proximity === option.value && groupsStyles.filterOptionRowActive,
                    index === proximityOptions.length - 1 && groupsStyles.filterOptionRowLast,
                  ]}
                  onPress={() => {
                    setProximity(option.value);
                    setExpandedFilter(null);
                  }}
                >
                  <Text
                    style={[
                      groupsStyles.filterOptionLabel,
                      proximity === option.value && groupsStyles.filterOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <View style={groupsStyles.filterDropdownSection}>
          <Pressable
            style={[
              groupsStyles.filterDropdownHeader,
              expandedFilter === "sort" && groupsStyles.filterDropdownHeaderOpen,
            ]}
            onPress={() => toggleFilterSection("sort")}
          >
            <View style={groupsStyles.filterDropdownTitleWrap}>
              <Text style={groupsStyles.filterLabel}>Sort by</Text>
              <Text style={groupsStyles.filterDropdownValue}>{selectedSortLabel}</Text>
            </View>
            <Text style={groupsStyles.filterChevron}>{expandedFilter === "sort" ? "▾" : "▸"}</Text>
          </Pressable>
          {expandedFilter === "sort" ? (
            <View style={groupsStyles.filterOptionsList}>
              {sortOptions.map((option, index) => (
                <Pressable
                  key={option.value}
                  style={[
                    groupsStyles.filterOptionRow,
                    sortBy === option.value && groupsStyles.filterOptionRowActive,
                    index === sortOptions.length - 1 && groupsStyles.filterOptionRowLast,
                  ]}
                  onPress={() => {
                    setSortBy(option.value);
                    setExpandedFilter(null);
                  }}
                >
                  <Text
                    style={[
                      groupsStyles.filterOptionLabel,
                      sortBy === option.value && groupsStyles.filterOptionLabelActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
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

      {!loading && visibleGroups.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No groups match those filters yet.</Text>
        </Card>
      ) : null}

      {visibleGroups.map((group) => {
        const isOwnGroup = group.creator.id === user.id;
        const isPending =
          group.joinPolicy === "application" &&
          group.applicationStatus === "pending" &&
          !group.joinedByUser;
        const isDenied =
          group.joinPolicy === "application" &&
          group.applicationStatus === "denied" &&
          !group.joinedByUser;
        const joinLabel = group.joinedByUser
          ? "Joined"
          : isPending
          ? "Pending"
          : isDenied
          ? "Reapply"
          : group.joinPolicy === "application"
          ? "Apply"
          : "Join";
        const locationLabel = group.isRemote
          ? "Remote"
          : group.city
          ? `${group.city} - ${group.location}`
          : group.location;
        const distanceLabel =
          Number.isFinite(group.distanceKm ?? Number.NaN) && !group.isRemote
            ? `${(group.distanceKm as number).toFixed(1)} km away`
            : null;

        return (
          <Card key={group.id} style={groupsStyles.groupCard}>
            {group.imageUrl ? (
              <Image source={{ uri: group.imageUrl }} style={groupsStyles.groupImage} resizeMode="cover" />
            ) : (
              <View style={groupsStyles.groupImageFallback}>
                <Text style={groupsStyles.groupImageFallbackLabel}>{group.category}</Text>
              </View>
            )}

            <View style={groupsStyles.groupContent}>
              <View style={groupsStyles.groupTopRow}>
                <View style={groupsStyles.groupMetaRow}>
                  <Text style={groupsStyles.groupMetaText}>{group.category}</Text>
                  <Text style={groupsStyles.groupMetaText}>{group.memberCount} members</Text>
                  {group.joinPolicy === "application" ? (
                    <Text style={groupsStyles.groupMetaText}>Application</Text>
                  ) : null}
                </View>

                {!isOwnGroup ? (
                  <Pressable
                    style={[
                      groupsStyles.joinPill,
                      group.joinedByUser
                        ? groupsStyles.joinPillJoined
                        : isPending
                        ? groupsStyles.joinPillPending
                        : isDenied
                        ? groupsStyles.joinPillDenied
                        : groupsStyles.joinPillDefault,
                    ]}
                    disabled={joiningIds.has(group.id) || isPending}
                    onPress={() => {
                      void handleMembershipToggle(group);
                    }}
                  >
                    <Text
                      style={[
                        groupsStyles.joinPillText,
                        group.joinedByUser
                          ? groupsStyles.joinPillTextJoined
                          : isPending
                          ? groupsStyles.joinPillTextPending
                          : isDenied
                          ? groupsStyles.joinPillTextDenied
                          : groupsStyles.joinPillTextDefault,
                      ]}
                    >
                      {joiningIds.has(group.id) ? "..." : joinLabel}
                    </Text>
                  </Pressable>
                ) : (
                  <View style={[groupsStyles.joinPill, groupsStyles.ownerPill]}>
                    <Text style={[groupsStyles.joinPillText, groupsStyles.ownerPillText]}>Owner</Text>
                  </View>
                )}
              </View>

              <Text style={groupsStyles.groupTitle}>{group.title}</Text>
              <Text style={groupsStyles.groupDescription}>{group.description}</Text>

              <View style={groupsStyles.groupFooterRow}>
                <Text style={groupsStyles.groupFooterText}>
                  {locationLabel}
                  {distanceLabel ? ` - ${distanceLabel}` : ""}
                </Text>
                <Text style={groupsStyles.groupFooterText}>{formatRelativeTime(group.createdAt)}</Text>
              </View>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
};

const groupsStyles = StyleSheet.create({
  container: {
    paddingTop: 10,
    paddingBottom: 120,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 31,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6b7280",
  },
  composerCard: {
    gap: 10,
    borderColor: "#f2d7c8",
    backgroundColor: "#fffaf8",
  },
  composerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  filtersCard: {
    gap: 12,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  filterSection: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  filterDropdownSection: {
    gap: 8,
  },
  filterDropdownHeader: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterDropdownHeaderOpen: {
    borderColor: "#ff8557",
    backgroundColor: "#fff7f3",
  },
  filterDropdownTitleWrap: {
    gap: 3,
    flex: 1,
  },
  filterDropdownValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  filterChevron: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 8,
  },
  filterOptionsList: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },
  filterOptionRow: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  filterOptionRowLast: {
    borderBottomWidth: 0,
  },
  filterOptionRowActive: {
    backgroundColor: "#fff3ee",
  },
  filterOptionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4b5563",
  },
  filterOptionLabelActive: {
    color: "#cf5f35",
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: "#ff8557",
    backgroundColor: "#fff3ee",
  },
  filterChipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
  },
  filterChipLabelActive: {
    color: "#cf5f35",
  },
  groupCard: {
    overflow: "hidden",
    padding: 0,
    borderColor: "#e5e7eb",
  },
  groupImage: {
    width: "100%",
    height: 126,
  },
  groupImageFallback: {
    width: "100%",
    height: 126,
    backgroundColor: "#f9f6f3",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f0ece7",
  },
  groupImageFallbackLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b8f9b",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  groupContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  groupTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  groupMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  groupMetaText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7b8794",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  groupTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#111827",
  },
  groupDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#6b7280",
  },
  joinPill: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  joinPillDefault: {
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  joinPillJoined: {
    borderColor: "#10b981",
    backgroundColor: "#10b981",
  },
  joinPillPending: {
    borderColor: "#fcd34d",
    backgroundColor: "#fef3c7",
  },
  joinPillDenied: {
    borderColor: "#fda4af",
    backgroundColor: "#fff1f2",
  },
  ownerPill: {
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
  },
  joinPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  joinPillTextDefault: {
    color: "#4b5563",
  },
  joinPillTextJoined: {
    color: "#ffffff",
  },
  joinPillTextPending: {
    color: "#92400e",
  },
  joinPillTextDenied: {
    color: "#be123c",
  },
  ownerPillText: {
    color: "#1d4ed8",
  },
  groupFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  groupFooterText: {
    fontSize: 11,
    color: "#6b7280",
  },
});
