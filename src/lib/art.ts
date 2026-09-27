import { GRADIENTS } from "./mockData";

/** Vision scenes — cinematic culture imagery used as card backdrops. */
export const SCENES = [
  "/art/scene-concert.png",
  "/art/scene-rooftop.png",
  "/art/scene-mural.png",
  "/art/scene-market.png",
] as const;

/** Deterministic scene pick per entity id (stable across card ↔ expand). */
export function sceneFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SCENES[h % SCENES.length];
}

export function fallbackGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}
