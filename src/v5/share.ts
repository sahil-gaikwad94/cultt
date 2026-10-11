/**
 * The share sheet.
 *
 * One component, every surface: the deck, the meme gallery, a story, a concert,
 * a restaurant. It exists because "share" used to mean four different things in
 * four places, and two of them ("Added to your story", "Sent to Messages")
 * toasted an action they never performed.
 *
 * Honesty rules baked into the shape of this module:
 *  - A destination is only rendered when the app can actually complete it. No
 *    `onAddToStory` handler means no "Add to story" row at all.
 *  - Instagram and Snapchat cannot take an image from a web page they do not
 *    control. So: native share *with the file* when the platform allows it,
 *    otherwise copy the link, open the app, and say exactly that.
 *  - Every toast reports what happened, never what was hoped for.
 */

import { getOverlayManager } from '../lib/overlay.ts';
import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';
import './share.css';

export type ShareKind = 'meme' | 'song' | 'profile' | 'story' | 'concert' | 'dine' | 'link';

export interface ShareSubject {
  kind: ShareKind;
  /** The item id — used for the story layer when the caller has one. */
  id: string;
  title: string;
  subtitle?: string;
  /** Image URL (absolute or root-relative). Enables the image destinations. */
  image?: string | null;
  /** Canonical link for this item. Defaults to the current page. */
  url?: string;
  /** Quiet facts under the title: venue + date, artist, price. */
  facts?: string[];
  /** Composition for "add to your story" when the subject can be a backdrop. */
  storyLayers?: unknown[];
}

export interface ShareThread {
  id: string;
  name: string;
  /** Resonance, when the caller knows it. */
  score?: number;
  emoji?: string;
}

export interface ShareAction {
  id: string;
  label: string;
  hint?: string;
  /** Inline SVG markup for the tile. */
  icon?: string;
  run: () => void | Promise<void>;
}

export interface ShareOptions {
  threads?: ShareThread[];
  onSendToMatch?: (subject: ShareSubject, threadId: string) => void | Promise<void>;
  onAddToStory?: (subject: ShareSubject) => void | Promise<void>;
  onToast?: (message: string) => void;
  /** Extra, context-specific destinations (remind me, add to calendar, …). */
  extra?: ShareAction[];
}

export interface ShareHandle {
  close(): void;
}

/* ------------------------------------------------------------- helpers */

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const reduceMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

