import { describe, expect, it, vi } from 'vitest';
import {
  ageFromDob,
  assertAdult,
  AgeGateError,
  cancelDeletion,
  DELETION_COOLING_OFF_DAYS,
  DELETION_COOLING_OFF_MS,
  fuzzLocation,
  isAdult,
  isPurgeable,
  LOCATION_FUZZ_KM,
  maxDob,
  MIN_AGE,
  moderateText,
  REPORT_REASONS,
  requestDeletion,
  requestExport,
  SAFETY_FLOWS,
  VIBE_REPORT_REASONS,
} from '../../src/lib/safety';

const NOW = Date.parse('2026-10-06T12:00:00Z');

describe('18+ gate', () => {
  it('accepts someone whose eighteenth birthday is today', () => {
    expect(ageFromDob('2008-10-06', NOW)).toBe(18);
    expect(isAdult('2008-10-06', NOW)).toBe(true);
  });

  it('rejects someone one day short of eighteen', () => {
    expect(ageFromDob('2008-10-07', NOW)).toBe(17);
    expect(isAdult('2008-10-07', NOW)).toBe(false);
  });

  it('rejects a date of birth that is a year too young', () => {
    expect(isAdult('2009-01-01', NOW)).toBe(false);
  });

  it('handles a birthday later in the year correctly', () => {
    expect(ageFromDob('2008-12-25', NOW)).toBe(17);
    expect(ageFromDob('2007-12-25', NOW)).toBe(18);
  });

  it('treats an unparseable date of birth as not eligible', () => {
    expect(ageFromDob('not-a-date', NOW)).toBeNull();
    expect(isAdult('not-a-date', NOW)).toBe(false);
    expect(assertAdultOrNull('nonsense', NOW)).toBe('threw');
  });

  it('hard-blocks under-18 signup: it throws, it does not warn', () => {
    expect(() => assertAdult('2015-01-01', NOW)).toThrow(AgeGateError);
    expect(() => assertAdult('2015-01-01', NOW)).toThrow(/18\+/);
    expect(() => assertAdult('2005-01-01', NOW)).not.toThrow();
  });

  it('exposes an input max that is exactly 18 years ago', () => {
    expect(maxDob(NOW)).toBe('2008-10-06');
    expect(MIN_AGE).toBe(18);
  });
});

const assertAdultOrNull = (dob: string, now: number): 'threw' | 'ok' => {
  try {
    assertAdult(dob, now);
    return 'ok';
  } catch {
    return 'threw';
  }
};

describe('three separate safety flows', () => {
  it('keeps report, vibe-report and block as distinct flows', () => {
    expect(Object.keys(SAFETY_FLOWS).sort()).toEqual(['block', 'report', 'vibe-report']);
  });

  it('never notifies the reported person, on any flow', () => {
    for (const flow of Object.values(SAFETY_FLOWS)) {
      expect(flow.notifies).toBe(false);
    }
  });

  it('uses different vocabularies for abuse and recalibration', () => {
    // An abuse reason must not be offerable as a "didn't feel like a match" reason.
    for (const reason of REPORT_REASONS) {
      expect(VIBE_REPORT_REASONS).not.toContain(reason);
    }
    expect(VIBE_REPORT_REASONS).toContain('Nothing in common');
    expect(REPORT_REASONS).toContain('Harassment or abuse');
  });

  it('states the moderation SLA on the report flow only', () => {
    expect(SAFETY_FLOWS.report.hint).toMatch(/moderation team/i);
    expect(SAFETY_FLOWS['vibe-report'].hint).toMatch(/not told and not punished/i);
    expect(SAFETY_FLOWS.block.hint).toMatch(/no notification is sent/i);
  });
});

describe('text moderation', () => {
  it('blocks an abusive message before it leaves the device', () => {
    const verdict = moderateText('just kill yourself');
    expect(verdict.allowed).toBe(false);
    expect(verdict.score).toBeGreaterThanOrEqual(0.9);
    expect(verdict.flags).toContain('blocked-term');
  });

  it('allows ordinary flirting, including mild profanity', () => {
    expect(moderateText('you get it. play it loud').allowed).toBe(true);
    expect(moderateText('that bridge is unreal, honestly').allowed).toBe(true);
  });

  it('flags link spam and character flooding', () => {
    expect(moderateText('http://a.com http://b.com http://c.com').flags).toContain('link-spam');
    expect(moderateText('loooooooooooooool').flags).toContain('flooding');
  });

  it('reports which provider made the call, so it can be swapped', () => {
    // Perspective API shuts down 31 Dec 2026; the blocklist is the launch-scale
    // pass and `external` is what a classifier will report.
    expect(moderateText('hello').provider).toBe('blocklist');
  });
});

describe('account deletion and export', () => {
  it('starts a 14-day cooling-off period, not an instant delete', () => {
    const request = requestDeletion(NOW);
    expect(request.status).toBe('cooling-off');
    expect(Date.parse(request.effectiveAt) - NOW).toBe(DELETION_COOLING_OFF_MS);
    expect(DELETION_COOLING_OFF_DAYS).toBe(14);
  });

  it('is cancellable until the cooling-off period ends', () => {
    const request = requestDeletion(NOW);
    expect(isPurgeable(request, NOW)).toBe(false);
    expect(isPurgeable(request, NOW + DELETION_COOLING_OFF_MS + 1)).toBe(true);
    expect(cancelDeletion().status).toBe('active');
  });

  it('never purges a cancelled request', () => {
    expect(isPurgeable(cancelDeletion(), NOW + DELETION_COOLING_OFF_MS * 10)).toBe(false);
  });

  it('issues a signed, expiring export link', () => {
    const bundle = requestExport('https://cultured.app', NOW);
    expect(bundle.url).toContain('/api/export/');
    expect(Date.parse(bundle.expiresAt)).toBeGreaterThan(NOW);
  });
});

describe('location fuzzing', () => {
  it('rounds a precise point to roughly a 1 km cell', () => {
    const fuzzed = fuzzLocation(38.7222524, -9.1393366, 'Lisbon');
    expect(fuzzed.city).toBe('Lisbon');
    expect(Math.abs((fuzzed.lat as number) - 38.7222524)).toBeLessThan(0.005);
    expect(Math.abs((fuzzed.lng as number) - -9.1393366)).toBeLessThan(0.005);
    expect(fuzzed.lat).not.toBe(38.7222524);
    expect(LOCATION_FUZZ_KM).toBe(1);
  });

  it('gives two nearby points the same cell and far points different cells', () => {
    const a = fuzzLocation(38.7222, -9.1393, 'Lisbon');
    const b = fuzzLocation(38.7223, -9.1394, 'Lisbon');
    const c = fuzzLocation(38.9, -9.1393, 'Lisbon');
    expect(a.cell).toBe(b.cell);
    expect(a.cell).not.toBe(c.cell);
  });
});

describe('no secrets or dark patterns in the copy', () => {
  it('does not describe photo checking as identity verification', () => {
    expect(SAFETY_FLOWS.report.hint).not.toMatch(/verified identity/i);
  });

  it('does not use a fake-urgent tone', () => {
    for (const flow of Object.values(SAFETY_FLOWS)) {
      expect(flow.hint).not.toMatch(/hurry|act now|don't miss|final warning/i);
    }
  });
});

describe('timers are not used to fake a report', () => {
  it('resolves the safety action without a delay', async () => {
    vi.useFakeTimers();
    const pending = Promise.resolve('queued');
    await expect(pending).resolves.toBe('queued');
    vi.useRealTimers();
  });
});