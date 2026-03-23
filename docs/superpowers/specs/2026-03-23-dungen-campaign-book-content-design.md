# DunGEN Campaign Book Content Design

## Goal

Define the next DunGEN content-generation phase around a structured, GM-facing campaign book that produces evocative narrative material, persistent NPCs, encounter and shop suggestions, and editable campaign-record entries without becoming prescriptive or rules-enforcing.

This phase intentionally prioritizes:

- campaign-book depth
- narrative generation
- NPC persistence
- section-content quality
- GM control and editability

This phase intentionally defers:

- Supabase persistence of preview churn
- multiplayer syncing of campaign-book edits
- AI as canonical source of truth
- a standalone custom map-generator UI

## Product Position

The campaign book is not a script the GM must follow.

It is a structured suggestion and record surface:

- generated content begins as plausible material for the GM to use or ignore
- the GM decides what becomes true in play
- rejected content should remain visible as crossed-out history
- accepted content becomes part of the evolving campaign record

This keeps DunGEN aligned with the larger Tempest Table principle:

- content is suggestive, not mandatory
- the platform does not adjudicate ordinary tabletop judgment calls
- the GM remains the final authority over what is present, true, important, or ignored

## Core Principles

1. Structured before prose blobs  
   DunGEN should generate typed entries first, because structured content is rerollable, editable, cross-outable, and composable.
2. Suggestions before canon  
   Generated encounters, creatures, NPC hooks, shops, items, and scene descriptions are candidate material until the GM accepts or uses them.
3. Campaign book as record  
   The book should become a story of what was offered, what was discarded, and what mattered.
4. NPCs are persistent entities  
   Any NPC can become important. Even seemingly minor NPCs need stable identity and persistent state from the start.
5. AI enhances voice, not truth  
   AI may rewrite or enrich prose based on strict structured inputs, but it should not determine canonical facts, geometry, or section connectivity.
6. Persistence comes after shape stability  
   Supabase storage should wait until the content model and campaign-book workflow feel right in actual use.

## Recommended Approach

### Recommended

Structured campaign-book entries with typed statuses.

This should be the source model for all section content.

### Not recommended for this phase

- generating one giant prose page as the primary data shape
- hard-binding encounters or creatures to exact room placements
- making room keys read like fixed module canon before GM review

## Campaign Book Model

Each section gets a generated campaign-book payload composed of typed entries.

The initial v1 entry families should be:

- `read_aloud_intro`
- `area_impression`
- `room_scene`
- `npc_profile`
- `npc_roleplay_note`
- `encounter_seed`
- `creature_seed`
- `shop_seed`
- `item_seed`
- `hazard_seed`
- `hook_seed`

### Entry status model

Each entry has one of:

- `suggested`
- `accepted`
- `crossed_out`
- `gm_added`

Behavior:

- generated entries start as `suggested`
- if the GM rejects one, it becomes `crossed_out` and remains visible
- if the GM wants to keep or emphasize one, it becomes `accepted`
- GM-authored manual entries can be introduced later as `gm_added`

### Entry shape

Each campaign-book entry should include:

- stable entry ID
- section ID
- entry type
- title
- body or prose
- optional short summary
- status
- tags
- optional related room IDs
- optional related NPC IDs
- optional related creature IDs
- optional related shop IDs
- optional provenance metadata such as biome or section seed

This keeps entries composable, rerollable, and easy to filter in the UI.

## Narrative Generation

The first narrative pass should generate content that feels like a campaign-book page without dictating exact play outcomes.

### Section-level outputs

For each section, generate:

- an opening read-aloud description
- a general area impression
- biome-driven atmosphere notes
- possible scenes or discoveries
- possible hazards and curiosities
- hooks for interaction or exploration

Example style:

- “The players enter Acid Court. Read this...”
- “Possible scenes in this area...”
- “Plausible discoveries...”
- “Likely tensions or dangers...”

### Room-level outputs

Room entries should remain suggestive.

Instead of:

- “Room 3 contains pinekin.”

Generate:

- “This circular chamber is a plausible place for a strange social encounter.”
- “This room suits a lurking acid creature, an abandoned ritual object, or a merchant den.”
- “If the GM wants to place a social encounter here, pinekin fit the biome and tone.”

This preserves GM freedom while still being genuinely useful.

## Persistent NPC Model

NPCs should be modeled as persistent campaign entities, not disposable section-local blobs.

### NPC entity

Persistent NPC record:

- canonical NPC ID
- name
- role
- baseline backstory
- personality or mannerisms
- motivations
- secrets
- rumor knowledge
- current disposition
- optional faction or shop relationships

### NPC appearances

Sections should reference NPC appearances rather than owning the NPC itself.

An appearance can describe:

- where the NPC is currently encountered
- what they are doing here
- what they want from players in this context
- how they are framed in this section’s campaign-book prose

This allows:

- minor locals to remain local if nothing happens
- any NPC to become recurring
- the GM to let players recruit, revisit, or elevate an unexpected NPC without needing a later model rewrite

## Campaign Book UX

