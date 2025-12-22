"use client";

import type { KeyboardEvent } from "react";
import { Card } from "@/components/Card";

type ProfileQuestionCardProps = {
  title: string;
  answer?: string;
  onEdit?: () => void;
};

export const ProfileQuestionCard = ({
  title,
  answer,
  onEdit,
}: ProfileQuestionCardProps) => {
  const trimmed = answer?.trim();
  const isEditable = Boolean(onEdit);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onEdit) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit();
    }
  };

  return (
    <Card
      className={
        isEditable
          ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(30,26,22,0.16)]"
          : undefined
      }
      role={isEditable ? "button" : undefined}
      tabIndex={isEditable ? 0 : undefined}
      onClick={onEdit}
      onKeyDown={handleKeyDown}
      aria-label={isEditable ? `Edit answer for ${title}` : undefined}
    >
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">
        {trimmed ? trimmed : "Answer this to personalize your profile."}
      </p>
    </Card>
  );
};
