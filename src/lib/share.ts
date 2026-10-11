/**
 * The share sheet — capability detection first, buttons second.
 *
 * `legacy.ts:913` carries the rule this module exists to uphold: an earlier
 * sheet offered "Added to your story" and "Sent to Messages" buttons that did
 * nothing but toast. They were removed, because a button that lies is worse
 * than no button. So every target here is produced by `planShare`, which takes
 * a capability object and only returns what the device can actually do.
 *
 * The honest state of the platform, checked rather than assumed:
 *
 *   - There is **no web API for posting to an Instagram or Snapchat Story**.
 *     Instagram's Graph API story publishing needs a Business/Creator account
 *     and app review; Snap's Creative Kit is a native mobile SDK. Neither is
 *     reachable from a Vite web app, and `instagram://` / `snapchat://`
 *     schemes open the app with nothing attached.
 *   - What *does* work is `navigator.share({ files })` — Web Share Level 2. On
 *     Android Chrome that opens the OS sheet with Instagram and Snapchat as
 *     real targets, and Instagram arrives with the image already loaded. That
 *     is the correct implementation, so it is the only "share out" tile, and it
 *     is gated on `navigator.canShare({ files })`.
 *   - Everything else is in-app (your story, a match) or local (save, copy),
 *     all of which are real.
 *
 * `planShare` is pure so the whole matrix of device × content is testable
 * without a browser.
 */

export type ShareTargetId = 'story' | 'match' | 'card' | 'save' | 'copy' | 'more';

export interface ShareCapabilities {
  /** `navigator.share` exists at all. */
  webShare: boolean;
  /** It can carry files — the only honest route to another app's story. */
  webShareFiles: boolean;
  clipboardText: boolean;
  /** `ClipboardItem` with an image. Safari and Chrome only. */
  clipboardImage: boolean;
  /** An `<a download>` can be clicked. */
  download: boolean;
}

export interface ShareImage {
  src: string;
  alt: string;
  /** Used for the downloaded filename and the shared File's name. */
  filename: string;
}

export interface ShareItem {
  title: string;
  text: string;
  url: string;
  image?: ShareImage;
  /** A brand card can only be offered when there is something to draw on it. */
  cardTitle?: string;
  cardCaption?: string;
}

export interface ShareContext {
  /** "Send to a match" is a dead end with nobody matched, so it is not offered. */
  hasMatches: boolean;
}

export interface ShareOption {
  id: ShareTargetId;
  label: string;
  hint: string;
}

/** Reads the device once. Everything is feature-detected, never UA-sniffed. */
export const detectCapabilities = (): ShareCapabilities => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { webShare: false, webShareFiles: false, clipboardText: false, clipboardImage: false, download: false };
  }
  const nav = navigator as Navigator & { canShare?: (data?: unknown) => boolean };
  let webShareFiles = false;
  if (typeof nav.canShare === 'function') {
    try {
      // A probe File, not a real one — canShare is synchronous and cheap.
      webShareFiles = nav.canShare({ files: [new File([], 'probe.png', { type: 'image/png' })] });
    } catch {
      webShareFiles = false;
    }
  }
  const clip = navigator.clipboard as
    | (Clipboard & { write?: (items: unknown[]) => Promise<void> })
    | undefined;
  return {
    webShare: typeof nav.share === 'function',
    webShareFiles,
    clipboardText: !!clip && typeof clip.writeText === 'function',
    clipboardImage: typeof window.ClipboardItem === 'function' && !!clip && typeof clip.write === 'function',
    download: typeof document !== 'undefined' && typeof document.createElement === 'function',
  };
};

/**
 * The tiles to show, in the order they should appear. Pure: the same
 * capabilities and content always produce the same sheet, which is what makes
 * it possible to assert that no combination offers a button that cannot work.
 */
