/**
 * v5 Home (build brief §6.1 + §6.2).
 *
 * Top bar: contour logo, laugh-streak flame, and the Laugh budget meter — 15
 * pips around the heart, a pip pops when it is spent.
 *
 * A pill segmented control pages between `[Receipts] [Today] [The Draft]` with
 * a liquid indicator and a horizontal swipe pager. All four sub-pages exist
 * behind flags; only the two chosen in CHOICES are enabled.
 *
 * Today holds: the Drop hero (one song + one meme as framed exhibits with
 * placards), the Deck, a Quick Games strip, and the daily ritual ring.
 */

import { copy } from '../copy/index.ts';
import { archetypeFor, axisLabel, memeCategoryName } from '../copy/taxonomy.ts';
import { getStore } from '../store/index.ts';
import type { StoreState } from '../store/index.ts';
import { laughBudget } from '../store/selectors.ts';
import { v5config } from '../store/config.ts';
import { contentStats, servableMemes, songs as songManifest, toPlayable } from '../content/index.ts';
import { getAudio } from './audio.ts';
import { axisAffinity, createDeck, decideGesture, dragRotation, impactFor, limitSheetCopy, memeArt, placardFor, rubberBand } from './deck.ts';
import type { DeckItem } from './deck.ts';
import { createContour } from './contour.ts';
import { axisVector, createFxLayer, openReactionTray, reactionName, trayFor } from './reactions.ts';
import { haptics } from '../lib/haptics.ts';
import { animate } from '../lib/waapi.ts';
import { getQuality } from './quality.ts';

