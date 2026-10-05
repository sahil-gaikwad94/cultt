/** Shapes for the generated seed corpus. Mirrors public/memes/sources.json. */

export interface SeedMeme {
  readonly id: string;
  /** Culture Feed tab: work | music | screen | life | love | money. */
  readonly topic: string;
  readonly text: string;
  /** Text alternative: caption plus a short description, for screen readers. */
  readonly alt: string;
  /** Taxonomy ids: content families + format features + style axes. */
  readonly tags: readonly string[];
  readonly bg: string;
  readonly fg: string;
  readonly ac: string;
  readonly likes: number;
  readonly laughs: number;
}