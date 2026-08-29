import { cardRows, courseSeries } from '@/lib/admin-data';
import AdminCourses from './AdminCourses';

export default function Page() {
  const cards = cardRows();
  const series = courseSeries();
  return <AdminCourses cards={cards} series={series} />;
}