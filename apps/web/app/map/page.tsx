import { EventList, MapCanvas } from "@/features/map";

export default function MapPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_0.9fr]">
        <MapCanvas />
        <EventList />
      </div>
    </div>
  );
}
