import type {
  Character,
  Map,
  NPCInstance,
  NPCTemplate,
  Session,
  SessionExport,
  TokenSize,
} from '../types';

const fetchOptionalBase64 = async (
  url: string | null,
  fetchAsBase64: (url: string) => Promise<string>
): Promise<string | null> => {
  if (!url) {
    return null;
  }

  try {
    return await fetchAsBase64(url);
  } catch (error) {
    console.error('Failed to fetch asset for export:', error);
    return null;
  }
};

export const buildSessionExport = async ({
  session,
  maps,
  characters,
  npcTemplates,
  npcInstances,
  fetchAsBase64,
}: {
  session: Pick<Session, 'name' | 'notepadContent'>;
  maps: Map[];
  characters: Character[];
  npcTemplates: NPCTemplate[];
  npcInstances: NPCInstance[];
  fetchAsBase64: (url: string) => Promise<string>;
}): Promise<SessionExport> => {
  const mapsWithImages = await Promise.all(
    maps.map(async (map) => {
      const imageBase64 = (await fetchOptionalBase64(map.imageUrl, fetchAsBase64)) ?? '';
      const mapNPCs = npcInstances.filter((instance) => instance.mapId === map.id);

      const npcInstancesData = await Promise.all(
        mapNPCs.map(async (npc) => {
          const tokenBase64 = await fetchOptionalBase64(npc.tokenUrl, fetchAsBase64);
          const template = npcTemplates.find((entry) => entry.id === npc.templateId);

          return {
            displayName: npc.displayName || 'NPC',
            templateName: template?.name || 'Unknown',
            tokenBase64,
            size: (npc.size || 'medium') as TokenSize,
            positionX: npc.positionX,
            positionY: npc.positionY,
            isVisible: npc.isVisible,
            notes: npc.notes,
          };
        })
      );

      return {
        name: map.name,
        imageBase64,
        width: map.width,
        height: map.height,
        gridSettings: {
          enabled: map.gridEnabled,
          offsetX: map.gridOffsetX,
          offsetY: map.gridOffsetY,
          cellSize: map.gridCellSize,
          color: map.gridColor,
        },
        tokenSettings: {
          overrideEnabled: map.tokenSizeOverrideEnabled,
          mediumSizePx: map.mediumTokenSizePx,
        },
        fogSettings: {
          enabled: map.fogEnabled,
          defaultState: map.fogDefaultState,
          fogData: map.fogData,
        },
        showPlayerTokens: map.showPlayerTokens,
        npcInstances: npcInstancesData,
      };
    })
  );

  const charactersWithImages = await Promise.all(
    characters.map(async (character) => ({
      name: character.name,
      tokenBase64: await fetchOptionalBase64(character.tokenUrl, fetchAsBase64),
      inventory: character.inventory,
      notes: character.notes,
    }))
  );

  const npcTemplatesWithImages = await Promise.all(
    npcTemplates.map(async (template) => ({
      name: template.name,
      tokenBase64: await fetchOptionalBase64(template.tokenUrl, fetchAsBase64),
      defaultSize: template.defaultSize,
      notes: template.notes,
    }))
  );

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    session: {
      name: session.name,
      notepadContent: session.notepadContent,
    },
    maps: mapsWithImages,
    characters: charactersWithImages,
    npcTemplates: npcTemplatesWithImages,
  };
};