export const planShare = (item: ShareItem, caps: ShareCapabilities, context: ShareContext): ShareOption[] => {
  const out: ShareOption[] = [];

  out.push({ id: 'story', label: 'Your story', hint: 'Gone in 12 hours' });
  if (context.hasMatches) out.push({ id: 'match', label: 'Send to a match', hint: 'Opens in chat' });
  if (item.image && caps.download) {
    out.push({ id: 'card', label: 'Share card', hint: 'Framed with your placard' });
  }
  if (item.image && caps.download) out.push({ id: 'save', label: 'Save image', hint: 'To your photos' });
  if (caps.clipboardText) out.push({ id: 'copy', label: 'Copy link', hint: item.url });
  if (caps.webShare) {
    out.push({
      id: 'more',
      label: 'More…',
      hint: caps.webShareFiles && item.image ? 'Opens your apps with the image' : 'Opens your share sheet',
    });
  }
  return out;
};

/** The line shown when the sheet has nothing to offer. Honest, not a shrug. */
export const EMPTY_SHARE_HINT =
  'This browser has no share sheet and no clipboard, so there is nowhere to send it from here.';

/* ------------------------------------------------------------- the actions */

export interface ActionResult {
  ok: boolean;
  /** What actually happened, in words the toast can use verbatim. */
  message: string;
}

const fail = (message: string): ActionResult => ({ ok: false, message });

/** Fetches an image as a blob. Same-origin only, so no CORS surprises. */
export const imageBlob = async (src: string): Promise<Blob | null> => {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
};

/** Triggers a download. Reports honestly if the browser refused. */
export const saveImage = async (image: ShareImage): Promise<ActionResult> => {
  if (typeof document === 'undefined') return fail('Saving is not available here');
  const blob = await imageBlob(image.src);
  if (!blob) return fail('Could not reach that image');
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = image.filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, message: 'Image saved' };
  } catch {
    return fail('Could not save that image');
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
};

/** Downloads a blob the app generated itself (the share card). */
export const saveBlob = (blob: Blob, filename: string): ActionResult => {
  if (typeof document === 'undefined') return fail('Saving is not available here');
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { ok: true, message: 'Card saved' };
  } catch {
    return fail('Could not save that card');
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
};

/**
 * Hands an app-generated blob to the OS sheet. Falls back to saving it, so a
 * card that was drawn is never silently thrown away.
 */
export const shareBlob = async (
  blob: Blob,
  filename: string,
  item: ShareItem,
  caps: ShareCapabilities,
): Promise<ActionResult> => {
  const nav = navigator as Navigator & { canShare?: (data?: unknown) => boolean };
  if (caps.webShare && caps.webShareFiles) {
    const file = new File([blob], filename, { type: blob.type || 'image/png' });
    if (typeof nav.canShare !== 'function' || nav.canShare({ files: [file] })) {
      try {
        await navigator.share({ title: item.title, text: item.text, files: [file] });
        return { ok: true, message: '' };
      } catch (error) {
        if (isDismissal(error)) return { ok: true, message: '' };
      }
    }
  }
  return saveBlob(blob, filename);
};

export const copyLink = async (item: ShareItem): Promise<ActionResult> => {
  try {
    await navigator.clipboard.writeText(item.url);
    return { ok: true, message: 'Link copied' };
  } catch {
    return fail('Could not reach the clipboard — copy the address bar instead');
  }
};

/**
 * The OS share sheet, with the image attached when the device allows it.
 * A dismissal is not a failure and reports nothing.
 */
export const shareOut = async (item: ShareItem, caps: ShareCapabilities): Promise<ActionResult> => {
  const nav = navigator as Navigator & { canShare?: (data?: unknown) => boolean };
  if (caps.webShareFiles && item.image) {
    const blob = await imageBlob(item.image.src);
    if (blob) {
      const file = new File([blob], item.image.filename, { type: blob.type || 'image/webp' });
      if (typeof nav.canShare !== 'function' || nav.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: item.title, text: item.text, files: [file] });
          return { ok: true, message: '' };
        } catch (error) {
          if (isDismissal(error)) return { ok: true, message: '' };
        }
      }
    }
  }
  try {
    await navigator.share({ title: item.title, text: item.text, url: item.url });
    return { ok: true, message: '' };
  } catch (error) {
    if (isDismissal(error)) return { ok: true, message: '' };
    return fail('That did not share');
  }
};

const isDismissal = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'AbortError' || error.name === 'NotAllowedError');
