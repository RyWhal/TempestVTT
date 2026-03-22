# Persistent Procedural Dungeon Campaign Mode

This document captures the master spec for adding a persistent procedural dungeon campaign mode to StormlightVTT. It is intended as an in-repo reference for later implementation work.

## Repo Context

As of 2026-03-21, the `DunGEN` folder already contains generated content/config JSON files that align with parts of this spec:

- `biomes.json`
- `creature_variant_modifiers.json`
- `creatures.json`
- `gen_names_phonemes.json`
- `genai_description_schema.json`
- `npc_anchor_templates.json`
- `npc_generation_schema.json`
- `npc_modifiers.json`
- `npc_role_to_anchor_mapping.json`
- `npc_roles.json`
- `village_archetypes.json`

This spec assumes:

- the VTT already has GM login, map display, tokens, chat, dice, and drawing
- the VTT is intentionally rules-light and permissive
- this feature is an extension, not a rewrite
- the generated world is persistent, seeded, and GM-controlled
- a presented map is a Dungeon Section: a cohesive piece of dungeon, usually 1-12 rooms, within a 100x100 tile grid using 5 ft tiles

## 1. Product Definition

### 1.1 Feature Name

Persistent Procedural Dungeon Campaign Mode

### 1.2 Primary Promise

A GM can start a session with little to no prep, reveal new dungeon sections as players explore, preview upcoming content, lock canon when satisfied, and keep the whole world persistent across sessions.

### 1.3 Product Fit

This mode should fit the existing VTT philosophy:

- low friction
- system-agnostic, with D&D 5e as default anchor
- minimal hard enforcement
- GM assistance, not GM replacement
- manual override everywhere

## 2. Core Design Principles

1. Deterministic generation  
   Same world seed + same coordinates/IDs = same generated result until explicitly rerolled.
2. Preview before canon  
   Rooms/sections can exist in preview state before being locked.
3. Persistence after lock  
   Once locked, rooms and sections remain static unless GM deliberately overrides.
4. Composable worldbuilding  
   The system should use curated JSON libraries plus procedural assembly.
5. Geometry separate from meaning  
   Room shape is not room purpose.
6. Map readability first  
   Tactical clarity beats pretty-but-confusing generation.
7. AI as an enhancement layer  
   AI helps with flavor text and portraits, not core map structure.
8. Section-based presentation  
   A single GM-presented map is a Dungeon Section: a biome-cohesive subsection of the endless dungeon.

## 3. High-Level Architecture

### 3.1 Modules

```text
/procgen
  /engine
  /state
  /content
  /map
  /gm
  /ai
  /integration
```

### 3.2 Responsibilities

#### `/engine`

Core deterministic generation logic.

#### `/state`

Persistent world, sections, rooms, entities, overrides, and session state.

#### `/content`

JSON data packs:

- biomes
- creature families
- variants
- NPC roles
- anchors
- village archetypes
- shops
- room templates
- room primitives
- phoneme sets

#### `/map`

Tile painting, wall generation, object placement, room masks, section layout.

#### `/gm`

Preview/lock/reroll tools, hidden notes, read-ahead panel.

#### `/ai`

Optional prompt synthesis for portraits, descriptions, rumors, and flavor.

#### `/integration`

Hooks into the existing VTT map surface, tokens, chat, dice, drawing, and GM UI.

## 4. World Model

### 4.1 World Structure

The endless dungeon is a graph of Dungeon Sections.

```text
Campaign World
  -> Dungeon Graph
    -> Dungeon Section
      -> Room
        -> Encounters / NPCs / Shops / Objects
```

### 4.2 Section Definition

A Dungeon Section is:

- one playable VTT map
- one dominant biome, possibly with edge blending
- 1-12 rooms
- fits inside a 100x100 tile grid
- has at least one entrance and one exit
- stores exact connection coordinates for stitching to adjacent sections

## 5. State Model

### 5.1 Canonical State Layers

#### Generation State

System-owned canonical truth:

