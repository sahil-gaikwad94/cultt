import { beforeEach, describe, expect, it } from 'vitest';
import { MockRepo } from '../../src/data/mockRepo';

describe('MockRepo', () => {
  beforeEach(() => localStorage.clear());
  it('records reactions and safety actions behind the adapter', async () => {
    const repo = new MockRepo();
    await repo.recordReaction('post-1', 'laugh');
    await repo.submitSafetyAction('person-1', 'vibe-report', 'not a cultural fit');
    expect(JSON.parse(localStorage.getItem('cultured2:repo-events') ?? '[]')).toHaveLength(2);
  });
  it('models a deletion request as a cooling-off period', async () => {
    const result = await new MockRepo().requestAccountDeletion();
    expect(result.status).toBe('cooling-off');
    expect(new Date(result.effectiveAt).getTime()).toBeGreaterThan(Date.now());
  });
});
