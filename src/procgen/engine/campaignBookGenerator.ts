import type {
  CampaignBookEntryType,
  GeneratedCampaignBook,
  GeneratedCampaignBookEntry,
  GeneratedSection,
  GeneratedSectionContent,
} from '../types';
import { generateSectionNarrative } from './sectionNarrativeGenerator';
import { hashString } from './seed';

interface GenerateCampaignBookInput {
  section: GeneratedSection;
  sectionName: string;
  content: Omit<GeneratedSectionContent, 'campaignBook'> | GeneratedSectionContent;
}

const createEntry = ({
  section,
  type,
  title,
  body,
  summary,
  tags,
  relatedRoomIds,
  relatedNpcIds,
  relatedCreatureIds,
  relatedShopIds,
}: {
  section: GeneratedSection;
  type: CampaignBookEntryType;
  title: string;
  body: string;
  summary: string | null;
  tags: string[];
  relatedRoomIds?: string[];
  relatedNpcIds?: string[];
  relatedCreatureIds?: string[];
  relatedShopIds?: string[];
}): GeneratedCampaignBookEntry => ({
  id: `entry_${hashString(
    [
      section.seed,
      type,
      title,
      body,
      summary ?? '',
      tags.join(','),
      relatedRoomIds?.join(',') ?? '',
      relatedNpcIds?.join(',') ?? '',
      relatedCreatureIds?.join(',') ?? '',
      relatedShopIds?.join(',') ?? '',
    ].join(':')
  )}`,
  sectionId: section.sectionId,
  type,
  title,
  body,
  summary,
  status: 'suggested',
  tags,
  relatedRoomIds: relatedRoomIds ?? [],
  relatedNpcIds: relatedNpcIds ?? [],
  relatedCreatureIds: relatedCreatureIds ?? [],
  relatedShopIds: relatedShopIds ?? [],
  provenance: {
    biomeId: section.primaryBiomeId,
    sectionSeed: section.seed,
  },
});

const withTrailingPeriod = (value: string) => (/[.!?]$/.test(value) ? value : `${value}.`);

const uniqueValues = (values: string[]) => [...new Set(values.filter(Boolean))];

