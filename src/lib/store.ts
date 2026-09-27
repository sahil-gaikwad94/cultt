"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Candidate,
  Match,
  Message,
  Mode,
  NotificationItem,
  PromptAnswer,
} from "./types";
import { candidates, seedMatches, seedNotifications, myFingerprint, antiGenreDefaults } from "./mockData";

export type OnboardingStep =
  | "welcome"
  | "auth"
  | "verify"
  | "spotify"
  | "meme"
  | "music"
  | "photos"
  | "permissions";

const ONBOARDING_ORDER: OnboardingStep[] = [
  "welcome", "auth", "verify", "spotify", "meme", "music", "photos", "permissions",
];

interface Settings {
  ageMin: number;
  ageMax: number;
  maxDistanceKm: number;
  defaultMode: Mode;
  fingerprintVisibility: "matches_only" | "before_matching";
  reconnectSpotify: boolean;
  genreTags: string[];
  antiGenres: string[];
  incognito: boolean;
  readReceipts: boolean;
  notifMatches: boolean;
  notifMessages: boolean;
  notifFeed: boolean;
  notifDailyDrop: boolean;
  notifMarketing: boolean;
}

interface AppState {
  hydrated: boolean;
  onboardingDone: boolean;
  onboardingStep: OnboardingStep;
  mode: Mode;

  /* feed */
  feedCursor: number;
  likedPosts: string[];
  laughedPosts: string[];
  savedPosts: string[];

  /* matrix */
  passedIds: string[];
  resonatedIds: string[];
  rewindsLeft: number;
  resonatesLeft: number;
  likedIds: string[];

  /* matches & chat */
  matches: Match[];

  /* notifications */
  notifications: NotificationItem[];

  /* profile */
  profileName: string;
  profileAge: number;
  profileCity: string;
  profileBio: string;
  photoSlots: (string | null)[];
  lookingFor: Mode;

  /* calibration */
  likedMemes: string[];
  likedTracks: string[];
  spotifyConnected: boolean;
  permissions: { notifications: boolean | null; location: boolean | null };

  settings: Settings;

  /* actions */
  setHydrated: (v: boolean) => void;
  completeOnboarding: () => void;
  setOnboardingStep: (s: OnboardingStep) => void;
  setMode: (m: Mode) => void;
  bumpFeed: (n: number) => void;
  toggleReaction: (kind: "liked" | "laughed" | "saved", id: string) => void;
  passCandidate: (id: string) => void;
  likeCandidate: (id: string) => void;
  resonateCandidate: (id: string) => void;
  rewindLastPass: () => string | null;
  addMatch: (c: Candidate) => string;
  markMatchRead: (id: string) => void;
  sendMessage: (matchId: string, msg: Message) => void;
  dismissNotification: (id: string) => void;
  setProfile: (p: Partial<Pick<AppState, "profileName" | "profileAge" | "profileCity" | "profileBio" | "lookingFor">>) => void;
  setPhotoSlot: (i: number, v: string | null) => void;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  toggleArraySetting: (k: "genreTags" | "antiGenres", v: string) => void;
  resetFingerprint: () => void;
  setPermission: (k: "notifications" | "location", v: boolean) => void;
  setSpotify: (v: boolean) => void;
  calibrate: (kind: "meme" | "track", id: string) => void;
}

const defaultSettings: Settings = {
  ageMin: 22,
  ageMax: 34,
  maxDistanceKm: 15,
  defaultMode: "dating",
  fingerprintVisibility: "matches_only",
  reconnectSpotify: false,
  genreTags: [...myFingerprint.genres],
  antiGenres: [...antiGenreDefaults],
  incognito: false,
  readReceipts: false,
  notifMatches: true,
  notifMessages: true,
  notifFeed: false,
  notifDailyDrop: false,
  notifMarketing: false,
};

let matchCounter = 100;

/**
 * Guarded storage: drops writes that happen BEFORE rehydration completes.
 * Child effects (e.g. markMatchRead) run before RootEffects rehydrates —
 * without this guard they'd persist a default-state snapshot over the
 * user's real state (the clobber race).
 */
