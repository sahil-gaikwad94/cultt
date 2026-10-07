/**
 * Regression tests for build-brief bug §4.1.2: "the Meme Duel modal opening
 * over Home after onboarding, and the 'Welcome to cultured' toast overlapping
 * buttons."
 *
 * Two separate failures, both pinned here:
 *  1. There was no owner for floating layers, so two blocking layers could
 *     mount at once (`#duel-page` z:75 over `#onboard` z:50; a sheet at z:30
 *     under a modal at z:20).
 *  2. The toast sat at `bottom:100px` with `z-index:70`, i.e. directly on the
 *     primary button of any sheet that had just opened.
 */

import { describe, expect, it } from 'vitest';
import { createOverlayManager, PRIORITY, Z } from '../../src/lib/overlay';

const el = (id: string): HTMLElement => {
  const node = document.createElement('div');
  node.id = id;
  return node;
};

describe('z-scale: one place, agreed by CSS and JS', () => {
  it('sheets sit above pages/modals never the other way round', () => {
    expect(Z.sheet).toBeGreaterThan(Z.coachmark);
    expect(Z.modal).toBeGreaterThan(Z.sheet);
    expect(Z['reaction-tray']).toBeGreaterThan(Z.modal);
  });

  it('every overlay kind has a rung', () => {
    for (const kind of Object.keys(PRIORITY) as (keyof typeof PRIORITY)[]) {
      expect(Z[kind]).toBeGreaterThan(0);
    }
  });
});

describe('overlay manager', () => {
  it('mounts a sheet and applies its z rung', () => {
    const manager = createOverlayManager({ document });
    const node = el('sheet-1');
    manager.open({ id: 'sheet-1', kind: 'sheet', el: node });
    expect(node.style.zIndex).toBe(String(Z.sheet));
    expect(node.dataset.overlayKind).toBe('sheet');
    expect(node.isConnected).toBe(true);
    expect(manager.state().top?.id).toBe('sheet-1');
  });

  it('does not stack two blocking layers — a lower-priority one is queued', () => {
    const manager = createOverlayManager({ document });
    const modal = el('modal');
    const sheet = el('sheet');
    manager.open({ id: 'modal', kind: 'modal', el: modal });
    manager.open({ id: 'sheet', kind: 'sheet', el: sheet });

    expect(manager.state().stack.map((l) => l.id)).toEqual(['modal']);
    expect(manager.state().queued.map((l) => l.id)).toEqual(['sheet']);
    expect(sheet.isConnected).toBe(false);
  });

  it('promotes the queued layer when the incumbent closes', () => {
    const manager = createOverlayManager({ document });
    const modal = el('modal');
    const sheet = el('sheet');
    manager.open({ id: 'modal', kind: 'modal', el: modal });
    manager.open({ id: 'sheet', kind: 'sheet', el: sheet });
    manager.close('modal');

    expect(manager.state().stack.map((l) => l.id)).toEqual(['sheet']);
    expect(sheet.isConnected).toBe(true);
    expect(modal.hidden).toBe(true);
  });

  it('a higher-priority layer takes the screen and re-queues the incumbent', () => {
    const manager = createOverlayManager({ document });
    const modal = el('modal');
    const tray = el('tray');
    manager.open({ id: 'modal', kind: 'modal', el: modal });
    manager.open({ id: 'tray', kind: 'reaction-tray', el: tray });

    expect(manager.state().top?.id).toBe('tray');
    expect(manager.state().queued.map((l) => l.id)).toEqual(['modal']);
    manager.close('tray');
    expect(manager.state().top?.id).toBe('modal');
  });

  it('toasts never block, and never take a blocking rung', () => {
    const manager = createOverlayManager({ document });
    const sheet = el('sheet');
    const toast = el('toast');
    manager.open({ id: 'sheet', kind: 'sheet', el: sheet });
    manager.open({ id: 'toast', kind: 'toast', el: toast });

    // Both are mounted: the toast confirms an action taken inside the sheet.
    expect(manager.state().stack.map((l) => l.id).sort()).toEqual(['sheet', 'toast']);
    expect(Number(toast.style.zIndex)).toBe(Z.toast);
    expect(Number(toast.style.zIndex)).toBeGreaterThan(Number(sheet.style.zIndex));
  });

  it('replaces a layer opened twice with the same id instead of double-mounting', () => {
    const manager = createOverlayManager({ document });
    manager.open({ id: 'sheet', kind: 'sheet', el: el('a') });
    manager.open({ id: 'sheet', kind: 'sheet', el: el('b') });
    expect(manager.state().stack).toHaveLength(1);
    expect(manager.state().top?.el.id).toBe('b');
  });

  it('closeAll clears the stack and the queue', () => {
    const manager = createOverlayManager({ document });
    manager.open({ id: 'sheet', kind: 'sheet', el: el('sheet') });
    manager.open({ id: 'modal', kind: 'modal', el: el('modal') });
    manager.closeAll();
    expect(manager.state().stack).toEqual([]);
    expect(manager.state().queued).toEqual([]);
  });

  it('notifies subscribers on every change', () => {
    const manager = createOverlayManager({ document });
    const seen: string[] = [];
    manager.subscribe((state) => seen.push(state.top?.id ?? 'none'));
    manager.open({ id: 'a', kind: 'sheet', el: el('a') });
    manager.close('a');
    expect(seen).toEqual(['a', 'none']);
  });
});
