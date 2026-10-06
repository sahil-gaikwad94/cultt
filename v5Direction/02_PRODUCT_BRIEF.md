# cultured v5 — product brief

What I watched: your 3-minute walkthrough of the current build (intro → onboarding → Home → Arena → Matrix → People → You) and the 12-second Telegram reaction clip. I have not seen your code, so the agent prompt tells the coding agent to read the repo first. Timestamps below are approximate (mm:ss in your recording).

## 1. The product, as I understand it

A dating app where your sense of humor and your replay history are the profile. You react to memes and songs, the app grows a **Fingerprint** (a contour-line shape plus six humor axes: deadpan, absurdist, dry wit, chaotic, wholesome, niche refs), and **Matrix** introduces you to people whose fingerprints overlap. Photos are optional and private. There are no comments; interaction is like, save, share, react, duel. Principle worth protecting: nothing needs moderating because most interaction is fixed-choice, and the app is honest about empty states instead of faking activity.

**Vision for v5, one line:** the first dating app that feels like a loud, funny exhibit inside a calm dark gallery. You meet people through what made both of you laugh.

## 2. Keep these (they're already good)

- The brand voice. "Same memes. Different damage." and "A healthy amount of damage. The engine thanks you." are the bar every new line has to clear.
- The contour Fingerprint as the brand mark. It's the one visual nobody else has.
- Locked-reveal duels (nobody sees a partial), fixed-choice play, no typing.
- Honest empty states, no fake users, 18+ gate checked server-side.
- Big condensed display type on dark with bone-white text and gold micro-labels.
- Resonate (instead of "like") and the Matrix / Arena / Circles vocabulary.

## 3. What's broken or boring (from the recording)

| # | Where | What I saw | Direction |
|---|---|---|---|
| 1 | Intro 0:00–0:04 | A thin spinner on black for about 4 seconds before any brand shows; "tap to skip" visible from frame one | Rebuild as a timed sequence; first frame under 400 ms |
| 2 | Intro 0:04–0:10 | Meme cards clipped by the left edge, logo barely visible, wordmark types in over other text | Choreograph as one continuous move (see prompt) |
| 3 | Intro (your "very laggy") | Consistent with full-screen blur/noise layers and animated SVG filters on the main thread; I can't profile from video | GPU-only transforms, contour field on canvas/WebGL, adaptive quality |
| 4 | Onboarding | Nine steps, form-first: date input, toggle, three auth buttons of uneven size, then three music sources of which none work | Value first, forms last; hide integrations that don't exist yet |
| 5 | Onboarding 0:28–0:36 | The floating contour and "% signal confidence" text sit on top of the track list; microcopy is clipped under the meme cards | Fixed layout zones, no overlap |
| 6 | Sound step | Every clip says "No audio source connected"; no music plays | Real 30-second previews |
| 7 | Music-source step | A "Photo checked on this device" pill floats in from another step | State leak |
| 8 | Reveal screen | Strong payoff, but shows a garbled name ("Alelllsb"), scaffolding labels ("Beat one/two/three") and an empty input pill | Real name step, plain headings |
| 9 | After "Enter cultured" 0:48 | A Meme Duel modal opens over Home and a "Welcome" toast covers its button | Modal/toast ordering bug |
| 10 | Home 1:16 | Swapping cards lets meme text ghost through the song card | Layer/transition bug |
| 11 | Home | Every song uses the same moon-over-hills art, so songs feel interchangeable | Real album art |
| 12 | Home 1:24 | "Today's memes" are flat colored text cards with an emoji (reads as filler); tiny actions; a big empty gap before "From your circles" | Real image/video memes, full-bleed deck |
| 13 | Home | Like = small heart pop; Save = a toast ("Removed from saved") | Feedback is functional, not delightful |
| 14 | You 2:32–2:52 | Resonances, Saved and Laughs given all show 0, and "Saved culture" says nothing saved, after you liked and saved earlier | State isn't shared across screens. This is your "can't see liked/saved" bug |
| 15 | Matrix detail 2:12–2:24 | Blank gradient box mid-transition, "0%" flash on a new card, "Something felt off?" overlay overlapping the humor bars | Transition and layer bugs |
| 16 | Matrix card | One contour and a name, no memes or songs on the card | No hook; show pins |
| 17 | People | Only an empty state; no stories, no fresh matches | Redesign |
| 18 | You | Playlist rows with blank thumbnails, truncated text in the photo block, clipped chip row, top contour clipped by the "The Story" pill | Layout pass |
| 19 | Arena | Toast truncated ("Opener needs a real match — duel som…"); "Your city is still quiet" is honest but a dead end | Turn it into a progress meter |
| 20 | Never Have I Ever | Ten cards per round from a small bank, so repeats arrive fast | 100-card bank included, no repeats until exhausted |

## 4. Market context (why this direction is timely)

