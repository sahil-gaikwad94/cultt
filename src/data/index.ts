import { MockRepo } from './mockRepo';
import { SupabaseRepo } from './supabaseRepo';
import { v5config } from '../store/config';
import type { Repo } from '../lib/types';

export const createRepo = (): Repo => {
  const cfg = (window as Window & { CULTURED_CONFIG?: { backend?: string; supabaseUrl?: string; supabaseAnonKey?: string } }).CULTURED_CONFIG;
  if (cfg?.backend === 'supabase') return new SupabaseRepo(cfg.supabaseUrl ?? '', cfg.supabaseAnonKey ?? '');
  /* The mock adapter is the default backend, so its invented population has to
     be opt-in: `v5config.demo` is `?demo=1` or an explicit config value, and
     never true on its own. */
  return new MockRepo(Date.now(), v5config.demo);
};
