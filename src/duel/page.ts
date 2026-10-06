/**
 * `/d/:id` — the duel recipient's side, with no account and no app shell.
 *
 * Five fixed-choice prompts, nothing else: there is no free text on this page,
 * which is the whole reason a public link can ship before moderation exists.
 * The verdict renders only after both sides have submitted; until then the page
 * says it is waiting, and only that.
 *
 * The recipient's picks are also real calibration: MockRepo folds them into the
 * `duel` event stream the moment they submit, so a duel played before onboarding
 * seeds onboarding rather than evaporating into a score.
 */

import { renderDuelCard } from './card';
import type { DuelPrompt, DuelRecord, Repo } from '../lib/types';

const RING = `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="14" cy="14" r="2.6"/><circle cx="14" cy="14" r="7.6" stroke-dasharray="36 12"/><circle cx="14" cy="14" r="12.2" stroke-dasharray="54 23" transform="rotate(40 14 14)"/></svg>`;

type Phase = 'loading' | 'missing' | 'intro' | 'playing' | 'submitted' | 'reveal' | 'finished';

const haptic = (p: number | number[]): void => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* unsupported */
  }
};

export const bootDuelPage = async (repo: Repo, id: string): Promise<void> => {
  const root = document.getElementById('duel-page');
  if (!root) return;
  let record: DuelRecord | null = null;
  let phase: Phase = 'loading';
  let step = 0;
  const picks: Record<string, 'a' | 'b'> = {};
  let cleanup: (() => void) | null = null;

  const draw = (): void => {
    root.innerHTML = shell();
    wire();
  };

  const shell = (): string => {
    const top = `<header class="dp-top"><span class="dp-mark">${RING}cultured</span><span class="chipg">Meme Duel</span></header>`;
    if (phase === 'loading') {
      return `${top}<div class="dp-body"><div class="dp-skel"><i></i><i></i><i></i></div></div>`;
    }
    if (phase === 'missing') {
      return `${top}<div class="dp-body dp-center">
        <div class="dp-sticker" aria-hidden="true">🫥</div>
        <h1>This duel has ended.</h1>
        <p>Duel links live for two weeks and then they are gone. No score, no card, nothing kept.</p>
        <button class="cta" data-act="dp-home">Start your own duel</button>
      </div>`;
    }
    const creator = record?.a.name ?? 'Your friend';
    if (phase === 'intro') {
      return `${top}<div class="dp-body">
        <div class="dp-stage"><span class="dp-vs" aria-hidden="true"><i>A</i><b>vs</b><i>B</i></span></div>
        <h1>${escapeHtml(creator)} sent you a<br>Meme Duel.</h1>
        <p class="dp-sub">Same five prompts, five captions each. No peeking at each other's picks — the verdict only opens once <b>both</b> of you are in.</p>
        <ul class="dp-rules">
          <li><span>①</span>Five choices. No typing, nothing to moderate.</li>
          <li><span>②</span>No account needed for this — but your picks also tune your own taste profile if you join later.</li>
          <li><span>③</span>Nothing is public until you choose to share a card.</li>
        </ul>
        <button class="cta" data-act="dp-start">Play the five</button>
      </div>`;
    }
    if (phase === 'playing' && record) {
      const prompt: DuelPrompt | undefined = record.prompts[step];
      if (!prompt) return shell();
      const dots = record.prompts
        .map((p, i) => `<i class="${i < step ? 'done' : i === step ? 'cur' : ''}"></i>`)
        .join('');
      return `${top}<div class="dp-body">
        <div class="dp-head"><span class="chipg">${escapeHtml(creator)} · set</span><span class="dp-step">${step + 1} / ${record.prompts.length}</span></div>
        <div class="dp-prog" aria-hidden="true">${dots}</div>
        <div class="dp-stage" key="${prompt.id}">
          <span class="dp-emoji">${prompt.emoji}</span>
          <h1 class="dp-q">${escapeHtml(prompt.q)}</h1>
        </div>
        <div class="duel2-opts dp-opts">
          ${(['a', 'b'] as const)
            .map(
              (side) => `<button class="duel2-opt opt-${side} ${picks[prompt.id] === side ? 'chosen' : ''}" data-act="dp-pick" data-v="${side}">
            <b>${side.toUpperCase()}</b><span>${escapeHtml(prompt.options[side].text)}</span></button>`,
            )
            .join('')}
        </div>
        <p class="dp-tiny">Pick one — it locks with a flip, like a meme card in a pack.</p>
      </div>`;
    }
    if (phase === 'submitted') {
      return `${top}<div class="dp-body dp-center">
        <div class="dp-fp" aria-hidden="true"><i></i><i></i><i></i></div>
        <h1>You’re in.</h1>
        <p class="dp-sub">Your five picks are locked in. ${escapeHtml(creator)} hasn’t finished theirs yet — the verdict opens only after <b>both</b> sides are in.</p>
        <button class="cta ghostb" data-act="dp-why">Why it works this way</button>
      </div>`;
    }
    if ((phase === 'reveal' || phase === 'finished') && record?.verdict) {
      const v = record.verdict;
      const rec = record; // stable local: closures below can't re-narrow the outer binding
      return `${top}<div class="dp-body">
        <div class="dp-head"><span class="chipg">The verdict</span><span class="dp-step">${escapeHtml(creator)} vs You</span></div>
        <div class="duel2-verdict">
          <div class="duel2-ring" role="img" aria-label="${v.score} of ${v.of} picks matched">
            <svg viewBox="0 0 168 168" aria-hidden="true"><circle class="track" cx="84" cy="84" r="74" stroke-width="7"/><circle class="fill" cx="84" cy="84" r="74" stroke-width="7" style="--len:${(2 * Math.PI * 74).toFixed(1)};--to:${(2 * Math.PI * 74 * (1 - v.score / v.of)).toFixed(1)}"/></svg>
            <span class="dv-wrap"><span class="dv">${v.score}<small>/${v.of}</small></span><span class="de">${v.score === v.of ? '🔥' : v.score === 0 ? '🙈' : '😏'}</span></span>
          </div>
          <b>${escapeHtml(v.line)}</b>
        </div>
        <h3 class="dp-h">Your picks</h3>
        <div class="dp-list">${record.prompts
          .map((p) => {
            const mine = rec.b.picks?.[p.id];
            const theirs = rec.a.picks?.[p.id];
            const same = mine && mine === theirs;
            return `<div class="dp-row ${same ? 'same' : ''}">
              <span class="dp-row-e">${p.emoji}</span>
              <div><b>${same ? 'Both: ' : 'You: '}${mine ? escapeHtml(p.options[mine].text) : '—'}</b>
              ${!same && theirs ? `<span>${escapeHtml(creator)}: ${escapeHtml(p.options[theirs].text)}</span>` : '<span>same damage</span>'}</div>
              <em>${same ? '♥' : '⚔️'}</em></div>`;
          })
          .join('')}</div>
        <div class="dp-cardwrap"><canvas class="dp-card" aria-label="Your Duel Card preview"></canvas></div>
        <div class="dp-actions">
          <button class="cta" data-act="dp-save">Save the card</button>
          <button class="cta ghostb" data-act="dp-own">Start your own duel</button>
        </div>
        <p class="dp-tiny">The saved card carries a small watermark. This preview never does.</p>
      </div>`;
    }
    return `${top}<div class="dp-body dp-center"><h1>This duel is waiting.</h1><p class="dp-sub">${escapeHtml(creator)} hasn’t set their five captions yet. No partial verdict — that’s the point.</p><button class="cta ghostb" data-act="dp-reload">Check again</button></div>`;
  };

  const escapeHtml = (v: string): string =>
    String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

  const load = async (): Promise<void> => {
    try {
      record = await repo.duel.get(id);
    } catch {
      record = null;
    }
    if (!record) {
      phase = 'missing';
      draw();
      return;
    }
    if (record.verdict) phase = 'reveal';
    else if (record.b.picks) phase = 'submitted';
    else phase = 'intro';
    draw();
  };

  const wire = (): void => {
    root.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = (btn as HTMLElement).dataset.act;
        haptic(6);
        if (act === 'dp-start') {
          try {
            await repo.duel.join(id);
          } catch {
            phase = 'missing';
            draw();
            return;
          }
          phase = 'playing';
          draw();
        } else if (act === 'dp-pick') {
          const p = record?.prompts[step];
          if (p) {
            picks[p.id] = (btn as HTMLElement).dataset.v === 'b' ? 'b' : 'a';
            haptic([8, 24, 8]);
            step += 1;
            if (step >= (record?.prompts.length ?? 5)) {
              try {
                record = await repo.duel.submit(id, 'b', picks);
                phase = record.verdict ? 'reveal' : 'submitted';
              } catch {
                phase = 'missing';
              }
            }
            draw();
          }
        } else if (act === 'dp-reload' || act === 'dp-why') {
          if (act === 'dp-reload') void load();
          else haptic(4);
        } else if (act === 'dp-save') {
          const canvas = root.querySelector('canvas.dp-card') as HTMLCanvasElement | null;
          if (canvas && record) renderDuelCard(canvas, record, { size: 'story', external: true });
          const url = canvas ? canvas.toDataURL('image/png') : null;
          if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = `cultured-duel-${id}.png`;
            a.click();
          }
        } else if (act === 'dp-own') {
          window.location.href = '/';
        } else if (act === 'dp-home') {
          window.location.href = '/';
        }
      });
    });
    const canvas = root.querySelector('canvas.dp-card') as HTMLCanvasElement | null;
    if (canvas && record?.verdict) renderDuelCard(canvas, record, { size: 'square', external: false });
  };

  await load();

  // Both sides in? Open the verdict without a refresh — the watch channel is
  // the mock's BroadcastChannel; a production adapter uses the same seam.
  cleanup = repo.duel.watch(id, (rec) => {
    if (!rec) return;
    record = rec;
    if (rec.verdict && phase !== 'reveal' && phase !== 'finished') {
      phase = 'reveal';
      haptic([20, 60, 20]);
      draw();
    } else if (phase === 'playing' && rec.b.picks) {
      phase = 'submitted';
      draw();
    }
  });
  window.addEventListener(
    'pagehide',
    () => {
      cleanup?.();
    },
    { once: true },
  );
};
