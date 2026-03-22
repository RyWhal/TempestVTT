# DunGEN Content-First Design

## Goal

Define DunGEN as a content-first procedural campaign app surface that uses VTT capabilities as a play shell, rather than treating generated content as a subsystem inside the classic map-upload VTT.

## Product Framing

DunGEN is the game-content engine and campaign surface.

The VTT is the runtime play interface players use to move through generated content.

This means:

- generated content is the product priority
- canonical content state is the source of truth
- the play interface is allowed to evolve away from the current VTT patterns when the content needs it
- bespoke tracking, dice, map, journal, history, and reveal workflows are in scope if they improve the generated campaign experience

## Core Design Principles

1. Content first  
   The generated campaign, section history, NPCs, shops, encounters, and world state drive the interface.
2. VTT as play shell  
   Map, tokens, fog, chat, dice, and drawing are tools DunGEN can use, replace, or extend.
3. Separate route, shared app  
   DunGEN starts as a separate route inside the same app so it can evolve independently without requiring a separate deployment.
4. Shared assets from day one  
   Generated assets are global and reusable across campaigns and sessions.
5. No wasted generation on previews  
   Automatic asset generation should only happen for locked content, not preview churn.
6. Rules-light runtime  
   Players bring their own RPG rules; DunGEN provides content, context, and optional structured support where useful.

## Recommended Route Strategy

### `/DunGEN`

Primary GM-facing entry point for procedural campaigns.

Use this route for:

- creating a new DunGEN campaign
- opening an existing campaign
- reviewing campaign history and section progression
- previewing generated sections
- locking canon
- applying overrides
- managing read-ahead content

### `/play`

Shared runtime play surface used when a section is actively being run at the table.

Use this route for:

- player token movement
- fog/reveal
- chat
- dice
- drawings
- map interaction

This surface should be fed by DunGEN state when the active session is running procedural content.

### Future flexibility

If DunGEN becomes the primary product direction later:

- `/` can point to DunGEN first
- classic uploaded maps can become a secondary manual mode

## Recommended User Flow

### 1. Enter DunGEN

GM opens `/DunGEN`.

The landing screen shows:

- create campaign
- resume campaign
- import seed or campaign state
- recent campaigns

### 2. Create Campaign

GM chooses:

- world seed
- campaign goal
- tone profile
- difficulty model
- starting section or starter village

System creates:

- campaign config
- starting section in preview
- adjacent preview stubs

### 3. Prep In Campaign Hub

GM works primarily in a campaign hub view.

The hub should show:

- current section preview
- room list
- biome and layout data
- exits and adjacent previews
- settlement/shop/NPC summaries
- reroll and lock controls
- campaign history and discovered canon

This is the core DunGEN surface.

### 4. Launch Active Section To Table

When ready, the GM runs the section in the play shell.

That should:

- set the active section for the session
- adapt generated section render data into the play surface
- make the runtime table tools available without exposing the GM prep surface to players

### 5. Run Session

Players interact with generated content through the play shell.

GM can:

- reveal rooms and areas
- inspect section and room data
- spawn suggested tokens
- track outcomes
- preview adjacent content privately

Locked content persists.

### 6. Return To Campaign Hub

Between sessions, the GM returns to `/DunGEN` to:

- inspect history
- review locked canon
- prep next sections
- manage overrides
- continue campaign progression

## Shared Asset Design

Shared assets should exist independently from sessions and campaigns.

Campaigns should reference assets, not own copies.

### Asset rules

- assets are global
- assets are content-addressed
- assets are reused across campaigns and sessions
- asset generation never blocks play
- preview content should not automatically generate assets

### Asset identity

Each generated asset should resolve from a stable fingerprint derived from canonical content inputs such as:

- family or species ID
- variant IDs
- biome context
- visual descriptor payload
- prompt template version

If two campaigns produce the same canonical visual identity, they should reuse the same asset.

### Asset timing

Recommended policy:

- automatically generate missing assets only for locked content
- do not auto-generate for preview rooms or preview sections

### Fallback behavior

If an asset does not exist yet:

- use a placeholder token or icon
- allow play to continue
- let generation complete asynchronously

## Architectural Split

### DunGEN domain

Owns:

- campaign config
- world graph
- section generation
- room state
- NPC/shop/encounter content
- campaign history
- GM overrides
- shared asset references

### Play shell

Owns:

- rendering active section content
- token interaction
- fog/reveal
- chat
- dice
- drawings
- player-facing runtime controls

### Integration layer

Owns:

- adapting canonical DunGEN state into runtime map payloads
- binding content entities to tokens
- syncing runtime outcomes back into persistent campaign state

## Non-Goals

These should not constrain the initial DunGEN design:

- preserving the current uploaded-map-first GM workflow
- forcing DunGEN concepts into old `maps` abstractions
- making generic dice UI the permanent answer for all content-driven interactions
- generating art for every preview artifact

## Implementation Implications

1. DunGEN should start on its own route and UI shell.
2. The initial plan should keep classic map mode working, but not treat it as the center of the new architecture.
3. Persistence should model campaigns and sections directly, not just image-backed maps.
4. Shared asset caching belongs in v1 schema design even if automated image generation is a v2 capability.
5. The first playable slice should prove:
   - campaign creation
   - section preview and lock
   - launch into play shell
   - persistent history
   - shared asset references