const absolute = (url: string | undefined): string => {
  if (!url) return typeof location === 'undefined' ? '' : location.href;
  if (/^https?:\/\//.test(url)) return url;
  if (typeof location === 'undefined') return url;
  return `${location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
};

/** The share text. One sentence, then the link. */
export const shareText = (subject: ShareSubject): string =>
  [subject.title, subject.subtitle].filter(Boolean).join(' — ') || 'cultured';

export const shareLine = (subject: ShareSubject): string => `${shareText(subject)} · ${absolute(subject.url)}`;

const openExternal = (url: string): void => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    /* popup blocked — the toast already told the user what to do */
  }
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'true');
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
};

/** Fetches an image as a File so a platform share sheet can carry it. */
export const imageFileFor = async (url: string | null | undefined, name = 'cultured.webp'): Promise<File | null> => {
  if (!url || typeof fetch !== 'function' || typeof File !== 'function') return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return new File([blob], name, { type: blob.type });
  } catch {
    return null;
  }
};

/** True when the platform will hand a file to another app. */
export const canShareFiles = (file: File | null): boolean => {
  if (!file || typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

const ICONS = {
  story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  match: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 6.5h16v9H9l-5 3.5z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r="1"/></svg>',
  snapchat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4c2.6 0 4.2 1.8 4.2 4.4v2l1.8 1.2-1.6 1.2.8 2.2c-1.2.6-2.4.2-3 .8-.8.8-1.4 2.2-2.2 2.2s-1.4-1.4-2.2-2.2c-.6-.6-1.8-.2-3-.8l.8-2.2L6 11.6 7.8 10.4v-2C7.8 5.8 9.4 4 12 4z"/></svg>',
  whatsapp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 19l1-3.2A7 7 0 1 1 8.6 18z"/><path d="M9 10.5c0 2.4 2 4.4 4.4 4.4"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M10 13.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5L11 7.5"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0L6.5 13a3.5 3.5 0 0 0 5 5l1.5-1.5"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 4v11M8 11.5l4 3.8 4-3.8M5 19.5h14"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="5.5" width="16" height="14" rx="3"/><path d="M4 10h16M9 4v3M15 4v3"/></svg>',
} as const;

export const shareIcons = ICONS;

/* --------------------------------------------------------- destinations */

/**
 * The destination list, as data. Pure, so the honesty contract is testable:
 * a row exists exactly when its handler exists.
 */
export const destinationsFor = (subject: ShareSubject, options: ShareOptions, notify: (m: string) => void): ShareAction[] => {
  const actions: ShareAction[] = [];
  const url = absolute(subject.url);
  const line = `${shareText(subject)} · ${url}`;

  if (options.onAddToStory) {
    actions.push({
      id: 'story',
      label: 'Your story',
      hint: 'Gone in 12 hours',
      icon: ICONS.story,
      run: async () => {
        await options.onAddToStory?.(subject);
      },
    });
  }

  if (options.onSendToMatch && options.threads?.length) {
    actions.push({
      id: 'match',
      label: 'Send to a match',
      hint: `${options.threads.length} open ${options.threads.length === 1 ? 'chat' : 'chats'}`,
      icon: ICONS.match,
      run: () => {
        /* The sheet swaps the grid for the thread list; nothing is sent yet. */
      },
    });
  }

  actions.push({
    id: 'instagram',
    label: 'Instagram story',
    hint: 'Image or link',
    icon: ICONS.instagram,
    run: async () => {
      const file = await imageFileFor(subject.image, `${subject.kind}-${subject.id}.webp`);
      if (canShareFiles(file)) {
        try {
          await navigator.share({ files: [file as File], text: line });
          notify('Pick Instagram in the share sheet');
          return;
        } catch {
          /* the user closed it — fall through to the link path */
        }
      }
      const copied = await copyText(line);
      openExternal('https://www.instagram.com/');
      notify(copied ? 'Link copied — paste it into your story' : 'Opening Instagram');
    },
  });

  actions.push({
    id: 'snapchat',
    label: 'Snapchat story',
    hint: 'Image or link',
    icon: ICONS.snapchat,
    run: async () => {
      const file = await imageFileFor(subject.image, `${subject.kind}-${subject.id}.webp`);
      if (canShareFiles(file)) {
        try {
          await navigator.share({ files: [file as File], text: line });
          notify('Pick Snapchat in the share sheet');
          return;
        } catch {
          /* dismissed */
        }
      }
      const copied = await copyText(line);
      openExternal('https://www.snapchat.com/');
      notify(copied ? 'Link copied — paste it into Snapchat' : 'Opening Snapchat');
    },
  });

  actions.push({
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: ICONS.whatsapp,
    run: async () => {
      const copied = await copyText(line);
      openExternal(`https://wa.me/?text=${encodeURIComponent(line)}`);
      if (!copied) notify('Opening WhatsApp');
    },
  });

  actions.push({
    id: 'x',
    label: 'Post on X',
    icon: ICONS.x,
    run: () => {
      openExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(subject))}&url=${encodeURIComponent(url)}`);
    },
  });

  if (subject.image) {
    actions.push({
      id: 'save-image',
      label: 'Save image',
      icon: ICONS.download,
      run: async () => {
        const file = await imageFileFor(subject.image, `${subject.kind}-${subject.id}.webp`);
        if (!file) {
          notify('Could not fetch that image');
          return;
        }
        const href = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.download = file.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(href), 2000);
        notify('Saved to your downloads');
      },
    });
  }

  actions.push({
    id: 'copy',
    label: 'Copy link',
    icon: ICONS.link,
    run: async () => {
      notify((await copyText(line)) ? 'Link copied' : 'Could not copy on this device');
    },
  });

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    actions.push({
      id: 'more',
      label: 'More',
      hint: 'Device share sheet',
      icon: ICONS.more,
      run: async () => {
        try {
          await navigator.share({ title: 'cultured', text: shareText(subject), url });
        } catch {
          /* dismissed — nothing happened, so nothing is reported */
        }
      },
    });
  }

  return [...actions, ...(options.extra ?? [])];
};

/* ---------------------------------------------------------------- sheet */

export const openShareSheet = (subject: ShareSubject, options: ShareOptions = {}): ShareHandle => {
  const overlay = getOverlayManager();
  const id = 'share-sheet';
  overlay.close(id);

  const notify = (message: string): void => options.onToast?.(message);

  const root = document.createElement('div');
  root.className = 'sh-root';
  root.innerHTML = `
    <div class="sh-scrim" data-close></div>
    <section class="sh-sheet" role="dialog" aria-modal="true" aria-label="Share ${esc(subject.title)}">
      <span class="sh-grab" aria-hidden="true"></span>
      <header class="sh-head">
        ${subject.image ? `<span class="sh-thumb"><img src="${esc(subject.image)}" alt="" loading="lazy" decoding="async"></span>` : '<span class="sh-thumb sh-thumb-empty" aria-hidden="true">◍</span>'}
        <span class="sh-meta">
          <b>${esc(subject.title)}</b>
          ${subject.subtitle ? `<small>${esc(subject.subtitle)}</small>` : ''}
          ${subject.facts?.length ? `<span class="sh-facts">${subject.facts.map((fact) => esc(fact)).join(' · ')}</span>` : ''}
        </span>
        <button type="button" class="sh-x" data-close aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
      <div class="sh-grid" data-grid></div>
      <div class="sh-matches" data-matches hidden></div>
      <p class="sh-note">Nothing is uploaded until you pick a destination.</p>
    </section>`;

  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const matches = root.querySelector<HTMLElement>('[data-matches]')!;
  const actions = destinationsFor(subject, options, notify);

  grid.innerHTML = actions
    .map(
      (action, index) =>
        `<button type="button" class="sh-tile" data-action="${esc(action.id)}" style="--i:${index}">
          <span class="sh-ic" aria-hidden="true">${action.icon ?? ICONS.link}</span>
          <b>${esc(action.label)}</b>
          ${action.hint ? `<small>${esc(action.hint)}</small>` : ''}
        </button>`,
    )
    .join('');

  const showMatches = (): void => {
    const threads = options.threads ?? [];
    grid.hidden = true;
    matches.hidden = false;
    matches.innerHTML = `
      <div class="sh-matches-head">
        <button type="button" class="sh-back" data-back aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
        </button>
        <b>Send to a match</b>
      </div>
      ${threads
        .map(
          (thread, index) =>
            `<button type="button" class="sh-thread" data-thread="${esc(thread.id)}" style="--i:${index}">
              <span class="sh-av" aria-hidden="true">${esc(thread.emoji ?? thread.name.slice(0, 1).toUpperCase())}</span>
              <span class="sh-thread-meta"><b>${esc(thread.name)}</b>${thread.score ? `<small>${thread.score}% resonance</small>` : ''}</span>
            </button>`,
        )
        .join('')}`;
  };

  const close = (): void => {
    overlay.close(id);
    root.remove();
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close();
  };

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-close]')) {
      close();
      return;
    }
    if (target.closest('[data-back]')) {
      grid.hidden = false;
      matches.hidden = true;
      return;
    }
    const threadButton = target.closest<HTMLElement>('[data-thread]');
    if (threadButton?.dataset.thread) {
      const threadId = threadButton.dataset.thread;
      haptics.play('light');
      void Promise.resolve(options.onSendToMatch?.(subject, threadId)).then(() => close());
      return;
    }
    const tile = target.closest<HTMLElement>('[data-action]');
    if (!tile?.dataset.action) return;
    const action = actions.find((candidate) => candidate.id === tile.dataset.action);
    if (!action) return;
    haptics.play('tick');
    if (action.id === 'match') {
      showMatches();
      return;
    }
    void Promise.resolve(action.run()).then(() => {
      /* Destinations that navigate away keep the sheet open on purpose: the user
         may still want a second one. Copy/share close it. */
      if (['story', 'copy', 'save-image'].includes(action.id)) close();
    });
  });

  document.addEventListener('keydown', onKey);

  overlay.open({
    id,
    kind: 'sheet',
    el: root,
    onDismiss: () => {
      root.remove();
      document.removeEventListener('keydown', onKey);
    },
  });

  if (!reduceMotion()) {
    animate(root.querySelector('.sh-sheet'), [{ transform: 'translateY(26px)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
      duration: 280,
      easing: 'cubic-bezier(.22,.61,.36,1)',
    });
    animate(root.querySelector('.sh-scrim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  }

  /* Focus lands on the sheet so Escape and Tab behave, without scrolling the
     page behind it. */
  root.querySelector<HTMLElement>('.sh-tile')?.focus?.({ preventScroll: true });

  return { close };
};
