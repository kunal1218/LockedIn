import Link from "next/link";
import { Card } from "@/components/Card";

const ctaClasses =
  "inline-flex items-center justify-center rounded-full border border-card-border bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent/60";

export default function FriendsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold">Friends</h1>
          <p className="text-sm text-muted">
            Keep tabs on the people you want to build with.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Your circle</h2>
            <p className="text-sm text-muted">
              Your friends list is empty for now. Start a convo and we will fill
              this space with your people.
            </p>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Find new people</h2>
            <p className="text-sm text-muted">
              Browse live campus energy or jump into open requests.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/map" className={ctaClasses}>
                Explore map
              </Link>
              <Link href="/requests" className={ctaClasses}>
                View requests
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
