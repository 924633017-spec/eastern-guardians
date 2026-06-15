# Digital Shrine MVP Design

## Product Summary

Digital Shrine is a desktop-first PWA for overseas users that turns Chinese mythological guardians into daily ritual companions. The product combines a personalized shrine, guided daily rituals, lightweight divination, and shareable visual identity.

This MVP is intentionally not a "fortune telling app" and not a "pet app." It is a ritual companion with strong visual identity and repeatable daily use.

## Audience

- English-speaking users interested in astrology, self-discovery, rituals, emotional support, or digital ambiance
- Users who enjoy apps like Co-Star, Finch, Sanctuary, or cozy desktop spaces
- Users who value aesthetics and shareable identity cards

## Product Positioning

- Category: Mythology-inspired ritual companion
- Surface: Desktop-first installable web app
- Differentiator: Chinese deity archetypes mapped to practical daily modes

## Core Promise

Users can build a personal shrine, invite a guardian deity aligned with their current life focus, complete a daily ritual, and receive reflective guidance that feels atmospheric, calming, and worth returning to.

## Deity System

The MVP launches with five deities, each acting as a distinct user mode rather than a cosmetic skin.

### Guanyin

- Themes: healing, calm, compassion, emotional reset
- Interface mood: porcelain, moonlight, mist, water reflections
- Ritual style: breathe, release, soften

### Caishen

- Themes: abundance, momentum, money, opportunity
- Interface mood: cinnabar, gold leaf, lacquer, glow
- Ritual style: commit, act, attract

### Yuelao

- Themes: love, connection, repair, longing
- Interface mood: rose silk, lantern light, threads, petals
- Ritual style: invite, reflect, connect

### Wenchang

- Themes: focus, study, writing, expression
- Interface mood: ink, bamboo, parchment, starlight
- Ritual style: prepare, concentrate, create

### Mazu

- Themes: protection, travel, transitions, safe passage
- Interface mood: sea glass, tide blue, salt white, harbor lamps
- Ritual style: anchor, trust, continue

## MVP User Flow

1. User lands on the app and enters a guided onboarding flow.
2. User selects date of birth, zodiac sign, and a current intention.
3. The app recommends a guardian deity and generates a shrine profile.
4. The shrine home loads with a deity chamber, today's colors, number, ritual prompt, and guidance card.
5. The user performs one daily ritual:
   - light incense
   - write a wish
   - receive an oracle line
   - reveal one practical action for today
6. The user may switch deity modes, browse shrine details, and generate a share card.

## Information Architecture

### Screen 1: Landing

- Strong editorial hero
- Product promise
- Deity constellation preview
- Start ritual CTA

### Screen 2: Onboarding

- Date of birth
- Zodiac sign
- Intention selector
- Optional tone preference
- Result preview

### Screen 3: Shrine Home

- Large visual shrine scene
- Guardian deity card
- Lucky color palette
- Lucky number
- Daily oracle
- Streak and incense meter
- Daily action prompt

### Screen 4: Ritual Panel

- Light incense interaction
- Wish journal field
- Oracle reveal
- Action card reveal

### Screen 5: Share Card

- Deity portrait tile
- User intention
- Lucky color
- Lucky number
- Oracle line

## Content System

The MVP uses a deterministic content engine rather than freeform AI chat as the primary experience.

- Inputs:
  - birth month/day
  - zodiac sign
  - current intention
  - active deity
- Outputs:
  - guardian recommendation
  - lucky colors
  - lucky number
  - oracle line
  - action prompt
  - altar ambiance

Freeform AI can be added later as an enhancement layer, not the app's foundation.

## Visual Direction

The aesthetic should feel like a contemporary digital shrine:

- sacred but not religiously literal
- atmospheric but not horror-leaning
- premium, collectible, and shareable
- heavily art-directed, with layered gradients, glass, texture, and glow

### Typography

- Display typography with editorial elegance
- Refined serif pairing with clean sans support
- Strong hierarchy and high contrast

### Layout

- Desktop-first compositions
- Asymmetric panels
- Floating shrine chamber as focal point
- Dense but controlled information blocks

### Motion

- Slow incense smoke and aura pulses
- Gentle reveal transitions
- Card flips or fades for oracle moments
- Ambient shimmer rather than loud micro-interactions

## Technical Approach

- Framework: React + TypeScript + Vite
- PWA: vite-plugin-pwa
- Styling: custom CSS with design tokens
- State: local component state for MVP
- Data: local structured deity dataset
- Persistence: localStorage for shrine profile and streak

## MVP Scope Guardrails

Included:

- installable PWA shell
- landing page
- onboarding flow
- shrine home
- deity modes
- daily ritual interaction
- local persistence
- share card module

Excluded:

- accounts
- cloud sync
- payment
- real AI chat backend
- CMS
- native desktop shell

## Safety and Positioning Guardrails

- Do not present guidance as guaranteed outcomes
- Do not claim medical, legal, or financial authority
- Frame guidance as reflection and ritual support
- Avoid direct imitation of sacred iconography tied to active worship contexts

## Success Criteria

The MVP succeeds if it can:

- deliver a visually memorable shrine experience
- make each deity feel distinct
- support a satisfying first-run ritual loop
- feel polished enough for organic sharing and early user testing
