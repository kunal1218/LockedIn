import { EventDrawer, MapCanvas } from "@/features/map";

export default function MapPage() {
  return (
    <div className="relative h-[calc(100svh-96px)] min-h-[calc(100vh-96px)] w-full overflow-hidden">
      <MapCanvas />
      <EventDrawer />
    </div>
  );
}
