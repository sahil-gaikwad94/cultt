export type Mode = "dating" | "friends";

export type HumorStyle = "affiliative" | "selfEnhancing" | "aggressive" | "selfDefeating";

export interface HumorVector {
  affiliative: number;
  selfEnhancing: number;
  aggressive: number;
  selfDefeating: number;
}

export interface Artist {
  name: string;
  tag: string;
  gradient: string;
}

export interface Playlist {
  id: string;
  title: string;
  trackCount: number;
  pinned: boolean;
}

export interface PromptAnswer {
  id: string;
  prompt: string;
  answer: string;
}

export interface Candidate {
  id: string;
  name: string;
  age: number;
  distanceKm: number;
  city: string;
  tasteScore: number;
  sharedArtist: string;
  sharedMemeCategory: string;
  photoGradient: string;
  verified: boolean;
  lookingFor: Mode;
  blurb: string;
  humor: HumorVector;
  humorSummary: string;
  topArtists: Artist[];
  playlists: Playlist[];
  recentMemes: { id: string; gradient: string; caption: string }[];
  prompts: PromptAnswer[];
  /** mutual resonance → triggers the celebration */
  mutual: boolean;
}

export type FeedType = "meme" | "track" | "drop" | "discovery";

export interface FeedPost {
  id: string;
  type: FeedType;
  author: string;
  authorGradient: string;
  location: string;
  timeAgo: string;
  caption: string;
  /** meme top/bottom render text — placeholders, not real images */
  memeTop?: string;
  memeBottom?: string;
  likeCount: number;
  laughCount: number;
  commentCount: number;
  gradient: string;
  humorTag?: string;
  /** track cards */
  trackTitle?: string;
  trackArtist?: string;
  nearbyCount?: number;
}

export interface Fingerprint {
  humor: HumorVector;
  summary: string;
  topArtists: Artist[];
  genres: string[];
  playlists: Playlist[];
  recentMemes: { id: string; gradient: string; caption: string }[];
  prompts: PromptAnswer[];
}

export interface Message {
  id: string;
  senderId: "me" | string;
  text?: string;
  /** auto-attached shared meme/track that triggered the match */
  attachment?: { kind: "meme" | "track"; title: string; sub: string; gradient: string };
  time: string;
  reactions?: string[];
}

export interface Match {
  id: string;
  candidateId: string;
  name: string;
  age: number;
  gradient: string;
  tasteScore: number;
  city: string;
  mode: Mode;
  matchedOn?: { kind: "meme" | "track"; title: string; sub: string; gradient: string };
  messages: Message[];
  unread: number;
  lastActive: string;
}

export interface NotificationItem {
  id: string;
  section: "matches" | "feed" | "fingerprint";
  title: string;
  body: string;
  time: string;
  gradient?: string;
  unread?: boolean;
}
