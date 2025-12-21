import { Tag } from "@/components/Tag";

const filterGroups = [
  {
    label: "Type",
    options: ["All", "Help", "Build", "Fun", "Creative"],
  },
  {
    label: "Distance",
    options: ["Nearby", "15 min", "Anywhere"],
  },
];

export const RequestFilters = () => {
  return (
    <div className="space-y-4">
      {filterGroups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.options.map((option, index) => (
              <Tag key={option} tone={index === 0 ? "accent" : "default"}>
                {option}
              </Tag>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
