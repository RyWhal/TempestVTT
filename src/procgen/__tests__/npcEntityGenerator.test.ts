import { describe, expect, it } from 'vitest';
import { generateSection } from '../engine/sectionGenerator';
import { generateSectionContent, getNextContentRerollState } from '../engine/sectionContentGenerator';
import { generateNpcEntities } from '../engine/npcEntityGenerator';

const serializeNonNpcSlices = (content: ReturnType<typeof generateSectionContent>) =>
  JSON.stringify({
    summary: content.summary,
    shops: content.shops,
    rumors: content.rumors,
    encounters: content.encounters,
  });

describe('npcEntityGenerator', () => {
  it('creates stable settlement NPC entities, summaries, and section appearances', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });

    const first = generateNpcEntities({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });
    const second = generateNpcEntities({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });

    expect(second).toEqual(first);
    expect(first.npcs.length).toBeGreaterThanOrEqual(3);
    expect(first.npcEntities.length).toBe(first.npcs.length);
    expect(first.npcAppearances.length).toBe(first.npcEntities.length);
    expect(first.npcEntities[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      roleId: expect.any(String),
      roleName: expect.any(String),
      baselineBackstory: expect.any(String),
      appearanceSummary: expect.any(String),
      personality: expect.any(String),
      voice: expect.any(String),
      mannerisms: expect.any(Array),
      knownFor: expect.any(Array),
    });
    expect(first.npcEntities[0]?.id).not.toBe('npc_1');
    expect(first.npcAppearances[0]).toMatchObject({
      sectionId: 'section_hometown',
      npcId: first.npcEntities[0]?.id,
      knows: expect.any(Array),
      needs: expect.any(Array),
      offers: expect.any(Array),
    });
    expect(first.npcEntities[0]?.appearanceSummary.toLowerCase()).not.toContain('someone who');
    expect(first.npcEntities[0]?.appearanceSummary.toLowerCase()).not.toContain(
      'the unmistakable bearing'
    );

    const otherSection = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown_2',
      sectionKind: 'settlement',
    });
    const other = generateNpcEntities({
      section: otherSection,
      sectionName: 'Hometown East',
      settlementArchetypeId: 'waystop',
    });

    expect(other.npcEntities[0]?.id).not.toBe(first.npcEntities[0]?.id);
  });

  it('adds settlement npc entities and appearances without removing the flat npc summaries', () => {
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

    expect(content.npcs.length).toBeGreaterThan(0);
    expect(content.npcEntities.length).toBe(content.npcs.length);
    expect(content.npcAppearances.length).toBe(content.npcs.length);
    expect(content.npcEntities[0]?.id).toBe(content.npcs[0]?.id);
    expect(content.npcAppearances[0]?.npcId).toBe(content.npcEntities[0]?.id);
  });

  it('keeps canonical npc ids collision-free when archetype role pools overlap', () => {
    for (let index = 0; index < 12; index += 1) {
      const section = generateSection({
        worldSeed: `farm_seed_${index}`,
        sectionId: `section_farm_${index}`,
        sectionKind: 'settlement',
      });

      const content = generateNpcEntities({
        section,
        sectionName: `Farm ${index}`,
        settlementArchetypeId: 'farm_enclave_village',
      });

      const ids = content.npcEntities.map((npc) => npc.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('keeps unrelated content slices stable when only npc rerolls change', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });

    const base = generateSectionContent({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });
    const rerolled = generateSectionContent({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
      rerollState: getNextContentRerollState(undefined, 'npcs'),
    });

    expect(rerolled.npcs).not.toEqual(base.npcs);
    expect(rerolled.npcEntities).not.toEqual(base.npcEntities);
    expect(rerolled.summary).toBe(base.summary);
    expect(rerolled.shops).toEqual(base.shops);
    expect(rerolled.rumors).toEqual(base.rumors);
    expect(rerolled.encounters).toEqual(base.encounters);
    expect(rerolled.hazards).toEqual(base.hazards);
    expect(rerolled.creatures).toEqual(base.creatures);

    const rerolledNpcNames = new Set(rerolled.npcs.map((npc) => npc.name));
    const discardedNpcNames = base.npcs
      .map((npc) => npc.name)
      .filter((name) => !rerolledNpcNames.has(name));
    const referencedText = serializeNonNpcSlices(rerolled);

    expect(discardedNpcNames.length).toBeGreaterThan(0);
    for (const name of discardedNpcNames) {
      expect(referencedText).not.toContain(name);
    }
  });

  it('ignores settlement archetype input for exploration sections', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_preview_001',
      sectionKind: 'exploration',
    });

    const content = generateSectionContent({
      section,
      sectionName: 'East Road',
      settlementArchetypeId: 'waystop',
    });

    expect(content.settlementArchetypeId).toBeNull();
    expect(content.settlementArchetypeName).toBeNull();
    expect(content.npcEntities.length).toBeGreaterThan(0);
    expect(content.npcAppearances.length).toBe(content.npcEntities.length);
    expect(content.npcs.length).toBe(content.npcEntities.length);
  });

  it('sources npc physical and roleplay flavor from content packs instead of generic hardcoded prose', () => {
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

    const innkeeper = content.npcEntities.find((npc) => npc.roleId === 'innkeeper');
    const innkeeperAppearance = content.npcAppearances.find(
      (appearance) => appearance.npcId === innkeeper?.id
    );

    expect(innkeeper).toBeTruthy();
    expect(innkeeperAppearance).toBeTruthy();
    expect(innkeeper?.appearanceSummary).toMatch(/thick black apron|cellar keys|room ledger/i);
    expect(innkeeper?.baselineBackstory).toContain('common room');
    expect(innkeeperAppearance?.framing).toContain('steady on the surface');
    expect(innkeeperAppearance?.framing).not.toContain('proves useful');
    expect(innkeeperAppearance?.needs[0]?.toLowerCase()).toContain('common room');
    expect(innkeeperAppearance?.offers[0]?.toLowerCase()).toMatch(/shelter|quiet table|gossip/);
    expect(innkeeperAppearance?.knows[0]?.toLowerCase()).toContain('voices');
  });

  it('resolves anchor templates, tiers, modifiers, and schema-backed output for generated npcs', () => {
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

    const innkeeper = content.npcEntities.find((npc) => npc.roleId === 'innkeeper');
    const guide = content.npcEntities.find((npc) => npc.roleId === 'guide');
    const watchman = content.npcEntities.find((npc) => npc.roleId === 'watchman');

    expect(innkeeper).toMatchObject({
      anchorTemplateId: 'commoner',
      anchorTemplateName: 'Commoner',
      tier: 'incidental',
      settlementType: 'waystop',
      biomeId: section.primaryBiomeId,
      category: 'civil',
      modifierIds: expect.any(Array),
      modifierNames: expect.any(Array),
      resolvedStats: {
        ac: expect.any(Number),
        hp: expect.any(Number),
        hitDice: expect.any(String),
        speed: expect.any(Number),
        abilities: {
          str: expect.any(Number),
          dex: expect.any(Number),
          con: expect.any(Number),
          int: expect.any(Number),
          wis: expect.any(Number),
          cha: expect.any(Number),
        },
        skills: expect.any(Array),
        proficiencyBonus: expect.any(Number),
        cr: expect.any(Number),
      },
      actions: expect.any(Array),
      equipment: expect.any(Array),
      traits: expect.any(Array),
      shortDescription: expect.any(String),
      portraitPrompt: expect.any(String),
      gmNotes: expect.any(String),
    });

    expect(guide?.anchorTemplateId).toBe('scout');
    expect(guide?.tier).toBe('capable');
    expect(guide?.resolvedStats.skills).toEqual(expect.arrayContaining(['Survival']));
    expect(guide?.equipment.join(' ').toLowerCase()).toMatch(/chalk|rope|lantern|route markers/);

    expect(watchman?.anchorTemplateId).toBe('guard');
    expect(watchman?.tier).toBe('capable');
    expect(watchman?.resolvedStats.ac).toBeGreaterThanOrEqual(16);
    expect(watchman?.actions.length).toBeGreaterThan(0);

    expect(innkeeper?.modifierIds.length).toBeGreaterThan(0);
    expect(innkeeper?.modifierNames.length).toBe(innkeeper?.modifierIds.length);
    expect(innkeeper?.portraitPrompt).toContain(innkeeper?.name ?? '');
    expect(innkeeper?.shortDescription).toContain(innkeeper?.roleName ?? '');
    expect(innkeeper?.gmNotes.toLowerCase()).toContain('anchor');
  });
});
