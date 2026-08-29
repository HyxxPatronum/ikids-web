import { courseWordCatalog } from '@/lib/admin-data';
import AdminWords from './AdminWords';

export default function Page() {
  const words = courseWordCatalog();
  return <AdminWords words={words} />;
}