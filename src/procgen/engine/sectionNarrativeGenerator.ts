import type {
  GeneratedSection,
  GeneratedSectionContent,
  GeneratedSectionNarrative,
  GeneratedSectionNarrativeBeat,
} from '../types';
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
  const firstHazard = content.hazards[0]?.name.toLowerCase();
  const firstCreature = content.creatures[0]?.name;
  const firstEncounter = content.encounters[0]?.title;
  const entryRoom = section.rooms.find((room) => room.isEntrance) ?? section.rooms[0];

  const introVariants = [
    `${sectionName} could first read as ${content.tone} rather than immediately hostile, with ${content.biomeName.toLowerCase()} details suggesting pressure just beyond the next decision point.`,
    `When the party enters ${sectionName}, you might lean on ${content.biomeDescription.toLowerCase()} so the place feels unsettled before any single threat is confirmed.`,
    `${sectionName} may be introduced as a place where ${content.summary.charAt(0).toLowerCase()}${content.summary.slice(1)} and every detail suggests that caution matters.`,
  ];

  const impressionVariants = [
    `${sectionName} could be framed as a route where the air, light, and footing all suggest that plans will need to stay flexible.`,
    `The area might feel shaped less by one fixed scene and more by accumulating pressure from ${firstHazard ?? 'the terrain'} and uneven lines of sight.`,
    `A first impression here could emphasize how ${content.biomeName.toLowerCase()} conditions make even ordinary movement feel provisional.`,
  ];

  const readAloudIntro = createBeat({
    section,
    type: 'read_aloud_intro',
    title: `Read Aloud: ${sectionName}`,
    body: pickOne(introVariants, nextRandom, introVariants[0]),
    summary: 'Opening atmosphere that stays flexible for the GM.',
    tags: ['narrative', section.sectionKind, 'intro'],
    relatedRoomIds: entryRoom ? [entryRoom.roomId] : [],
  });

  const areaImpressions = [
    createBeat({
      section,
      type: 'area_impression',
      title: `${sectionName} at a glance`,
      body: pickOne(impressionVariants, nextRandom, impressionVariants[0]),
      summary: 'General section impression.',
      tags: ['narrative', section.sectionKind, 'impression'],
      relatedRoomIds: section.rooms.slice(0, 2).map((room) => room.roomId),
    }),
  ];

  if (firstEncounter) {
    areaImpressions.push(
      createBeat({
        section,
        type: 'area_impression',
        title: 'Pressure building in the route',
        body: `If you want a second note, the section could suggest ${firstEncounter.toLowerCase()} before it ever resolves into a fixed event, keeping tension available without locking the room order.`,
        summary: 'Pressure note tied to an encounter seed.',
        tags: ['narrative', 'pressure', 'encounter'],
        relatedRoomIds: [],
      })
    );
  }

  const roomScenes = section.rooms.slice(0, Math.min(3, section.rooms.length)).map((room, index) => {
    const titlePrefix =
      room.isEntrance ? 'Possible entrance scene' : room.isExit ? 'Possible exit scene' : 'Possible room scene';
    const roomLabel = formatLabel(room.roomTypeId);
    const sceneOptions = [
      `${titlePrefix}: this ${roomLabel.toLowerCase()} could host a wary pause, a clue about recent movement, or a social beat that lets the party test the section before danger hardens.`,
      `${titlePrefix}: the room might suit signs of ${firstCreature ?? 'local pressure'}, a temporary stash, or a conversation interrupted before the party arrived.`,
      `${titlePrefix}: you could frame this space as useful for regrouping, a partial discovery, or a complication that grows out of ${firstHazard ?? 'the terrain'} instead of replacing it.`,
    ];

    return createBeat({
      section,
      type: 'room_scene',
      title: `${titlePrefix} ${index + 1}`,
      body: pickOne(sceneOptions, nextRandom, sceneOptions[0]),
      summary: `Flexible framing for ${roomLabel.toLowerCase()}.`,
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
