/**
 * The v5 seam.
 *
 * v5 is the app: every screen here is on by default, and each is a *lazy*
 * entry point so the screen chunks still load after first paint rather than
 * blocking it (brief §10: initial JS stays ≤ 180 KB gz — the v5 shell measures
 * ~125 KB gz, inside budget).
 *
 * The legacy module still provides the shell — nav rail, onboarding, the duel
 * route, settings — and bails out of each screen host when its flag is on, so
 * this module owns `#s-feed`, `#s-match`, `#s-people`, `#s-arena` and `#s-you`.
 * `?v5=0` is the kill-switch that hands all five back to the legacy renders.
 */

import { v5config } from '../store/config.ts';
import { servableMemes } from '../content/index.ts';
/* Static import inside a module that is only ever reached through a dynamic
   import: the stylesheet lands in the v5 chunk, never in the first paint. */
import './styles.css';

/** Reads the live config, so a test that flips `window.CULTURED_CONFIG` is seen. */
export const v5Flags = () => v5config.v5;

export const isV5Home = (): boolean => v5config.v5.home;
export const isV5Vault = (): boolean => v5config.v5.vault;
export const isV5Intro = (): boolean => v5config.v5.intro;
export const isV5Profile = (): boolean => v5config.v5.profile;
export const isV5Stories = (): boolean => v5config.v5.stories;
export const isV5Matrix = (): boolean => v5config.v5.matrix;
export const isV5People = (): boolean => v5config.v5.people;
export const isV5Arena = (): boolean => v5config.v5.arena;

/** Opens Stories as its own layer. */
export const mountV5Stories = async (options: { onClose?: () => void } = {}): Promise<void> => {
  const { mountStories } = await import('./stories.ts');

  const layer = document.createElement('div');
  layer.id = 'v5-stories-layer';
  document.body.appendChild(layer);

  let handle: { destroy(): void } | null = null;
  handle = mountStories(layer, {
    ...options,
    onClose: () => {
      handle?.destroy();
      handle = null;
      layer.remove();
      options.onClose?.();
    },
  });
};

/** Opens the Match Matrix as its own layer. */
export const mountV5Matrix = async (options: { onClose?: () => void } = {}): Promise<void> => {
  const { mountMatrix } = await import('./matrix.ts');

  const layer = document.createElement('div');
  layer.id = 'v5-matrix-layer';
  document.body.appendChild(layer);

  let handle: { destroy(): void } | null = null;
  handle = mountMatrix(layer, {
    ...options,
    onClose: () => {
      handle?.destroy();
      handle = null;
      layer.remove();
      options.onClose?.();
    },
  });
};

/** Opens the profile-as-a-wall as its own layer. */
export const mountV5Profile = async (options: { onClose?: () => void } = {}): Promise<void> => {
  const { mountProfile } = await import('./profile.ts');

  const layer = document.createElement('div');
  layer.id = 'v5-profile-layer';
  document.body.appendChild(layer);

  let handle: { destroy(): void } | null = null;
  handle = mountProfile(layer, {
    ...options,
    onClose: () => {
      handle?.destroy();
      handle = null;
      layer.remove();
      options.onClose?.();
    },
  });
};

export interface V5HomeHandle {
  destroy(): void;
}

/**
 * Opens NHIE as its own layer. Friend mode passes a `seed` so both players are
 * dealt the same twelve cards.
 */
export const mountV5Nhie = async (options: { seed?: number; onClose?: () => void } = {}): Promise<void> => {
  const { mountNhie } = await import('./nhie-screen.ts');

  const layer = document.createElement('div');
  layer.id = 'v5-nhie-layer';
  document.body.appendChild(layer);

  let handle: { destroy(): void } | null = null;
  handle = mountNhie(layer, {
    ...options,
    onClose: () => {
      handle?.destroy();
      handle = null;
      layer.remove();
      options.onClose?.();
    },
  });
};

/**
 * Mounts the v5 Home into `host` (normally `#s-feed`) and owns it for the
 * lifetime of the page. Returns a handle so tests can tear it down.
 */
export const mountV5Home = async (host: HTMLElement): Promise<V5HomeHandle> => {
  const [{ renderHome }, { mountVault }] = await Promise.all([
    import('./home.ts'),
    import('./vault.ts'),
  ]);

  let vault: { destroy(): void } | null = null;

  const openVault = () => {
    if (vault) return;
    const layer = document.createElement('div');
    layer.id = 'v5-vault-layer';
    document.body.appendChild(layer);
    vault = mountVault(layer, {
      onClose: () => {
        vault?.destroy();
        vault = null;
        layer.remove();
      },
    });
  };

  const home = renderHome(host, {
    onOpenVault: openVault,
    onOpenGame: (game: string) => {
      if (game === 'nhie') {
        void mountV5Nhie();
        return;
      }
      if (game === 'vault') {
        openVault();
        return;
      }
      if (game === 'profile') {
        void mountV5Profile();
        return;
      }
      if (game === 'stories') {
        void mountV5Stories();
        return;
      }
      if (game === 'matrix') {
        void mountV5Matrix();
        return;
      }
      // Duels are still the legacy screen in Phase 2.
      document.querySelector<HTMLElement>('[data-act="open-duel"]')?.click();
    },
  });

  return {
    destroy() {
      vault?.destroy();
      vault = null;
      document.getElementById('v5-vault-layer')?.remove();
      home.destroy();
    },
  };
};

/**
 * Plays the 5.5 s cold open once per install, then calls `onDone`.
 * Reduced motion skips straight to the CTA (brief §5.1).
 */
export const mountV5Intro = async (onDone: () => void): Promise<void> => {
  const { mountIntro, INTRO_DURATION } = await import('./intro.ts');

  /* The deck and stories read `servableMemes(true)`; the intro used to call it
     with no argument, which returns [] (all memes are unlicensed), and the cold
     open then rendered with zero cards. Match the rest of the app: licensing is
     enforced at the build gate, and a build that exists was allowed to ship. */
  const memes = servableMemes(true).slice(0, 5).map((meme) => ({ src: meme.src, alt: meme.alt }));
  const host = document.createElement('div');
  document.body.appendChild(host);

  let settled = false;
  let handle: { destroy(): void } | null = null;
  const finish = () => {
    if (settled) return;
    settled = true;
    handle?.destroy();
    host.remove();
    onDone();
  };

  handle = mountIntro({ host, memes, onDone: finish });

  // Belt and braces: the intro owns its own clock, but a stalled frame loop
  // must never trap the user behind the splash.
  setTimeout(finish, (INTRO_DURATION + 1.5) * 1000);
};

/** True when the cold open has already been played on this device. */
const INTRO_SEEN_KEY = 'cultured@v5:intro-seen';

export const introSeen = (): boolean => {
  try {
    return localStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return true;
  }
};

export const markIntroSeen = (): void => {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    /* Private mode: play it again next time. Harmless. */
  }
};
