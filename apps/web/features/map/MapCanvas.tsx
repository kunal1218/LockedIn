import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";

const markers = [
  { label: "Picnic", className: "top-[22%] left-[18%]" },
  { label: "Brainstorm", className: "top-[48%] left-[52%]" },
  { label: "Open mic", className: "top-[65%] left-[30%]" },
];

export const MapCanvas = () => {
  return (
    <Card className="relative min-h-[420px] overflow-hidden p-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff,transparent_55%),radial-gradient(circle_at_bottom,#ffe1b4,transparent_45%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(54,181,166,0.12),rgba(255,134,88,0.1))]" />
      <div className="relative flex h-full flex-col justify-between p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold">Campus Map</h2>
            <p className="text-sm text-muted">Tap a spot, claim a hangout.</p>
          </div>
          <Tag tone="accent">Map-first</Tag>
        </div>
        <div className="relative mt-6 flex-1 rounded-[20px] border border-dashed border-accent/40 bg-white/60">
          <div className="absolute inset-0 rounded-[20px] bg-[radial-gradient(circle,rgba(255,255,255,0.7)_0%,rgba(255,255,255,0)_70%)]" />
          {markers.map((marker) => (
            <div
              key={marker.label}
              className={`absolute ${marker.className} flex items-center gap-2`}
            >
              <span className="pulse-soft h-3 w-3 rounded-full bg-accent" />
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-ink shadow-sm">
                {marker.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-muted">
          <span>Map provider TODO</span>
          <span>·</span>
          <span>Zoom</span>
          <span>·</span>
          <span>Near me</span>
        </div>
      </div>
    </Card>
  );
};
