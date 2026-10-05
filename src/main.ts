import './styles/tokens.css';
import './styles/app.css';
import { createRepo } from './data';
import { installRepoBridge } from './components/phase1';

const repo = createRepo();
installRepoBridge(repo);

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
  await import('./legacy');
};

void boot();
