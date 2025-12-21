import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { feedPosts } from "./mock";
import { PollCard } from "./PollCard";
import { PostCard } from "./PostCard";

const filterTags = ["All", "Build", "Help", "Chaos", "Cofounder"];

export const Feed = () => {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Global Feed</h2>
          <p className="text-sm text-muted">What your campus is up to right now.</p>
        </div>
        <Card className="hidden items-center gap-2 px-4 py-2 sm:flex">
          <span className="text-xs font-semibold text-muted">Sort</span>
          <Tag tone="accent">Fresh</Tag>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        {filterTags.map((tag) => (
          <Tag key={tag} tone={tag === "All" ? "accent" : "default"}>
            {tag}
          </Tag>
        ))}
      </div>
      <div className="space-y-5">
        {feedPosts.map((post) =>
          post.type === "poll" ? (
            <PollCard key={post.id} post={post} />
          ) : (
            <PostCard key={post.id} post={post} />
          )
        )}
      </div>
    </section>
  );
};
