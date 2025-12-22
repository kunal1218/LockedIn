"use client";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { profile } from "./mock";

export const ProfileHeader = () => {
  const { user } = useAuth();
  const displayName = user?.name ?? profile.name;
  const displayHandle = user?.handle ?? profile.handle;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-16 -top-12 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
      <div className="absolute -bottom-10 left-16 h-24 w-24 rounded-full bg-accent-2/20 blur-2xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size={72} className="text-2xl" />
          <div>
            <p className="font-display text-2xl font-semibold text-ink">
              {displayName}
            </p>
            <p className="text-sm text-muted">{displayHandle}</p>
            <p className="mt-2 text-sm text-ink/80">{profile.bio}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.badges.map((badge) => (
                <Tag key={badge} tone="sun">
                  {badge}
                </Tag>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="profile">Edit profile</Button>
          <Button variant="profile">Share vibe</Button>
        </div>
      </div>
    </Card>
  );
};