- seeds
- biome IDs
- room types
- section graph
- encounter definitions
- shop stock
- village structure

#### Session Presentation State

Table-facing mutable state:

- token positions
- token displayed names
- drawings
- pings
- temporary notes
- current initiative, if any

#### GM Override State

Explicit manual edits:

- room rerolled
- NPC renamed canonically
- shop stock edited
- encounter replaced
- section exit moved
- biome forced

This separation is essential. Without it, the generator and the table UI will fight each other.

## 6. Deterministic Generation Model

### 6.1 Seeds

Required seed levels:

- `world_seed`
- `section_seed`
- `room_seed`
- `entity_seed`
- `name_seed`

Seed derivation rule:

Each child seed should be derived from parent seed + unique stable identifier.

```json
{
  "seed_derivation": {
    "world_seed": "world_ironbell_042",
    "section_seed": "hash(world_seed + section_id)",
    "room_seed": "hash(section_seed + room_id)",
    "entity_seed": "hash(room_seed + entity_id)",
    "name_seed": "hash(entity_seed + phoneme_set_id)"
  }
}
```

### 6.2 Preview/Lock States

Allowed states:

- `unseen`
- `preview`
- `locked`

Once a room or section is locked, it becomes canon.

## 7. Section Generation Model

### 7.1 Section-Level Responsibilities

A section generator must determine:

- section ID
- dominant biome
- secondary biome blend, if any
- section name
- layout type
- room count
- room arrangement in 100x100 tiles
- section entrances/exits
- encounter density
- settlement presence
- primary creature spawn candidates
- NPC/village/shop presence
- previewable adjacent section stubs

### 7.2 Section Constraints

- section size = 100 x 100 tiles
- 1-12 rooms
- at least 1 entrance
- at least 1 exit
- all rooms reachable from entrance
- no orphan rooms
- section graph consistent with dungeon graph
- biome transitions coherent

## 8. Geometry Model

### 8.1 Important Distinction

#### Room Primitive

Pure shape and placement.

#### Room Type

Meaning and gameplay role.

#### Room Instance

An actual placed room in a section.

#### Room Overlays

Special flags such as shop, entrance, exit, boss, settlement, puzzle.

## 9. Required Schema Catalog

This is the exhaustive list of schemas the system should have.

### 9.1 Core World / Campaign Schemas

- `campaign_config.json`
- `campaign_goal_preset.json`
- `world_state.json`
- `dungeon_graph.json`
- `section_stub.json`
- `dungeon_section.json`
- `section_connection.json`

### 9.2 Section/Map Schemas

- `section_layout_preset.json`
- `tile_palette.json`
- `material_set.json`
- `wall_style.json`
- `biome_transition_rule.json`

### 9.3 Room Schemas

- `room_primitives.json`
- `primitive_instance.json`
- `room_type_library.json`
- `room_function_overlay.json`
- `room_instance.json`
- `room_state.json`
- `door_instance.json`

### 9.4 Content Schemas

- `biomes.json`
- `creature_families.json`
- `creature_variants.json`
- `encounter_template.json`
- `npc_anchor_templates.json`
- `npc_role_to_anchor_mapping.json`
- `npc_roles.json`
- `npc_modifiers.json`
- `npc_generation_schema.json`
- `npc_species_overrides.json`
- `village_archetypes.json`
- `village_instance.json`
- `shop_types.json`
- `shop_instance.json`
- `loot_table.json`
- `item_template.json`
- `rumor_fragment.json`
- `motivation_fragment.json`
- `secret_fragment.json`

### 9.5 Naming Schemas

- `name_phonemes.json`
- `name_generation_rules.json`
- `title_suffixes.json`
- `location_naming_rules.json`

### 9.6 Rendering / Object Schemas

- `object_prefab.json`
- `object_cluster.json`
- `placed_object.json`
- `hazard_template.json`
- `hazard_instance.json`
- `lighting_profile.json`
- `atmosphere_profile.json`

### 9.7 AI Support Schemas

