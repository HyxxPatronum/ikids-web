export type LearningProgress = {
  cardId: string;
  completedPercent: number;
  moduleStatus: Record<string, { completed?: boolean; score?: number }>;
  answers: Record<string, string>;
  rebuild: number[];
  lastModule?: string;
  checked?: Record<string, boolean>;
  updatedAt: string;
};

const progressKey = 'fluent-learning-progress-v2';

const browser = () => typeof window !== 'undefined';

export function readProgress(): Record<string, LearningProgress> {
  if (!browser()) return {};
  try { return JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch { return {}; }
}

export function progressFor(cardId: string): LearningProgress {
  return readProgress()[cardId] || { cardId, completedPercent: 0, moduleStatus: {}, answers: {}, rebuild: [], checked: {}, updatedAt: '' };
}

export function saveProgress(next: LearningProgress) {
  if (!browser()) return;
  localStorage.setItem(progressKey, JSON.stringify({ ...readProgress(), [next.cardId]: { ...next, updatedAt: new Date().toISOString() } }));
}
