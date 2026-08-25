export type ProductionInitialization = {
  migrate(): Promise<void>;
  importEcdict(): Promise<{ imported: number }>;
  rebuildCatalog(): Promise<{ indexed: number }>;
  verify(): Promise<{ ready: boolean }>;
};

export type ProductionInitializationResult = {
  status: 'ready';
  ecdictEntries: number;
  catalogEntries: number;
};

async function phase<T>(name: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${name}: ${detail}`, { cause: error });
  }
}

export async function initializeProduction(initialization: ProductionInitialization): Promise<ProductionInitializationResult> {
  await phase('migration', () => initialization.migrate());
  const ecdict = await phase('ecdict', () => initialization.importEcdict());
  const catalog = await phase('catalog', () => initialization.rebuildCatalog());
  const verification = await phase('verification', () => initialization.verify());
  if (!verification.ready) throw new Error('verification: production dependencies are not ready');
  return { status: 'ready', ecdictEntries: ecdict.imported, catalogEntries: catalog.indexed };
}