- `genai_description_schema.json`
- `portrait_prompt_schema.json`
- `room_flavor_prompt_schema.json`
- `shop_flavor_prompt_schema.json`

### 9.8 State and Override Schemas

- `gm_override_patch.json`
- `session_presentation_state.json`
- `entity_runtime_state.json`
- `token_binding.json`

### 9.9 Integration Schemas

- `map_render_payload.json`
- `gm_panel_payload.json`
- `player_reveal_payload.json`

## 10. Exhaustive Feature Requirements

### 10.1 Campaign Features

- create campaign from seed
- choose campaign goal
- select tone profile
- select difficulty model
- choose starting section or starter village
- export/import seed
- export/import campaign state

### 10.2 GM Features

- reveal unexplored room/section
- preview room
- preview section
- lock room
- lock section
- regenerate room
- regenerate section
- regenerate encounter only
- regenerate NPC only
- regenerate shop stock only
- view hidden notes
- read ahead to adjacent previews
- manually edit canonical data
- move/replace entrances and exits before lock
- attach notes

### 10.3 Player-Facing Features

- see revealed section map
- move tokens
- draw on map
- chat and roll as before
- interact with GM-placed/generated content
- no forced rule automation

### 10.4 Persistence Features

- visited sections persist
- locked rooms persist
- dead creatures remain dead unless GM changes them
- looted containers remain looted
- modified doors remain modified
- shop inventory can persist if GM wants
- session drawings remain presentation-layer only unless saved by GM

## 11. Schema Examples

Below is at least one example JSON for every schema explicitly discussed.

### 11.1 `campaign_config.json`

```json
{
  "campaign_id": "camp_001",
  "name": "The Bloom Beneath",
  "world_seed": "world_ironbell_042",
  "campaign_goal_id": "find_the_center",
  "difficulty_model": "distance_scaled_balanced",
  "tone_profile": {
    "absurdity": 4,
    "horror_frequency": "occasional",
    "default_emotional_mix": ["funny", "tragic", "mysterious"]
  },
  "starting_section_id": "section_start_001",
  "starting_village_id": "village_start_001",
  "system_default": "dnd5e_anchor"
}
```

### 11.2 `dungeon_graph.json`

```json
{
  "dungeon_graph": {
    "nodes": ["section_start_001", "section_002"],
    "edges": [
      {
        "from_section_id": "section_start_001",
        "from_connection_id": "exit_east_01",
        "to_section_id": "section_002",
        "to_connection_id": "entrance_west_01"
      }
    ]
  }
}
```

### 11.3 `dungeon_section.json`

```json
{
  "section_id": "section_start_001",
  "name": "The Blooming Chapel",
  "primary_biome_id": "fungal_warrens",
  "secondary_biome_ids": ["stone_halls"],
  "blend_mode": "gradual",
  "grid": {
    "width": 100,
    "height": 100,
    "tile_size_ft": 5
  },
  "layout_type": "central_hub",
  "flow_type": "hub",
  "room_ids": ["room_001", "room_002", "room_003", "room_004"],
  "entrance_connection_ids": ["entrance_west_01"],
  "exit_connection_ids": ["exit_east_01", "exit_north_01"],
  "settlement_present": false,
  "settlement_id": null,
  "encounter_density": "medium",
  "hazard_density": "medium",
  "state": "preview"
}
```

### 11.4 `section_connection.json`

```json
{
  "connection_id": "exit_east_01",
  "section_id": "section_start_001",
  "room_id": "room_002",
  "kind": "exit",
  "portal_type": "corridor",
  "position": { "x": 92, "y": 51 },
  "connects_to_section_id": "section_002",
  "connects_to_connection_id": "entrance_west_01",
  "is_locked": false
}
```

### 11.5 `biomes.json`