let storageReady = false;
const guardedStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    if (!storageReady) return;
    try {
      localStorage.setItem(name, value);
    } catch {
      /* quota/private mode */
    }
  },
  removeItem: (name: string) => {
    if (!storageReady) return;
    try {
      localStorage.removeItem(name);
    } catch {
      /* noop */
    }
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboardingDone: false,
      onboardingStep: "welcome",
      mode: "dating",

      feedCursor: 0,
      likedPosts: [],
      laughedPosts: [],
      savedPosts: [],

      passedIds: [],
      resonatedIds: [],
      likedIds: [],
      rewindsLeft: 3,
      resonatesLeft: 3,

      matches: seedMatches,
      notifications: seedNotifications,

      profileName: "Alex",
      profileAge: 26,
      profileCity: "Williamsburg, NY",
      profileBio: "Meme archivist with a vinyl problem. Fluent in three humor styles and four time zones.",
      photoSlots: ["linear-gradient(135deg, #7c5cff 0%, #a855f7 48%, #1e1b4b 100%)", "linear-gradient(160deg, #8ec5fc 0%, #6c63c7 55%, #2b1e66 100%)", "linear-gradient(135deg, #0ba360 0%, #3cba92 100%)", null, null, null],
      lookingFor: "dating",

      likedMemes: [],
      likedTracks: [],
      spotifyConnected: false,
      permissions: { notifications: null, location: null },

      settings: defaultSettings,

      setHydrated: (v) => set({ hydrated: v }),
      completeOnboarding: () => set({ onboardingDone: true, onboardingStep: "permissions" }),
      setOnboardingStep: (s) => set({ onboardingStep: s }),
      setMode: (m) => set({ mode: m }),
      bumpFeed: (n) => set({ feedCursor: n }),

      toggleReaction: (kind, id) =>
        set((s) => {
          const key = kind === "liked" ? "likedPosts" : kind === "laughed" ? "laughedPosts" : "savedPosts";
          const arr = s[key];
          return {
            [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id],
          } as Partial<AppState>;
        }),

      passCandidate: (id) =>
        set((s) => ({
          passedIds: s.passedIds.includes(id) ? s.passedIds : [...s.passedIds, id],
        })),

      likeCandidate: (id) =>
        set((s) => ({
          likedIds: s.likedIds.includes(id) ? s.likedIds : [...s.likedIds, id],
        })),

      resonateCandidate: (id) =>
        set((s) => ({
          resonatedIds: s.resonatedIds.includes(id) ? s.resonatedIds : [...s.resonatedIds, id],
          resonatesLeft: Math.max(0, s.resonatesLeft - 1),
        })),

      rewindLastPass: () => {
        const s = get();
        if (s.rewindsLeft <= 0 || s.passedIds.length === 0) return null;
        const last = s.passedIds[s.passedIds.length - 1];
        set({
          passedIds: s.passedIds.slice(0, -1),
          rewindsLeft: s.rewindsLeft - 1,
        });
        return last;
      },

      addMatch: (c) => {
        const id = `m${++matchCounter}`;
        const match: Match = {
          id,
          candidateId: c.id,
          name: c.name,
          age: c.age,
          gradient: c.photoGradient,
          tasteScore: c.tasteScore,
          city: c.city,
          mode: get().mode,
          matchedOn: {
            kind: "meme",
            title: c.recentMemes[0]?.caption ?? "a shared laugh",
            sub: "you both laughed at this",
            gradient: c.recentMemes[0]?.gradient ?? c.photoGradient,
          },
          unread: 0,
          lastActive: "now",
          messages: [
            {
              id: `${id}-sys`,
              senderId: "me",
              attachment: {
                kind: "meme",
                title: c.recentMemes[0]?.caption ?? "a shared laugh",
                sub: `matched at ${c.tasteScore}% taste twins`,
                gradient: c.recentMemes[0]?.gradient ?? c.photoGradient,
              },
              time: "now",
              reactions: [],
            },
          ],
        };
        set((s) => ({ matches: [match, ...s.matches] }));
        return id;
      },

      markMatchRead: (id) =>
        set((s) => ({
          matches: s.matches.map((m) => (m.id === id ? { ...m, unread: 0 } : m)),
        })),

      sendMessage: (matchId, msg) =>
        set((s) => ({
          matches: s.matches.map((m) =>
            m.id === matchId
              ? { ...m, lastActive: "now", messages: [...m.messages, msg] }
              : m
          ),
        })),

      dismissNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      setProfile: (p) => set(p),

      setPhotoSlot: (i, v) =>
        set((s) => {
          const slots = [...s.photoSlots];
          slots[i] = v;
          return { photoSlots: slots };
        }),

      setSetting: (k, v) => set((s) => ({ settings: { ...s.settings, [k]: v } })),

      toggleArraySetting: (k, v) =>
        set((s) => ({
          settings: {
            ...s.settings,
            [k]: s.settings[k].includes(v)
              ? s.settings[k].filter((x) => x !== v)
              : [...s.settings[k], v],
          },
        })),

      resetFingerprint: () =>
        set((s) => ({
          settings: { ...s.settings, genreTags: [] },
          likedMemes: [],
          likedTracks: [],
        })),

      setPermission: (k, v) =>
        set((s) => ({ permissions: { ...s.permissions, [k]: v } })),

      setSpotify: (v) => set({ spotifyConnected: v }),

      calibrate: (kind, id) =>
        set((s) =>
          kind === "meme"
            ? { likedMemes: s.likedMemes.includes(id) ? s.likedMemes : [...s.likedMemes, id] }
            : { likedTracks: s.likedTracks.includes(id) ? s.likedTracks : [...s.likedTracks, id] }
        ),
    }),
    {
      name: "cultured-store-v1",
      skipHydration: true,
      storage: createJSONStorage(() => guardedStorage),
      onRehydrateStorage: () => () => {
        storageReady = true;
      },
      partialize: (s) => {
        const {
          hydrated, ...rest
        } = s;
        void hydrated;
        return rest as AppState;
      },
    }
  )
);

export const onboardingOrder = ONBOARDING_ORDER;

/** Candidates still in the Matrix queue (never re-queues existing matches). */
export function queueFor(
  s: Pick<AppState, "passedIds" | "likedIds" | "resonatedIds" | "mode" | "matches">
): Candidate[] {
  const decided = new Set([...s.passedIds, ...s.likedIds, ...s.resonatedIds]);
  const matched = new Set(s.matches.map((m) => m.candidateId));
  return candidates.filter(
    (c) => !decided.has(c.id) && !matched.has(c.id) && c.lookingFor === s.mode
  );
}
