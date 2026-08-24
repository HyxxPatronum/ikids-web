import LessonReader from './LessonReader';

export default async function Lesson({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <LessonReader slug={slug} />;
}
