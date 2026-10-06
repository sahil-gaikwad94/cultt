import { test, expect, type Page } from '@playwright/test';

/**
 * Onboarding has nine dots and one job per step: get to the next one.
 *
 * The sound-calibration step (the sixth dot) once failed that job. Its clip list
 * sits outside the scrolling `.ob-body` every other step relies on, so on a
 * 390x844 phone the list grew to ~1470px, squeezed the question to 26px and
 * pushed the footer — with Continue in it — below the fold. Nothing on the step
 * could scroll, so the funnel dead-ended: no way forward, and nothing visibly
 * broken to explain why.
 *
 * The contract checked here is the one a screenshot can't: on every step, the
 * control that moves you on is inside the viewport and is the topmost element at
 * its own centre, at both shipping viewports.
 */

/** Each step's forward control, and the question that identifies the step. */
const STEPS = {
  age: { act: 'ob-next', text: 'Continue', heading: 'A little trust, first.' },
  photo: { act: 'ob-next', text: 'Continue', heading: 'Show there’s a real person here.' },
  music: { act: 'ob-next', text: 'Use this source', heading: 'Where should your taste come from?' },
  memes: { heading: 'What kind of funny are you?' },
  sound: { act: 'ob-next', text: 'Continue', heading: 'Let the music do some talking.' },
  context: { act: 'ob-next', text: 'Continue', heading: 'A little more than a face.' },
  basics: { act: 'ob-next', text: 'Continue', heading: 'What should we call you?' },
  permissions: { act: 'ob-done', text: 'Build my Fingerprint', heading: 'Keep the ritual close.' },
} as const;

/** Every step's forward control must be visible, in viewport, and hit-testable. */
const expectAdvanceIsReachable = async (page: Page, act: string, text: string): Promise<void> => {
  const cta = page.locator(`#onboard [data-act="${act}"]`).last();
  await expect(cta).toHaveText(text);
  await expect(cta).toBeVisible();
  await expect(cta).toBeInViewport({ ratio: 1 });

  // In the viewport *and on top*: something overlaying the footer would still
  // satisfy the checks above.
  const reachable = await cta.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return Boolean(top && (top === el || el.contains(top) || top.contains(el)));
  });
  expect(reachable, `${act} is covered by something at its own centre`).toBe(true);
};

/** A step taller than its panel is a dead end, not a scroll — so it must fit. */
const expectStepFits = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(() => {
    const onboard = document.getElementById('onboard') as HTMLElement;
    const step = onboard.querySelector('.step,.reveal') as HTMLElement;
    return {
      onboard: onboard.scrollHeight - onboard.clientHeight,
      step: step.scrollHeight - step.clientHeight,
    };
  });
  expect(overflow.onboard, '#onboard had to scroll to show the step').toBeLessThanOrEqual(1);
  expect(overflow.step, 'the step outgrew the panel').toBeLessThanOrEqual(1);
};