```json
{
  "id": "fungal_warrens",
  "name": "Fungal Warrens",
  "tags": ["organic", "spores", "overgrowth"],
  "description": "Massive fungal blooms overtake the dungeon, glowing softly and releasing drifting spores.",
  "hazards": ["spore clouds", "hallucinogenic effects"],
  "materials": ["fungus", "rotted stone"],
  "common_creatures": ["sporekin", "fungal beasts"],
  "room_shapes": ["rounded chambers", "dense clusters"],
  "settlement_viability": "medium",
  "tone": "strange, alive, slightly unsettling",
  "transitions": ["rootvault", "stone_halls", "slime_cavern"]
}
```

### 11.6 `creature_variants.json`

```json
{
  "id": "glowing",
  "name": "Glowing",
  "stat_adjustments": {
    "stealth_penalty": 2
  },
  "behavior_adjustments": ["attracts_attention"],
  "visual_keywords": ["soft internal glow", "luminous seams", "light leaking from body"]
}
```

### 11.7 `npc_anchor_templates.json`

```json
{
  "id": "guard",
  "name": "Guard",
  "tier": "capable",
  "base_5e_source": "guard",
  "default_cr": 0.125,
  "base_stats": {
    "ac": 16,
    "hp": 11,
    "hit_dice": "2d8+2",
    "speed": 30,
    "abilities": {
      "str": 13,
      "dex": 12,
      "con": 12,
      "int": 10,
      "wis": 11,
      "cha": 10
    },
    "saving_throws": [],
    "skills": ["Perception"],
    "senses": ["passive_perception_11"],
    "languages": ["common"],
    "proficiency_bonus": 2
  },
  "default_actions": [
    {
      "id": "spear_melee",
      "name": "Spear",
      "type": "melee_weapon_attack",
      "to_hit": 3,
      "reach": "5 ft",
      "target": "1 target",
      "damage": "1d6+1 piercing"
    }
  ],
  "default_equipment": ["spear", "shield", "patched chain shirt"]
}
```

### 11.8 `npc_role_to_anchor_mapping.json`

```json
{
  "role_id": "captain",
  "anchor_template_id": "veteran",
  "tier": "seasoned"
}
```

### 11.9 `npc_roles.json`

```json
{
  "id": "guide",
  "name": "Guide",
  "category": "civil",
  "default_anchor_template": "scout",
  "allowed_settlements": ["waystop", "market_den", "beast_tether_hold", "village"],
  "allowed_species_origins": ["remnant", "residual", "native"],
  "common_traits": ["wary", "practical", "superstitious"],
  "common_equipment_overrides": ["chalk", "rope", "lantern", "route markers"],
  "possible_skills": ["Perception", "Stealth", "Survival"],
  "possible_motivations": ["earn enough to retire", "prove a path is safe", "find a missing traveler"],
  "possible_secrets": ["fakes part of their expertise", "abandons clients in bad odds", "knows an illegal shortcut"],
  "possible_rumors": ["someone is moving route markers", "a safe corridor is no longer safe"]
}
```

### 11.10 `npc_modifiers.json`

```json
{
  "id": "routewise",
  "name": "Routewise",
  "category": "background",
  "stat_adjustments": { "wis_bonus": 1 },
  "skill_adjustments": ["Perception", "Survival"],
  "trait_additions": ["knows nearby routes", "remembers landmarks"],
  "social_adjustments": ["practical", "cautious"],
  "visual_keywords": ["chalk marks", "rope loops", "worn travel gear"]
}
```

### 11.11 `npc_generation_schema.json`

```json
{
  "required_inputs": {
    "species_id": "string",
    "species_origin": "enum[remnant,residual,native]",
    "role_id": "string",
    "settlement_type": "string",
    "biome_id": "string",
    "tier_override": "optional string",
    "modifier_ids": "optional array[string]",
    "name_seed": "string or integer",
    "world_seed": "string or integer"
  }
}
```

### 11.12 `name_phonemes.json`

```json
{
  "id": "pinekin",
  "style_tags": ["sweet", "weird", "organic"],
  "onsets": ["p", "pl", "b", "m", "t", "fl"],
  "nuclei": ["a", "e", "i", "o", "u", "ai", "oa"],
  "codas": ["p", "n", "m", "l", "t"],
  "prefixes": ["ju", "pi"],
  "suffixes": ["kin", "fruit"],
  "patterns": ["ON", "ONC", "ON-SUFFIX"]
}
```

