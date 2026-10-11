/**
 * The share sheet.
 *
 * The contract this pins is the honesty rule: a destination exists exactly when
 * the app can complete it, and every toast reports what actually happened. The
 * old sheet offered "Your story" and "Messages" buttons that only toasted — a
 * button that lies is worse than no button.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { destinationsFor, openShareSheet, shareLine, shareText } from '../../src/v5/share';
import type { ShareSubject } from '../../src/v5/share';

const subject: ShareSubject = {
  kind: 'meme',
  id: 'meme-abc',
  title: 'Hydration, but make it suspicious',
  subtitle: 'Meme',
  image: '/memes/meme-01.webp',
  url: '/feed',
  facts: ['#main-character'],
  storyLayers: [{ type: 'meme', id: 'meme-abc' }],
};

const ids = (actions: { id: string }[]): string[] => actions.map((action) => action.id);

const cleanup = () => {
  document.querySelectorAll('.sh-root').forEach((node) => node.remove());
};

afterEach(cleanup);

describe('share destinations', () => {
  it('offers no story row when there is no story handler', () => {
    expect(ids(destinationsFor(subject, {}, () => undefined))).not.toContain('story');
  });

  it('offers the story row when the app can really post one', () => {
    const actions = destinationsFor(subject, { onAddToStory: () => undefined }, () => undefined);
    expect(ids(actions)).toContain('story');
  });

  it('offers a match row only when there are threads and a sender', () => {
    const noThreads = destinationsFor(subject, { onSendToMatch: () => undefined }, () => undefined);
    expect(ids(noThreads)).not.toContain('match');
    const withThreads = destinationsFor(
      subject,
      { onSendToMatch: () => undefined, threads: [{ id: 'ines', name: 'Ines', score: 88 }] },
      () => undefined,
    );
    expect(ids(withThreads)).toContain('match');
  });

  it('only offers save-image when the subject has an image', () => {
    expect(ids(destinationsFor(subject, {}, () => undefined))).toContain('save-image');
    expect(ids(destinationsFor({ ...subject, image: null }, {}, () => undefined))).not.toContain('save-image');
  });

  it('always offers Instagram, Snapchat, WhatsApp, X and copy', () => {
    const actions = ids(destinationsFor(subject, {}, () => undefined));
    for (const id of ['instagram', 'snapchat', 'whatsapp', 'x', 'copy']) expect(actions).toContain(id);
  });

  it('keeps context-specific extras', () => {
    const actions = destinationsFor(subject, { extra: [{ id: 'remind', label: 'Remind me', run: () => undefined }] }, () => undefined);
    expect(ids(actions)).toContain('remind');
  });
});

describe('share text', () => {
  it('reads as one line, title first', () => {
    expect(shareText(subject)).toBe('Hydration, but make it suspicious — Meme');
  });

  it('builds an absolute link from a root-relative url', () => {
    expect(shareLine(subject)).toContain(`${location.origin}/feed`);
  });
});

describe('the sheet itself', () => {
  it('renders a dialog with the destinations and closes on Escape', () => {
    const handle = openShareSheet(subject, { onAddToStory: () => undefined });
    const dialog = document.querySelector('.sh-sheet');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(document.querySelectorAll('.sh-tile').length).toBeGreaterThan(3);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.sh-root')).toBeNull();
    handle.close();
  });

  it('reports a copy that could not happen instead of claiming success', async () => {
    const toast = vi.fn();
    openShareSheet(subject, { onToast: toast });
    const copy = document.querySelector<HTMLElement>('[data-action="copy"]');
    copy?.click();
    await Promise.resolve();
    await Promise.resolve();
    /* jsdom has no clipboard and no execCommand, so the honest line is failure. */
    expect(toast).toHaveBeenCalled();
    expect(String(toast.mock.calls[0]?.[0])).toMatch(/could not copy/i);
  });

  it('swaps the grid for the match list and sends to the chosen thread', async () => {
    const sent = vi.fn();
    openShareSheet(subject, {
      onSendToMatch: sent,
      threads: [
        { id: 'ines', name: 'Ines', score: 88 },
        { id: 'kai', name: 'Kai', score: 84 },
      ],
    });
    document.querySelector<HTMLElement>('[data-action="match"]')?.click();
    expect(document.querySelectorAll('.sh-thread').length).toBe(2);
    document.querySelector<HTMLElement>('[data-thread="kai"]')?.click();
    await Promise.resolve();
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ id: 'meme-abc' }), 'kai');
    expect(document.querySelector('.sh-root')).toBeNull();
  });
});
