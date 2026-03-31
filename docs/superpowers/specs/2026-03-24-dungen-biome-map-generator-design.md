# DunGEN Biome Map Generator Design

## Goal

Define the next DunGEN map-generation phase around biome-specific layout profiles, settlement livability rules, and JSON-configured floor-material resolution so the main player-facing surface becomes more distinct, more configurable, and ready for asset-backed tiles without locking visual assets into code.

This phase intentionally prioritizes:

- biome-specific map identity
- JSON-first generator configuration
- settlement plausibility beyond Hometown
- deterministic floor-material assignment
- Cloudflare R2 asset lookup with clean fallback

This phase intentionally defers:

- wall materials and textured wall rendering
- persistence of generated asset state in Supabase
- a standalone custom map-generator UI
- AI-generated tile art

## Product Position

The map generator is the main player-facing interaction surface.

Because of that, DunGEN maps should not feel like one generic generator with biome labels pasted on top. Different biomes should materially affect:

- how rooms are shaped
- how dense or open a section feels
- how often landmarks appear
- how plausible settlements are
- how floor surfaces are resolved visually

This remains compatible with the permissive tabletop-first model:

- maps communicate space and atmosphere
- maps do not enforce token movement or rules
- assets are presentation, not adjudication

## Core Principles

1. JSON owns deterministic content and configuration  
   If a deterministic generator rule can live in a human-editable pack, it should.
2. Code selects and assembles  
   Code should resolve seeded choices, score livability, assign materials, and assemble regions. It should not hardcode authored biome behavior where JSON can express it.
3. Biome and settlement are separate concerns  
   A biome describes terrain and layout tendencies. Settlement viability describes whether people can plausibly live there and what kind of habitation fits.
4. Material keys, not hardcoded URLs  
   Generated maps should emit semantic floor material keys. The renderer should resolve those keys through a small asset resolver layer.
5. Missing assets must not block play  
   If an R2 tile asset is missing, the map should render with a deterministic fallback material.
6. Visual identity before custom controls  
   The generator should become meaningfully expressive before exposing a GM-facing custom map-generator UI.

## Recommended Approach

### Recommended

Split this phase into three coordinated systems:

- biome generation profiles
- settlement and livability profiles
- floor-material and transition profiles with asset resolution

This keeps generation logic, habitation plausibility, and visual asset lookup cleanly separated.

### Not recommended for this phase

- one giant biome file containing every generation and asset rule
- direct client construction of R2 URLs from arbitrary content fields
- wall material rendering in the same pass

## System Overview

### 1. Biome generation profiles

Biomes should drive map shape and layout feel.

Each biome profile should be able to control:

- allowed room primitive families
- primitive density
- corridor and junction tendencies
- openness ratio
- room-size tendencies
- landmark frequency
- clutter pressure
- hazard pressure
- settlement pressure

This should let an ice biome, fungal biome, forge biome, archive biome, or garden biome produce visibly different geometry without requiring one-off code branches for every case.

### 2. Settlement and livability profiles

Settlement viability should not be hardcoded as “Hometown only.”

Deeper world sections should sometimes resolve to:

- safe village
- waystation
- hidden enclave
- shrine hamlet
- salvage town
- fortified hold
- or no settlement at all

This should come from a deterministic livability score, not from ad hoc exceptions.

Low-livability sections should still be able to generate non-settlement people such as:

- hermits
- delvers
- stranded travelers
- rival adventurers
- shrine keepers
- patrols

### 3. Floor-material profiles and resolver

Generated sections should emit floor material keys for:

- base floor surfaces
- landmark surfaces
- settlement surfaces
- transition surfaces between materials

The renderer should then ask a resolver for a URL, not try to know storage layout directly.

This allows:

- predictable R2 uploads later
- local fallback immediately
- future material growth without generator rewrites

## JSON Configuration Model

### Biome generation profiles

Add:

- `DunGEN/biome_generation_profiles.json`

Each entry should use a normalized root:

```json
{
  "entries": []
}
```

Each biome entry should include fields like:

- `id`
- `label`
- `allowed_section_kinds`
- `allowed_room_primitive_ids`
- `room_primitive_density`
- `allowed_corridor_primitive_ids`
- `corridor_density`
- `junction_density`
- `open_space_ratio`
- `landmark_frequency`
- `hazard_pressure`
- `settlement_pressure`
- `default_floor_material_key`
- `alternate_floor_material_keys`

The exact field list can evolve, but the schema should remain normalized and uniform across entries.

### Settlement generation profiles

Add:

- `DunGEN/settlement_generation_profiles.json`

Each entry should describe habitation types, not terrain.

Fields should include:

- `id`
- `label`
- `allowed_biomes`
- `water_support`
- `food_support`
- `safety_modifier`
- `route_centrality_modifier`
- `open_space_preference`
- `primitive_preferences`
- `minimum_livability_score`
- `npc_role_weights`
- `shop_type_weights`
- `default_floor_material_key`

