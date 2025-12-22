"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";

export const ProfileLogout = () => {
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <Card className="flex flex-col items-start justify-between gap-4 border-accent/20 bg-gradient-to-br from-white via-white to-accent-4/40 sm:flex-row sm:items-center">
      <div>
        <p className="text-sm font-semibold text-ink">Taking a breather?</p>
        <p className="text-sm text-muted">
          Your profile stays ready for the next drop-in.
        </p>
      </div>
      <Button variant="profile" onClick={handleLogout}>
        Log out
      </Button>
    </Card>
  );
};