- Dating-app fatigue is the story of 2026. A Forbes survey reported by Fortune found over 75% of Gen Z feel burnt out on Hinge, Tinder and Bumble, and Match Group's own CEO says under-30s want to connect in a lower-stress way.
- Incumbents are chasing exactly that: Tinder launched Modes (Double Date, College). Early data showed double-date users sent roughly 25% more messages per match, and about 15% of people accepting a double-date invite were new or returning users. Hinge is testing "Direct to Date" to skip small talk, and both run IRL events.
- What it means for you: lead with vibe, not profiles; make openers cheap and playful (reactions, memes, Roulette); and add group formats (Crew, Double Date) and IRL nudges later. Your "humor first" positioning is the right wedge.

## 5. v5 art direction: "The Gallery"

Calm dark museum, loud exhibits. The UI chrome stays quiet (near-black, bone type, thin lines, grain). The content is loud (saturated memes, album art). Three signature moves:

1. **Living contours.** The Fingerprint stops being a static image: it's the story ring, the avatar aura, the progress indicator, the ripple under every tap. One generative language everywhere.
2. **Museum placards.** Every meme and song gets a placard ("Exhibit №4,021 · Dev Tears · Mood: Existential" plus a dry impact line). Funny, shareable, and it doubles as alt text.
3. **Profile as a wall.** Your profile is a curated exhibit: pinned memes as framed pieces, songs as sleeves on a shelf, a theme for the wall (Gallery, Corkboard, Zine, Record Crate, Arcade, Bus Window).

## 6. Page by page

