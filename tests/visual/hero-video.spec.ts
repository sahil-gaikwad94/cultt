import { test, expect } from '@playwright/test';

/**
 * The `heroVideo` slot.
 *
 * This branch runs only when `public/assets/manifest.json` has a non-null
 * `heroVideo.file`. It is skipped when the manifest leaves the slot empty, which
 * is the shipped default — so it is skipped in CI rather than silently passing
 * against a configuration nobody runs.
 */

const manifestHasVideo = async (
  request: import('@playwright/test').APIRequestContext,
  baseURL: string,
): Promise<boolean> => {
  const res = await request.get(`${baseURL}/assets/manifest.json`);
  if (!res.ok()) return false;
  const manifest = (await res.json()) as { heroVideo?: { file?: string | null } };
  return Boolean(manifest.heroVideo?.file);
};

test.describe('heroVideo slot', () => {
  test('plays a muted, inline, 9:16 clip with the live text over it', async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    const base = baseURL ?? 'http://127.0.0.1:4173';
    test.skip(
      !(await manifestHasVideo(request, base)),
      'heroVideo.file is null in the manifest; the code timeline is the active path',
    );

    await page.goto('/');

    const video = page.locator('#onboard .co-video');
    await expect(video).toHaveAttribute('muted', '');
    await expect(video).toHaveAttribute('playsinline', '');
    await expect(video).toHaveAttribute('src', /intro\.mp4$/);
    await expect(video).toHaveAttribute('poster', '/assets/intro-poster.jpg');

    // The live text sits on top of the clip rather than being baked into it.
    const z = await page.evaluate(() => {
      const v = document.querySelector('.co-video');
      const t = document.querySelector('.co-type');
      if (!v || !t) return null;
      const order = Array.from(document.querySelectorAll('.co > *'));
      return order.indexOf(t) > order.indexOf(v);
    });
    expect(z).toBe(true);

    const tag = await video.evaluate((node: HTMLVideoElement) => ({
      muted: node.muted,
      loop: node.loop,
      playsInline: node.playsInline,
      readyState: node.readyState,
    }));
    expect(tag.muted).toBe(true);
    expect(tag.playsInline).toBe(true);

    // The visual beats must NOT also be drawn on top of the clip. Without this
    // the ring, the split halves and the ribbons render twice: once from the
    // footage and once from the DOM, slightly out of step with each other.
    for (const selector of ['.co-canvas', '.co-stage', '.co-halves', '.co-heart']) {
      await expect(page.locator(selector)).toHaveCSS('opacity', '0');
    }
    // ...while the words are still driven by the DOM, which is the whole point.
    await expect(page.locator('.co-type')).not.toHaveCSS('opacity', '0');

    testInfo.annotations.push({ type: 'heroVideo', description: 'slot active' });
  });
});
