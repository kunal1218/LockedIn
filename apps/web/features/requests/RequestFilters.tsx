import { Tag } from "@/components/Tag";

export type RecencyFilter = "all" | "1h" | "24h" | "168h";
export type UrgencyFilter = "all" | "low" | "medium" | "high";
export type SortOption = "recency" | "likes" | "urgency";
export type ProximityFilter = "all" | "remote" | "local";

const recencyOptions: Array<{ label: string; value: RecencyFilter }> = [
  { label: "Past hour", value: "1h" },
  { label: "Today", value: "24h" },
  { label: "This week", value: "168h" },
  { label: "All time", value: "all" },
];

const urgencyOptions: Array<{ label: string; value: UrgencyFilter }> = [
  { label: "Any urgency", value: "all" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: "Most recent", value: "recency" },
  { label: "Most liked", value: "likes" },
];

const proximityOptions: Array<{ label: string; value: ProximityFilter }> = [
  { label: "All", value: "all" },
  { label: "Remote", value: "remote" },
  { label: "In-person", value: "local" },
];

type RequestFiltersProps = {
  recency: RecencyFilter;
  onRecencyChange: (value: RecencyFilter) => void;
  urgency: UrgencyFilter;
  onUrgencyChange: (value: UrgencyFilter) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  proximity: ProximityFilter;
  onProximityChange: (value: ProximityFilter) => void;
};

export const RequestFilters = ({
  recency,
  onRecencyChange,
  urgency,
  onUrgencyChange,
  sortBy,
  onSortChange,
  proximity,
  onProximityChange,
}: RequestFiltersProps) => {
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
          Urgency
        </p>
        <div className="flex flex-wrap gap-2">
          {urgencyOptions.map((option) => (
            <Tag
              key={option.value}
              tone={urgency === option.value ? "accent" : "default"}
              className="cursor-pointer"
              onClick={() => onUrgencyChange(option.value)}
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