- **Intro (5.5 s):** a point blooms into contour lines, real memes deal in on springs, kinetic type, the lines morph into a waveform, everything collapses into the logo. Live WebGL on good phones, simpler canvas on mid, a pre-rendered video on weak ones.
- **Onboarding (~90 s to reveal):** the **Humor Gauntlet** (swipe 12 real memes while the fingerprint grows live), **genre bubbles** (tap to inflate what you love), a 3-song sound check with real previews, pick a **signature laugh**, name tag, then a cinematic **Fingerprint reveal** with a humor archetype. Ask for sign-in after the reveal ("Keep your fingerprint") if the backend allows.
- **Home:** three sub-pages. **Today** has the Daily Drop hero, **The Deck** (swipe memes and songs; 15 laughs a day shown as a budget meter), circles with a real call to action instead of a dead end, and a small daily ritual ring.
- **Matrix:** cards show a living aura, a pinned meme as a tilted polaroid and a song sleeve peeking out. Compatibility is shown as **two contours sliding together** instead of only a number. Detail view has a six-axis radar (you vs them), "you both laughed at" with both reactions, their pin board and shelf, and **Resonate on a pin** (like Hinge's like-on-a-prompt, but on a meme). Mutual match is a full-screen moment.
- **People:** stories rail with contour rings on top; threads show a "vibe line" (💀 reacted to your meme) instead of a text snippet; messages can be meme cards or song cards with inline preview; long-press any bubble for the reaction tray; send from your Vault; a shared **Mixtape** per match as a later add-on.
- **You (profile):** Exhibit view plus an edit studio: wall theme, accent palette, aura style, frame style, font pair, sticker pack, anthem, signature laugh, drag-to-reorder blocks, and a "how matches see me" preview. Pin board and shelf are picked from your **Vault**.
- **Vault (new):** private Saved / Laughed / Pinned library with search and filters. This fixes "I can't see what I liked" and powers the profile.
- **Stories (12 h):** add any meme or song; editor with frames, backdrops, stickers (music, mood, W-or-L, Blessed-or-Cursed, Add Yours, countdown), text, draw, filters; audience (everyone / matches / inner circle / hide from); reply rules; viewer list with reactions; fade-to-dust expiry.
- **Share card:** one clean "placard" layout in three sizes (9:16, 1:1, link preview). Meme, song, Fingerprint, Duel result, Weekly recap all use the same template. Restrained on purpose.

## 7. Reaction system (Telegram-inspired, aiming past it)

What your clip does well: the tray emojis animate when they appear, the chosen emoji travels to a chip under the message, sparks burst on landing, and the chip squashes as it settles. v5 keeps all of that and adds:

- **Finger-drag fisheye** across the tray with a haptic tick per emoji.
- **Signature FX per reaction**, and they're jokes: 💀 the card slumps to grayscale and revives; 😭 the card laughs in jitters with tear jets; 🗿 camera-shake thud with dust; 🤡 party hat drops and a nose bounces; 🧠 contour rings ripple out; 🔥 embers rise and the chip glows; 🫠 the card drips and re-forms; 🥹 soft sparkle bloom.
- **Combos:** tap fast on the same item and the effect escalates (x2, x3, x5 UNWELL). It's cosmetic, so it never burns your laugh budget.
- **Meaning:** each reaction nudges your fingerprint axes (💀 absurdist, 🗿 deadpan, 🧠 niche refs, 🥹 wholesome...). Reactions are data, not decoration.
- **Everywhere:** memes, songs, pins, stories, chat bubbles.
- **Your signature laugh:** one tap sends it; matches see it on your profile.

Assets: Google's Noto animated emoji (Lottie, ~884 files, roughly 36–66 KB each, CC BY 4.0, so one credit line in About) gives you legal, animated emoji without copying Telegram's. The signature FX are your own particles and springs.

## 8. Home sub-pages: pick one per slot

**Yesterday slot**
- **Y1 · Receipts (my pick).** Yesterday as a thermal-paper receipt: what you laughed at, saved, your peak-chaos time, total damage. Below it, a "missed drops" shelf so yesterday isn't dead content. One tap shares the receipt. Personal, nostalgic, highly shareable.
- **Y2 · The Verdict.** The room's results: top meme and song, plus the **Split Decision** (the drop the community disagreed on most, with the reaction split animated and where you landed: "You sided with 12%. Bold."). Social and competitive; needs some user volume to feel alive.

**Tomorrow slot**
- **T1 · The Draft (my pick).** Tomorrow's drop is voted on today between two blurred candidates; a "Called it" badge if yours wins; countdown and a hint. It creates a reason to come back tomorrow.
- **T2 · Forecast.** Pick tomorrow's "weather" (☀️ Sunny with a chance of delulu, ⛈️ Thunderstorm of group chats...) plus one saved meme and song as **Tomorrow-me**, shown as a status ring on your card for 24 hours, with "Same weather" badges and low-pressure IRL chips (coffee, walk, listening party). Best once you have local density; aligns with the IRL trend above.

The prompt defaults to **Y1 + T1**. Edit the CHOICES block in the prompt to switch.

## 9. Viral loops (the few that matter)

1. **The Duel Link, no install.** A friend opens your link, plays in the browser in under 30 seconds with no account, and sees the **Damage Report** (both contours colliding, compatibility, matching answers). They get their own fingerprint at the end and a prompt to keep it. This is your Wordle-style share.
2. **Archetype + Cultured Weekly.** Every Sunday a Spotify-Wrapped-style recap in story slides. Your **humor archetype** (15 of them, from your top two axes) is an identity flex. Rarity is shown only once real data exists; no invented percentages.
3. **Smoke Signals.** Send any meme or song to anyone by link. They react with the full tray in the browser; you get the reaction live. To reply, they join. Reaction receipts are social proof.
4. **City Meter.** "Your city is still quiet" becomes "{Your city} unlocks at 100 people: 37/100", with invites moving you up and a campus/city leaderboard. Density is the real dating-app problem; make it a game.
5. **Crew Fingerprint** (Phase 2). Two to four friends tap one link; you get a group fingerprint and superlatives ("most unhinged"). It's non-dating, so people share it without stigma, and it's the on-ramp to Double Date.

Add-ons built into other features: **Add Yours** story chains, **laugh streaks**, and **duel streaks** with a friend.

Growth guardrails: no contact-list scraping, no anonymous-sender tricks, no dark patterns, 18+ throughout.

## 10. Content plan

- **Memes:** your local image memes get like/save/share/react; add video memes (muted autoplay in view, one at a time). Remove AI-generated text memes entirely. The prompt adds a manifest script and a `rightsCleared` flag that blocks a production build if any meme isn't marked cleared, so nothing unlicensed ships by accident.
- **Songs:** `v5-content/songs_seed.csv` has 208 real tracks across 31 genres with a vibe tag each. A script resolves artwork and 30-second previews from the iTunes Search API with Deezer as fallback. The current fictional artists get replaced.
- **Never Have I Ever:** `v5-content/nhie_questions.json` has 100 cards in 10 categories, each with a subtext line, humor axis and spice level.
- **Copy:** `v5-content/copy_deck.md` covers voice rules and the full microcopy set, including category names, genre names, archetypes and notifications.

## 11. Decisions and risks

**Decisions I made (change if you disagree)**
- 15 daily limit applies to **laughs** (likes on memes/songs). **Resonates** on people get their own cap, also 15, both remote-configurable. Saves, passes and shares are unlimited. Resets at local midnight.
- "Signal confidence" is renamed **Fingerprint clarity** in the UI.
- Onboarding shows no integration that isn't live; Last.fm / Apple Music / Spotify return as "Connect later" chips when they work.

**Licensing flags (I'm not a lawyer; check each provider's current terms)**
- Memes: you've said you'll buy the rights before launch. Keep the build gate until then.
- Music previews: iTunes Search API returns 30-second previews and Deezer's public API does too (Deezer links expire, so refresh them server-side). Spotify stopped returning `preview_url` to apps registered after 27 Nov 2024, and its developer terms bar syncing its content with visuals, so don't scrape previews. Because of that, v5 treats music in stories as an in-app **sticker** with tap-to-preview, not audio baked into an exported video. Real baked-in music needs a licence.
- Telegram's reaction animations are Telegram's; v5 uses Noto animated emoji (CC BY 4.0) plus your own effects.

**Risks**
- Cold start: a swipe app with few users feels empty. The City Meter and Duel Link are the answer; prioritize them.
- Story text overlays need report/block and a basic filter.
- Perf on mid-range Android is the make-or-break; the prompt sets budgets and an automatic quality ladder.

## 12. Files

- `01_AGENT_PROMPT.md`: paste as the first message to your coding agent.
- `v5-content/`: copy this folder into the repo root before you start. The prompt refers to it.
