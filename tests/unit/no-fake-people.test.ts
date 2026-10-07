/**
 * No invented people in a production bundle.
 *
 * The constraint is "no fake users or fake stats in production", and the thing
 * that can silently break it is a constant that fails to fold. `DEMO_DATA` is
 * `DEV && CFG.flags.demoData !== false`, and `DEV` is
 * `import.meta.env.DEV === true` — written that way on purpose, because an
 * earlier `typeof import.meta !== 'undefined'` guard defeated the folding and
 * left the seeded people in the shipped bundle.
 *
 * So this test checks the artefact, not the source: it reads the real
 * production bundle and asserts the personas are gone. It is skipped when
 * `dist/` has not been built, because a unit run should not require one.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const distAssets = resolve(__dirname, '../../dist/assets');

const legacyBundle = (): string | null => {
  if (!existsSync(distAssets)) return null;
  const file = readdirSync(distAssets).find((name) => /^legacy-.*\.js$/.test(name));
  return file ? readFileSync(resolve(distAssets, file), 'utf8') : null;
};

/** Bios are the reliable marker: names can collide with ordinary words. */
const PERSONA_BIOS = [
  'Commute DJ. Has been asked to stop.',
  'Makes playlists for weather that hasn’t happened yet.',
  'Keeps a spreadsheet of songs that make her want to leave the party.',
  'Will defend one questionable album forever.',
  'Deadpan in three languages.',
  'Nostalgic for decades she wasn’t alive for.',
];

/** The seeded circle authors, which are personas too. */
const CIRCLE_AUTHORS = ['Ines', 'Kai', 'Dev'];

describe('the production bundle carries no invented people', () => {
  const bundle = legacyBundle();

  it.skipIf(bundle === null)('contains none of the nine Matrix personas', () => {
    for (const bio of PERSONA_BIOS) {
      expect(bundle, `found persona bio in the production bundle: ${bio}`).not.toContain(bio);
    }
  });

  it.skipIf(bundle === null)('still contains the honest density gate', () => {
    // The screen that replaces them must survive the folding.
    expect(bundle).toContain('a lie with a nice layout');
  });

  it.skipIf(bundle === null)('does not ship the seeded circle authors as content', () => {
    /* The room seat map keeps three of these names behind FEATURE_ROOMS, which
       is off by default and not reachable from any shipping surface. What must
       not survive is the circle-post author list, which the feed renders. */
    expect(bundle).not.toContain('circle_0');
    expect(bundle).not.toContain('Saved by 41 people in your circles this week.');
    void CIRCLE_AUTHORS;
  });
});