### 11.13 `village_archetypes.json`

```json
{
  "id": "waystop",
  "name": "Waystop",
  "summary": "A small route-side settlement built to support travelers, delvers, and caravans moving between safer dungeon regions.",
  "allowed_biomes": ["stone_halls", "waterways", "garden_hold", "farm_enclave", "arcane_halls"],
  "stability": "medium",
  "population_range": [20, 80],
  "required_roles": ["innkeeper", "merchant", "watchman"],
  "common_roles": ["guide", "guard", "healer", "rumor_broker", "scavenger"],
  "shop_types": ["inn", "merchant", "guide_post", "healer", "tinkerer"]
}
```

### 11.14 `shop_types.json`

```json
{
  "id": "smith",
  "name": "Smithy",
  "shop_category": "craft",
  "summary": "A forge or repair shop for weapons, armor, tools, and metal fittings.",
  "common_settlements": ["forge_nook", "salvage_town", "market_den", "village"],
  "required_roles": ["smith"],
  "inventory_categories": ["weapons", "armor", "repair_materials", "tools"],
  "service_offerings": ["weapon repair", "armor patching", "custom fitting", "metal salvage appraisal"],
  "price_level": "moderate_to_high",
  "map_room_preferences": ["forge_room", "workshop", "storehouse"]
}
```

### 11.15 `room_templates.json`

```json
{
  "id": "pillared_hall",
  "name": "Pillared Hall",
  "template_category": "general",
  "geometry_type": "columned_room",
  "layout_tags": ["cover", "sightline_breaks", "ancient"],
  "supported_biomes": ["stone_halls", "arcane_halls", "remnant_court", "library_ruin", "crystal_vault"],
  "common_exits": [2, 3],
  "hazard_capacity": "medium",
  "encounter_density": "high",
  "settlement_suitability": "medium"
}
```

### 11.16 `room_primitives.json`

```json
{
  "id": "rectangle_medium",
  "name": "Rectangle Medium",
  "family": "rectangle",
  "shape_type": "convex",
  "grid_footprint": { "min_w": 14, "max_w": 28, "min_h": 8, "max_h": 16 },
  "supports_rotation": true,
  "wall_mode": "perimeter",
  "door_sides": ["north", "south", "east", "west"],
  "door_capacity": { "north": 3, "south": 3, "east": 2, "west": 2 },
  "supports_centerpiece": true,
  "anchor_points": [
    { "id": "center", "x_pct": 0.5, "y_pct": 0.5 },
    { "id": "front_focus", "x_pct": 0.5, "y_pct": 0.15 }
  ]
}
```

### 11.17 `primitive_instance.json`

```json
{
  "primitive_instance_id": "priminst_001",
  "primitive_id": "rectangle_medium",
  "x": 22,
  "y": 18,
  "w": 20,
  "h": 10,
  "rotation": 0,
  "mirrored": false
}
```

### 11.18 `room_type_library.json`

```json
{
  "room_type_id": "workshop",
  "category": "functional",
  "allowed_primitives": ["rectangle_medium", "rectangle_long", "square_medium", "split_room_dual_chamber"],
  "required_features": ["work_surface"],
  "optional_features": ["storage", "heat_source", "tool_wall", "prototype_table"],
  "common_biomes": ["rustworks", "stone_halls", "control_room", "salvage_town"],
  "encounter_bias": ["social", "craft", "defense"],
  "can_host_shop": true,
  "can_host_settlement": true
}
```

### 11.19 `room_function_overlay.json`

```json
{
  "function_id": "smith_shop",
  "requires_room_type": ["workshop", "forge_room"],
  "shop_type_id": "smith",
  "state_tags": ["occupied", "commercial", "hot"]
}
```

### 11.20 `room_instance.json`

