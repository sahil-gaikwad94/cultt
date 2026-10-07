import './styles/tokens.css';
import './styles/app.css';
import { createRepo } from './data';
import { installRepoBridge } from './components/phase1';
import { getStore } from './store';
import { v5config } from './store/config';

const repo = createRepo();
installRepoBridge(repo);

/* The v5 store loads + migrates before the first screen paints, so the very
   first render already has the user's real reactions, saves and pins instead
   of zeros. The migration is read-only against `cultured2:*`. */
const v5store = getStore();
(window as Window & { Cultured?: Record<string, unknown> }).Cultured = {
  ...((window as Window & { Cultured?: Record<string, unknown> }).Cultured ?? {}),
  store: v5store,
};

/* Deep link: /d/:id (or ?d=id on static hosts without an SPA rewrite) opens the
   duel recipient page — no app shell, no account, no nav. */
const duelMatch =
  location.pathname.match(/^\/d\/([A-Za-z0-9]+)/) || location.search.match(/[?&]d=([A-Za-z0-9]+)/);

const boot = async () => {
  try {
    const response = await fetch('/assets/manifest.json');
    const manifest = (await response.json()) as Record<string, { file?: string | null }>;
    (window as Window & { CulturedAssets?: Record<string, string> }).CulturedAssets = Object.fromEntries(
      Object.entries(manifest)
        .filter(([, slot]) => Boolean(slot.file))
        .map(([name, slot]) => [name, slot.file as string]),
    );
  } catch {
    // Procedural art remains the safe default when the manifest is unavailable.
  }
  if (duelMatch) {
    const page = document.getElementById('duel-page');
    if (page) page.hidden = false;
    document.getElementById('phone')?.classList.add('duel-route');
    await v5store.ready;
    const { bootDuelPage } = await import('./duel/page');
    void bootDuelPage(repo, duelMatch[1] as string);
    return;
  }
  await v5store.ready;

  /* v5 cold open (brief §5.1). Lazy: the intro chunk never ships to a user
     without the flag, and it plays at most once per install. */
  if (v5config.v5.intro) {
    const { introSeen, markIntroSeen, mountV5Intro } = await import('./v5/mount');
    if (!introSeen()) {
      await new Promise<void>((resolve) => {
        markIntroSeen();
        void mountV5Intro(resolve);
      });
    }
  }

  await import('./legacy');

  /* v5 Home replaces the legacy feed inside the same `#s-feed` host, so the
     existing tab rail, nav and deep links keep working untouched. */
  if (v5config.v5.home) {
    const host = document.getElementById('s-feed');
    if (host) {
      const { mountV5Home } = await import('./v5/mount');
      await mountV5Home(host);
    }
  }
};

void boot();
