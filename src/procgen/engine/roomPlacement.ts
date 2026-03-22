import type { RectBounds, RoomPrimitive, SectionKind } from '../types';
import type { LayoutPreset, LayoutSlot } from './layoutPresets';

export interface PlacedRoom {
  roomId: string;
  primitiveId: string;
  bounds: RectBounds;
  slotId: string;
  tags: string[];
}

interface RoomPlacementInput {
  preset: LayoutPreset;
  roomPrimitives: RoomPrimitive[];
  nextRandom: () => number;
  sectionKind: SectionKind;
}

const choosePrimitiveForSlot = (
  slot: LayoutSlot,
  roomPrimitives: RoomPrimitive[],
  sectionKind: SectionKind
): RoomPrimitive => {
  const slotArea = slot.width * slot.height;
  const eligible = roomPrimitives.filter((primitive) => {
    const footprint = primitive.grid_footprint;

    if (!footprint) {
      return false;
    }

    const widthFits =
      footprint.min_w <= slot.width &&
      footprint.min_h <= slot.height &&
      (footprint.max_w >= Math.max(6, slot.width - 6) ||
        footprint.max_h >= Math.max(6, slot.height - 6));

    if (!widthFits) {
      return false;
    }

    if (sectionKind === 'settlement' && slotArea <= 180) {
      return footprint.max_w <= 22 && footprint.max_h <= 22;
    }

    return true;
  });

  const ranked = eligible.sort((left, right) => {
    const leftFootprint = left.grid_footprint;
    const rightFootprint = right.grid_footprint;

    const leftArea = leftFootprint ? leftFootprint.max_w * leftFootprint.max_h : 0;
    const rightArea = rightFootprint ? rightFootprint.max_w * rightFootprint.max_h : 0;

    if (sectionKind === 'settlement') {
      return rightArea - leftArea;
    }

    return leftArea - rightArea;
  });

  return ranked[0] ?? roomPrimitives[0];
};

const clampDimension = (
  target: number,
  min: number,
  max: number
) => Math.max(min, Math.min(max, target));

const placeRoomInSlot = (
  slot: LayoutSlot,
  primitive: RoomPrimitive,
  nextRandom: () => number,
  roomId: string,
  sectionKind: SectionKind
): PlacedRoom => {
  const footprint = primitive.grid_footprint ?? {
    min_w: slot.width,
    max_w: slot.width,
    min_h: slot.height,
    max_h: slot.height,
  };

  const densityFloor = sectionKind === 'settlement' ? 0.84 : 0.8;
  const densityRange = sectionKind === 'settlement' ? 0.1 : 0.18;
  const targetWidth = clampDimension(
    Math.floor(slot.width * (densityFloor + nextRandom() * densityRange)),
    footprint.min_w,
    Math.min(footprint.max_w, slot.width)
  );
  const targetHeight = clampDimension(
    Math.floor(slot.height * (densityFloor + nextRandom() * densityRange)),
    footprint.min_h,
    Math.min(footprint.max_h, slot.height)
  );

  const maxOffsetX = Math.max(0, slot.width - targetWidth);
  const maxOffsetY = Math.max(0, slot.height - targetHeight);
  const offsetX = Math.floor(maxOffsetX * nextRandom());
  const offsetY = Math.floor(maxOffsetY * nextRandom());

  return {
    roomId,
    primitiveId: primitive.id,
    slotId: slot.id,
    bounds: {
      x: slot.x + offsetX,
      y: slot.y + offsetY,
      width: targetWidth,
      height: targetHeight,
    },
    tags: slot.tags ?? [],
  };
};

export const placeRoomsForPreset = ({
  preset,
  roomPrimitives,
  nextRandom,
  sectionKind,
}: RoomPlacementInput): PlacedRoom[] => {
  return preset.slots.map((slot, index) => {
    const primitive = choosePrimitiveForSlot(slot, roomPrimitives, sectionKind);
    return placeRoomInSlot(
      slot,
      primitive,
      nextRandom,
      `room_${String(index + 1).padStart(3, '0')}`,
      sectionKind
    );
  });
};
