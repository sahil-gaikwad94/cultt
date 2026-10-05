export type Reaction = 'like' | 'laugh' | 'save';
export type Decision = 'pass' | 'resonate';
export type SafetyReason = 'report' | 'vibe-report' | 'block';
export type LegalDocument = 'privacy' | 'terms' | 'guidelines';

export interface Session { userId: string; onboarded: boolean; adult: boolean; }
export interface Repo {
  getSession(): Promise<Session>;
  recordReaction(postId: string, reaction: Reaction): Promise<void>;
  decide(candidateId: string, decision: Decision): Promise<{ matched: boolean }>;
  sendMessage(threadId: string, body: string): Promise<void>;
  submitSafetyAction(targetId: string, reason: SafetyReason, note?: string): Promise<void>;
  getLegalDocument(document: LegalDocument): Promise<{ title: string; body: string }>;
  requestDataExport(): Promise<{ status: 'queued'; requestedAt: string }>;
  requestAccountDeletion(): Promise<{ status: 'cooling-off'; effectiveAt: string }>;
}
