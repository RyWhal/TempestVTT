import type {
  GeneratedSection,
  GeneratedSectionContent,
  GeneratedSectionNarrative,
  GeneratedSectionNarrativeBeat,
  SectionNarrativeFragment,
} from '../types';
import { contentRegistry } from '../content/contentRegistry';
import { createSeededRandom, hashString } from './seed';

interface GenerateSectionNarrativeInput {
  section: GeneratedSection;
  sectionName: string;
  content: Pick<
    GeneratedSectionContent,
    'biomeName' | 'tone' | 'summary' | 'biomeDescription' | 'hazards' | 'encounters' | 'creatures'
  >;
}

const pickOne = <T>(items: T[], nextRandom: () => number, fallback: T): T => {
  if (items.length === 0) {
    return fallback;
  }

  return items[Math.floor(nextRandom() * items.length)] ?? fallback;
};

const matchesAllowedValues = (value: unknown, candidate: string | null) => {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  if (!candidate) {
    return false;
  }

  return value.includes(candidate);
};

const matchesNarrativeContext = (
  entry: Record<string, unknown>,
  context: { sectionKind: string; biomeId: string }
) =>
  matchesAllowedValues(entry.allowed_section_kinds, context.sectionKind) &&
  matchesAllowedValues(entry.allowed_biomes, context.biomeId);

const pickNarrativeEntry = (
  entries: SectionNarrativeFragment[],
  category: string,
  context: { sectionKind: string; biomeId: string },
  nextRandom: () => number
) => {
  const categoryEntries = entries.filter((entry) => entry.category === category);
  const matching = categoryEntries.filter((entry) => matchesNarrativeContext(entry, context));
  return pickOne(matching, nextRandom, categoryEntries[0] ?? entries[0]);
};

const applyTemplateTokens = (value: string, tokens: Record<string, string>) =>
  Object.entries(tokens).reduce(
    (result, [token, replacement]) => result.split(`{${token}}`).join(replacement),
    value
  );

const formatLabel = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const createBeat = ({
  section,
  type,
  title,
  body,
  summary,
  tags,
  relatedRoomIds,
}: {
  section: GeneratedSection;
  type: GeneratedSectionNarrativeBeat['type'];
  title: string;
  body: string;
  summary: string | null;
  tags: string[];
  relatedRoomIds?: string[];
}): GeneratedSectionNarrativeBeat => ({
  id: `narrative_${hashString([section.seed, type, title, relatedRoomIds?.join(',') ?? ''].join(':'))}`,
  type,
  title,
  body,
  summary,
  tags,
  relatedRoomIds: relatedRoomIds ?? [],
});

export const generateSectionNarrative = ({
  section,
  sectionName,
  content,
}: GenerateSectionNarrativeInput): GeneratedSectionNarrative => {
  const nextRandom = createSeededRandom(`${section.seed}:campaign-book:narrative`);
  const narrativeFragments = contentRegistry.loadPack('section_narrative_fragments').sectionNarrativeFragments;
  const firstHazard = content.hazards[0]?.name.toLowerCase();
  const firstCreature = content.creatures[0]?.name;
  const firstEncounter = content.encounters[0]?.title;
  const entryRoom = section.rooms.find((room) => room.isEntrance) ?? section.rooms[0];
  const context = {
    sectionKind: section.sectionKind,
    biomeId: section.primaryBiomeId,
  };
  const baseTokens = {
    section_name: sectionName,
    biome_name: content.biomeName.toLowerCase(),
    biome_description: content.biomeDescription.toLowerCase(),
    tone: content.tone,
    hazard_name: firstHazard ?? 'the terrain',
    encounter_title: firstEncounter ?? 'pressure in the route',
    creature_name: firstCreature ?? 'local pressure',
    room_type_label_lower: '',
  };
  const introEntry = pickNarrativeEntry(narrativeFragments, 'read_aloud_intro', context, nextRandom);
  const impressionEntry = pickNarrativeEntry(narrativeFragments, 'area_impression', context, nextRandom);

  const readAloudIntro = createBeat({
    section,
    type: 'read_aloud_intro',
    title: applyTemplateTokens(introEntry.title_template, baseTokens),
    body: applyTemplateTokens(introEntry.text, baseTokens),
    summary: applyTemplateTokens(introEntry.summary_text, baseTokens),
    tags: ['narrative', section.sectionKind, 'intro'],
    relatedRoomIds: entryRoom ? [entryRoom.roomId] : [],
  });

  const areaImpressions = [
    createBeat({
      section,
      type: 'area_impression',
      title: applyTemplateTokens(impressionEntry.title_template, baseTokens),
      body: applyTemplateTokens(impressionEntry.text, baseTokens),
      summary: applyTemplateTokens(impressionEntry.summary_text, baseTokens),
      tags: ['narrative', section.sectionKind, 'impression'],
      relatedRoomIds: section.rooms.slice(0, 2).map((room) => room.roomId),
    }),
  ];

  if (firstEncounter) {
    const pressureEntry = pickNarrativeEntry(narrativeFragments, 'pressure_impression', context, nextRandom);
    areaImpressions.push(
      createBeat({
        section,
        type: 'area_impression',
        title: applyTemplateTokens(pressureEntry.title_template, baseTokens),
        body: applyTemplateTokens(pressureEntry.text, baseTokens),
        summary: applyTemplateTokens(pressureEntry.summary_text, baseTokens),
        tags: ['narrative', 'pressure', 'encounter'],
        relatedRoomIds: [],
      })
    );
  }

  const roomScenes = section.rooms.slice(0, Math.min(3, section.rooms.length)).map((room, index) => {
    const titlePrefix =
      room.isEntrance ? 'Possible entrance scene' : room.isExit ? 'Possible exit scene' : 'Possible room scene';
    const roomLabel = formatLabel(room.roomTypeId);
    const sceneEntry = pickNarrativeEntry(narrativeFragments, 'room_scene', context, nextRandom);
    const sceneTokens = {
      ...baseTokens,
      room_type_label_lower: roomLabel.toLowerCase(),
    };

    return createBeat({
      section,
      type: 'room_scene',
      title: `${titlePrefix} ${index + 1}`,
      body: applyTemplateTokens(sceneEntry.text, sceneTokens),
      summary: applyTemplateTokens(sceneEntry.summary_text, sceneTokens),
      tags: ['narrative', 'room_scene', room.roomTypeId],
      relatedRoomIds: [room.roomId],
    });
  });

  return {
    readAloudIntro,
    areaImpressions,
    roomScenes,
  };
};
