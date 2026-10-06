# cultured — v5 copy deck

Source of truth for UI text. Convert into a typed `copy.ts` (keys by screen), never hard-code strings in components.

## Voice rules

- Short, dry, self-aware. Complete sentences that end in a period. The joke lives in the second sentence.
- Talk like a friend with great taste who is slightly too online. Never like a startup.
- No "journey", "unlock", "level up", "find love", "swipe right". No exclamation marks except inside reactions.
- Say the real thing: if something is unavailable, say it is unavailable. No fake numbers, no fake users.
- Never use developer words in UI: "vector", "adapter", "seed", "signal confidence", "beat one/two/three". Say **Fingerprint clarity** instead of signal confidence.
- Meme and song titles come from content, not from us. Our job is the placard line under them.

## Intro (kinetic type, in order)

1. Match on your humor.
2. ~~Not your headshot.~~ → "headshot" pixelates and disappears.
3. cultured.
CTA: **Find my fingerprint** · secondary: I already have one.

## Onboarding

| Step | Headline | Sub | CTA |
|---|---|---|---|
| Age gate | Grown-ups only. | cultured is 18+. Your birthday is checked on the server and never shown on your profile. | Looks right |
| Under 18 | Come back at 18. | The memes will still be here. They're not going anywhere. They're memes. | — |
| Humor gauntlet | What kind of funny are you? | Swipe right if it's you. Left if it's not. Nothing here is shared. | (swipe) |
| Gauntlet milestone 4 | Okay, I see you. | Your fingerprint just got its first ring. | |
| Gauntlet milestone 8 | That's a pattern. | Whoever you are, you're not boring. | |
| Gauntlet done | Twelve for twelve. | One more room to check: your ears. | Let's hear it |
| Genre bubbles | Pour your taste in. | Tap what you love until it swells. Up to six. | Sounds like me |
| Sound check | Three songs. Honest reactions only. | Thirty seconds each. Your face stays private. | |
| Signature laugh | Pick your signature laugh. | One tap on anything you love sends this. Matches see it on your profile. | This one |
| Name tag | What do people call you? | A name, not a username. Sixteen characters, no pressure. | Done |
| Photo (optional) | Face optional. | Add one if you want. It stays under your control. | Add / Skip for now |
| Reveal | Your Fingerprint. | Built from 12 memes, 3 songs and 1 questionable reaction. | Keep it |
| Save it | Keep your fingerprint. | Sign in so it's still yours tomorrow. | Email me a magic link · Apple · Google |
| Notifications | Daily drop at 9:00. | One song. One meme. Zero small talk. | Remind me · Not now |
| Location | Roughly where you are. | City-level only. It tunes who shows up near you. | Allow · Later |
| First-run tip 1 | Hold to react. | Long-press anything to pick a reaction. | Got it |
| First-run tip 2 | Swipe to decide. | Right is a laugh. Left is a pass. Up is a save. | Got it |

## Navigation

Home · Arena · Matrix · People · You

## Home

- Sub-page tabs: **Receipts** · **Today** · **The Draft** (defaults). Alternates: **The Verdict** · **Forecast**.
- Header kicker: Today's drop, curated for you.
- Deck title: The Deck. Sub: Fifteen laughs a day. Spend them well.
- Laugh budget label: **Laughs left** (11/15).
- Deck empty (seen everything): You've seen it all. Impressive and slightly worrying. | Fresh drops arrive at 9:00.
- Circles empty: Nobody's online yet. Duel a friend and make some noise. | Start a duel
- Ritual ring: Today's ritual · laugh 3 · save 1 · react once.

### Laugh limit hit

- Title: Laugh budget spent.
- Body: You've laughed 15 times today. Your cheeks have filed a complaint.
- Sub: Saving, passing and sharing are still free. 15 fresh laughs at midnight.
- Button: Back to browsing · Secondary: See what I saved

### Placards (under every meme and song)

Format: `Exhibit №{n} · {category} · Mood: {mood}` then one *impact line*, chosen at random:

- On view since forever. Cultural impact: unforgivable.
- Acquired without permission. Displayed with pride.
- Please do not touch. Please do react.
- Medium: pixels and regret.
- Curator's note: yes, this is the one.
- Estimated value: priceless. Estimated sense: none.
- Last seen causing a group chat to go quiet.
- Restored from a screenshot of a screenshot.
- Provenance: someone's cousin's phone.
- Condition: emotionally damaged, structurally sound.

