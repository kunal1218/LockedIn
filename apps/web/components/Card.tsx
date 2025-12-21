import type { HTMLAttributes } from "react";

const baseClasses =
  "rounded-[24px] border border-card-border/70 bg-card/90 p-6 shadow-[0_20px_60px_rgba(30,26,22,0.08)] backdrop-blur";

type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = ({ className, ...props }: CardProps) => {
  return <div className={`${baseClasses} ${className ?? ""}`} {...props} />;
};
