import { courseWordCatalog } from '../../lib/course-data';
import WordsCenter from './WordsCenter';

export const metadata = { title: '词汇中心 | IKIDs' };

export default function WordsPage() { return <WordsCenter words={courseWordCatalog()} />; }
