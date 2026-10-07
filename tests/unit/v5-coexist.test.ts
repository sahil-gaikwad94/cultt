/**
 * All five v5 tabs mounted at once.
 *
 * Each screen is unit-tested in isolation, which is exactly why this file
 * exists: mounting them together is what the app actually does when `?v5=1`,
 * and the individual tests would all pass while the combination broke. The
 * specific risk is shared DOM — every screen clears its host with
 * `textContent = ''`, and Home also appends an fx canvas to `document.body`. A
 * screen that reached for the wrong host, or one whose teardown removed another
 * screen's nodes, would only show up here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountV5Home } from '../../src/v5/mount';
import { mountMatrix } from '../../src/v5/matrix';
import { mountPeople } from '../../src/v5/people';
import { mountArena } from '../../src/v5/arena';
import { mountProfile } from '../../src/v5/profile';
import { createStore, setStoreForTests } from '../../src/store';
import { v5config } from '../../src/store/config';

const T0 = Date.parse('2026-10-07T12:00:00.000Z');

const HOSTS = ['s-feed', 's-match', 's-people', 's-arena', 's-you'] as const;

let handles: { destroy(): void }[] = [];
let hosts: HTMLElement[] = [];

const buildShell = () => {
  HOSTS.forEach((id) => {
    const node = document.createElement('section');
    node.id = id;
    // Pre-existing legacy content, to prove a screen clears only its own host.
    node.textContent = `legacy-${id}`;
    document.body.appendChild(node);
    hosts.push(node);
  });
};

describe('all five v5 screens coexist', () => {
  beforeEach(() => {
    localStorage.clear();
    handles = [];
    hosts = [];
    buildShell();
    const store = createStore({ storage: null, legacy: null, now: () => T0 });
    setStoreForTests(store);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });

  afterEach(() => {
    handles.forEach((h) => h.destroy());
    handles = [];
    hosts.forEach((h) => h.remove());
    hosts = [];
    vi.unstubAllGlobals();
  });

  it('mounts each screen into its own host without clobbering the others', async () => {
    const byId = (id: string) => hosts.find((h) => h.id === id)!;

    handles.push(await mountV5Home(byId('s-feed')));
    handles.push(mountMatrix(byId('s-match')));
    handles.push(mountPeople(byId('s-people')));
    handles.push(mountArena(byId('s-arena')));
    handles.push(mountProfile(byId('s-you')));
    await Promise.resolve();
    await Promise.resolve();

    // Every screen rendered into the host it was given.
    //
    // Home is the odd one out: `renderHome` does `host.classList.add('v5-home')`
    // and renders directly into the host, whereas the other four append a child
    // root element. So Home is asserted on the host's own class list and the
    // rest by descendant — querying `.v5-home` cannot match the host itself.
    expect(byId('s-feed').classList.contains('v5-home')).toBe(true);
    expect(byId('s-match').querySelector('.v5-matrix')).not.toBeNull();
    expect(byId('s-people').querySelector('.v5-people')).not.toBeNull();
    expect(byId('s-arena').querySelector('.v5-arena')).not.toBeNull();
    expect(byId('s-you').querySelector('.v5-profile')).not.toBeNull();

    // And no screen leaked its root into another host.
    expect(byId('s-feed').querySelectorAll('.v5-matrix')).toHaveLength(0);
    expect(byId('s-match').classList.contains('v5-home')).toBe(false);
    expect(byId('s-arena').querySelectorAll('.v5-people')).toHaveLength(0);
  });

  it('clears the legacy content only in the host it owns', async () => {
    handles.push(await mountV5Home(hosts.find((h) => h.id === 's-feed')!));
    handles.push(mountArena(hosts.find((h) => h.id === 's-arena')!));
    await Promise.resolve();

    expect(hosts.find((h) => h.id === 's-feed')!.textContent).not.toContain('legacy-s-feed');
    expect(hosts.find((h) => h.id === 's-arena')!.textContent).not.toContain('legacy-s-arena');
    // Untouched hosts keep their legacy render.
    expect(hosts.find((h) => h.id === 's-you')!.textContent).toBe('legacy-s-you');
  });

  it('keeps exactly one fx canvas for the whole app, not one per screen', async () => {
    handles.push(await mountV5Home(hosts.find((h) => h.id === 's-feed')!));
    handles.push(mountMatrix(hosts.find((h) => h.id === 's-match')!));
    handles.push(mountArena(hosts.find((h) => h.id === 's-arena')!));
    await Promise.resolve();

    expect(document.querySelectorAll('.v5-fx-layer')).toHaveLength(1);
  });

  it('tearing one screen down leaves the other four intact', async () => {
    const byId = (id: string) => hosts.find((h) => h.id === id)!;
    handles.push(await mountV5Home(byId('s-feed')));
    const matrix = mountMatrix(byId('s-match'));
    handles.push(matrix);
    handles.push(mountPeople(byId('s-people')));
    handles.push(mountArena(byId('s-arena')));
    await Promise.resolve();

    matrix.destroy();
    handles = handles.filter((h) => h !== matrix);

    expect(byId('s-match').querySelector('.v5-matrix')).toBeNull();
    expect(byId('s-feed').classList.contains('v5-home')).toBe(true);
    expect(byId('s-people').querySelector('.v5-people')).not.toBeNull();
    expect(byId('s-arena').querySelector('.v5-arena')).not.toBeNull();
  });

  it('reads the same config every screen gates on', () => {
    // All five resolve from one object; if a screen grew its own flag source it
    // would drift from the shell.
    const keys = Object.keys(v5config.v5);
    for (const screen of ['home', 'matrix', 'people', 'arena']) {
      expect(keys).toContain(screen);
    }
  });
});
