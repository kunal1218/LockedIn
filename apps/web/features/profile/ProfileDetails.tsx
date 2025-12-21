import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { profile } from "./mock";

const renderTags = (items: string[], tone: "default" | "accent" | "mint" | "sun") => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <Tag key={item} tone={tone}>
        {item}
      </Tag>
    ))}
  </div>
);

export const ProfileDetails = () => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="font-display text-lg font-semibold">Interests</h3>
        <p className="text-sm text-muted">Stuff I get excited about.</p>
        <div className="mt-4">{renderTags(profile.interests, "mint")}</div>
      </Card>
      <Card>
        <h3 className="font-display text-lg font-semibold">Down to do</h3>
        <p className="text-sm text-muted">Low-stakes, high-energy.</p>
        <div className="mt-4">{renderTags(profile.downTo, "accent")}</div>
      </Card>
      <Card>
        <h3 className="font-display text-lg font-semibold">Needs help with</h3>
        <p className="text-sm text-muted">Be the hero.</p>
        <div className="mt-4">{renderTags(profile.needsHelpWith, "sun")}</div>
      </Card>
      <Card>
        <h3 className="font-display text-lg font-semibold">Vibes</h3>
        <p className="text-sm text-muted">How I show up.</p>
        <div className="mt-4">{renderTags(profile.vibes, "default")}</div>
      </Card>
    </div>
  );
};
