import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";

const pulseItems: Array<{
  label: string;
  count: number;
  tone: "default" | "accent" | "mint" | "sun";
}> = [
  { label: "Cofounder search", count: 12, tone: "accent" },
  { label: "Basketball runs", count: 7, tone: "sun" },
  { label: "Late-night diner", count: 9, tone: "mint" },
  { label: "Design collab", count: 5, tone: "default" },
];

export const CampusPulse = () => {
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold">Campus Pulse</h3>
        <p className="text-sm text-muted">What is popping in the last hour.</p>
      </div>
      <div className="space-y-3">
        {pulseItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{item.label}</span>
            <Tag tone={item.tone}>
              {item.count} posts
            </Tag>
          </div>
        ))}
      </div>
    </Card>
  );
};