export const generateCampaignBook = ({
  section,
  sectionName,
  content,
}: GenerateCampaignBookInput): GeneratedCampaignBook => {
  const narrative = generateSectionNarrative({
    section,
    sectionName,
    content,
  });
  const entries: GeneratedCampaignBookEntry[] = [];

  entries.push(
    createEntry({
      section,
      type: narrative.readAloudIntro.type,
      title: narrative.readAloudIntro.title,
      body: narrative.readAloudIntro.body,
      summary: narrative.readAloudIntro.summary,
      tags: narrative.readAloudIntro.tags,
      relatedRoomIds: narrative.readAloudIntro.relatedRoomIds,
    })
  );

  for (const impression of narrative.areaImpressions) {
    entries.push(
      createEntry({
        section,
        type: impression.type,
        title: impression.title,
        body: impression.body,
        summary: impression.summary,
        tags: impression.tags,
        relatedRoomIds: impression.relatedRoomIds,
      })
    );
  }

  for (const roomScene of narrative.roomScenes) {
    entries.push(
      createEntry({
        section,
        type: roomScene.type,
        title: roomScene.title,
        body: roomScene.body,
        summary: roomScene.summary,
        tags: roomScene.tags,
        relatedRoomIds: roomScene.relatedRoomIds,
      })
    );
  }

  for (const npc of content.npcEntities) {
    entries.push(
      createEntry({
        section,
        type: 'npc_profile',
        title: `${npc.name}, ${npc.roleName ?? 'local contact'}`,
        body: `${npc.baselineBackstory} ${npc.appearanceSummary} In conversation, ${npc.name} may sound ${npc.voice.toLowerCase()} and tends to ${npc.mannerisms[0]?.toLowerCase() ?? 'watch for reactions before committing'}. They are currently focused on ${npc.motivations[0]?.toLowerCase() ?? 'keeping control of the situation'} and are known around here for ${npc.knownFor.slice(0, 2).join(' and ').toLowerCase() || 'keeping the local situation together'}.`,
        summary: npc.secrets[0]
          ? `Possible private angle: ${withTrailingPeriod(npc.secrets[0])}`
          : 'Persistent NPC profile.',
        tags: uniqueValues(['npc', 'profile', npc.roleId ?? '', npc.shopId ? 'shop' : '']),
        relatedNpcIds: [npc.id],
        relatedShopIds: npc.shopId ? [npc.shopId] : [],
      })
    );
  }

  for (const appearance of content.npcAppearances) {
    entries.push(
      createEntry({
        section,
        type: 'npc_roleplay_note',
        title: `Roleplay note: ${appearance.context}`,
        body: `Play ${appearance.context} as ${appearance.framing.toLowerCase()}. They tend to push the conversation toward ${appearance.wantsFromPlayers.toLowerCase()} and often come across like someone who ${appearance.roleInSection.toLowerCase()}. They may know ${appearance.knows[0]?.toLowerCase() ?? 'more than they first admit'}, need ${appearance.needs[0]?.toLowerCase() ?? 'a reason to trust the party'}, and offer ${appearance.offers[0]?.toLowerCase() ?? 'practical local help'} if the interaction goes well.`,
        summary: `Possible roleplay angle for ${appearance.npcId}.`,
        tags: ['npc', 'roleplay', 'appearance'],
        relatedNpcIds: [appearance.npcId],
      })
    );
  }

  for (const encounter of content.encounters) {
    entries.push(
      createEntry({
        section,
        type: 'encounter_seed',
        title: encounter.title,
        body: encounter.detail,
        summary: `${encounter.threatLevel} pressure encounter. ${withTrailingPeriod(encounter.summary)}`,
        tags: ['encounter', encounter.threatLevel],
        relatedCreatureIds: content.creatures.slice(0, 1).map((creature) => creature.id),
      })
    );
  }

  for (const creature of content.creatures) {
    entries.push(
      createEntry({
        section,
        type: 'creature_seed',
        title: creature.name,
        body: `${creature.name} could show up as ${creature.role.toLowerCase()} pressure in this section, and their ${creature.temperament.toLowerCase()} behavior might first be suggested through signs, sounds, or a disrupted route before a direct scene appears.`,
        summary: withTrailingPeriod(creature.hook),
        tags: ['creature', creature.familyId, creature.role],
        relatedCreatureIds: [creature.id],
      })
    );
  }

  for (const shop of content.shops) {
    entries.push(
      createEntry({
        section,
        type: 'shop_seed',
        title: shop.name,
        body: `${shop.description} ${shop.pressure}`,
        summary:
          shop.services.length > 0
            ? `Possible services: ${shop.services.slice(0, 2).join(', ')}.`
            : withTrailingPeriod(shop.pressure),
        tags: ['shop', shop.shopTypeId],
        relatedNpcIds: content.npcEntities
          .filter((npc) => npc.shopId === shop.id)
          .map((npc) => npc.id),
        relatedShopIds: [shop.id],
      })
    );
  }

  const itemSeedNames =
    content.shops.length > 0
      ? uniqueValues(content.shops.flatMap((shop) => shop.featuredStock)).slice(0, 3)
      : uniqueValues(
          [
            content.hazards[0] ? `${content.hazards[0].name} salvage` : '',
            content.creatures[0] ? `${content.creatures[0].name} sign` : '',
            `${content.biomeName} keepsake`,
          ].filter(Boolean)
        ).slice(0, 2);

  for (const itemName of itemSeedNames) {
    entries.push(
      createEntry({
        section,
        type: 'item_seed',
        title: itemName,
        body: `${itemName} could matter as a clue, bargaining chip, or local curiosity, and you might place it wherever the section needs a concrete detail without fixing the exact room in advance.`,
        summary: 'Flexible item or curiosity seed.',
        tags: ['item', section.sectionKind],
      })
    );
  }

  for (const hazard of content.hazards) {
    entries.push(
      createEntry({
        section,
        type: 'hazard_seed',
        title: hazard.name,
        body: `${hazard.name} could complicate travel, conversation, or combat timing in this section, and the GM might treat it as background pressure or a sharper complication depending on the pace needed.`,
        summary: withTrailingPeriod(hazard.summary),
        tags: ['hazard', section.sectionKind],
      })
    );
  }

  for (const [index, hook] of content.hooks.entries()) {
    entries.push(
      createEntry({
        section,
        type: 'hook_seed',
        title: hook.title || `Hook ${index + 1}`,
        body: hook.text,
        summary: `Source: ${hook.source}.`,
        tags: ['hook', section.sectionKind],
        relatedNpcIds: content.npcEntities.slice(0, 1).map((npc) => npc.id),
        relatedCreatureIds: index === 0 ? content.creatures.slice(0, 1).map((creature) => creature.id) : [],
      })
    );
  }

  return {
    sectionId: section.sectionId,
    entries,
    persistentNpcs: content.npcEntities,
    npcAppearances: content.npcAppearances,
  };
};
