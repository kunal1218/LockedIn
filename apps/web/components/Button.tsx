"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { useAuth } from "@/features/auth/AuthProvider";

const baseClasses =
  "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-70";

const variantClasses = {
  primary:
    "bg-accent text-white shadow-[0_12px_30px_rgba(255,134,88,0.25)] hover:translate-y-[-1px]",
  outline:
    "border border-card-border bg-white/80 text-ink hover:border-accent/60",
  ghost: "text-ink/80 hover:text-ink",
  profile:
    "rounded-2xl border border-ink/10 bg-gradient-to-br from-white via-white to-accent-4/40 px-5 py-2.5 text-ink shadow-[0_12px_28px_rgba(27,26,23,0.08)] hover:translate-y-[-1px] hover:border-accent/40 hover:shadow-[0_16px_32px_rgba(255,134,88,0.16)]",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClasses;
  requiresAuth?: boolean;
  authMode?: "login" | "signup";
};

export const Button = ({
  variant = "primary",
  className,
  requiresAuth = true,
  authMode,
  onClick,
  ...props
}: ButtonProps) => {
  const { isAuthenticated, openAuthModal } = useAuth();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (props.disabled) {
      return;
    }

    if (requiresAuth && !isAuthenticated) {
      event.preventDefault();
      openAuthModal(authMode);
      return;
    }

    onClick?.(event);
  };

  return (
    <button
      type={props.type ?? "button"}
      className={`${baseClasses} ${variantClasses[variant]} ${className ?? ""}`}
      onClick={handleClick}
      {...props}
    />
  );
};
