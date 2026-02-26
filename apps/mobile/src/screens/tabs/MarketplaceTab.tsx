import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View, Pressable } from "react-native";
import {
  type Listing,
  createListing,
  deleteListing,
  fetchListings,
  fetchMyListings,
  startMarketplaceConversation,
  updateListingStatus,
} from "../../api/actions";
import { ActionButton } from "../../components/ActionButton";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import type { SessionProps } from "../../types/session";
import { styles } from "../../styles/ui";

const marketplaceCategories: Listing["category"][] = [
  "Textbooks",
  "Electronics",
  "Furniture",
  "Clothing",
  "Other",
];

const marketplaceConditions: Listing["condition"][] = [
  "New",
  "Like New",
  "Good",
  "Fair",
];

export const MarketplaceTab = ({ token, user, onAuthExpired }: SessionProps) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListingIds, setMyListingIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Listing["category"]>("Other");
  const [condition, setCondition] = useState<Listing["condition"]>("Good");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allListings, mine] = await Promise.all([fetchListings(), fetchMyListings(token)]);
      setListings(allListings);
      setMyListingIds(new Set(mine.map((listing) => listing.id)));
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
    void load();
  }, [load]);

  const submitListing = async () => {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const parsedPrice = Number(price);

    if (!normalizedTitle || !normalizedDescription || !Number.isFinite(parsedPrice)) {
      setError("Title, description, and numeric price are required.");
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const listing = await createListing(
        {
          title: normalizedTitle,
          description: normalizedDescription,
          price: parsedPrice,
          category,
          condition,
        },
        token
      );
      setListings((prev) => [listing, ...prev]);
      setMyListingIds((prev) => new Set(prev).add(listing.id));
      setTitle("");
      setDescription("");
      setPrice("");
    } catch (submitError) {
      if (isAuthError(submitError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(submitError));
    } finally {
      setPosting(false);
    }
  };

  const handleToggleSold = async (listing: Listing) => {
    try {
      const nextStatus: Listing["status"] = listing.status === "active" ? "sold" : "active";
      const updated = await updateListingStatus(listing.id, nextStatus, token);
      setListings((prev) => prev.map((item) => (item.id === listing.id ? updated : item)));
    } catch (statusError) {
      if (isAuthError(statusError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(statusError));
    }
  };

  const handleDelete = async (listingId: string) => {
    try {
      await deleteListing(listingId, token);
      setListings((prev) => prev.filter((listing) => listing.id !== listingId));
      setMyListingIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    } catch (deleteError) {
      if (isAuthError(deleteError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(deleteError));
    }
  };

  const handleMessageSeller = async (listingId: string) => {
    try {
      await startMarketplaceConversation(listingId, "Hey, is this still available?", token);
      Alert.alert("Message sent", "Conversation started with the seller.");
    } catch (messageError) {
      if (isAuthError(messageError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(messageError));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.sectionTitle}>Create Listing</Text>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Calculus textbook"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Condition, pickup details, etc."
          multiline
        />

        <Text style={styles.label}>Price</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="25"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.inlineActions}>
          {marketplaceCategories.map((option) => (
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

        <Text style={styles.label}>Condition</Text>
        <View style={styles.inlineActions}>
          {marketplaceConditions.map((option) => (
            <Pressable
              key={option}
              style={[styles.chip, condition === option && styles.chipActive]}
              onPress={() => setCondition(option)}
            >
              <Text style={[styles.chipLabel, condition === option && styles.chipLabelActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        <ActionButton
          label={posting ? "Posting..." : "Create listing"}
          onPress={() => {
            void submitListing();
          }}
          disabled={posting}
        />
      </Card>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Listings</Text>
        <ActionButton
          label={loading ? "Refreshing..." : "Refresh"}
          onPress={() => {
            void load();
          }}
          disabled={loading}
          tone="muted"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#2563eb" /> : null}

      {listings.map((listing) => {
        const isMine = myListingIds.has(listing.id) || listing.seller.id === user.id;

        return (
          <Card key={listing.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{listing.title}</Text>
              <Text style={styles.cardPrice}>${listing.price}</Text>
            </View>
            <Text style={styles.cardBody}>{listing.description}</Text>
            <Text style={styles.mutedText}>
              {listing.category} • {listing.condition} • {listing.status}
            </Text>
            <Text style={styles.mutedText}>Seller: {listing.seller.name}</Text>

            <View style={styles.inlineActions}>
              {isMine ? (
                <>
                  <ActionButton
                    label={listing.status === "sold" ? "Mark active" : "Mark sold"}
                    tone="muted"
                    onPress={() => {
                      void handleToggleSold(listing);
                    }}
                  />
                  <ActionButton
                    label="Delete"
                    tone="danger"
                    onPress={() => {
                      void handleDelete(listing.id);
                    }}
                  />
                </>
              ) : (
                <ActionButton
                  label="Message seller"
                  tone="muted"
                  onPress={() => {
                    void handleMessageSeller(listing.id);
                  }}
                />
              )}
            </View>
          </Card>
        );
      })}

      {!loading && listings.length === 0 ? (
        <Text style={styles.emptyText}>No marketplace listings yet.</Text>
      ) : null}
    </ScrollView>
  );
};
