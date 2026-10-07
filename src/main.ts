import './styles/tokens.css';
import './styles/app.css';
/* The v5 stylesheet is fully scoped (.v5-*, .reaction-tray, .tray-*, .hold-ring)
   — no global selectors — so it is safe to load alongside the legacy app. It
   carries the ReactionTray and Stories styling the legacy UI now reuses. ~8 KB
   gz; the brief's budget (§10) is about JS, and this stays off the JS path. */
import './v5/styles.css';
import { createRepo } from './data';
import { installRepoBridge } from './components/phase1';
import { getStore } from './store';
import { v5config } from './store/config';

/* `createRepo` is async: the Supabase client is imported lazily so it never
   lands on the first-paint critical path. See src/data/index.ts. */
const repoPromise = createRepo();

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
  const repo = await repoPromise;
  installRepoBridge(repo);
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

  /* Same seam for the Matrix and People: the legacy render bails out when the
     flag is on, and this owns the host instead. */
  if (v5config.v5.matrix) {
    const host = document.getElementById('s-match');
    if (host) {
      const { mountMatrix } = await import('./v5/matrix');
      mountMatrix(host);
    }
  }
  if (v5config.v5.people) {
    const host = document.getElementById('s-people');
    if (host) {
      const { mountPeople } = await import('./v5/people');
      mountPeople(host);
    }
  }
  if (v5config.v5.arena) {
    const host = document.getElementById('s-arena');
    if (host) {
      const { mountArena } = await import('./v5/arena');
      mountArena(host);
    }
  }

  /* The "You" tab is the last legacy screen; the v5 profile-as-a-wall owns it
     now, mounted into #s-you through the same seam as the others. */
  if (v5config.v5.profile) {
    const host = document.getElementById('s-you');
    if (host) {
      const { mountProfile } = await import('./v5/profile');
      mountProfile(host, { embedded: true });
    }
  }
};

void boot();
