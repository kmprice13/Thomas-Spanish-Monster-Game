# Isla Monstruo — Project Notes

> A Three.js browser game teaching Spanish to Thomas (ages 5–8, ADHD) through creature collecting, exploration, and NPC voice commands. No flashcards. No punishment. No English during play.

---

## Table of Contents

1. [Why This Game Exists](#1-why-this-game-exists)
2. [Core Design Philosophy](#2-core-design-philosophy)
3. [What's Built (Current State)](#3-whats-built-current-state)
4. [Key Decisions Made](#4-key-decisions-made)
5. [Open Questions & Decisions Still to Make](#5-open-questions--decisions-still-to-make)
6. [Technical Architecture](#6-technical-architecture)
7. [The Learning Engine](#7-the-learning-engine)
8. [The Parent Dashboard](#8-the-parent-dashboard)
9. [AI Cost Strategy](#9-ai-cost-strategy)
10. [What We Know About Thomas](#10-what-we-know-about-thomas)
11. [Future Roadmap](#11-future-roadmap)
12. [Running the Project](#12-running-the-project)

---

## 1. Why This Game Exists

Thomas is preparing for Spanish immersion school. The goal isn't to teach him to translate — it's to build **comprehensible input**: the ability to understand Spanish in context, the same way a child absorbs a first language. Every mechanic is chosen to accelerate that, not to test him.

The reference game is **Teach Your Monster to Read** — it's the benchmark for stickiness, progression feel, and how it makes a child feel capable rather than tested. Thomas already loves it.

---

## 2. Core Design Philosophy

### Comprehension through action, not translation
The child hears a Spanish word and interacts with the matching object in the world. They never see an English translation during play. English exists only in the parent dashboard, invisible to Thomas. Understanding is demonstrated by doing, not by remembering.

### No punishment
Wrong guesses get a gentle "Mmm... otra vez" (try again). Never a buzzer, never a red flash, never a score going down. The game reacts with curiosity, not judgment. This is deliberate for ADHD — punishment kills intrinsic motivation.

### The child must always have a fair chance
If Thomas doesn't know what *flor* means, he can't be expected to find the flower. Before any word is ever the target of a quest, **Nube introduces it first**. The child sees and hears the word in context before being asked to act on it. This is the "Option A" mechanic.

### The game grows with him
Words unlock gradually. New command types (find → touch → give → count → color) introduce new grammar implicitly. Nube's sentences get slightly more complex over time. Thomas never notices he's learning grammar rules.

### ADHD-friendly pacing
- Something new appears every 2 quests (word unlock)
- A creature is awarded every 3 quests (dopamine hit)
- Sessions have no forced length — quit anytime, progress is saved
- Calm mode reduces saturation and disables animations for sensory sensitivity
- Slow speech mode slows audio playback for processing time

---

## 3. What's Built (Current State)

### Milestone 1 — Playable Loop ✅
The core gameplay loop: Nube speaks Spanish → player walks/taps object → confetti + audio → next quest. 12 meadow vocabulary items. Procedural low-poly 3D models for everything (no external assets needed). Web Speech API for voice. Full parent dashboard gate.

### Milestone 2 — Learning Engine ✅
- **85 pre-baked M4A audio clips** using macOS Paulina (es_MX) voice — warm, native-quality Spanish, no robotic TTS in the child's experience
- **Option A intro mechanic** — Nube introduces every new word before asking Thomas to find it. Teal spotlight ring, NPC faces the target, voice plays "¡Mira! ¡La manzana!", brief pause, then the quest command
- **SM-2 spaced repetition** — every tap is timed; response time is a proxy for confidence; the algorithm schedules each word's next review on the forgetting curve
- **Confusion pair tracking** — if Thomas repeatedly taps the wrong object for a given word, the game learns which pair confuses him and physically separates them in the scene
- **Enhanced parent dashboard** — fluent / building / struggling word tiers, confusion pairs, response speed trend, next-review dates per word, plain-language insights

### File overview
```
src/
  content/
    vocabulary.ts      — 12 vocab items (es/en/say/article/model/color)
    quests.ts          — Spanish command phrasing (5 command types)
  assets/
    ModelFactory.ts    — procedural flat-shaded low-poly models
    Biome.ts           — layered animated meadow world
  systems/
    AudioClips.ts      — M4A-first player, TTS fallback
    AudioSystem.ts     — procedural Web Audio SFX
    CameraRig.ts       — smooth follow camera
    Confetti.ts        — pooled 180-particle burst VFX
    GameUI.ts          — all DOM/CSS state
    ProgressStore.ts   — SM-2, confusion pairs, parent summary
    QuestDirector.ts   — quest logic (9 unit tests)
    SpanishVoice.ts    — Web Speech API wrapper
  entities/
    WorldObject.ts     — tappable vocab objects, dual ring system
  game/
    Game.ts            — top-level orchestrator, phase machine
  core/
    Loop.ts, Renderer.ts, InputController.ts
scripts/
  generate-audio.mjs   — generates 85 M4A clips via macOS `say`
public/
  audio/               — 85 M4A files + manifest.json
```

---

## 4. Key Decisions Made

### Language approach: comprehension-through-action
**Decision:** No English during play, ever. English is stored in `vocabulary.ts` only for the parent dashboard.
**Why:** Bilingual acquisition research shows that keeping input in the target language — even when the child doesn't fully understand — accelerates comprehension. Translation creates a crutch that slows this.
**Status:** Locked.

### Intro mechanic: Option A (Teach Your Monster style)
**Decision:** Nube introduces each new word *before* the child is ever asked to find it.
**Why over Option B (learn by context/trial):** Thomas needs to feel capable, not confused. Option A guarantees a fair first attempt. We don't want his first experience with a new word to be failing to recognize it.
**What it looks like:** Nube bounces → turns to face target → teal spotlight ring pulses on target → "¡Mira! ¡La manzana!" → 600ms pause → quest command plays.
**Status:** Implemented.

### Audio: macOS Paulina voice over Web Speech API
**Decision:** Pre-bake 85 clips using `say -v Paulina -r 160` → AIFF → AAC M4A.
**Why:** Web Speech API produces robotic, synthesized TTS that is off-putting for children. Paulina (es_MX) is a warm, natural-sounding voice built into every Mac. Quality gap is massive.
**Trade-off:** 85 static clips means dynamic sentences (color quest "busca la pelota roja") fall back to TTS. This is acceptable — most quests use find/touch/give commands which are all pre-baked.
**Status:** Done. If ElevenLabs API key becomes available, the manifest format is identical — swap drop-in.

### Voice synthesis approach: file-first with TTS fallback
**Decision:** `AudioClips.ts` checks manifest.json first, plays M4A if available, falls back to `SpanishVoice.ts` TTS for anything not in the manifest.
**Why:** Graceful degradation. If running on a non-Mac where audio generation wasn't possible, the game still works (just sounds more robotic).
**Status:** Implemented.

### Spaced repetition algorithm: SM-2 (not FSRS)
**Decision:** Implement SM-2 inline, no external dependency.
**Why over FSRS:** SM-2 is well-understood, battle-tested (Anki), and simpler to implement correctly in ~60 lines. FSRS is more accurate for large card decks but requires its own dependency and is harder to reason about for a game context. At Thomas's age and vocabulary size (12–50 words), the difference is negligible.
**Response time → quality mapping:**
- < 2.5s correct = quality 5 (fluent, no thinking required)
- 2.5–6s correct = quality 4 (knows it, slight hesitation)
- > 6s correct = quality 3 (correct but shaky)
- Wrong = quality 1 (reset interval, lower ease factor)
**Status:** Implemented.

### Confusion pair guard
**Decision:** If Thomas selects the wrong object 3+ times across sessions where the same pair appears, the spawn layout separates them to > 3.5 units apart.
**Why:** Minimizes the reinforcement of a wrong association. If *pez* and *rana* are always next to each other, a fast tap of the wrong one becomes a habit.
**Status:** Implemented.

### Art direction: flat-shaded low-poly procedural
**Decision:** No imported 3D assets. All models built in code using `ModelFactory.ts`.
**Why:** No 3D API keys were available (credential probe showed Tripo/Gemini/ElevenLabs all MISSING). More importantly, the flat-shaded low-poly style (Animal Crossing × Teach Your Monster) is *correct* for this age group — high contrast, readable shapes, no texture noise to distract.
**Status:** Implemented. 13 vocab models + player monster (Nube + Thomas) + eggs.

### No streak mechanic
**Decision:** Deliberately no streaks, no "days in a row" counter visible to Thomas.
**Why:** Streaks create anxiety when broken, which is antithetical to ADHD-friendly design. The game should feel welcoming on day 1 after a 2-week gap.
**Status:** Locked.

### Parent access gate: arithmetic question
**Decision:** Random addition problem (two 2–9 digit numbers, three multiple-choice answers).
**Why:** Simple enough for a parent, impossible for a 5-year-old. No password to forget, no account required.
**Status:** Implemented.

### Storage: localStorage, offline-first
**Decision:** All progress stored locally in the browser with key `ismg-progress-v2`.
**Why:** No server, no signup, no privacy concerns, works on planes. Supabase sync is planned but not blocking.
**Trade-off:** Progress is per-device. If Thomas plays on two different tablets, progress doesn't merge.
**Status:** Implemented. Migration path: same ProgressData interface, Supabase would be an additional write layer.

---

## 5. Open Questions & Decisions Still to Make

### Biome progression
- **Q: When does the Beach biome unlock?** Leading option: after Thomas has 6+ fluent meadow words (ease > 2.1, reps ≥ 3). Alternative: after a fixed number of quests (simpler). No decision yet.
- **Q: What vocabulary is in the Beach biome?** Needs curation. Candidates: *arena* (sand), *ola* (wave), *concha* (shell), *cangrejo* (crab), *barco* (boat), *sol* (sun), *toalla* (towel), *cubo* (bucket). Need to check if macOS Paulina has any pronunciation quirks with these.
- **Q: Is the beach a separate scene or the same island with a new area?** Architecturally, extending the island is cleaner than a scene transition. Biome.ts already has the abstraction.

### Creature / pal roster
- **Q: Are the 12 vocabulary items (manzana, rana, etc.) the creatures, or are creatures separate characters?** Currently the game uses vocabulary IDs for creature IDs, which means collecting a *rana* creature is tied to mastering that word. This might be the wrong model — creatures should probably be *rewards* for mastering words, distinct from the words themselves (e.g., earn "Sparkle the Star Monster" for mastering *estrella*).
- **Q: What do creatures do after you collect them?** The Pal Book currently just shows them as emoji cells. Do they follow you? Do they have abilities? This is the "village building" mechanic mentioned but not designed yet.

### Village / home base mechanic
- **Q: What does "village building" actually look like?** Vague concept: Thomas earns decorations/buildings and places them on a base. Needs design. Teach Your Monster has the monster's house you upgrade. Animal Crossing has the island. Neither is quite right for a language game.
- **Q: Is village building the primary meta-loop or a secondary feature?** If primary, it needs significant design work before implementation. If secondary (just cosmetic rewards), it could ship quickly.

### Audio for color and count quests
- **Q: Should we pre-bake color and count quest commands?** There are 4 colors × 12 nouns × 2 genders = 96 possible color commands, and ~3 number variants × 12 nouns = 36 count commands. Total ~132 additional clips. Feasible with the same macOS script.
- **Current state:** Color and count quests fall back to Web Speech API TTS. This sounds robotic but is functional.
- **Recommendation:** Generate these clips in a second pass when the quest types become more common in Thomas's sessions.

### Claude API integration
- **Parent dashboard narrative:** The plan is to use Claude API to generate a plain-English weekly summary ("Thomas had a big week with animals — frog, fish, and bird all clicked into place. He's still mixing up star and flower."). Estimated cost: ~$0.001/summary. This hasn't been implemented yet.
  - **Q: When is this triggered?** On dashboard open? Weekly email? On-demand button?
  - **Q: What data do we send?** The `ParentSummary` object is safe — no PII, just word performance data.
- **Agentic biome unlock quests:** The plan is to use Claude to generate culturally-relevant Spanish mini-quests when Thomas unlocks a new biome ("Find 3 things on the beach that start with 'C'"). Estimated cost: ~$0.01/batch. Not implemented.

### Cloud save / multi-device
- **Q: How important is this in the near term?** If Thomas plays on multiple devices, progress won't sync. Supabase was mentioned as the planned backend.
- **Q: What's the user model?** Does kmprice (parent) have an account? Does Thomas? Currently no accounts exist.
- **Q: What about privacy?** Progress data contains nothing personally identifiable — just word performance records. Storing it in Supabase under a parent account would be fine.

### PWA / iOS home screen
- `public/manifest.webmanifest` already exists with PWA config (`display: fullscreen`, `theme_color: #8fd3ff`).
- **Q: When to prioritize this?** If Thomas is playing on an iPad, PWA install would make it feel like a real game. Low-effort, high-perceived-value.
- **Blocker:** Needs HTTPS. Currently running on localhost.

### Accessibility
- Calm mode (reduced saturation + animation kill switch) is implemented.
- Slow speech mode is implemented.
- **Q: Are there other sensory accommodations needed?** Touch controls exist for mobile. Keyboard input isn't implemented.
- **Q: Should we add subtitles?** Showing the Spanish word on screen when Nube speaks it would be Captions mode — useful for hearing-impaired kids or noisy environments. This would need a UI decision (does seeing the word change the learning dynamic?).

### Analytics
- **Q: Do we want any usage data at all?** Currently zero telemetry. We know nothing about session length, which quests are most failed, whether the intro mechanic is working, etc.
- **Recommendation:** Add anonymous, local-only analytics (write to localStorage alongside progress) to validate that the learning mechanics are working as designed. No external service needed initially.

### Multiplayer / sibling mode
- Not discussed. Flagging as a potential future request.

### Configurability
- Thomas's name is hardcoded in some comment references. The game itself doesn't display names.
- **Q: Should this be configurable?** If other families want to use this game, a simple name field in Settings would personalize Nube's dialogue.

---

## 6. Technical Architecture

### Phase machine (Game.ts)
```
start → (play button) → introducing | speaking → playing → celebrating → hatching → ...
                                                                              ↑
                                                                      loops back to
                                                                     introducing | speaking
```

- **start:** Title screen. World animates, NPC idles. No input.
- **introducing:** Nube faces target. Spotlight ring pulses. Intro clip plays. Player cannot move.
- **speaking:** Quest command plays. Player CAN move (ADHD — can't make them sit still).
- **playing:** Full input. Timer running for response-time measurement.
- **celebrating:** 1.4s pause after correct. Confetti, praise clip, banner.
- **hatching:** 2.2s egg hatch sequence. Confetti burst, mini pal appears.

### Audio clip naming convention
```
word-{id}       — pronunciation (Pal Book tap)
intro-{id}      — "¡Mira! ¡La manzana!" (Nube intro)
find-{id}       — "Busca la manzana."
touch-{id}      — "Toca la manzana."
give-{id}       — "Dale la manzana a Nube."
carrying-{id}   — "¡Sí! Dale la manzana a Nube." (give-quest pickup confirm)
praise-0..5     — "¡Sí! ¡Muy bien!" etc.
nudge-0..2      — "Mmm... otra vez." etc.
nube-hello      — "¡Hola! Soy Nube."
nube-ready      — "¿Listo? ¡Vamos!"
new-word        — "¡Nueva palabra!"
new-friend      — "¡Nuevo amigo!"
```

### Update loop order (per tick)
1. Resize check
2. Biome update (always — even on start screen)
3. Phase-gate early return (start phase)
4. Player movement
5. Quest interactions (proximity + tap)
6. World object updates
7. NPC animation
8. Timer countdowns (celebrate/hatch)
9. Confetti
10. Camera rig
11. Progress time accumulation
12. Diagnostics publish
13. Render

### SM-2 implementation
Stored per word in localStorage:
```typescript
interface SRSState {
  ease: number;       // ease factor, starts 2.5, min 1.3
  interval: number;   // days until next review
  reps: number;       // consecutive correct
  nextReview: number; // ms timestamp
}
```
Quality → interval:
- reps=0 → interval=1 day
- reps=1 → interval=6 days
- reps≥2 → interval = round(prev × ease)
Wrong answer resets reps=0, interval=1.

### Diagnostics object (window.__THREE_GAME_DIAGNOSTICS__)
Available in browser console during development:
```javascript
__THREE_GAME_DIAGNOSTICS__.phase       // current game phase
__THREE_GAME_DIAGNOSTICS__.quest       // {kind, target, collected}
__THREE_GAME_DIAGNOSTICS__.renderer    // {calls, triangles, geometries, textures}
__THREE_GAME_DIAGNOSTICS__.player      // {position, speed}
```

---

## 7. The Learning Engine

### What gets tracked per word
- `introduced` — has Nube done the intro sequence for this word? (boolean, never resets)
- `exposures` — how many times the intro has played (should be 1 for most words)
- `correctCount` / `totalAttempts` — raw accuracy
- `srs.ease` — SM-2 ease factor (starts 2.5, drifts based on performance)
- `srs.interval` — days until next review
- `srs.reps` — consecutive correct responses
- `srs.nextReview` — timestamp of next scheduled review
- `attempts[]` — rolling last-30 attempts: timestamp, correct, responseMs, confusedWith
- `confusionWith{}` — map of vocabId → wrong-pick count

### Fluency classification
```
fluent     → ease ≥ 2.1, reps ≥ 3, accuracy ≥ 75%
learning   → everything else that's been introduced
struggling → ease < 1.7 OR accuracy < 50%
unseen     → not yet introduced
```

### What parents see
- Word tiers (fluent / building / struggling) with Spanish + English
- Confusion pairs (e.g., "sometimes mixes up *pez* and *rana*")
- Response speed for fluent words (< 2.5s = solid, 2.5–6s = normal, > 6s = still thinking)
- Words due for review today (based on SM-2 schedule)
- Coming-up review schedule (next 3 words)
- Plain-language recommendation

### What parents do NOT see
- Raw numbers, percentages, scores
- Comparisons to other children
- Anything that implies Thomas is behind or failing

---

## 8. The Parent Dashboard

### How to access
Tap ⚙️ (Settings) → scroll to "Grown-ups" button → solve arithmetic question → dashboard opens.

### Gate design
Random addition of two 2–9 digit numbers with 3 multiple-choice answers. Wrong answer briefly flashes the button red, does not lock out. Designed to be trivially easy for adults and impossible for a 5-year-old.

### Privacy
No data leaves the device. Everything is localStorage. The dashboard reads `ProgressStore.parentSummary()` which transforms raw SRS data into parent-friendly language.

---

## 9. AI Cost Strategy

### Current: Zero AI cost
No Claude API calls during gameplay. The learning loop (SM-2, confusion tracking, response timing) is pure JavaScript.

### Planned: Low-cost AI touchpoints

| Feature | When | Estimated cost |
|---|---|---|
| Parent dashboard narrative summary | On dashboard open or weekly | ~$0.001/call |
| Biome unlock quest generation | One-time when biome unlocks | ~$0.01/batch |
| Word introduction content (if extended) | New biome vocabulary | ~$0.005/biome |

**Why keep AI cost low:** The game is a personal project for one child. $0–2/month is sustainable. $10+/month is not. Every AI touchpoint should be either invisible (background generation) or high-value-visible (parent dashboard insight).

**Claude API key status:** Not yet configured. When ready, add as environment variable `VITE_CLAUDE_API_KEY` (never committed to git — add to `.env.local`).

---

## 10. What We Know About Thomas

- Ages 5–8 range, currently in that window
- Has ADHD — needs immediate rewards, low frustration tolerance, variety keeps engagement
- Loves **Teach Your Monster to Read** — specifically the creature collecting, world exploration, and "trickies" (hard things that feel special to master)
- Preparing for Spanish immersion school — the goal is functional comprehension, not formal grammar
- Plays on a tablet (assumed) — all UI targets 44px+ touch targets
- No known specific sensory needs, but calm mode and slow speech mode are available as options

---

## 11. Future Roadmap

### Near term (next sessions)
- [ ] Generate color + count quest audio clips (132 additional M4A files)
- [ ] Claude API: parent dashboard narrative summary
- [ ] PWA: service worker + HTTPS deployment (Vercel or Netlify — free tier)
- [ ] Beach biome design: vocabulary list, unlock threshold, world extension

### Medium term
- [ ] Claude API: biome unlock quest generation
- [ ] Creature roster redesign (creatures as distinct characters, not vocab item IDs)
- [ ] Village / home base mechanic (design first, implement second)
- [ ] Supabase cloud save (multi-device progress sync)
- [ ] Anonymous local analytics (validate mechanic effectiveness)

### Long term
- [ ] Jungle biome (new vocabulary, new environment)
- [ ] Sibling/multiplayer mode
- [ ] Parent email summary (weekly digest)
- [ ] Optional captions / subtitle mode
- [ ] Configurability (child's name, difficulty)

---

## 12. Running the Project

```bash
# Install
npm install

# Dev server
npm run dev        # → http://127.0.0.1:5188

# Tests (pure logic, no browser needed)
npm test

# Type check
npx tsc --noEmit

# Build
npm run build

# Regenerate audio clips (macOS only — requires Paulina voice)
node scripts/generate-audio.mjs
```

### Key environment info
- Node.js with Vite + TypeScript
- Three.js r170+
- No backend, no database, no auth
- All progress in localStorage key: `ismg-progress-v2`
- Audio manifest: `public/audio/manifest.json` (85 clip IDs)

### Adding new vocabulary
1. Add entry to `MEADOW_VOCAB` in `src/content/vocabulary.ts`
2. Add a model builder to `src/assets/ModelFactory.ts`
3. Add the word to `VOCAB` in `scripts/generate-audio.mjs`
4. Run `node scripts/generate-audio.mjs` to generate audio clips
5. If word has a color variant, add to `COLORABLE` set in `QuestDirector.ts`

---

*Last updated: June 2026. Maintained by kmprice.*
