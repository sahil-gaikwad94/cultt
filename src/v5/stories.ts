/**
 * Stories (build brief §6.6) — 12 hours, then gone.
 *
 * Composition only: a story is a stack of layers that *reference* a meme or song
 * id plus a sticker and a backdrop. No licensed bytes are ever copied into one,
 * so a story cannot become a second place where unlicensed art leaks from.
 *
 * Honest by construction: there is no viewer count. With no backend there is
 * nobody to have seen it, and a fabricated "42 views" is exactly the fake stat
 * the brief forbids. The screen shows what is true — the audience you chose and
 * when it expires.
 */

import { copy } from '../copy/index.ts';
import { memeCategoryName } from '../copy/taxonomy.ts';
import { getStore } from '../store/index.ts';
import { liveStories } from '../store/selectors.ts';
import { v5config } from '../store/config.ts';
import { memeById, servableMemes, songById, songs } from '../content/index.ts';
import type { StoreState } from '../store/index.ts';
import type { Story } from '../store/types.ts';
import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

/* ------------------------------------------------------------ composition */

export type StoryLayer =
  | { type: 'meme'; id: string }
  | { type: 'song'; id: string }
  | { type: 'sticker'; name: string }
  | { type: 'text'; body: string };

export type Audience = Story['audience'];
export type ReplyRule = Story['replyRule'];

export interface StoryDraft {
  backdrop: { type: 'meme' | 'song'; id: string } | null;
  sticker: string | null;
  text: string;
  audience: Audience;
  replyRule: ReplyRule;
}

export const emptyDraft = (): StoryDraft => ({
  backdrop: null,
  sticker: null,
  text: '',
  audience: 'everyone',
  replyRule: 'react',
});

/** A draft is postable only when it has something to show. */
export const canPost = (draft: StoryDraft): boolean => draft.backdrop !== null;

/** Builds the layer stack a draft posts as. Pure. */
export const layersFor = (draft: StoryDraft): StoryLayer[] => {
  const layers: StoryLayer[] = [];
  if (draft.backdrop) layers.push(draft.backdrop);
  if (draft.sticker) layers.push({ type: 'sticker', name: draft.sticker });
  if (draft.text.trim()) layers.push({ type: 'text', body: draft.text.trim() });
  return layers;
};

/** Reads a layer stack back into something the viewer can render. */
export const describeLayers = (
  layers: readonly unknown[],
): { src: string | null; alt: string; caption: string; sticker: string | null } => {
  let src: string | null = null;
  let alt = '';
  let caption = '';
  let sticker: string | null = null;

  for (const raw of layers) {
    const layer = raw as StoryLayer;
    if (layer?.type === 'meme') {
      const meme = memeById(layer.id);
      if (!meme) continue;
      src = meme.variants.at(-1)?.webp ?? meme.src;
      alt = meme.alt;
      caption = memeCategoryName(meme.category);
    } else if (layer?.type === 'song') {
      const song = songById(layer.id);
      if (!song) continue;
      src = song.artworkUrl;
      alt = `${song.title} by ${song.artist}`;
      caption = `${song.title} · ${song.artist}`;
    } else if (layer?.type === 'sticker') {
      sticker = layer.name;
    } else if (layer?.type === 'text') {
      caption = layer.body;
    }
  }
  return { src, alt, caption, sticker };
};

