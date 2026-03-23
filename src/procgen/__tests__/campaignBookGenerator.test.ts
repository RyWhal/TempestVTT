import { describe, expect, it } from 'vitest';
import { generateCampaignBook } from '../engine/campaignBookGenerator';
import { generateSectionContent } from '../engine/sectionContentGenerator';
import { generateSection } from '../engine/sectionGenerator';
import {
  CAMPAIGN_BOOK_ENTRY_TYPES,
  type GeneratedCampaignBook,
  type GeneratedCampaignBookEntry,
  type GeneratedNpcAppearance,
  type GeneratedNpcEntity,
} from '../types';

const EXPECTED_ENTRY_TYPES = [
  'read_aloud_intro',
  'area_impression',
  'room_scene',
  'npc_profile',
  'npc_roleplay_note',
  'encounter_seed',
  'creature_seed',
  'shop_seed',
  'item_seed',
  'hazard_seed',
  'hook_seed',
] as const;

const expectSuggestiveBody = (body: string) => {
  expect(body.length).toBeGreaterThan(40);
  expect(body.toLowerCase()).toMatch(/\b(can|could|might|may|possible|perhaps|suggests?)\b/);
};

describe('campaignBookGenerator', () => {
  it('supports canonical campaign-book entry types, statuses, and persistent NPC separation', () => {
    expect(CAMPAIGN_BOOK_ENTRY_TYPES).toEqual(EXPECTED_ENTRY_TYPES);

    const entries: GeneratedCampaignBookEntry[] = [
      {
        id: 'entry_001',
        sectionId: 'section_hometown',
        type: 'read_aloud_intro',
        title: 'Arrival at the gate',
        body: 'The road narrows toward the settlement gate.',
        summary: 'Opening read-aloud text',
        status: 'suggested',
        tags: ['intro'],
        relatedRoomIds: [],
        relatedNpcIds: [],
        relatedCreatureIds: [],
        relatedShopIds: [],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_002',
        sectionId: 'section_hometown',
        type: 'area_impression',
        title: 'First impression',
        body: 'The area could feel watchful before anyone speaks plainly.',
        summary: 'A flexible first look',
        status: 'suggested',
        tags: ['narrative'],
        relatedRoomIds: ['room_01'],
        relatedNpcIds: [],
        relatedCreatureIds: [],
        relatedShopIds: [],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_003',
        sectionId: 'section_hometown',
        type: 'npc_profile',
        title: 'The innkeeper',
        body: 'A careful keeper of secrets watches the road.',
        summary: 'A guarded local contact',
        status: 'accepted',
        tags: ['npc', 'hook'],
        relatedRoomIds: ['room_01'],
        relatedNpcIds: ['npc_001'],
        relatedCreatureIds: [],
        relatedShopIds: ['shop_001'],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_004',
        sectionId: 'section_hometown',
        type: 'npc_roleplay_note',
        title: 'How to play Mara',
        body: 'Mara might answer directly when trust is earned and hedge when it is not.',
        summary: 'Roleplay tone',
        status: 'suggested',
        tags: ['npc', 'roleplay'],
        relatedRoomIds: [],
        relatedNpcIds: ['npc_001'],
        relatedCreatureIds: [],
        relatedShopIds: ['shop_001'],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_005',
        sectionId: 'section_hometown',
        type: 'encounter_seed',
        title: 'Roadside trouble',
        body: 'A tense scene can unfold near the road or gate.',
        summary: 'A possible encounter beat',
        status: 'crossed_out',
        tags: ['encounter'],
        relatedRoomIds: ['room_02'],
        relatedNpcIds: [],
        relatedCreatureIds: ['creature_001'],
        relatedShopIds: [],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_006',
        sectionId: 'section_hometown',
        type: 'creature_seed',
        title: 'Tracks beyond town',
        body: 'A creature sign might imply pressure without fixing exactly where it appears.',
        summary: 'Creature pressure',
        status: 'suggested',
        tags: ['creature'],
        relatedRoomIds: [],
        relatedNpcIds: [],
        relatedCreatureIds: ['creature_001'],
        relatedShopIds: [],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_007',
        sectionId: 'section_hometown',
        type: 'shop_seed',
        title: 'General store',
        body: 'A useful place for travel supplies and local gossip.',
        summary: 'A shop hook',
        status: 'gm_added',
        tags: ['shop'],
        relatedRoomIds: ['room_03'],
        relatedNpcIds: ['npc_001'],
        relatedCreatureIds: [],
        relatedShopIds: ['shop_001'],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_008',
        sectionId: 'section_hometown',
        type: 'item_seed',
        title: 'Worn charm',
        body: 'A small object that hints at local history.',
        summary: 'A notable item',
        status: 'suggested',
        tags: ['item'],
        relatedRoomIds: [],
        relatedNpcIds: [],
        relatedCreatureIds: [],
        relatedShopIds: [],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_009',
        sectionId: 'section_hometown',
        type: 'hazard_seed',
        title: 'Local danger',
        body: 'A hazard could complicate travel or trade without fixing a single outcome.',
        summary: 'Hazard pressure',
        status: 'suggested',
        tags: ['hazard'],
        relatedRoomIds: [],
        relatedNpcIds: [],
        relatedCreatureIds: [],
        relatedShopIds: [],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
      {
        id: 'entry_010',
        sectionId: 'section_hometown',
        type: 'hook_seed',
        title: 'A whispered request',
        body: 'Someone in town needs discreet help.',
        summary: 'A story hook',
        status: 'accepted',
        tags: ['hook'],
        relatedRoomIds: [],
        relatedNpcIds: ['npc_001'],
        relatedCreatureIds: [],
        relatedShopIds: [],
        provenance: {
          biomeId: 'waystop',
          sectionSeed: 'world_seed_001',
        },
      },
    ];

    const npc: GeneratedNpcEntity = {
      id: 'npc_001',
      name: 'Mara',
      roleId: 'innkeeper',
      roleName: 'Innkeeper',
      baselineBackstory: 'Keeps the only inn in town running through hard winters.',
      appearanceSummary: 'Looks like someone who has spent years reading trouble before it reaches the door.',
      personality: 'Measured and cautious',
      voice: 'Low and careful',
      mannerisms: ['watches the door', 'cleans the same glass while thinking'],
      motivations: ['Protect the inn', 'Learn who is asking questions'],
      secrets: ['Knows about a hidden cellar passage'],
      rumorKnowledge: ['The road has gone quiet after dark'],
      knownFor: ['keeping the inn intact', 'remembering who owes what'],
      currentDisposition: 'friendly',
      factionId: null,
      shopId: 'shop_001',
    };

    const appearance: GeneratedNpcAppearance = {
      id: 'appearance_001',
      sectionId: 'section_hometown',
      npcId: 'npc_001',
      context: 'At the inn counter',
      roleInSection: 'Greets the party and gauges their intent',
      wantsFromPlayers: 'A missing delivery key',
      framing: 'Tired but observant',
      knows: ['The cellar passage is still usable'],
      needs: ['The missing key returned quietly'],
      offers: ['A warm meal and guarded directions'],
    };

    const book: GeneratedCampaignBook = {
      sectionId: 'section_hometown',
      entries,
      persistentNpcs: [npc],
      npcAppearances: [appearance],
    };

    expect(book.entries.map((entry) => entry.type)).toEqual([
      'read_aloud_intro',
      'area_impression',
      'npc_profile',
      'npc_roleplay_note',
      'encounter_seed',
      'creature_seed',
      'shop_seed',
      'item_seed',
      'hazard_seed',
      'hook_seed',
    ]);
    expect(book.entries.map((entry) => entry.status)).toEqual([
      'suggested',
      'suggested',
      'accepted',
      'suggested',
      'crossed_out',
      'suggested',
      'gm_added',
      'suggested',
      'suggested',
      'accepted',
    ]);
    expect(book.persistentNpcs[0]).toMatchObject({ id: 'npc_001', name: 'Mara' });
    expect(book.npcAppearances[0]).toMatchObject({
      npcId: 'npc_001',
      sectionId: 'section_hometown',
      needs: ['The missing key returned quietly'],
    });
  });

  it('generates deterministic structured entries for settlement sections', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });
    const content = generateSectionContent({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });

    const first = generateCampaignBook({
      section,
      sectionName: 'Hometown',
      content,
    });
    const second = generateCampaignBook({
      section,
      sectionName: 'Hometown',
      content,
    });

    expect(second).toEqual(first);
    expect(content.campaignBook).toEqual(first);
    expect(first.sectionId).toBe(section.sectionId);
    expect(first.persistentNpcs).toEqual(content.npcEntities);
    expect(first.npcAppearances).toEqual(content.npcAppearances);
    expect(first.entries.every((entry) => entry.status === 'suggested')).toBe(true);
    expect(new Set(first.entries.map((entry) => entry.id)).size).toBe(first.entries.length);

    const types = new Set(first.entries.map((entry) => entry.type));
    for (const type of [
      'read_aloud_intro',
      'area_impression',
      'npc_profile',
      'npc_roleplay_note',
      'encounter_seed',
      'creature_seed',
      'shop_seed',
      'hazard_seed',
      'hook_seed',
    ] as const) {
      expect(types.has(type)).toBe(true);
    }

    expect(first.entries.filter((entry) => entry.type === 'read_aloud_intro')).toHaveLength(1);
    expect(first.entries.filter((entry) => entry.type === 'area_impression').length).toBeGreaterThanOrEqual(1);
    expect(first.entries.filter((entry) => entry.type === 'npc_profile').length).toBe(content.npcEntities.length);
    expect(first.entries.filter((entry) => entry.type === 'npc_roleplay_note').length).toBe(
      content.npcAppearances.length
    );

    for (const entry of first.entries) {
      expectSuggestiveBody(entry.body);
    }
  });

  it('keeps exploration campaign-book prose suggestive instead of room canon', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_preview_001',
      sectionKind: 'exploration',
    });
    const content = generateSectionContent({
      section,
      sectionName: 'East Road',
    });

    const book = content.campaignBook;
    const types = new Set(book.entries.map((entry) => entry.type));

    expect(types.has('read_aloud_intro')).toBe(true);
    expect(types.has('area_impression')).toBe(true);
    expect(types.has('encounter_seed')).toBe(true);
    expect(types.has('creature_seed')).toBe(true);
    expect(types.has('hazard_seed')).toBe(true);
    expect(types.has('hook_seed')).toBe(true);
    expect(types.has('npc_profile')).toBe(false);
    expect(types.has('shop_seed')).toBe(false);

    for (const entry of book.entries) {
      expect(entry.status).toBe('suggested');
      expect(entry.body.toLowerCase()).not.toMatch(/\bcontains\b/);
      expect(entry.body.toLowerCase()).not.toMatch(/\bis home to\b/);
      expectSuggestiveBody(entry.body);
    }
  });

  it('avoids repetitive npc profile phrasing in generated settlement prose', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });
    const content = generateSectionContent({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });

    const npcProfiles = content.campaignBook.entries.filter((entry) => entry.type === 'npc_profile');

    expect(npcProfiles.length).toBeGreaterThan(0);
    for (const entry of npcProfiles) {
      expect(entry.body.toLowerCase()).not.toContain('looking like someone who looks like');
      expect(entry.body.toLowerCase()).not.toContain('could come across as');
      expect(entry.body.toLowerCase()).not.toContain('steady;');
    }
  });

  it('avoids title-as-energy roleplay notes for npc guidance', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });
    const content = generateSectionContent({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });

    const roleplayNotes = content.campaignBook.entries.filter(
      (entry) => entry.type === 'npc_roleplay_note'
    );

    expect(roleplayNotes.length).toBeGreaterThan(0);
    for (const entry of roleplayNotes) {
      expect(entry.body.toLowerCase()).not.toContain(' energy');
      expect(entry.body.toLowerCase()).not.toContain('sounding like someone who innkeeper');
      expect(entry.body.toLowerCase()).not.toContain('sounding like someone who merchant');
      expect(entry.body.toLowerCase()).not.toContain('sounding like someone who watchman');
    }
  });
});
