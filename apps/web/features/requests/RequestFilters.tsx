import { Tag } from "@/components/Tag";

export type RecencyFilter = "all" | "1h" | "24h" | "168h";

const recencyOptions: Array<{ label: string; value: RecencyFilter }> = [
  { label: "Past hour", value: "1h" },
  { label: "Today", value: "24h" },
  { label: "This week", value: "168h" },
  { label: "All time", value: "all" },
];

type RequestFiltersProps = {
  recency: RecencyFilter;
  onRecencyChange: (value: RecencyFilter) => void;
};

export const RequestFilters = ({ recency, onRecencyChange }: RequestFiltersProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Recency
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
          Type
        </p>
        <div className="flex flex-wrap gap-2">
          {["All", "Help", "Build", "Fun", "Creative"].map((option, index) => (
            <Tag key={option} tone={index === 0 ? "accent" : "default"}>
              {option}
            </Tag>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Distance
        </p>
        <div className="flex flex-wrap gap-2">
          {["Nearby", "15 min", "Anywhere"].map((option, index) => (
            <Tag key={option} tone={index === 0 ? "accent" : "default"}>
              {option}
            </Tag>
          ))}
        </div>
      </div>
    </div>
  );
};
