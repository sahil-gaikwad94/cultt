/**
 * Legal copy.
 *
 * Every document ships flagged `needs_lawyer_review`. That is deliberate and
 * must stay that way until counsel signs off — both stores and the DMCA Safe
 * Harbor position depend on reviewed text, and an unreviewed policy presented
 * as final is worse than an obviously draft one.
 *
 * Plain-language structure, no dark patterns, no "by continuing you agree to
 * everything" clauses.
 */

import type { LegalDoc, LegalDocument } from '../lib/types';

const NEEDS_REVIEW = 'needs_lawyer_review' as const;
const UPDATED = '2026-10-06';

const privacy: LegalDoc = {
  title: 'Privacy policy',
  status: NEEDS_REVIEW,
  updatedAt: UPDATED,
  body: `What we collect

Your account needs an email address or a sign-in provider, a display name, your date of birth, and the taste signals you give us: meme reactions, saved culture, the artists and genres you pick, and the humour style you calibrate. If you turn on location, we store it fuzzed to roughly a one-kilometre cell, not as a precise point. If you add photos they stay on your profile until you remove them.

What we never collect

We do not sell your data. We do not buy lists. We do not run advertising pixels. We do not read your private messages except to enforce the community guidelines and to answer a safety report you filed.

Vectors, not a personality file

Taste is stored as two numeric vectors so matches can be ranked. Those vectors are not readable by other users and are not exposed through the API. Your raw event history is insert-only from your own device and never readable.

Your rights

Export your data at any time from Settings and we will send you a JSON bundle. Delete your account from Settings: it starts a 14-day cooling-off period you can cancel by signing back in, and then purges your rows, your photos, your audio and your push tokens. Location, if enabled, is deleted with everything else.

Retention

Events older than 90 days can be archived once we are past launch scale — the vectors already hold the signal. Messages are kept while a match exists and for a defined window after, then deleted.

Changes

We will post material changes here and in the app before they take effect.`,
};

const terms: LegalDoc = {
  title: 'Terms of use',
  status: NEEDS_REVIEW,
  updatedAt: UPDATED,
  body: `Who can use cultured

You must be 18 or older. We check your date of birth on the server, and an under-18 signup is blocked rather than warned. If you think this is wrong, contact support and we will review it.

What you agree to

You keep ownership of what you post. You give cultured permission to show it to other people on the app. You agree not to harass anyone, not to impersonate anyone, not to send sexual content to someone who has not asked for it, and not to use the app to scam anyone.

Matching is not a guarantee

The Taste Twins score is a similarity read on taste signals, not a prediction about chemistry and not a judgement about anyone's worth. We rank for humour and music first on purpose. We do not sell rankings.

Paid extras

The core loop is free: the Culture Feed, the Match Matrix, unlimited messages, the Daily Drop, listening sessions and Taste Cards. We sell optional extras — unlimited Resonates, rewind, a Playlist Pass that removes the 15-minute session cap, and licensed meme packs. Nothing you must have to talk to someone is behind a paywall.

Ending it

You can delete your account in-app at any time. We can suspend an account that breaks these terms, and we will tell you why. Reporting someone is always private to you.`,
};

const guidelines: LegalDoc = {
  title: 'Community guidelines',
  status: NEEDS_REVIEW,
  updatedAt: UPDATED,
  body: `The room is small. Keep it kind.

Be a person

One account, your own photos, your own words. No bots, no catfishing, no pretending to be someone else. If your account is for a couple or a group, say so in your bio.

No sexual pressure

Flirting is fine. Sending unsolicited sexual content, pressuring someone to send photos, or showing up somewhere uninvited is not. "No" ends the conversation.

Respect the quiet

This app has no guilt notifications on purpose. We will not tell you how many people are waiting for you. If you turn on the Daily Drop, it is a ritual, not a chore.

Three different tools

Report is for abuse. It goes to a human team and we aim to answer within 24 hours. Vibe-report is for "this wasn't a match" — it quietly recalibrates what we show you and the other person is not told and not punished. Block is a hard removal from both decks. Use the right one; they do very different things.

Photos

Your photos are yours. Do not photograph another person without their permission. Do not post anyone's private messages or identifying details without their consent — that is the fastest way to get removed.

In-app only

The humour signals we build come from what you react to inside cultured. We do not read your other accounts and we do not buy engagement data.`,
};

export const LEGAL_DOCUMENTS: Readonly<Record<LegalDocument, LegalDoc>> = Object.freeze({
  privacy,
  terms,
  guidelines,
});

/** Every page is draft until counsel replaces these. */
export const LEGAL_REVIEW_REQUIRED = true;