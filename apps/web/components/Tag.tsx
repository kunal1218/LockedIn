import type { HTMLAttributes } from "react";

type TagProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "accent" | "mint" | "sun";
};

const toneClasses = {
  default: "bg-card-border/40 text-ink/80",
  accent: "bg-accent/15 text-accent",
  mint: "bg-accent-2/15 text-accent-2",
  sun: "bg-accent-3/25 text-ink",
};

export const Tag = ({
  tone = "default",
  className,
  ...props
}: TagProps) => {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClasses[tone]} ${className ?? ""}`}
      {...props}
    />
  );
};
