import { MockRepo } from './mockRepo';
import { SupabaseRepo } from './supabaseRepo';
import type { Repo } from '../lib/types';
export const createRepo = (): Repo => {
  const cfg = (window as Window & { CULTURED_CONFIG?: { backend?: string; supabaseUrl?: string; supabaseAnonKey?: string } }).CULTURED_CONFIG;
  return cfg?.backend === 'supabase' ? new SupabaseRepo(cfg.supabaseUrl ?? '', cfg.supabaseAnonKey ?? '') : new MockRepo();
};
