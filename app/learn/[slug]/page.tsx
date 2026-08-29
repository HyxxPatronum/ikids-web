import { notFound } from 'next/navigation';
import { courseBySlug, publishedCourses } from '../../../lib/course-data';
import LearningExperience from './LearningExperience';

export default async function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = courseBySlug(slug);
  if (!course) notFound();
  const courses = publishedCourses();
  const index = courses.findIndex(item => item.slug === course.slug);
  return <LearningExperience course={course} previousLesson={courses[index - 1]?.slug} nextLesson={courses[index + 1]?.slug} />;
}
