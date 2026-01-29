import {
  CampusPulse,
  DailyChallenge,
  Feed,
  ScrollToTopOnMount,
  UniChat,
} from "@/features/home";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <ScrollToTopOnMount />
      <div className="space-y-8">
        <div className="reveal-up">
          <DailyChallenge />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6 reveal-up" style={{ animationDelay: "120ms" }}>
            <Feed />
          </div>
          <aside className="space-y-6 reveal-up" style={{ animationDelay: "220ms" }}>
            <UniChat />
            <CampusPulse />
          </aside>
        </div>
      </div>
    </div>
  );
}
