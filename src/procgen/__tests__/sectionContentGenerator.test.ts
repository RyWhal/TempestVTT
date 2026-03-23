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
});