```json
{
  "room_id": "room_003",
  "section_id": "section_start_001",
  "primitive_instance_id": "priminst_001",
  "room_type_id": "workshop",
  "biome_id": "rustworks",
  "biome_mix": ["rustworks", "stone_halls"],
  "function_overlays": ["smith_shop"],
  "state_tags": ["occupied", "cluttered", "warm"],
  "is_shop": true,
  "is_settlement_room": true,
  "is_entrance_room": false,
  "is_exit_room": false,
  "connection_room_ids": ["room_002", "room_004"],
  "door_ids": ["door_001", "door_002"],
  "encounter_id": null,
  "shop_instance_id": "shop_001",
  "notes": "Main smithy for the section village."
}
```

### 11.21 `door_instance.json`

```json
{
  "door_id": "door_001",
  "room_id": "room_003",
  "x": 22,
  "y": 23,
  "kind": "door",
  "state": "closed",
  "connects_to_room_id": "room_002",
  "locked": false,
  "hidden": false,
  "broken": false
}
```

### 11.22 `shop_instance.json`

```json
{
  "shop_id": "shop_001",
  "shop_type_id": "smith",
  "room_id": "room_003",
  "owner_npc_id": "npc_014",
  "inventory_seed": "inv_seed_001",
  "current_stock": [
    { "item_id": "itm_spear_01", "quantity": 3, "price": 5 },
    { "item_id": "itm_shield_01", "quantity": 1, "price": 10 }
  ],
  "service_flags": ["repair", "custom_order"],
  "rumor": "Someone is stealing tempered metal from a nearby forge room.",
  "problem": "Fuel shortage."
}
```

### 11.23 `village_instance.json`

```json
{
  "village_id": "village_start_001",
  "section_id": "section_village_001",
  "archetype_id": "waystop",
  "name": "Bellrest",
  "population": 46,
  "required_npc_ids": ["npc_001", "npc_002", "npc_003"],
  "shop_ids": ["shop_001", "shop_002"],
  "current_problem": "A traveler has gone missing.",
  "rumors": [
    "The east route is being sabotaged.",
    "Someone checked in but never checked out."
  ]
}
```

### 11.24 `object_prefab.json`

```json
{
  "object_prefab_id": "obj_crate_stack",
  "category": "storage",
  "size_tiles": { "w": 2, "h": 2 },
  "blocks_movement": true,
  "blocks_sight": false,
  "supports_rotation": true,
  "visual_tags": ["wood", "stacked", "clutter"],
  "interaction_tags": ["lootable", "breakable"]
}
```

### 11.25 `object_cluster.json`

```json
{
  "cluster_id": "cluster_abandoned_workbench",
  "object_prefab_ids": ["obj_workbench", "obj_tool_rack", "obj_crate_stack"],
  "placement_pattern": "tight_corner",
  "theme_tags": ["workshop", "abandoned"]
}
```

### 11.26 `placed_object.json`

```json
{
  "placed_object_id": "pobj_001",
  "room_id": "room_003",
  "object_prefab_id": "obj_workbench",
  "x": 31,
  "y": 21,
  "rotation": 90,
  "state_tags": ["intact", "occupied_surface"]
}
```

### 11.27 `hazard_template.json`

```json
{
  "hazard_id": "haz_steam_burst",
  "category": "environmental",
  "biomes": ["molten_forge", "control_room"],
  "effect_tags": ["heat", "line_blast"],
  "trigger_mode": "timed_or_manual",
  "severity": "medium"
}
```

### 11.28 `hazard_instance.json`

```json
{
  "hazard_instance_id": "hazinst_001",
  "room_id": "room_006",
  "hazard_id": "haz_steam_burst",
  "tiles": [
    { "x": 41, "y": 12 },
    { "x": 42, "y": 12 },
    { "x": 43, "y": 12 }
  ],
  "active": true
}
```

### 11.29 `genai_description_schema.json`

```json
{
  "template": "{size_phrase} {temperament_phrase} {family_name} from the {biome_name}, {origin_phrase}. It appears as {visual_core}. Notable features include {variant_visuals} and {signature_traits}. The mood is {tone_phrase}. Illustrated fantasy creature portrait, readable silhouette, high detail, clean subject focus, no text, centered composition."
}
```

