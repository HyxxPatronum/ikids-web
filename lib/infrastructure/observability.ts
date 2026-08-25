const operationalFields = [
  'name', 'outcome', 'durationMs', 'cacheStatus', 'providerStatus', 'stale',
  'component', 'status', 'phase', 'count',
] as const;

export function createStructuredObserver(write: (record: Record<string, unknown>) => void) {
  return (event: Record<string, unknown>) => {
    const record: Record<string, unknown> = {};
    for (const field of operationalFields) if (event[field] !== undefined) record[field] = event[field];
    write(record);
  };
}
