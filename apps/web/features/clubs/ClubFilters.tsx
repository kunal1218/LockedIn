import { Tag } from "@/components/Tag";
import type { ClubCategory } from "./types";

export type ClubRecencyFilter = "all" | "24h" | "168h";
export type ClubCategoryFilter = "all" | ClubCategory;
export type ClubSortOption = "recency" | "members" | "distance";
export type ClubProximityFilter = "all" | "nearby" | "remote";

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

type ClubFiltersProps = {
  recency: ClubRecencyFilter;
  onRecencyChange: (value: ClubRecencyFilter) => void;
  category: ClubCategoryFilter;
  onCategoryChange: (value: ClubCategoryFilter) => void;
  proximity: ClubProximityFilter;
  onProximityChange: (value: ClubProximityFilter) => void;
  sortBy: ClubSortOption;
  onSortChange: (value: ClubSortOption) => void;
};

export const ClubFilters = ({
  recency,
  onRecencyChange,
  category,
  onCategoryChange,
  proximity,
  onProximityChange,
  sortBy,
  onSortChange,
}: ClubFiltersProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Recency window
        </p>
        <div className="flex flex-wrap gap-2">
          {recencyOptions.map((option) => (
            <Tag
              key={option.value}
              tone={recency === option.value ? "accent" : "default"}
              className="cursor-pointer"
              onClick={() => onRecencyChange(option.value)}
            >
              {option.label}
            </Tag>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((option) => (
            <Tag
              key={option.value}
              tone={category === option.value ? "accent" : "default"}
              className="cursor-pointer"
              onClick={() => onCategoryChange(option.value)}
            >
              {option.label}
            </Tag>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Proximity
        </p>
        <div className="flex flex-wrap gap-2">
          {proximityOptions.map((option) => (
            <Tag
              key={option.value}
              tone={proximity === option.value ? "accent" : "default"}
              className="cursor-pointer"
              onClick={() => onProximityChange(option.value)}
            >
              {option.label}
            </Tag>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Sort by
        </p>
        <div className="flex flex-wrap gap-2">
          {sortOptions.map((option) => (
            <Tag
              key={option.value}
              tone={sortBy === option.value ? "accent" : "default"}
              className="cursor-pointer"
              onClick={() => onSortChange(option.value)}
            >
              {option.label}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
};
