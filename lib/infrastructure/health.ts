export type HealthCheckResult = { ok: boolean; detail: string };
export type HealthCheck = { check(): Promise<HealthCheckResult> };
export type ReadinessDependencies = {
  database: HealthCheck;
  ecdict: HealthCheck;
  catalog: HealthCheck;
  media: HealthCheck;
};

export type ReadinessResult = {
  status: 'ready' | 'degraded';
  checks: Record<keyof ReadinessDependencies, { status: 'ready' | 'failed'; detail: string }>;
};

export const liveness = () => ({ status: 'live' as const, service: 'fluent-science-reading' });

const errorDetail = (error: unknown) => error instanceof Error ? error.message : 'health check failed';

export function createHealthService(dependencies: ReadinessDependencies) {
  return {
    liveness() {
      return liveness();
    },
    async readiness(): Promise<ReadinessResult> {
      const names = Object.keys(dependencies) as Array<keyof ReadinessDependencies>;
      const results = await Promise.all(names.map(async name => {
        try {
          const result = await dependencies[name].check();
          return [name, { status: result.ok ? 'ready' as const : 'failed' as const, detail: result.detail }] as const;
        } catch (error) {
          return [name, { status: 'failed' as const, detail: errorDetail(error) }] as const;
        }
      }));
      const checks = Object.fromEntries(results) as ReadinessResult['checks'];
      return {
        status: Object.values(checks).every(check => check.status === 'ready') ? 'ready' : 'degraded',
        checks,
      };
    },
  };
}
