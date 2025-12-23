import { PostDetail } from "@/features/home/PostDetail";

type PostPageProps = {
  params: {
    postId: string;
  };
};

export default function PostPage({ params }: PostPageProps) {
  return <PostDetail postId={params.postId} />;
}
