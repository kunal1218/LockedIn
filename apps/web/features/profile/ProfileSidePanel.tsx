import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";

const openTo = ["Co-founder chats", "Hackathons", "Coffee walks"];

export const ProfileCurrentlyCard = () => {
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold">Currently</h3>
      <p className="text-sm text-muted">Heads down on a campus tools sprint.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {openTo.map((item) => (
          <Tag key={item} tone="mint">
            {item}
          </Tag>
        ))}
      </div>
    </Card>
  );
};

export const ProfileCrewCard = () => {
  return (
    <Card>
      <h3 className="font-display text-lg font-semibold">Crew count</h3>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-2xl bg-accent/10 px-3 py-4">
          <p className="font-display text-lg font-semibold text-ink">24</p>
          <p className="text-xs text-muted">friends</p>
        </div>
        <div className="rounded-2xl bg-accent-2/10 px-3 py-4">
          <p className="font-display text-lg font-semibold text-ink">7</p>
          <p className="text-xs text-muted">collabs</p>
        </div>
        <div className="rounded-2xl bg-accent-3/20 px-3 py-4">
          <p className="font-display text-lg font-semibold text-ink">3</p>
          <p className="text-xs text-muted">quests</p>
        </div>
      </div>
    </Card>
  );
};

export const ProfileSidePanel = () => {
  return (
    <div className="space-y-6">
      <ProfileCurrentlyCard />
      <ProfileCrewCard />
    </div>
  );
};