### 11.30 `gm_override_patch.json`

```json
{
  "override_id": "ovr_001",
  "target_type": "room",
  "target_id": "room_003",
  "patch_type": "replace_shop",
  "author": "gm",
  "applied_at": "2026-03-21T21:00:00Z",
  "payload": {
    "old_shop_type_id": "smith",
    "new_shop_type_id": "tinkerer"
  }
}
```

### 11.31 `session_presentation_state.json`

```json
{
  "section_id": "section_start_001",
  "token_positions": [
    { "token_id": "pc_001", "x": 18, "y": 44 },
    { "token_id": "npc_014_token", "x": 30, "y": 22 }
  ],
  "token_display_names": [
    { "token_id": "npc_014_token", "display_name": "Old Brim" }
  ],
  "drawings": [
    { "stroke_id": "draw_001", "color": "#ff0000", "points": [[12, 14], [13, 15], [14, 16]] }
  ]
}
```

## 12. Generation Pipelines

### 12.1 Campaign Creation Pipeline

1. choose `world_seed`
2. choose campaign goal
3. create starting village/section
4. generate starting section and adjacent preview sections
5. persist campaign config

### 12.2 Section Generation Pipeline

1. derive section seed
2. choose dominant biome
3. choose layout type
4. choose room count
5. pick room primitives
6. place primitive instances within 100x100
7. assign room types
8. assign room biome or biome blend
9. create doors and room graph
10. assign section entrances/exits
11. assign encounters/NPCs/shops/settlement content
12. generate summary and notes
13. store as preview

### 12.3 Room Generation Pipeline

1. choose primitive
2. instantiate bounds and rotation
3. choose room type
4. assign biome
5. apply overlays
6. place hazards
7. place object clusters
8. place doors
9. bind encounter/shop/NPC if needed
10. synthesize flavor

### 12.4 NPC Generation Pipeline

Use the previously defined anchor, role, modifier, and naming system.

1. resolve role
2. validate settlement compatibility
3. resolve 5e anchor
4. apply modifiers
5. generate name from phonemes
6. generate motivation/secret/rumor
7. generate portrait prompt
8. freeze resolved NPC when locked

## 13. Section Layout Rules

### 13.1 Valid Section Layout Types

- `single_chamber`
- `linear_path`
- `branching_paths`
- `central_hub`
- `ring_loop`
- `maze`
- `clustered_rooms`
- `open_field`
- `multi_level_stack`
- `corridor_network`

### 13.2 Placement Rules

- rooms cannot overlap unless explicitly multi-level
- corridors must connect rooms
- all connection coordinates must land on valid floor edge tiles
- at least one path from section entrance to each section exit
- room spacing should allow walls and transitions

## 14. Map Rendering Model

### 14.1 Required Layers

1. floor tiles
2. walls
3. doors and threshold markers
4. object props
5. hazards
6. atmosphere overlays
7. token layer
8. drawing layer

### 14.2 Rendering Inputs

- section room masks
- biome material palette
- placed object list
- door list
- hazard list
- atmosphere profile
- lighting profile
- session presentation state

### 14.3 Tile Generation Model

Primitive mask determines where styled floor tiles are painted.  
Walls derive from primitive perimeter and internal partitions.  
Biome/material set determines visual styling.

## 15. Existing VTT Integration Requirements

### 15.1 Preserve Existing Systems

- chat unchanged
- dice unchanged
- drawing unchanged
- token movement unchanged
- permissive multiplayer interaction unchanged

### 15.2 New Integrations

- map display can accept generated map payload instead of uploaded static map
- token suggestions can be auto-spawned from section content
- GM can still manually add/remove/edit tokens
- generated names should be editable without breaking canonical IDs

### 15.3 Required Distinction

Displayed token name is not the canonical entity ID.

## 16. GM UX Requirements

### 16.1 GM Section Panel