const el = <T extends HTMLElement>(tag: string, className?: string, html?: string): T => {
  const node = document.createElement(tag) as T;
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

const esc = (value: string): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/* --------------------------------------------------------------- top bar - */

const renderBudgetMeter = (state: StoreState, now: number): HTMLElement => {
  const budget = laughBudget(state, v5config.laughsPerDay, now);
  const meter = el<HTMLDivElement>('div', 'v5-budget', '');
  meter.setAttribute('role', 'meter');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', String(budget.cap));
  meter.setAttribute('aria-valuenow', String(budget.left));
  meter.setAttribute('aria-label', `${copy.home.laughsLeft} ${budget.left}/${budget.cap}`);

  const heart = el<HTMLSpanElement>('span', 'v5-budget-heart', '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/></svg>');
  meter.appendChild(heart);

  const pips = el<HTMLSpanElement>('span', 'v5-pips', '');
  for (let i = 0; i < budget.cap; i += 1) {
    const pip = el<HTMLSpanElement>('i', 'v5-pip');
    pip.dataset.spent = String(i >= budget.left);
    pips.appendChild(pip);
  }
  meter.appendChild(pips);
  meter.appendChild(el<HTMLSpanElement>('span', 'v5-budget-count', `${budget.left}<small>/${budget.cap}</small>`));
  return meter;
};

/** Pops a pip. Called after a spend so the meter animates rather than jumps. */
const popPip = (meter: HTMLElement, index: number): void => {
  const pip = meter.querySelectorAll<HTMLElement>('.v5-pip')[index];
  if (!pip) return;
  pip.dataset.spent = 'true';
  animate(pip, 
    [{ transform: 'scale(1.5)', opacity: 1 }, { transform: 'scale(0.4)', opacity: 0.35 }],
    { duration: 320, easing: 'cubic-bezier(.34,1.3,.5,1)' },
  );
};

/* ----------------------------------------------------------------- cards - */

interface CardContext {
  host: HTMLElement;
  store: ReturnType<typeof getStore>;
  audio: ReturnType<typeof getAudio>;
  fx: ReturnType<typeof createFxLayer>;
  onBudgetChange: () => void;
  onAdvanced: (item: DeckItem) => void;
  onOpenVault: () => void;
}

const renderMemeCard = (item: DeckItem, index: number): HTMLElement => {
  const meme = item.meme!;
  const art = memeArt(meme);
  const card = el<HTMLElement>('article', 'v5-card v5-card-meme');
  card.dataset.id = item.id;
  card.dataset.kind = 'meme';
  card.style.setProperty('--dominant', meme.dominant ?? '#1b1b19');

  card.innerHTML = `
    <div class="v5-card-media" style="aspect-ratio:${meme.width || 4}/${meme.height || 3}">
      <img src="${esc(art.src)}"${art.srcset ? ` srcset="${esc(art.srcset)}" sizes="${esc(art.sizes)}"` : ''}
           alt="${esc(art.alt)}" decoding="async" loading="${index < 2 ? 'eager' : 'lazy'}" draggable="false">
    </div>
    <span class="v5-card-chip">${esc(memeCategoryName(meme.category))}</span>
    <div class="v5-placard">
      <span class="v5-placard-line">${esc(placardFor(item, index))}</span>
      <span class="v5-placard-impact">${esc(impactFor(item))}</span>
    </div>
    <div class="v5-card-rail">
      <button type="button" class="v5-rail-btn" data-act="laugh" aria-label="${esc(reactionName('meme', '😭'))}">😭</button>
      <button type="button" class="v5-rail-btn" data-act="save" aria-label="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6.5 4h11v16.5L12 16.8 6.5 20.5z"/></svg></button>
      <button type="button" class="v5-rail-btn" data-act="share" aria-label="Share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 15.5V4M8 7.8 12 4l4 3.8M5 12v7.5h14V12"/></svg></button>
    </div>
    <div class="v5-stamp v5-stamp-right" aria-hidden="true">HAHA</div>
    <div class="v5-stamp v5-stamp-left" aria-hidden="true">MEH</div>
    <div class="v5-stamp v5-stamp-up" aria-hidden="true">KEPT</div>
    <div class="v5-chips" data-chips></div>`;
  return card;
};

const renderSongCard = (item: DeckItem, index: number): HTMLElement => {
  const song = item.song!;
  const card = el<HTMLElement>('article', 'v5-card v5-card-song');
  card.dataset.id = item.id;
  card.dataset.kind = 'song';

  const art = song.artworkUrl
    ? `<img src="${esc(song.artworkUrl)}" alt="" decoding="async" loading="${index < 2 ? 'eager' : 'lazy'}">`
    : `<span class="v5-art-fallback" aria-hidden="true">♪</span>`;

  card.innerHTML = `
    <div class="v5-song-art">${art}</div>
    <div class="v5-song-meta">
      <span class="v5-card-chip">${esc(song.genreName)}</span>
      <h3>${esc(song.title)}</h3>
      <p>${esc(song.artist)}</p>
    </div>
    <button type="button" class="v5-play-ring" data-act="play" aria-label="Play 30-second preview">
      <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="v5-ring-track" cx="50" cy="50" r="44"/><circle class="v5-ring-fill" cx="50" cy="50" r="44"/></svg>
      <span class="v5-play-glyph" aria-hidden="true">▶</span>
    </button>
    <div class="v5-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="v5-placard">
      <span class="v5-placard-line">${esc(placardFor(item, index))}</span>
      <span class="v5-placard-impact">${esc(impactFor(item))}</span>
    </div>
    ${
      song.trackViewUrl
        ? `<a class="v5-listen" href="${esc(song.trackViewUrl)}" target="_blank" rel="noopener noreferrer">Listen on ${song.provider === 'deezer' ? 'Deezer' : 'Apple Music'}</a>`
        : `<span class="v5-listen v5-listen-off">${esc(copy.status.noPreview)}</span>`
    }
    <div class="v5-stamp v5-stamp-right" aria-hidden="true">HAHA</div>
    <div class="v5-stamp v5-stamp-left" aria-hidden="true">MEH</div>
    <div class="v5-stamp v5-stamp-up" aria-hidden="true">KEPT</div>
    <div class="v5-chips" data-chips></div>`;
  return card;
};

/* ------------------------------------------------------------------ deck - */

const RENDER_AHEAD = 3;

export interface DeckHost {
  destroy(): void;
}

/**
 * Renders the Deck into `host`. At most three cards are in the DOM; the rest
 * are ordered but unrendered, and two ahead are preloaded.
 */
export const mountDeck = (host: HTMLElement, context: CardContext): DeckHost => {
  const store = context.store;
  const now = () => Date.now();
  const deck = createDeck(
    { memes: servableMemes(true), songs: songManifest.items },
    now,
  );

  let cards: HTMLElement[] = [];
  let pointer: { id: number; startX: number; startY: number; startT: number; dx: number; dy: number; active: boolean } | null = null;
  let destroyed = false;

  const paint = () => {
    if (destroyed) return;
    const upcoming = deck.items().slice(0, RENDER_AHEAD);
    host.textContent = '';
    cards = [];

    if (!upcoming.length) {
      host.appendChild(renderExhausted(deck.galleryCount()));
      return;
    }

    upcoming.forEach((item, index) => {
      const card = item.kind === 'meme' ? renderMemeCard(item, index) : renderSongCard(item, index);
      card.style.setProperty('--depth', String(index));
      card.style.zIndex = String(RENDER_AHEAD - index);
      if (index > 0) {
        const scale = 1 - (1 - 0.94) * index;
        card.style.transform = `translateY(${index * 12}px) scale(${scale})`;
      }
      host.appendChild(card);
      cards.push(card);
      wireCard(card, item, index);
    });

    // Preload two ahead.
    for (const item of upcoming.slice(1, 3)) {
      const src = item.kind === 'meme' ? memeArt(item.meme!).src : item.song?.artworkUrl;
      if (src) {
        const image = new Image();
        image.src = src;
      }
    }
  };

  const renderExhausted = (galleryCount: number): HTMLElement => {
    const node = el<HTMLDivElement>('div', 'v5-exhausted');
    node.innerHTML = `
      <canvas class="v5-exhausted-contour" aria-hidden="true"></canvas>
      <h3>${esc(copy.home.deckEmpty.headline)}</h3>
      <p>${esc(copy.home.deckEmpty.sub)}</p>
      <p class="v5-gallery-count">${esc(copy.home.galleryCount(galleryCount))}</p>`;
    const canvas = node.querySelector<HTMLCanvasElement>('canvas');
    if (canvas) {
      const contour = createContour({ canvas, params: { seed: 7, rings: 6, wobble: 0.2, stroke: '#E8C77E' }, static: true });
      contour.draw();
    }
    return node;
  };

  const refreshBudget = () => context.onBudgetChange();

  const applyReaction = (item: DeckItem, card: HTMLElement, emoji: string, at: { x: number; y: number }) => {
    const kind = item.kind === 'song' ? 'song' : 'meme';
    const result = store.react({ kind, itemId: item.id, emoji, surface: 'deck' });
    if (!result.ok) {
      if (result.reason === 'budget') showLimitSheet();
      return;
    }
    renderChip(card, kind, emoji);
    refreshBudget();
    void context.fx.play(emoji, at);
    haptics.play('light');
  };

  const renderChip = (card: HTMLElement, kind: 'meme' | 'song', emoji: string) => {
    const chips = card.querySelector<HTMLElement>('[data-chips]');
    if (!chips) return;
    const label = reactionName(kind, emoji);
    const existing = chips.querySelector<HTMLElement>(`[data-emoji="${emoji}"]`);
    if (existing) {
      animate(existing, [{ transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260 });
      return;
    }
    const chip = el<HTMLSpanElement>('span', 'v5-chip', `${emoji} <small>${esc(label)}</small>`);
    chip.dataset.emoji = emoji;
    chips.appendChild(chip);
    animate(chip, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)' }], {
      duration: 340,
      easing: 'cubic-bezier(.34,1.3,.5,1)',
    });
  };

  const showLimitSheet = () => {
    const sheet = limitSheetCopy(store.getState(), now());
    const node = el<HTMLDivElement>('div', 'v5-limit-sheet');
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-label', sheet.title);
    node.innerHTML = `
      <h2>${esc(sheet.title)}</h2>
      <p>${esc(sheet.body)}</p>
      <p class="v5-limit-sub">${esc(sheet.sub)}</p>
      <p class="v5-limit-countdown">${esc(sheet.countdown)}</p>
      <button type="button" class="v5-btn" data-close>${esc(sheet.cta)}</button>
      <button type="button" class="v5-btn v5-btn-ghost" data-vault>${esc(sheet.secondary)}</button>`;
    node.querySelector('[data-close]')?.addEventListener('click', () => node.remove());
    node.querySelector('[data-vault]')?.addEventListener('click', () => {
      node.remove();
      context.onOpenVault();
    });
    document.body.appendChild(node);
    animate(node, [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.22,.61,.36,1)' });
  };

  const wireCard = (card: HTMLElement, item: DeckItem, index: number) => {
    if (index !== 0) return; // only the top card is interactive
    const kind = item.kind === 'song' ? 'song' : 'meme';
    const width = card.offsetWidth || 320;

    card.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button,a')) return;
      pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startT: performance.now(), dx: 0, dy: 0, active: true };
      card.setPointerCapture(event.pointerId);
    });

    card.addEventListener('pointermove', (event) => {
      if (!pointer?.active || event.pointerId !== pointer.id) return;
      pointer.dx = event.clientX - pointer.startX;
      pointer.dy = event.clientY - pointer.startY;
      const decision = decideGesture({
        dx: pointer.dx,
        dy: pointer.dy,
        velocity: 0,
        cardWidth: width,
        laughsLeft: deck.laughsLeft(),
      });
      const blocked = decision.blocked;
      const dx = blocked ? rubberBand(pointer.dx) : pointer.dx;
      card.style.transform = `translate(${dx}px, ${pointer.dy < 0 ? pointer.dy : 0}px) rotate(${dragRotation(dx, width).toFixed(2)}deg)`;
      card.classList.toggle('is-blocked', blocked);

      const rightStamp = card.querySelector<HTMLElement>('.v5-stamp-right');
      const leftStamp = card.querySelector<HTMLElement>('.v5-stamp-left');
      const upStamp = card.querySelector<HTMLElement>('.v5-stamp-up');
      if (rightStamp) rightStamp.style.opacity = String(Math.max(0, Math.min(1, dx / (width * 0.28))));
      if (leftStamp) leftStamp.style.opacity = String(Math.max(0, Math.min(1, -dx / (width * 0.28))));
      if (upStamp) upStamp.style.opacity = String(Math.max(0, Math.min(1, -pointer.dy / (width * 0.28))));
    });

    const release = (event: PointerEvent) => {
      if (!pointer?.active || event.pointerId !== pointer.id) return;
      const elapsed = Math.max(1, performance.now() - pointer.startT);
      const distance = Math.hypot(pointer.dx, pointer.dy);
      const velocity = distance / elapsed;
      const decision = decideGesture({
        dx: pointer.dx,
        dy: pointer.dy,
        velocity,
        cardWidth: width,
        laughsLeft: deck.laughsLeft(),
      });
      pointer = null;

      if (decision.blocked) {
        animate(card, [{ transform: card.style.transform }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(.34,1.3,.5,1)' });
        card.classList.remove('is-blocked');
        haptics.play('thud');
        showLimitSheet();
        return;
      }

      if (!decision.committed) {
        animate(card, [{ transform: card.style.transform }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,.61,.36,1)' });
        return;
      }

      commit(item, card, decision.action);
    };

    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);

    // Action rail
    card.querySelector('[data-act="laugh"]')?.addEventListener('click', (event) => {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      applyReaction(item, card, trayFor(kind)[0], { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    });
    card.querySelector('[data-act="save"]')?.addEventListener('click', () => {
      const result = store.toggleSave(kind, item.id);
      (card.querySelector('[data-act="save"]') as HTMLElement | null)?.classList.toggle('is-on', result.saved);
      haptics.play('light');
      toast(result.saved ? copy.vault.savedToast : copy.vault.unsavedToast);
    });
    card.querySelector('[data-act="share"]')?.addEventListener('click', () => {
      void share(item);
    });
    card.querySelector('[data-act="play"]')?.addEventListener('click', async () => {
      if (!item.song) return;
      await context.audio.toggle(toPlayable(item.song));
      card.classList.toggle('is-playing', context.audio.state().playing);
    });

    // Long-press opens the tray.
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let holdOrigin: { x: number; y: number } | null = null;
    card.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button,a')) return;
      holdOrigin = { x: event.clientX, y: event.clientY };
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (pointer) pointer.active = false;
        void openReactionTray({ kind, anchor: holdOrigin ?? { x: 0, y: 0 }, target: card }).then((result) => {
          if (result.emoji) applyReaction(item, card, result.emoji, result.at);
        });
      }, 350);
    });
    const cancelHold = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
    };
    card.addEventListener('pointermove', cancelHold, { passive: true });
    card.addEventListener('pointerup', cancelHold, { passive: true });
    card.addEventListener('pointercancel', cancelHold, { passive: true });

    // Double-tap = signature reaction with a burst at the tap point.
    let lastTap = 0;
    card.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button,a')) return;
      const at = { x: event.clientX, y: event.clientY };
      const nowMs = performance.now();
      if (nowMs - lastTap < 320) {
        lastTap = 0;
        const stored = store.getState().reactions.find((r) => r.itemId === item.id);
        applyReaction(item, card, stored?.emoji ?? '😭', at);
        return;
      }
      lastTap = nowMs;
    });
  };

  const commit = (item: DeckItem, card: HTMLElement, action: 'laugh' | 'pass' | 'save') => {
    const kind = item.kind === 'song' ? 'song' : 'meme';
    if (action === 'laugh') {
      const signature = '😭';
      const result = store.react({ kind, itemId: item.id, emoji: signature, surface: 'deck' });
      if (!result.ok) {
        showLimitSheet();
        return;
      }
      refreshBudget();
      haptics.play('laugh');
    } else if (action === 'save') {
      store.setSaved(kind, item.id, true);
      haptics.play('light');
      toast(copy.vault.savedToast);
    }

    const flyOut = action === 'pass' ? -1 : 1;
    const animation = animate(card, 
      [
        { transform: card.style.transform || 'none', opacity: 1 },
        { transform: `translate(${action === 'save' ? 0 : flyOut * 420}px, ${action === 'save' ? -520 : 40}px) rotate(${action === 'save' ? 0 : flyOut * 24}deg) scale(.9)`, opacity: 0 },
      ],
      { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    const finish = () => {
      deck.advance();
      context.onAdvanced(item);
      paint();
      refreshBudget();
    };
    animation.finished.then(finish, finish);
  };

  const share = async (item: DeckItem): Promise<void> => {
    const title = item.kind === 'meme' ? item.meme!.title : `${item.song!.title} — ${item.song!.artist}`;
    const text = `${title}. ${copy.sharing.memeFooter}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'cultured', text, url: location.href });
        return;
      } catch {
        /* the user dismissed it; fall through to the toast */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${location.href}`);
      toast('Copied');
    } catch {
      toast(copy.status.error);
    }
  };

  const toast = (message: string): void => {
    const node = el<HTMLDivElement>('div', 'v5-toast', esc(message));
    node.setAttribute('role', 'status');
    document.body.appendChild(node);
    animate(node, [{ opacity: 0, transform: 'translate(-50%,-14px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], {
      duration: 240,
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'forwards',
    });
    setTimeout(() => node.remove(), 1800);
  };

  paint();
  const unsubscribe = store.subscribe(() => {
    refreshBudget();
  });

  return {
    destroy() {
      destroyed = true;
      unsubscribe();
      host.textContent = '';
      cards = [];
    },
  };
};

