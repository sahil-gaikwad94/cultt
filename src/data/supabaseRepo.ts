import type { Repo } from '../lib/types';
/** Contract placeholder: wire Supabase RPCs here once project credentials and migrations exist. */
export class SupabaseRepo implements Repo {
  constructor(private readonly url: string, private readonly anonKey: string) {}
  private unavailable(): never { throw new Error(`Supabase adapter is not configured for this build (${this.url ? 'url set' : 'missing url'}).`); }
  getSession = async () => this.unavailable();
  recordReaction = async () => this.unavailable();
  decide = async () => this.unavailable();
  sendMessage = async () => this.unavailable();
  submitSafetyAction = async () => this.unavailable();
  getLegalDocument = async () => this.unavailable();
  requestDataExport = async () => this.unavailable();
  requestAccountDeletion = async () => this.unavailable();
}
