/**
 * Open Graph card generator (brief §4.4, Phase 4 viral loop).
 *
 * When a duel or profile link is shared, the platform's crawler fetches the
 * page's `og:image`. Without one, the preview is a bare URL and the loop dies.
 * This draws a branded 1200×630 card from live data — the app's own language:
 * brand-ink ground, the fingerprint contour, coral accent, bone type. No faces,
 * no baked bitmaps, nothing fabricated: the only text is what the caller passes.
 *
 * `renderOgCard` is pure and returns an SVG string so it is trivially testable.
 * `api/og.ts` rasterises it to PNG, because Facebook and Twitter do not render
 * SVG `og:image`.
 */

export interface OgCardInput {
  /** Small uppercase eyebrow above the title. */
  kicker?: string;
  /** Headline. Keep it short — it is not wrapped. */
  title?: string;
  /** Supporting line under the title. */
  subtitle?: string;
  /** Accent colour for the contour and the rule. Defaults to the brand coral. */
  accent?: string;
}

const INK = '#0A0A09';
const BONE = '#EFE9DA';
const MIST = '#b9b5aa';
const STONE = '#8e8b83';
const CORAL = '#ff5d7a';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** XML-escapes text so a name like `</svg><script>` can never break out. */
const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * The fingerprint contour, reused from the app's ring glyph: three concentric
 * dashed circles. Drawn as a quiet watermark in the corner so the card reads as
 * cultured without shouting.
 */
const contour = (cx: number, cy: number, accent: string): string => `
  <g transform="translate(${cx} ${cy})" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity="0.55">
    <circle r="46"/>
    <circle r="96" stroke-dasharray="150 60" transform="rotate(35)"/>
    <circle r="146" stroke-dasharray="230 110" transform="rotate(-20)"/>
  </g>`;

export const renderOgCard = (input: OgCardInput = {}): string => {
  const kicker = esc(input.kicker ?? 'match on your humor, not your headshot');
  const title = esc(input.title ?? 'cultured');
  const subtitle = esc(input.subtitle ?? 'Memes and music. Find the people who laugh at the same things.');
  const accent = input.accent && /^#[0-9a-fA-F]{6}$/.test(input.accent) ? input.accent : CORAL;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" role="img" aria-label="${title}">
  <defs>
    <radialGradient id="glow" cx="0.82" cy="0.18" r="0.7">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${INK}"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glow)"/>
  ${contour(980, 170, accent)}
  <text x="88" y="176" fill="${STONE}" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="5" text-transform="uppercase">${kicker.toUpperCase()}</text>
  <text x="84" y="320" fill="${BONE}" font-family="Helvetica, Arial, sans-serif" font-size="104" font-weight="700">${title}</text>
  <text x="88" y="392" fill="${MIST}" font-family="Helvetica, Arial, sans-serif" font-size="34">${subtitle}</text>
  <rect x="88" y="436" width="132" height="7" rx="3.5" fill="${accent}"/>
  <g transform="translate(88 520)">
    <g fill="none" stroke="${BONE}" stroke-width="2.4" stroke-linecap="round" opacity="0.9">
      <circle cx="16" cy="16" r="3"/>
      <circle cx="16" cy="16" r="8.6" stroke-dasharray="40 14"/>
      <circle cx="16" cy="16" r="14" stroke-dasharray="62 26" transform="rotate(40 16 16)"/>
    </g>
    <text x="46" y="28" fill="${BONE}" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="700">cultured</text>
  </g>
</svg>`;
};