## Reactions

Memes tray: 💀 Dead · 😭 Can't breathe · 🗿 Deadpan · 🤡 Self-own · 🧠 Galaxy brain · 🫠 Existential · 🥹 Soft · 🔥 Slaps
Songs tray: 🔥 Slaps · 🎧 On repeat · 🥹 Soft · 😭 Wrecked me · 🤌 Chef's kiss · 🫠 Too real · 🕺 Moves · 💀 Dead

Long-press hint: Hold for more feelings.
Reacted toast: *Dead.* (use the reaction's name as the toast, no extra words)
Combo text (fast repeat taps): x2 · x3 · **x5 UNWELL**

## Saves and the Vault

- Saved toast: Kept. (action: Undo)
- Un-saved toast: Let go. (action: Undo)
- Vault title: Your Vault. Private. Judged by no one.
- Vault tabs: Saved · Laughed · Pinned
- Vault empty: Nothing here yet. Tap the bookmark on anything that gets you.
- Pin sheet title: Pick what matches see first.
- Pin limit: That's six. Unpin one to make room.
- Pin board header: Pin board · what they see first.
- Shelf header: On the shelf · songs you'd defend.

## Matrix

- Card kicker: {distance} · Dating / Friends
- Compat label: **Taste twin** (90+) · **Strong overlap** (75–89) · **Plot twist potential** (55–74) · **Opposites, loudly** (<55)
- Primary button: Resonate · Pass button label (a11y): Pass
- Resonate on a pin: Resonate on this
- Undo: Take it back
- Mutual moment: **You resonate.** | Two fingerprints, one punchline. | Send a meme · Spin an opener
- Out of resonates: Resonates spent for today. | New ones at midnight. Your taste isn't going anywhere.
- Empty queue: You've met everyone nearby. Widen the net or come back after the next drop.
- Filters title: Tune the room

## People (chats + stories)

- Tab title: People · sub-tabs: Chats · Stories
- Empty chats: No threads yet. Resonate with someone, then ask them about a song. | Go to Matrix
- Input placeholder: Say something. Or send a meme.
- Quick row: Meme · Song · Opener
- System chip (match): You two resonated. No pressure. Some pressure.
- Typing: …composing a masterpiece
- Opener lines come from Roulette templates, never from the app pretending to be the user.

## Stories

- Rail label: Stories · gone in 12 hours
- Add button: Add to story
- Editor tools: Frame · Backdrop · Stickers · Text · Draw · Filter · Audience
- Stickers: Music · Mood · W or L · Blessed or Cursed · Add yours · Countdown
- Audience: Everyone · Matches · Inner circle · Hide from…
- Reply setting: Anyone can react · Matches can reply · Replies off
- Posted toast: Live for 12 hours.
- Expiry line: Gone. Like it never happened.
- Add yours prompts: Your most replayed shame song · A meme that explains your Monday · The song you'd defend in court · What your 3 AM brain plays
- Viewers sheet title: Who saw it

## Sharing

- Sheet title: Send it somewhere.
- Targets: Story · Messages · Copy link · Save image · Match
- Meme card footer: seen on cultured
- Duel result title: Damage Report
- Link landing CTA: Find your own fingerprint. Thirty seconds, no photo.

## Arena

- Header: What the room is feeling now.
- Meme Duel tile: Same meme, different damage.
- NHIE tile: Confess, but funnier.
- Roulette tile: An opener, not "hey".
- City meter tile: {city} unlocks at 100 people. {n}/100.
- Roulette practice banner: Practice spin. Nobody's notified.
- NHIE buttons: Guilty · Clean
- NHIE stamps: GUILTY (ink slam) · CLEAN (halo)
- NHIE rank titles by guilty count out of 12: 0–1 Suspiciously clean · 2–4 Mostly innocent · 5–7 A healthy amount of damage · 8–10 Repeat offender · 11–12 Public menace
- Friend mode reveal: You're both guilty of:

## Loading, errors, offline

- Loading lines (rotate): Warming up the memes. · Untangling your fingerprint. · Asking the algorithm nicely. · Polishing the exhibits.
- Offline: No signal. The memes are in a meeting.
- Generic error: That broke. Not you. Try again.
- Preview unavailable: No preview for this one. Open it in Apple Music or Deezer.

## Meme categories (display name → intent)

1. Corporate Hostage Situation → work
2. Dev Tears → programming / tech
3. Brain Rot Reserve → absurdist
4. Wholesome Hazmat → wholesome
5. Situationship Studies → dating
6. 3 AM Philosophy → existential
7. Group Chat Crimes → social
8. Campus Survival → college life
9. Pet Court → animals
10. Gym Delusion → fitness
11. Kitchen Crimes → food
12. Cursed Images → cursed
13. Old Internet Museum → nostalgia
14. Niche Reference Club → deep cuts
15. Main Character Moments → relatable wins

## Genres (slug → display)

pop Main Character Pop · indie Rainy Window Indie · hiphop Bars & Brags · rnb Slow Burn · rock Air Guitar Hazard · metal Mosh Pit Therapy · punk Three Chords, Zero Chill · emo Eyeliner Era · electronic Dancefloor Diplomacy · dnb Heartbeat at 174 · lofi Study Cat Radio · ambient Staring at the Ceiling · jazz Coffee Shop Intellectual · classical Dramatic Entrance · country Porch Confessions · folk Campfire Feelings · latin Dembow Distractions · kpop Choreo Brain · citypop Neon Drive 1984 · bollywood Filmi Feelings · afrobeats Late Night Lagos · reggae Island Time · hyperpop Glitchcore Gremlin · synthwave Retro Night Drive · sadcore Cry in the Shower · workout Gym Delusion · showtunes Theatre Kid Residue · ost Side Quest Soundtrack · phonk Drift Brain · soul Heart on Vinyl · disco Mirror Ball Mandatory

## Humor archetypes (top two axes → name)

D deadpan · A absurdist · W dry wit · C chaotic · H wholesome · N niche refs

- DA 3 AM Philosopher — Existential dread, but make it funny.
- DW Sarcasm Sommelier — Notes of irony, long finish.
- DC Feral Straight Man — Flat voice. Unhinged content.
- DH The Soft Deadpan — Soft heart, flat delivery.
- DN Niche Archivist — Knows the reference. Knows you don't.
- AW Surreal Sniper — Absurd, but precise.
- AC Chaos Goblin — Treats the group chat like a trampoline.
- AH Absurdist Jester — Logic left. Joy stayed.
- AN Lore Goblin — Deep-cut nonsense, lovingly curated.
- WC Group Chat Gremlin — Fastest reply. Worst timing. Best line.
- WH Pun Raider — Will pun. Cannot be stopped.
- WN Dry-Wit Detective — Noticed the joke before it was a joke.
- CH Wholesome Menace — Sweetest in the room. Plotting something.
- CN Cringe Connoisseur — Collects the awkward like fine wine.
- HN Cozy Archivist — Wholesome deep cuts.

Rarity line: only shown once the real distribution has ≥ 200 users. Before that: **Among the first {n} to get this one.** Never invent a percentage.

## Weekly Wrapped ("Cultured Weekly", Sundays) — slide titles

1. Your week in laughs.
2. {n} laughs. {m} saves. 1 questionable reaction.
3. Peak chaos: {time}.
4. Your most-used reaction: {emoji} {name}.
5. On repeat: {song}.
6. You laughed hardest at: {category}.
7. Your archetype this week: {name}.
Share caption default: my week, in memes.

## Forecast weather cards (if the Forecast sub-page is chosen)

☀️ Sunny with a chance of delulu · ☁️ Overcast but make it aesthetic · ⛈️ Thunderstorm of group chats · 🌫️ Fog of 3 AM thoughts · 🌈 Suspiciously optimistic · 🥶 Do not disturb, I'm recharging

## Push notifications

- Daily drop: Today's drop is live. One song. One meme. Zero small talk.
- Draft result: You called it. Tomorrow's drop was your pick. (or) Not your pick. Still good though.
- Resonance: Someone resonated with your {pin title}.
- Mutual: You resonate with {name}. Say something. Or send a meme.
- Duel reveal: Your duel with {name} is in. Brace.
- Story reaction: {name} reacted {emoji} to your story.
- Streak at risk: Your laugh streak ends tonight. One meme saves it.
- Weekly: Your week is ready. It's a lot.

## Credits line (About screen)

Animated emoji: Noto Emoji Animation by Google, CC BY 4.0.
