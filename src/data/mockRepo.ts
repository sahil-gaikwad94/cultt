import type { Decision, LegalDocument, Reaction, Repo, SafetyReason, Session } from '../lib/types';

const KEY = 'cultured2:repo-events';
const read = (): unknown[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[]; } catch { return []; } };
const write = (event: unknown) => localStorage.setItem(KEY, JSON.stringify([...read(), event]));

export class MockRepo implements Repo {
  async getSession(): Promise<Session> { return { userId: 'mock-user', onboarded: true, adult: true }; }
  async recordReaction(postId: string, reaction: Reaction) { write({ type: 'reaction', postId, reaction, at: new Date().toISOString() }); }
  async decide(candidateId: string, decision: Decision) { write({ type: 'decision', candidateId, decision, at: new Date().toISOString() }); return { matched: decision === 'resonate' }; }
  async sendMessage(threadId: string, body: string) { write({ type: 'message', threadId, body, at: new Date().toISOString() }); }
  async submitSafetyAction(targetId: string, reason: SafetyReason, note?: string) { write({ type: reason, targetId, note, at: new Date().toISOString() }); }
  async getLegalDocument(document: LegalDocument) { return { title: document === 'privacy' ? 'Privacy policy' : document === 'terms' ? 'Terms of use' : 'Community guidelines', body: 'Draft for review. This screen is intentionally marked needs lawyer review before launch.' }; }
  async requestDataExport() { const requestedAt = new Date().toISOString(); write({ type: 'export-request', requestedAt }); return { status: 'queued' as const, requestedAt }; }
  async requestAccountDeletion() { const effectiveAt = new Date(Date.now() + 14 * 86400000).toISOString(); write({ type: 'delete-request', effectiveAt }); return { status: 'cooling-off' as const, effectiveAt }; }
}
