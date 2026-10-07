import { MockRepo } from './mockRepo';
import { v5config } from '../store/config';
import type { Repo } from '../lib/types';

/* Supabase is the optional backend: it is only ever constructed when the host
   page sets `CULTURED_CONFIG.backend === 'supabase'`. Importing it statically
   here put `@supabase/supabase-js` on the first-paint critical path for every
   visitor, and the default install never uses it — so the import is dynamic and
   `createRepo` is async. That keeps the client out of the entry chunk and takes
   the v5 first-boot JS back inside the §10 budget. */
export const createRepo = async (): Promise<Repo> => {
  const cfg = (window as Window & { CULTURED_CONFIG?: { backend?: string; supabaseUrl?: string; supabaseAnonKey?: string } }).CULTURED_CONFIG;
  if (cfg?.backend === 'supabase') {
    const { SupabaseRepo } = await import('./supabaseRepo');
    return new SupabaseRepo(cfg.supabaseUrl ?? '', cfg.supabaseAnonKey ?? '');
  }
  /* The mock adapter is the default backend, so its invented population has to
     be opt-in: `v5config.demo` is `?demo=1` or an explicit config value, and
     never true on its own. */
  return new MockRepo(Date.now(), v5config.demo);
};

/* The synchronous default, for callers that cannot await and never run against
   Supabase. Same demo gate, so it cannot hand out the invented population. */
export const createMockRepo = (): Repo => new MockRepo(Date.now(), v5config.demo);
