import type { Repo } from '../lib/types';
export function installRepoBridge(repo: Repo) {
  const existing = (window as Window & { Cultured?: Record<string, unknown> }).Cultured ?? {};
  (window as Window & { Cultured?: Record<string, unknown> }).Cultured = { ...existing, repo, phase: '1', flags: { ugc: false, phoneOtp: false } };
}
