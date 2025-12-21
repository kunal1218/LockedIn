export const BackgroundDecor = () => {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 left-[-120px] h-[360px] w-[360px] rounded-full bg-accent-4/70 blur-3xl" />
      <div className="absolute top-40 right-[-140px] h-[420px] w-[420px] rounded-full bg-accent-2/30 blur-3xl" />
      <div className="absolute bottom-[-120px] left-[40%] h-[280px] w-[280px] rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute bottom-24 right-[20%] h-[120px] w-[120px] rounded-full border border-accent/30 bg-white/40 blur-xl" />
    </div>
  );
};
