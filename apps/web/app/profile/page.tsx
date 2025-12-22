import {
  ProfileDetails,
  ProfileHeader,
  ProfileLogout,
  ProfileSidePanel,
} from "@/features/profile";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <ProfileHeader />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <ProfileDetails />
          <ProfileSidePanel />
        </div>
        <ProfileLogout />
      </div>
    </div>
  );
}
