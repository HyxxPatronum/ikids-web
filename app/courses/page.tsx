import { publishedCourses } from '../../lib/course-data';
import CourseCatalog from './CourseCatalog';

export const metadata = { title: '我的课程 | IKIDs' };

export default function CoursesPage() {
  return <CourseCatalog courses={publishedCourses()} />;
}
