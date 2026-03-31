import type { Biome, GeneratedSectionRoom, SectionKind } from '../types';
import type { PlacedRoom } from './roomPlacement';

interface RoomAssignmentInput {
  placedRooms: PlacedRoom[];
  sectionKind: SectionKind;
  primaryBiome: Biome | undefined;
  entranceSlotId: string;
  exitSlotIds: string[];
  edgeMap: Map<string, string[]>;
}

const inferRoomTypeId = (placedRoom: PlacedRoom, sectionKind: SectionKind): string => {
  if (placedRoom.tags.includes('entry')) {
    return 'entrance_room';
  }

  if (placedRoom.tags.includes('exit')) {
    return 'exit_room';
  }

  if (placedRoom.tags.includes('hub')) {
    return sectionKind === 'settlement' ? 'settlement_hub' : 'hub_room';
  }

  if (placedRoom.tags.includes('landmark')) {
    return sectionKind === 'settlement' ? 'village_landmark' : 'landmark_chamber';
  }

  return sectionKind === 'settlement' ? 'settlement_room' : 'side_room';
};

export const assignRooms = ({
  placedRooms,
  sectionKind,
  primaryBiome,
  entranceSlotId,
  exitSlotIds,
  edgeMap,
}: RoomAssignmentInput): GeneratedSectionRoom[] => {
  const biomeId = primaryBiome?.id ?? 'stone_halls';

  return placedRooms.map((placedRoom) => ({
    roomId: placedRoom.roomId,
    primitiveId: placedRoom.primitiveId,
    roomTypeId: inferRoomTypeId(placedRoom, sectionKind),
    biomeId,
    bounds: placedRoom.bounds,
    connectedRoomIds: edgeMap.get(placedRoom.roomId) ?? [],
    isEntrance: placedRoom.slotId === entranceSlotId,
    isExit: exitSlotIds.includes(placedRoom.slotId),
    tags: placedRoom.tags,
  }));
};