/* -------------------------------------------------------------- sub-pages */

const renderReceipts = (): HTMLElement => {
  const store = getStore();
  const state = store.getState();
  const node = el<HTMLDivElement>('div', 'v5-subpage v5-receipts');
  const stats = contentStats();

  const yesterday = new Date(Date.now() - 86400000);
  const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).getTime();
  const end = start + 86400000;
  const entries = state.reactions.filter((r) => r.ts >= start && r.ts < end);
  const saves = state.saves.filter((s) => s.ts >= start && s.ts < end);

  if (!entries.length && !saves.length) {
    node.innerHTML = `<div class="v5-empty"><h3>Nothing to report. Suspicious.</h3><p>${stats.memes} exhibits are waiting.</p></div>`;
    return node;
  }

  const peak = entries.reduce<{ ts: number; count: number }>((best, r) => {
    const hour = new Date(r.ts).getHours();
    const key = hour;
    const count = entries.filter((e) => new Date(e.ts).getHours() === key).length;
    return count > best.count ? { ts: hour, count } : best;
  }, { ts: 0, count: 0 });

  const lines = entries.slice(0, 8).map((r) => {
    const time = new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<li><span class="v5-r-time">${esc(time)}</span><span class="v5-r-id">${esc(r.itemId.slice(0, 12))}</span><span class="v5-r-emoji">${esc(r.emoji)}</span></li>`;
  });

  node.innerHTML = `
    <div class="v5-thermal">
      <header><b>cultured</b><span>${esc(yesterday.toLocaleDateString())}</span></header>
      <ul class="v5-r-lines">${lines.join('')}</ul>
      <dl class="v5-r-totals">
        <div><dt>laughs</dt><dd>${entries.length}</dd></div>
        <div><dt>saves</dt><dd>${saves.length}</dd></div>
        <div><dt>shares</dt><dd>0</dd></div>
      </dl>
      <p class="v5-r-peak">Peak chaos: ${String(peak.ts).padStart(2, '0')}:00</p>
      <div class="v5-r-barcode" aria-hidden="true"></div>
      <p class="v5-r-stamp">PAID IN FULL</p>
    </div>`;
  return node;
};

const renderDraft = (): HTMLElement => {
  const node = el<HTMLDivElement>('div', 'v5-subpage v5-draft');
  const pool = servableMemes(true);
  const candidates = pool.slice(0, 2);
  const songs = songManifest.items.slice(0, 2);

  node.innerHTML = `
    <div class="v5-draft-head">
      <h3>Tomorrow's drop</h3>
      <p>Vote once a day. Free.</p>
      <p class="v5-practice">Practice mode: results arrive at 9:00 once voting is live.</p>
    </div>
    <div class="v5-draft-pair">
      ${candidates
        .map(
          (meme) => `<button type="button" class="v5-draft-card" data-id="${esc(meme.id)}">
            <img src="${esc(memeArt(meme).src)}" alt="" aria-hidden="true">
            <span class="v5-draft-hint">${esc(memeCategoryName(meme.category))}</span>
          </button>`,
        )
        .join('')}
    </div>
    <div class="v5-draft-songs">
      ${songs
        .map(
          (song) => `<button type="button" class="v5-draft-song" data-id="${esc(song.id)}">
            <span class="v5-chip">${esc(song.genreName)}</span><b>${esc(song.vibe)}</b>
          </button>`,
        )
        .join('')}
    </div>`;
  return node;
};

/* ---------------------------------------------------------------- verdict */

export interface Verdict {
  /** The archetype the day's reactions point at, or null below two axes. */
  archetype: { name: string; line: string } | null;
  /** Ranked axes with a share of the day's reactions, highest first. */
  axes: { axis: string; label: string; share: number }[];
  laughs: number;
  saves: number;
  topReaction: { emoji: string; count: number } | null;
  /** 0..1 — how far the day's reactions concentrate on one axis. */
  clarity: number;
}

/**
 * Yesterday's reactions, read back as a verdict.
 *
 * Pure, so the tests can pin it: same state and same window, same verdict.
 * Clarity is the top axis's share of the day — a day spent entirely on one axis
 * reads 1, a day spread evenly across six reads ~0.17.
 */
export const verdictFor = (
  state: Parameters<typeof axisAffinity>[0],
  now: number = Date.now(),
): Verdict => {
  const start = new Date(now - 86400000);
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const to = from + 86400000;

  const reactions = state.reactions.filter((r) => r.ts >= from && r.ts < to);
  const saves = state.saves.filter((sv) => sv.ts >= from && sv.ts < to);

  const vector = axisVector(reactions);
  const total = Object.values(vector).reduce((sum, v) => sum + (v ?? 0), 0) || 1;
  const axes = Object.entries(vector)
    .map(([axis, value]) => ({ axis, label: axisLabel(axis), share: (value ?? 0) / total }))
    .sort((a, b) => b.share - a.share);

  const tally = new Map<string, number>();
  for (const reaction of reactions) tally.set(reaction.emoji, (tally.get(reaction.emoji) ?? 0) + 1);
  const topReaction = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([emoji, count]) => ({ emoji, count }))[0] ?? null;

  const found = archetypeFor(vector);
  return {
    archetype: found ? { name: found.archetype.name, line: found.archetype.line } : null,
    axes,
    laughs: reactions.length,
    saves: saves.length,
    topReaction,
    clarity: axes[0]?.share ?? 0,
  };
};

const renderVerdict = (): HTMLElement => {
  const node = el<HTMLDivElement>('div', 'v5-subpage v5-verdict');
  const verdict = verdictFor(getStore().getState());

  if (!verdict.laughs && !verdict.saves) {
    node.innerHTML = '<div class="v5-empty"><h3>No verdict yet.</h3><p>React to something yesterday-shaped and this fills in.</p></div>';
    return node;
  }

  const bars = verdict.axes
    .filter((axis) => axis.share > 0)
    .slice(0, 4)
    .map(
      (axis) => `<div class="v5-v-row">
        <span class="v5-v-label">${esc(axis.label)}</span>
        <span class="v5-v-track"><i style="transform:scaleX(${axis.share.toFixed(3)})"></i></span>
        <span class="v5-v-pct">${Math.round(axis.share * 100)}%</span>
      </div>`,
    )
    .join('');

  node.innerHTML = `
    <header class="v5-verdict-head">
      <span class="v5-kicker">Yesterday's verdict</span>
      <h3>${esc(verdict.archetype?.name ?? 'Still developing')}</h3>
      <p>${esc(verdict.archetype?.line ?? 'Two distinct axes and an archetype appears.')}</p>
    </header>
    <div class="v5-verdict-body">
      <div class="v5-v-bars">${bars}</div>
      <dl class="v5-v-totals">
        <div><dt>laughs</dt><dd>${verdict.laughs}</dd></div>
        <div><dt>saves</dt><dd>${verdict.saves}</dd></div>
        <div><dt>${esc(copy.fingerprintClarity)}</dt><dd>${Math.round(verdict.clarity * 100)}%</dd></div>
      </dl>
      ${
        verdict.topReaction
          ? `<p class="v5-v-top">Most used: <b>${esc(verdict.topReaction.emoji)}</b> ×${verdict.topReaction.count}</p>`
          : ''
      }
    </div>`;
  return node;
};

/* --------------------------------------------------------------- forecast */

/** Deterministic per local day, so everyone gets the same forecast today. */
export const forecastIndex = (dayKey: string, options: number): number => {
  let hash = 2166136261;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash ^= dayKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % Math.max(1, options);
};

const renderForecast = (): HTMLElement => {
  const node = el<HTMLDivElement>('div', 'v5-subpage v5-forecast');
  const tomorrow = new Date(Date.now() + 86400000);
  const dayKey = `${tomorrow.getFullYear()}${tomorrow.getMonth()}${tomorrow.getDate()}`;
  const weather = copy.forecast.weather[forecastIndex(dayKey, copy.forecast.weather.length)]!;
  const stats = contentStats();
  const pool = servableMemes(true);
  const teaser = pool[forecastIndex(dayKey, Math.max(1, pool.length))];

  node.innerHTML = `
    <header class="v5-forecast-head">
      <span class="v5-kicker">${esc(tomorrow.toLocaleDateString([], { weekday: 'long' }))}</span>
      <p class="v5-f-emoji" aria-hidden="true">${esc(weather.emoji)}</p>
      <h3>${esc(weather.label)}</h3>
    </header>
    <dl class="v5-f-facts">
      <div><dt>arriving</dt><dd>${stats.memes + stats.songs}</dd></div>
      <div><dt>at</dt><dd>09:00</dd></div>
      <div><dt>laughs</dt><dd>${v5config.laughsPerDay}</dd></div>
    </dl>
    ${
      teaser
        ? `<figure class="v5-f-teaser">
            <div class="v5-frame"><img src="${esc(memeArt(teaser).src)}" alt=""></div>
            <figcaption>A hint. That's all you get.</figcaption>
          </figure>`
        : ''
    }`;
  return node;
};

const renderToday = (context: CardContext): HTMLElement => {
  const node = el<HTMLDivElement>('div', 'v5-subpage v5-today');
  const stats = contentStats();
  const dropMeme = servableMemes(true)[0];
  const dropSong = songManifest.items[0];

  const hero = el<HTMLDivElement>('div', 'v5-drop');
  hero.innerHTML = `
    <span class="v5-kicker">${esc(copy.home.kicker)}</span>
    <div class="v5-drop-pair">
      ${
        dropSong
          ? `<figure class="v5-exhibit v5-exhibit-song">
              <div class="v5-frame">${dropSong.artworkUrl ? `<img src="${esc(dropSong.artworkUrl)}" alt="">` : '<span aria-hidden="true">♪</span>'}</div>
              <figcaption><b>${esc(dropSong.title)}</b><span>${esc(dropSong.artist)}</span></figcaption>
            </figure>`
          : ''
      }
      ${
        dropMeme
          ? `<figure class="v5-exhibit v5-exhibit-meme">
              <div class="v5-frame"><img src="${esc(memeArt(dropMeme).src)}" alt="${esc(dropMeme.alt)}"></div>
              <figcaption><b>${esc(dropMeme.title)}</b><span>${esc(memeCategoryName(dropMeme.category))}</span></figcaption>
            </figure>`
          : ''
      }
    </div>`;
  node.appendChild(hero);

  const deckSection = el<HTMLDivElement>('div', 'v5-deck-section');
  deckSection.innerHTML = `
    <div class="v5-deck-head">
      <h2>${esc(copy.home.deckTitle)}</h2>
      <p>${esc(copy.home.deckSub)}</p>
      <span class="v5-gallery-count">${esc(copy.home.galleryCount(stats.memes + stats.songs))}</span>
    </div>`;
  const deckHost = el<HTMLDivElement>('div', 'v5-deck');
  deckSection.appendChild(deckHost);
  node.appendChild(deckSection);

  const games = el<HTMLDivElement>('div', 'v5-games');
  games.innerHTML = `
    <h3>${esc(copy.arena.header)}</h3>
    <div class="v5-games-row">
      <button type="button" class="v5-game" data-game="duel"><b>Meme Duel</b><span>${esc(copy.arena.duelTile)}</span></button>
      <button type="button" class="v5-game" data-game="nhie"><b>Never Have I Ever</b><span>${esc(copy.arena.nhieTile)}</span></button>
      <button type="button" class="v5-game" data-game="vault"><b>Your Vault</b><span>${esc(copy.vault.title)}</span></button>
      ${
        v5config.v5.profile
          ? `<button type="button" class="v5-game" data-game="profile"><b>Your wall</b><span>${esc(copy.fingerprintClarity)}</span></button>`
          : ''
      }
    </div>`;
  node.appendChild(games);

  const ritual = el<HTMLDivElement>('div', 'v5-ritual');
  ritual.innerHTML = `<canvas class="v5-ritual-ring" aria-hidden="true"></canvas><p>${esc(copy.home.ritual)}</p>`;
  node.appendChild(ritual);

  const ring = ritual.querySelector<HTMLCanvasElement>('.v5-ritual-ring');
  if (ring) {
    const contour = createContour({ canvas: ring, params: { seed: 21, rings: 4, wobble: 0.18, stroke: '#E8C77E' }, static: getQuality().tier === 'C' });
    if (getQuality().tier !== 'C') contour.start();
  }

  // Mount the deck after the node is in the document so measurements are real.
  requestAnimationFrame(() => {
    if (!deckHost.isConnected) return;
    mountDeck(deckHost, context);
  });

  return node;
};

/* ------------------------------------------------------------------- home */

export interface HomeHandle {
  destroy(): void;
}

export const renderHome = (host: HTMLElement, hooks: { onOpenVault: () => void; onOpenGame: (game: string) => void }): HomeHandle => {
  const store = getStore();
  const audio = getAudio();
  const fxCanvas = el<HTMLCanvasElement>('canvas', 'v5-fx-layer');
  fxCanvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(fxCanvas);
  const fx = createFxLayer({ canvas: fxCanvas });

  host.textContent = '';
  host.classList.add('v5-home');

  const topbar = el<HTMLElement>('header', 'v5-topbar');
  const logo = el<HTMLDivElement>('div', 'v5-logo');
  logo.innerHTML = '<canvas class="v5-logo-contour" aria-hidden="true"></canvas><span>cultured</span>';
  topbar.appendChild(logo);

  const streak = store.getState().progress.laughStreak;
  const flame = el<HTMLDivElement>('div', 'v5-streak', streak ? `🔥<b>${streak}</b>` : '');
  flame.setAttribute('aria-label', streak ? `${streak} day laugh streak` : 'No streak yet');
  topbar.appendChild(flame);

  // The meter is a container that is re-rendered on every spend, so a pip can
  // pop without the whole top bar being rebuilt.
  const meterHost = el<HTMLDivElement>('div', 'v5-budget-host');
  const refreshMeter = () => {
    const previous = meterHost.querySelector('.v5-budget');
    const next = renderBudgetMeter(store.getState(), Date.now());
    meterHost.textContent = '';
    meterHost.appendChild(next);
    if (previous) {
      const spentBefore = previous.querySelectorAll('.v5-pip[data-spent="true"]').length;
      const spentNow = next.querySelectorAll('.v5-pip[data-spent="true"]').length;
      if (spentNow > spentBefore) popPip(next, next.querySelectorAll('.v5-pip').length - spentNow);
    }
  };
  refreshMeter();
  topbar.appendChild(meterHost);
  host.appendChild(topbar);

  const logoCanvas = logo.querySelector<HTMLCanvasElement>('canvas');
  if (logoCanvas) {
    const contour = createContour({ canvas: logoCanvas, params: { seed: 3, rings: 4, wobble: 0.22, stroke: '#EFE9DA' }, static: getQuality().tier === 'C' });
    if (getQuality().tier !== 'C') contour.start();
  }

  const tabs = v5config.home.enabledSubPages;
  const labels: Record<string, string> = {
    receipts: copy.home.tabs.receipts,
    today: copy.home.tabs.today,
    draft: copy.home.tabs.draft,
    verdict: copy.home.tabs.verdict,
    forecast: copy.home.tabs.forecast,
  };

  const segmented = el<HTMLDivElement>('div', 'v5-segmented');
  segmented.setAttribute('role', 'tablist');
  const indicator = el<HTMLSpanElement>('span', 'v5-seg-indicator');
  segmented.appendChild(indicator);
  for (const tab of tabs) {
    const button = el<HTMLButtonElement>('button', 'v5-seg-btn', esc(labels[tab] ?? tab));
    button.type = 'button';
    button.dataset.tab = tab;
    button.setAttribute('role', 'tab');
    segmented.appendChild(button);
  }
  host.appendChild(segmented);

  const pager = el<HTMLDivElement>('div', 'v5-pager');
  host.appendChild(pager);

  const context: CardContext = {
    host,
    store,
    audio,
    fx,
    onBudgetChange: refreshMeter,
    onAdvanced: () => undefined,
    onOpenVault: hooks.onOpenVault,
  };

  const pages = new Map<string, HTMLElement>();
  const buildPage = (tab: string): HTMLElement => {
    const existing = pages.get(tab);
    if (existing) return existing;
    const page =
      tab === 'today'
        ? renderToday(context)
        : tab === 'receipts'
          ? renderReceipts()
          : tab === 'verdict'
            ? renderVerdict()
            : tab === 'forecast'
              ? renderForecast()
              : renderDraft();
    page.dataset.tab = tab;
    pages.set(tab, page);
    return page;
  };

  const select = (tab: string) => {
    pager.textContent = '';
    const page = buildPage(tab);
    pager.appendChild(page);
    const index = tabs.indexOf(tab);
    segmented.querySelectorAll<HTMLButtonElement>('.v5-seg-btn').forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.classList.toggle('is-on', i === index);
    });
    if (index >= 0) {
      indicator.style.setProperty('--i', String(index));
      indicator.style.transform = `translateX(${index * 100}%)`;
    }
  };

  segmented.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.v5-seg-btn');
    if (!button?.dataset.tab) return;
    haptics.play('tick');
    select(button.dataset.tab);
  });

  // Swipe between pages.
  let swipeStart = 0;
  pager.addEventListener('pointerdown', (event) => {
    swipeStart = event.clientX;
  });
  pager.addEventListener('pointerup', (event) => {
    const dx = event.clientX - swipeStart;
    if (Math.abs(dx) < 60) return;
    const current = tabs.indexOf(pager.firstElementChild?.getAttribute('data-tab') ?? 'today');
    const next = dx < 0 ? current + 1 : current - 1;
    if (next >= 0 && next < tabs.length) select(tabs[next]);
  });

  host.addEventListener('click', (event) => {
    const game = (event.target as HTMLElement).closest<HTMLElement>('[data-game]');
    if (!game) return;
    hooks.onOpenGame(game.dataset.game ?? '');
  });

  select(tabs.includes('today') ? 'today' : tabs[0]);

  const unsubscribe = store.subscribe(refreshMeter);

  return {
    destroy() {
      unsubscribe();
      fx.destroy();
      fxCanvas.remove();
      host.textContent = '';
      host.classList.remove('v5-home');
    },
  };
};