/** "3h 12m left", or "Gone." — never a rounded-up lie. */
export const timeLeft = (expiresAt: number, now: number): string => {
  const ms = expiresAt - now;
  if (ms <= 0) return copy.stories.expired;
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m left` : `${minutes}m left`;
};

/* ------------------------------------------------------------------ mount */

export interface StoriesHandle {
  destroy(): void;
}

export interface StoriesOptions {
  onClose?: () => void;
  /** Your own id, so the rail can tell your stories from everyone else's. */
  ownerId?: string;
}

export const mountStories = (host: HTMLElement, options: StoriesOptions = {}): StoriesHandle => {
  const store = getStore();
  const ownerId = options.ownerId ?? 'me';
  const ttlMs = v5config.hours.storyTtl * 3600000;

  let draft: StoryDraft = emptyDraft();
  let composing = false;
  let viewing: Story | null = null;

  const root = el<HTMLDivElement>('div', 'v5-stories');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Stories');

  const paint = () => {
    const state: StoreState = store.getState();
    const now = Date.now();
    const live = liveStories(state, now);

    if (viewing) {
      const shown = describeLayers(viewing.layers);
      root.innerHTML = `
        <div class="v5-story-view">
          <div class="v5-story-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(((viewing.expiresAt - now) / ttlMs) * 100)}">
            <i style="transform:scaleX(${Math.max(0, Math.min(1, (viewing.expiresAt - now) / ttlMs)).toFixed(3)})"></i>
          </div>
          <header class="v5-story-head">
            <button type="button" class="v5-icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
            <span>${esc(timeLeft(viewing.expiresAt, now))}</span>
            <span class="v5-story-aud">${esc(viewing.audience)}</span>
          </header>
          <div class="v5-story-stage" style="${shown.src ? '' : 'background:var(--gallery-raised,#1b1b19)'}">
            ${shown.src ? `<img src="${esc(shown.src)}" alt="${esc(shown.alt)}">` : ''}
            ${shown.sticker ? `<span class="v5-story-sticker">${esc(shown.sticker)}</span>` : ''}
            ${shown.caption ? `<p class="v5-story-caption">${esc(shown.caption)}</p>` : ''}
          </div>
          <footer class="v5-story-foot">
            <p>${esc(copy.stories.posted)}</p>
            ${viewing.ownerId === ownerId ? '<button type="button" class="v5-btn v5-btn-ghost" data-delete>Take it down</button>' : ''}
          </footer>
        </div>`;
      return;
    }

    if (composing) {
      const pool = servableMemes(true).slice(0, 6);
      const tracks = songs.items.slice(0, 4);
      root.innerHTML = `
        <header class="v5-stories-head">
          <button type="button" class="v5-icon-btn" data-back aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
          <h2>${esc(copy.stories.add)}</h2>
          <button type="button" class="v5-btn" data-post ${canPost(draft) ? '' : 'disabled'}>Post</button>
        </header>
        <div class="v5-compose">
          <div class="v5-compose-preview" aria-live="polite">
            ${
              draft.backdrop
                ? (() => {
                    const shown = describeLayers(layersFor(draft));
                    return `${shown.src ? `<img src="${esc(shown.src)}" alt="${esc(shown.alt)}">` : ''}${
                      draft.sticker ? `<span class="v5-story-sticker">${esc(draft.sticker)}</span>` : ''
                    }${draft.text ? `<p class="v5-story-caption">${esc(draft.text)}</p>` : ''}`;
                  })()
                : `<p class="v5-compose-hint">Pick something to show.<br>A story needs a backdrop.</p>`
            }
          </div>
          <h4>Backdrop</h4>
          <div class="v5-compose-row">
            ${pool
              .map(
                (meme) => `<button type="button" class="v5-pick ${draft.backdrop?.id === meme.id ? 'is-on' : ''}" data-meme="${esc(meme.id)}" aria-label="${esc(meme.alt)}"><img src="${esc(meme.variants.at(-1)?.webp ?? meme.src)}" alt=""></button>`,
              )
              .join('')}
            ${tracks
              .map(
                (song) => `<button type="button" class="v5-pick ${draft.backdrop?.id === song.id ? 'is-on' : ''}" data-song="${esc(song.id)}" aria-label="${esc(song.title)}">${
                  song.artworkUrl ? `<img src="${esc(song.artworkUrl)}" alt="">` : '<span aria-hidden="true">♪</span>'
                }</button>`,
              )
              .join('')}
          </div>
          <h4>${esc(copy.stories.tools.stickers)}</h4>
          <div class="v5-compose-row">
            ${copy.stories.stickers
              .map(
                (name) =>
                  `<button type="button" class="v5-chip ${draft.sticker === name ? 'is-on' : ''}" data-sticker="${esc(name)}">${esc(name)}</button>`,
              )
              .join('')}
          </div>
          <h4>${esc(copy.stories.tools.text)}</h4>
          <input type="text" class="v5-search" data-text maxlength="80" placeholder="Say something" value="${esc(draft.text)}">
          <h4>${esc(copy.stories.tools.audience)}</h4>
          <div class="v5-compose-row">
            ${(['everyone', 'matches', 'circle'] as const)
              .map(
                (audience) =>
                  `<button type="button" class="v5-chip ${draft.audience === audience ? 'is-on' : ''}" data-audience="${audience}">${esc(
                    copy.stories.audience[['everyone', 'matches', 'circle'].indexOf(audience)] as string,
                  )}</button>`,
              )
              .join('')}
          </div>
          <h4>Replies</h4>
          <div class="v5-compose-row">
            ${(['react', 'matches', 'off'] as const)
              .map(
                (rule) =>
                  `<button type="button" class="v5-chip ${draft.replyRule === rule ? 'is-on' : ''}" data-reply="${rule}">${esc(
                    copy.stories.replyRules[['react', 'matches', 'off'].indexOf(rule)] as string,
                  )}</button>`,
              )
              .join('')}
          </div>
        </div>`;
      return;
    }

    const mine = live.filter((story) => story.ownerId === ownerId);
    const others = live.filter((story) => story.ownerId !== ownerId);

    root.innerHTML = `
      <header class="v5-stories-head">
        <button type="button" class="v5-icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2>${esc(copy.stories.railLabel)}</h2>
        <button type="button" class="v5-btn" data-add>${esc(copy.stories.add)}</button>
      </header>
      ${
        mine.length
          ? `<section class="v5-story-group"><h4>Yours</h4><div class="v5-story-rail">${mine
              .map(
                (story) =>
                  `<button type="button" class="v5-story-thumb" data-view="${esc(story.id)}">${thumbFor(story)}</button>`,
              )
              .join('')}</div></section>`
          : `<p class="v5-wall-empty">${esc(copy.stories.addYoursPrompts[0] as string)}</p>`
      }
      ${
        others.length
          ? `<section class="v5-story-group"><h4>Everyone</h4><div class="v5-story-rail">${others
              .map(
                (story) =>
                  `<button type="button" class="v5-story-thumb" data-view="${esc(story.id)}">${thumbFor(story)}</button>`,
              )
              .join('')}</div></section>`
          : `<p class="v5-wall-empty">Nobody has posted. Yours would be the first — that is not a bad thing.</p>`
      }
      <p class="v5-story-note">${esc(copy.stories.posted)}</p>`;
  };

  const thumbFor = (story: Story): string => {
    const shown = describeLayers(story.layers);
    return `${shown.src ? `<img src="${esc(shown.src)}" alt="${esc(shown.alt)}" loading="lazy" decoding="async">` : '<span class="v5-tile-fallback" aria-hidden="true">♪</span>'}
      <i>${esc(timeLeft(story.expiresAt, Date.now()))}</i>`;
  };

  paint();
  host.appendChild(root);
  animate(root, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], {
    duration: 300,
    easing: 'cubic-bezier(.22,.61,.36,1)',
  });

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (target.closest('[data-close]')) {
      options.onClose?.();
      handle.destroy();
      return;
    }
    if (target.closest('[data-back]')) {
      viewing = null;
      composing = false;
      haptics.play('tick');
      paint();
      return;
    }
    if (target.closest('[data-add]')) {
      composing = true;
      draft = emptyDraft();
      haptics.play('tick');
      paint();
      return;
    }

    const viewButton = target.closest<HTMLElement>('[data-view]');
    if (viewButton?.dataset.view) {
      viewing = store.getState().stories.find((story) => story.id === viewButton.dataset.view) ?? null;
      paint();
      return;
    }

    if (target.closest('[data-delete]') && viewing) {
      store.dropStory(viewing.id);
      viewing = null;
      haptics.play('light');
      paint();
      return;
    }

    if (composing) {
      const memeButton = target.closest<HTMLElement>('[data-meme]');
      if (memeButton?.dataset.meme) {
        draft = { ...draft, backdrop: { type: 'meme', id: memeButton.dataset.meme } };
        haptics.play('tick');
        paint();
        return;
      }
      const songButton = target.closest<HTMLElement>('[data-song]');
      if (songButton?.dataset.song) {
        draft = { ...draft, backdrop: { type: 'song', id: songButton.dataset.song } };
        haptics.play('tick');
        paint();
        return;
      }
      const stickerButton = target.closest<HTMLElement>('[data-sticker]');
      if (stickerButton?.dataset.sticker) {
        const name = stickerButton.dataset.sticker;
        draft = { ...draft, sticker: draft.sticker === name ? null : name };
        haptics.play('tick');
        paint();
        return;
      }
      const audienceButton = target.closest<HTMLElement>('[data-audience]');
      if (audienceButton?.dataset.audience) {
        draft = { ...draft, audience: audienceButton.dataset.audience as Audience };
        paint();
        return;
      }
      const replyButton = target.closest<HTMLElement>('[data-reply]');
      if (replyButton?.dataset.reply) {
        draft = { ...draft, replyRule: replyButton.dataset.reply as ReplyRule };
        paint();
        return;
      }
      if (target.closest('[data-post]') && canPost(draft)) {
        const now = Date.now();
        store.putStory({
          id: `story-${now.toString(36)}`,
          ownerId,
          createdAt: now,
          expiresAt: now + ttlMs,
          layers: layersFor(draft),
          audience: draft.audience,
          hideFrom: [],
          replyRule: draft.replyRule,
        });
        composing = false;
        draft = emptyDraft();
        haptics.play('success');
        paint();
      }
    }
  });

  root.addEventListener('input', (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-text]');
    if (!input) return;
    draft = { ...draft, text: input.value };
  });

  const unsubscribe = store.subscribe(() => paint());

  const handle: StoriesHandle = {
    destroy() {
      unsubscribe();
      root.remove();
    },
  };

  return handle;
};
