import { describe, expect, it } from 'vitest';
import { generateSection } from '../engine/sectionGenerator';
import {
  generateSectionContent,
  getNextContentRerollState,
} from '../engine/sectionContentGenerator';

describe('sectionContentGenerator', () => {
  it('returns deterministic content for the same section and reroll state', () => {
    const section = generateSection({
      worldSeed: 'starter_hub_seed',
      sectionId: 'section_hometown',
      sectionKind: 'settlement',
    });

    const first = generateSectionContent({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });
    const second = generateSectionContent({
      section,
      sectionName: 'Hometown',
      settlementArchetypeId: 'waystop',
    });

    expect(second).toEqual(first);
  });

  it('builds a useful starter village campaign-book payload', () => {
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

    expect(content.settlementArchetypeId).toBe('waystop');
    expect(content.npcs.length).toBeGreaterThanOrEqual(3);
    expect(content.shops.length).toBeGreaterThanOrEqual(2);
    expect(content.rumors.length).toBeGreaterThan(0);
    expect(content.hooks.length).toBeGreaterThan(0);
    expect(content.encounters.length).toBeGreaterThan(0);
    expect(content.shops[0]?.description.length).toBeGreaterThan(20);
    expect(content.shops[0]?.pressure.length).toBeGreaterThan(20);
    expect(content.encounters[0]?.detail.length).toBeGreaterThan(40);
  });

  it('builds exploration preview content from biome threats and hazards', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_preview_001',
      sectionKind: 'exploration',
    });

    const content = generateSectionContent({
      section,
      sectionName: 'East Road',
    });

    expect(content.creatures.length).toBeGreaterThan(0);
    expect(content.encounters.length).toBeGreaterThan(0);
    expect(content.hooks.length).toBeGreaterThan(0);
    expect(content.biomeName.length).toBeGreaterThan(0);
  });

  it('resolves creature family and variant details from deterministic content packs', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_preview_001',
      sectionKind: 'exploration',
    });

    const content = generateSectionContent({
      section,
      sectionName: 'East Road',
    });

    const creature = content.creatures[0];

    expect(creature).toMatchObject({
      familyId: expect.any(String),
      origin: expect.any(String),
      sizeClass: expect.any(String),
      intelligence: expect.any(String),
      societyLevel: expect.any(String),
      base5eAnalog: expect.any(String),
      visualKeywords: expect.any(Array),
      signatureTraits: expect.any(Array),
      lootTags: expect.any(Array),
      variantIds: expect.any(Array),
      variantNames: expect.any(Array),
      behaviorAdjustments: expect.any(Array),
      resolvedStats: {
        ac: expect.any(Number),
        hp: expect.any(Number),
        speed: expect.any(Number),
        cr: expect.any(Number),
        abilities: {
          str: expect.any(Number),
          dex: expect.any(Number),
          con: expect.any(Number),
          int: expect.any(Number),
          wis: expect.any(Number),
          cha: expect.any(Number),
        },
      },
      actions: expect.any(Array),
      traits: expect.any(Array),
    });
    expect(creature.visualKeywords.length).toBeGreaterThan(0);
    expect(creature.signatureTraits.length).toBeGreaterThan(0);
    expect(creature.variantIds.length).toBeGreaterThan(0);
    expect(creature.variantNames.length).toBe(creature.variantIds.length);
    expect(creature.actions.length).toBeGreaterThan(0);
  });

  it('changes only the targeted content slice when rerolling', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_preview_001',
      sectionKind: 'exploration',
    });

    const base = generateSectionContent({
      section,
      sectionName: 'East Road',
    });
    const rerolled = generateSectionContent({
      section,
      sectionName: 'East Road',
      rerollState: getNextContentRerollState(undefined, 'creatures'),
    });

    expect(rerolled.creatures).not.toEqual(base.creatures);
    expect(rerolled.encounters).toEqual(base.encounters);
    expect(rerolled.shops).toEqual(base.shops);
    expect(rerolled.rumors).toEqual(base.rumors);
    expect(rerolled.hooks).toEqual(base.hooks);
  });

  it('sources shop, rumor, encounter, and hook wording from content packs', () => {
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

    expect(content.shops.some((shop) => /common room|trade room|treatment space|route-minded/i.test(shop.description))).toBe(true);
    expect(content.encounters.some((encounter) => /social pressure|fixed fight|party can engage/i.test(encounter.detail))).toBe(true);
    expect(content.rumors.some((rumor) => /expedition talk|fresh signs|waystop|guide|merchant|watchman|guard|innkeeper/i.test(rumor.source))).toBe(true);
    expect(content.hooks.some((hook) => /single right answer|background tension|needs help/i.test(hook.text))).toBe(true);
  });

  it('sources narrative and creature campaign-book wording from deterministic content packs', () => {
    const section = generateSection({
      worldSeed: 'world_ironbell_042',
      sectionId: 'section_preview_001',
      sectionKind: 'exploration',
    });

    const content = generateSectionContent({
      section,
      sectionName: 'East Road',
    });

    expect(
      content.campaignBook.entries.some((entry) =>
        /Opening atmosphere that stays flexible for the GM\./i.test(entry.summary ?? '')
      )
    ).toBe(true);
    expect(
      content.campaignBook.entries.some((entry) =>
        /suggested through signs, sounds|environmental damage, leftovers|treated as a problem people plan around/i.test(
          entry.body
        )
      )
    ).toBe(true);
  });
});