Must show:

- section name
- biome
- layout type
- room list
- section entrances/exits
- adjacent preview sections
- settlement summary
- encounter density
- section notes

### 16.2 GM Room Panel

Must show:

- room type
- primitive
- biome
- overlays
- hazards
- encounter summary
- NPCs present
- shop if any
- reroll controls
- lock controls

### 16.3 Reroll Scopes

- reroll flavor only
- reroll NPC only
- reroll encounter only
- reroll shop stock only
- reroll room contents
- reroll entire room
- reroll section only if section not locked

## 17. Persistence Rules

### 17.1 Lock Behavior

When a room is locked:

- room becomes canonical
- room state persists
- adjacent rooms may auto-generate as preview

When a section is locked:

- section becomes canonical
- section entrance/exit coordinates become canonical
- adjacent sections may auto-generate as preview stubs

### 17.2 Preview Rules

Preview sections/rooms:

- visible to GM
- rerollable
- not yet canon
- may become canon when locked or entered

## 18. AI Integration Rules

### 18.1 Good AI Uses

- creature portrait prompt
- NPC portrait prompt
- shop flavor text
- rumor phrasing
- section summary
- room prose

### 18.2 Bad AI Uses

- core room geometry
- exact tactical maps
- section connectivity logic
- canonical seed derivation

## 19. Missing-but-Required Future Schemas

These were not fully built out above, but the system will need them.

### 19.1 `creature_families.json`

Fields needed:

- creature family ID
- origin
- allowed biomes
- visual keywords
- base 5e analog
- temperament
- default role
- variants allowed
- loot tags
- signature traits

### 19.2 `encounter_template.json`

Fields needed:

- allowed room types
- allowed biomes
- creature composition rules
- NPC/monster mix rules
- hazard synergy
- difficulty band
- spawn positioning rules

### 19.3 `loot_table.json`

Fields needed:

- biome tags
- room tags
- creature tags
- rarity
- consumables
- salvage
- curios
- relics
- equipment
- currency/barter equivalents

### 19.4 `npc_species_overrides.json`

Fields needed:

- species visual overrides
- anatomy notes
- movement notes
- portrait rules
- speech style
- naming phoneme set
- stat deltas if any

### 19.5 `tile_palette.json`

Fields needed:

- biome ID
- floor texture refs
- wall texture refs
- transition tiles
- accent overlays
- prop palette

## 20. Recommended Implementation Order

### Phase 1: Functional Prototype

- seeds
- campaign config
- section schema
- room primitives
- room types
- room instances
- section connections
- tile rendering
- preview/lock
- dungeon graph persistence

### Phase 2: World Richness

- biomes
- village archetypes
- shop types
- NPC anchors/roles/modifiers
- name phonemes
- section settlement generation

### Phase 3: Encounter Richness

- creature families
- variants
- encounter templates
- hazards
- loot tables

### Phase 4: AI Enhancement

- portrait prompts
- room/section flavor synthesis
- shareable seeds
- export/import
- GM override UX polish

## 21. Hard Constraints Codex Should Respect

1. Never merge geometry and semantics into one schema.
2. Never let session token state overwrite canonical world state.
3. Never let AI define room connectivity.
4. Always store exact section entrance/exit coordinates.
5. Always store room biome, even if section has a primary biome.
6. All generated maps must remain readable on a tactical grid.
7. Locked state is canonical unless GM explicitly overrides.

## 22. Final Build Target

The final system should let a GM:

- start a seeded campaign
- reveal a dungeon section
- see 1-12 generated rooms inside a 100x100 grid
- preview exits and adjacent sections
- inspect generated NPCs with 5e-anchor stats
- run shops, villages, ruins, and anomalies
- reroll before locking
- preserve everything once accepted

That aligns with the current VTT, the dungeon-world concept, and the content systems already defined.

## Most Useful Next Step

The most useful next step is turning this into:

- a directory/file plan
- implementation milestones
- starter JSON packs
- and a first-pass Python or TypeScript engine skeleton
