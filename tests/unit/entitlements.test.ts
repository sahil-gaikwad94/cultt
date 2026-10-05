import { describe, expect, it } from 'vitest';
import {
  dailyAllowance,
  entitlementsFor,
  FREE_RESONATE_PER_DAY,
  FREE_SESSION_CAP_SECONDS,
  FREE_TRIVIA_PER_DAY,
  readReceiptsEnabled,
  rewindAllowance,
  sessionAllowance,
  startOfLocalDay,
} from '../../src/lib/entitlements';

const NOW = Date.parse('2026-10-06T12:00:00Z');

describe('free tier never gates the core loop', () => {
  it('gives free users the full Feed, Matrix and unlimited messages', () => {
    const free = entitlementsFor('free', NOW);
    expect(free.tier).toBe('free');
    // Nothing here caps messaging or the deck: there is no such entitlement.
    expect(free).not.toHaveProperty('messagesPerDay');
    expect(free).not.toHaveProperty('deckSize');
    expect(free).not.toHaveProperty('canSeeLikes');
  });

  it('does not gate the mutual reveal behind a tier', () => {
    // The reveal comes from the mutual, not an entitlement key.
    const free = entitlementsFor('free', NOW);
    expect(JSON.stringify(free)).not.toMatch(/reveal|likes/i);
  });
});

describe('15-minute listening session cap', () => {
  it('caps a free session at exactly 15 minutes', () => {
    const free = entitlementsFor('free', NOW);
    const allowance = sessionAllowance(free, 0);
    expect(allowance.allowed).toBe(true);
    expect(allowance.remainingSeconds).toBe(FREE_SESSION_CAP_SECONDS);
    expect(FREE_SESSION_CAP_SECONDS).toBe(900);
  });

  it('counts down as the session runs and refuses at the cap', () => {
    const free = entitlementsFor('free', NOW);
    expect(sessionAllowance(free, 899).remainingSeconds).toBe(1);
    expect(sessionAllowance(free, 900).allowed).toBe(false);
    expect(sessionAllowance(free, 900).reason).toBe('session_cap');
  });

  it('offers Playlist Pass as the fix, not a subscription', () => {
    const free = entitlementsFor('free', NOW);
    expect(sessionAllowance(free, 900).upsell).toMatch(/Playlist Pass/);
  });

  it('removes the cap with a Playlist Pass', () => {
    const withPass = entitlementsFor('free', NOW, true);
    expect(sessionAllowance(withPass, 10_000).allowed).toBe(true);
    expect(sessionAllowance(withPass, 10_000).remainingSeconds).toBeNull();
  });

  it('removes the cap for premium too', () => {
    expect(sessionAllowance(entitlementsFor('premium', NOW), 99_999).allowed).toBe(true);
  });

  it('never returns a negative remaining count', () => {
    const free = entitlementsFor('free', NOW);
    expect(sessionAllowance(free, 5000).remainingSeconds).toBe(0);
  });
});

describe('daily allowances', () => {
  it('allows one Resonate a day on free', () => {
    const free = entitlementsFor('free', NOW);
    expect(FREE_RESONATE_PER_DAY).toBe(1);
    expect(dailyAllowance(free, 'resonate', 0).allowed).toBe(true);
    expect(dailyAllowance(free, 'resonate', 1).allowed).toBe(false);
    expect(dailyAllowance(free, 'resonate', 1).reason).toBe('resonate_cap');
  });

  it('allows two trivia plays a day on free', () => {
    const free = entitlementsFor('free', NOW);
    expect(FREE_TRIVIA_PER_DAY).toBe(2);
    expect(dailyAllowance(free, 'trivia', 1).allowed).toBe(true);
    expect(dailyAllowance(free, 'trivia', 2).allowed).toBe(false);
  });

  it('is unlimited for premium', () => {
    const premium = entitlementsFor('premium', NOW);
    expect(dailyAllowance(premium, 'resonate', 500).allowed).toBe(true);
    expect(dailyAllowance(premium, 'trivia', 500).allowed).toBe(true);
  });

  it('keys the reset to the local day, not a rolling window', () => {
    const early = entitlementsFor('free', Date.parse('2026-10-06T00:05:00Z'));
    const late = entitlementsFor('free', Date.parse('2026-10-06T23:55:00Z'));
    expect(early.day).toBe(late.day);
    expect(startOfLocalDay(Date.parse('2026-10-06T12:00:00Z'))).toBe(early.day);
  });
});

describe('premium extras that intentionally do not exist on free', () => {
  it('denies rewind on free and allows it for premium', () => {
    expect(rewindAllowance(entitlementsFor('free', NOW), 0).allowed).toBe(false);
    expect(rewindAllowance(entitlementsFor('free', NOW), 0).upsell).toMatch(/premium/i);
    expect(rewindAllowance(entitlementsFor('premium', NOW), 40).allowed).toBe(true);
  });

  it('keeps read receipts opt-in for everyone, subscribers included', () => {
    expect(readReceiptsEnabled(false)).toBe(false);
    expect(readReceiptsEnabled(true)).toBe(true);
  });
});
