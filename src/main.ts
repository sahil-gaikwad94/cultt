import './styles/tokens.css';
import './styles/app.css';
import { createRepo } from './data';
import { installRepoBridge } from './components/phase1';

const repo = createRepo();
installRepoBridge(repo);

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
    const { bootDuelPage } = await import('./duel/page');
    void bootDuelPage(repo, duelMatch[1] as string);
    return;
  }
  await import('./legacy');
};

void boot();
