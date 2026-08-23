import { redirect } from 'next/navigation';

export default async function Lesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/index.html?lesson=${encodeURIComponent(slug)}`);
}
