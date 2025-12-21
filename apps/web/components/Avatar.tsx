import type { HTMLAttributes } from "react";

const colorClasses = [
  "bg-amber-200",
  "bg-emerald-200",
  "bg-rose-200",
  "bg-sky-200",
];

type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  size?: number;
};

export const Avatar = ({ name, size = 40, className, ...props }: AvatarProps) => {
  const initial = name.charAt(0).toUpperCase();
  const colorClass = colorClasses[name.length % colorClasses.length];

  return (
    <div
      className={`flex items-center justify-center rounded-full text-sm font-semibold text-ink ${colorClass} ${className ?? ""}`}
      style={{ width: size, height: size }}
      {...props}
    >
      {initial}
    </div>
  );
};
