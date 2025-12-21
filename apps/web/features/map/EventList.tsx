import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { formatEventTime } from "@/lib/time";
import { events } from "./mock";

export const EventList = () => {
  return (
    <section className="space-y-5">
      <div>
        <h3 className="font-display text-xl font-semibold">Nearby events</h3>
        <p className="text-sm text-muted">Pick a vibe and show up.</p>
      </div>
      {events.map((event) => (
        <Card key={event.id} className="space-y-4">
          <div className="flex items-center justify-between">
            <Tag tone="mint">{event.category}</Tag>
            <span className="text-xs text-muted">
              {formatEventTime(event.startsAt)}
            </span>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-ink">{event.title}</h4>
            <p className="text-sm text-muted">{event.location}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">
              {event.attendees} people · {event.vibe}
            </span>
            <Button variant="outline">I am down</Button>
          </div>
        </Card>
      ))}
    </section>
  );
};