/** Cold Open -> step 1 -> ... -> the sound-calibration step. */
const walkToSoundCalibration = async (page: Page): Promise<void> => {
  await page.goto('/');
  const intro = page.locator('#onboard .co');
  await intro.waitFor();
  await intro.click({ position: { x: 40, y: 400 } });
  await page.locator('.co-cta').click();

  await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.age.heading);
  await page.fill('#ob-dob', '1996-04-04');
  await expect(page.locator('#onboard [data-act="ob-next"]')).toBeEnabled();
  await page.locator('#onboard [data-act="ob-next"]').click();

  await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.photo.heading);
  await page.locator('#onboard [data-act="ob-next"]').click();

  await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.music.heading);
  await page.locator('#onboard [data-act="ob-next"]').click();

  // The meme deck advances on the fifth decision, not on a button.
  await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.memes.heading);
  const laugh = page.locator('#onboard [data-act="ob-meme"][data-v="laugh"]');
  for (let i = 0; i < 5; i++) await laugh.click();
  await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.sound.heading);
};

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test.describe(`onboarding at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('every step can be advanced, the sound calibration included', async ({ page }) => {
      await page.goto('/');
      const intro = page.locator('#onboard .co');
      await intro.waitFor();
      await intro.click({ position: { x: 40, y: 400 } });
      await page.locator('.co-cta').click();

      // Step 1 (18+) is gated on the date of birth, so unlock it before moving on.
      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.age.heading);
      await expectAdvanceIsReachable(page, STEPS.age.act, STEPS.age.text);
      await expect(page.locator('#onboard [data-act="ob-next"]')).toBeDisabled();
      await page.fill('#ob-dob', '1996-04-04');
      await expect(page.locator('#onboard [data-act="ob-next"]')).toBeEnabled();
      await page.locator('#onboard [data-act="ob-next"]').click();

      // Step 2 (photo check).
      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.photo.heading);
      await expectAdvanceIsReachable(page, STEPS.photo.act, STEPS.photo.text);
      await page.locator('#onboard [data-act="ob-photo"]').click();
      await page.locator('#onboard [data-act="ob-next"]').click();

      // Step 3 (music source).
      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.music.heading);
      await expectAdvanceIsReachable(page, STEPS.music.act, STEPS.music.text);
      await page.locator('#onboard [data-act="ob-next"]').click();

      // Step 4 (meme deck) — drag or buttons, five cards per scene.
      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.memes.heading);
      await expect(page.locator('#onboard .ob-stack-card.top')).toBeVisible();
      const laugh = page.locator('#onboard [data-act="ob-meme"][data-v="laugh"]');
      await expect(laugh).toBeInViewport({ ratio: 1 });
      for (let i = 0; i < 5; i++) await laugh.click();

      // Step 5 — the sixth dot, sound calibration. This is the regression.
      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.sound.heading);
      await expect(page.locator('#onboard .ob-wave')).toHaveCount(4);
      await expectAdvanceIsReachable(page, STEPS.sound.act, STEPS.sound.text);
      await expectStepFits(page);

      // The clip list is the scrolling region — and the list scrolling must not
      // move the footer, because the footer is the way out of the step.
      const list = page.locator('#onboard .ob-split');
      const footerBefore = await page.locator('#onboard [data-act="ob-next"]').boundingBox();
      expect(
        await list.evaluate((el) => el.scrollHeight - el.clientHeight),
        'the clip list should be the scrolling region on this step',
      ).toBeGreaterThan(1);
      await list.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      const lastRate = page
        .locator('#onboard .ob-wave')
        .last()
        .locator('[data-act="ob-rate"]')
        .first();
      await expect(lastRate).toBeInViewport({ ratio: 1 });
      await expect(lastRate).toBeVisible();
      const footerAfter = await page.locator('#onboard [data-act="ob-next"]').boundingBox();
      expect(footerAfter?.y).toBe(footerBefore?.y);
      await expectAdvanceIsReachable(page, STEPS.sound.act, STEPS.sound.text);
      await page.locator('#onboard [data-act="ob-next"]').click();

      // Steps 6 to 8, then the reveal.
      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.context.heading);
      await expectAdvanceIsReachable(page, STEPS.context.act, STEPS.context.text);
      await page.locator('#onboard [data-act="ob-next"]').click();

      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.basics.heading);
      await expectAdvanceIsReachable(page, STEPS.basics.act, STEPS.basics.text);
      await page.locator('#onboard [data-act="ob-next"]').click();

      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.permissions.heading);
      await expectAdvanceIsReachable(page, STEPS.permissions.act, STEPS.permissions.text);
      await page.locator('#onboard [data-act="ob-done"]').click();

      // The reveal is three beats, and the last beat enters the app.
      await expect(page.locator('#onboard [data-act="ob-enter"]')).toBeVisible();
      await page.locator('#onboard [data-act="ob-enter"]').click();

      await expect(page.locator('#onboard')).not.toHaveClass(/on/);
      await expect(page.locator('#nav')).toBeVisible();
      await expect(page.locator('#s-feed .mm-card').first()).toBeVisible();
    });

    test('the sound step still advances after every clip is rated', async ({ page }) => {
      await walkToSoundCalibration(page);

      const rows = page.locator('#onboard .ob-wave');
      for (let i = 0; i < (await rows.count()); i++) {
        await rows.nth(i).locator('[data-act="ob-rate"]').first().click();
      }

      await expectStepFits(page);
      await expectAdvanceIsReachable(page, STEPS.sound.act, STEPS.sound.text);
      await page.locator('#onboard [data-act="ob-next"]').click();
      await expect(page.locator('#onboard .ob-q')).toHaveText(STEPS.context.heading);
    });
  });
}
