import { PublicProfileView } from "@/features/profile/PublicProfileView";

type PublicProfilePageProps = {
  params: {
    handle: string;
  };
};

export default function PublicProfilePage({ params }: PublicProfilePageProps) {
  return <PublicProfileView handle={params.handle} />;
}