This keeps settlement plausibility and layout tendency editable in JSON.

### Floor material profiles

Add:

- `DunGEN/floor_material_profiles.json`

Each entry should define a semantic floor material key, not an asset URL.

Fields should include:

- `id`
- `label`
- `category`
- `fallback_material_key`
- `asset_path`
- `variant_asset_paths`
- `supports_tiling`

Examples:

- `cobblestone`
- `dungeon_stone`
- `ice_floor`
- `wood_planks`
- `messy_stone`
- `carpet_red`

### Floor transition profiles

Add:

- `DunGEN/floor_transition_profiles.json`

Fields should include:

- `id`
- `from_material_key`
- `to_material_key`
- `asset_path`
- `fallback_material_key`

Examples:

- `ice_to_stone`
- `stone_to_carpet`
- `wood_to_messy_stone`

## Generator Behavior

### Section profile resolution

Before layout generation, the engine should resolve a section profile from seeded inputs:

- world seed
- section coordinates
- graph depth
- section kind candidate
- biome generation profile
- settlement/livability profile candidate

This should determine:

- whether the section is exploration or settlement
- which primitive families are favored
- how open or dense the section should feel
- what floor material family it prefers

### Primitive density

Primitive selection should not only be constrained by allowlists.

It should also use density weighting so a biome can favor:

- lots of compact primitives
- sparse large chambers
- many connecting halls
- more junction-heavy networks
- more plazas or open settlements

This is important because “allowed primitives” alone does not sufficiently shape the output.

### Settlement livability

Downstream settlement generation should use a deterministic livability score derived from:

- biome support
- water support
- food support
- safety pressure
- route centrality
- openness
- local hazard load

Possible outcomes:

- full settlement section
- minor habitation or refuge
- no settlement

This should allow safe villages deeper in the world without making dangerous biomes feel implausibly civilized.

### Exploration inhabitants

When livability is too low for a settlement, exploration sections should still be able to generate one-off people such as:

- hermits
- travelers
- delvers
- patrols
- stranded merchants
- caretakers

This should remain separate from full settlement generation.

## Asset Resolver Layer

### Recommended architecture

Use an app-controlled asset resolver layer.

The generator emits material keys only.
The renderer asks the resolver for a URL.

The resolver should:

- map floor material keys to predictable R2 public paths
- map transition keys to predictable R2 public paths
- return fallback material URLs when an asset is missing
- isolate storage path conventions from generator logic

### Recommended naming pattern

Predictable R2 object paths should look like:

- `tiles/floors/<material_key>.png`
- `tiles/transitions/<transition_key>.png`

Examples:

- `tiles/floors/ice_floor.png`
- `tiles/floors/dungeon_stone.png`
- `tiles/floors/wood_planks.png`
- `tiles/transitions/ice_to_stone.png`

This makes it possible to upload assets later and have them begin resolving immediately without code changes.

### Fallback behavior

If a requested material or transition tile does not exist in R2:

- resolver returns the configured fallback material
- renderer still produces a usable map
- missing assets should never block generation or play

## Renderer Integration

This phase should support floor materials only.

Generated map payloads should carry:

- floor material keys for room and corridor regions
- transition material keys where a floor transition is appropriate

Walls should remain:

- black outlines
- shape-driven
- texture-free in v1

This avoids mixing two substantial rendering changes into one phase.

## UI and Tooling Implications

This phase should prepare for, but not yet implement, a future custom map-generator tool.

The future generator UI will be much more useful once these systems exist because controls like:

- biome
- primitive density
- openness
- room count
- corridor width
- settlement probability

will then act on a generator that already has meaningful biome identity.

## Testing Strategy

### Generator tests

Add deterministic tests proving:

- same seed + same JSON packs => same section profile
- different biome profiles produce measurably different primitive tendencies
- primitive density affects selected room families
- livability scoring can produce downstream settlements beyond Hometown

### Resolver tests

Add tests proving:

- material key resolves to predictable R2 path
- missing material key falls back correctly
- transition key resolves independently of base material lookup

### Rendering tests

Add tests proving:

- generated map payload includes floor material keys
- transition keys appear where configured
- fallback rendering still works when no asset exists

## Implementation Order

1. Add normalized JSON packs for biome, settlement, floor material, and transition profiles.
2. Extend content loading, normalization, and shared types for the new packs.
3. Add deterministic section-profile resolution and livability scoring.
4. Thread resolved profile data into section generation and room placement.
5. Add floor-material assignment and transition-key assignment to generated map payloads.
6. Add the asset resolver layer for predictable Cloudflare R2 paths with fallback.
7. Keep renderer floor-only for this phase while walls remain outline-based.

## Success Criteria

This phase is successful when:

- different biomes produce visibly different map structure
- downstream safe villages or enclaves can appear deterministically
- exploration sections can still contain non-settlement inhabitants
- floor materials are configured in JSON, not hardcoded
- floor assets can be uploaded later to predictable R2 paths and resolve automatically
- missing assets gracefully fall back without breaking play

