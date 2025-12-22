"use client";

import { Card } from "@/components/Card";

type ProfileQuestionCardProps = {
  title: string;
  answer?: string;
};

export const ProfileQuestionCard = ({ title, answer }: ProfileQuestionCardProps) => {
  const trimmed = answer?.trim();

  return (
    <Card>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">
        {trimmed ? trimmed : "Answer this to personalize your profile."}
      </p>
    </Card>
  );
};