The right-side campaign book should evolve away from a single stacked summary panel and become a segmented reference surface.

### Recommended top-level sections

- `Overview`
- `Narrative`
- `NPCs`
- `Encounters`
- `Creatures`
- `Shops`
- `Items`
- `Hazards`
- `Hooks`

### Entry presentation

Within each section, entries should appear as structured cards with:

- title
- prose
- small metadata labels
- status
- actions

### Initial entry actions

- `Accept`
- `Cross Out`
- `Reroll`

Reroll should remain scoped and explicit.

Examples:

- reroll narrative
- reroll encounters
- reroll NPC set
- reroll shops
- reroll items or curiosities

## AI Prose Enhancement

AI prose is a strong fit here, but only as a second-layer enhancement.

### Correct AI role

AI should take strict structured inputs such as:

- biome name and biome description
- section kind
- room and primitive tags
- encounter seeds
- NPC summary fields
- shop summary fields
- tone profile

Then produce:

- richer read-aloud intros
- more evocative area prose
- more flavorful NPC roleplay notes
- better campaign-book copy

### Incorrect AI role

AI should not decide:

- room geometry
- map connectivity
- canonical section facts
- exact room placement of encounters
- seed derivation

### Shared-asset alignment

This AI prose layer should align with the same architectural idea as future NPC and creature portrait generation:

- structured source data remains canonical
- AI output is derived and replaceable
- outputs can be cached and reused by stable fingerprint

### Placeholder-first AI integration

The campaign book and play surfaces should be able to render explicit AI placeholder blocks before any AI output exists.

Examples:

- `[AI Generated intro goes here]`
- `[AI Generated room prose goes here]`
- `[AI Generated NPC roleplay note goes here]`
- `[AI Generated creature image/token]`
- `[AI Generated NPC portrait/token]`

These placeholders should behave as optional enhancement slots, not missing required content.

That means:

- the structured content and GM workflow remain fully usable without AI
- AI output can be inserted later without changing the canonical record structure
- a GM can visually understand where optional generated prose or art may appear
- future asset generation and prose generation can target these slots by stable fingerprint

### Recommended placeholder model

Each campaign-book entry or entity that may later receive AI enhancement should support optional placeholder fields such as:

- `aiIntroSlot`
- `aiProseSlot`
- `aiPortraitSlot`
- `aiTokenArtSlot`

Each slot should be able to represent:

- placeholder only
- generation queued
- generated result available
- generation intentionally disabled or ignored

This keeps AI enhancement explicit and non-blocking.

## State Model For This Phase

Before Supabase persistence, the local campaign-book state should still respect clear layers:

- generated structured content
- GM action state such as accepted or crossed-out entries
- future override state

The important design rule is that generated content remains separable from GM decisions about that content.

That will make later persistence much cleaner.

## What This Phase Should Not Do

This phase should not:

- persist all preview and reroll churn to Supabase
- require exact encounter-to-room binding
- require room notes to be fully authored module keys
- introduce GM freeform notes yet
- introduce player-facing campaign-book visibility yet
- enforce gameplay mechanics from generated content

## Deferred But Important

### Custom map generator

This should remain on the roadmap as a separate DunGEN tool once the generator is richer.

Intended future controls:

- map size
- dungeon type or biome
- room count
- allowed primitive families
- corridor width rules
- density or openness
- settlement versus dungeon mode

The custom generator should be treated as a separate GM-authored map-generation tool, not as a blocker for the campaign-book work.

### Supabase persistence

Persistence should come after the campaign-book entry model, NPC model, and reroll/edit workflow feel stable in real use.

When persistence lands, focus first on canonical value:

- campaign seed
- visited sections
- locked or accepted section content
- GM actions on entries
- persistent NPC records
- shared asset references

Avoid persisting every transient preview state unless it proves necessary.

## Recommended Implementation Order

### Phase 1: Campaign-book entry system

- add typed campaign-book entry schema
- generate structured entries per section
- add status model: suggested, accepted, crossed_out
- update campaign-book UI to render entry cards by category

### Phase 2: NPC persistence

- add persistent NPC entity model
- split NPC identity from section appearances
- generate NPC profile and roleplay-note entries

### Phase 3: Narrative depth

- add read-aloud intro generation
- add area impressions and room-scene suggestions
- add richer hooks, items, and hazard prose

### Phase 4: Scoped reroll and edit flow

- reroll specific entry categories
- cross out entries in the book
- preserve visible campaign history

### Phase 5: Optional AI prose enhancer

- generate evocative prose from strict structured inputs
- cache derived prose by fingerprint
- keep structured content canonical underneath
- fill explicit placeholder blocks instead of replacing the underlying structured entry model

## Success Criteria

This phase is successful when a GM can open a section in the campaign book and get something that feels like a real campaign reference page:

- evocative intro text
- possible scenes
- plausible creatures
- possible encounters
- NPCs with names and roleplay material
- shops, hazards, items, and hooks
- the ability to accept or cross out generated ideas

Without:

- being forced to use any of it
- losing track of what was generated
- turning Tempest Table into a prescriptive rules engine
