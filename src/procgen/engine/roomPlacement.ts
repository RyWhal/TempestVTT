import type {
  RectBounds,
  ResolvedSectionProfile,
  RoomPrimitive,
  SectionKind,
} from '../types';
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
  sectionProfile?: ResolvedSectionProfile;
}

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const rectsOverlap = (left: RectBounds, right: RectBounds) => {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
};

const choosePrimitiveForSlot = (
  slot: LayoutSlot,
  roomPrimitives: RoomPrimitive[],
  sectionKind: SectionKind,
  nextRandom: () => number,
  sectionProfile: ResolvedSectionProfile | undefined
): RoomPrimitive => {
  const slotArea = slot.width * slot.height;
  const tags = slot.tags ?? [];
  const allowedPrimitiveIds = new Set(sectionProfile?.allowedRoomPrimitiveIds ?? []);
  const preferredPrimitiveIds = new Set(
    sectionProfile?.settlementPrimitivePreferenceIds ?? []
  );
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

  if (!sectionProfile) {
    const ranked = eligible
      .map((primitive) => {
        const footprint = primitive.grid_footprint;
        const family = primitive.family ?? 'square';
        let score = family === 'square' ? 10 : 22;

        if (tags.includes('courtyard') || tags.includes('hub')) {
          if (primitive.id === 'ring_room') score += 80;
          if (family === 'circle' || family === 'oval' || family === 'polygon') score += 60;
          if (family === 'cross' || family === 'compound') score += 45;
        }

        if (tags.includes('landmark')) {
          if (family === 'polygon' || family === 'circle' || family === 'ring') score += 70;
          if (family === 'cross' || family === 'compound') score += 50;
        }

        if (tags.includes('service')) {
          if (family === 'compound') score += 55;
          if (family === 'rectangle') score += 45;
          if (family === 'polygon') score += 25;
        }

        if (tags.includes('street_edge')) {
          if (family === 'compound' || family === 'rectangle') score += 35;
        }

        if (tags.includes('residence')) {
          if (family === 'compound') score += 45;
          if (family === 'rectangle' || family === 'square') score += 35;
        }

        if (tags.includes('branch') || tags.includes('side')) {
          if (family === 'polygon' || family === 'oval') score += 40;
          if (family === 'compound') score += 28;
        }

        if (tags.includes('dense') && family === 'rectangle') {
          score += 12;
        }

        if (sectionKind === 'settlement' && slotArea > 240 && primitive.id === 'ring_room') {
          score += 35;
        }

        if (primitive.id === 'rectangle_long' && slot.width < 16) {
          score -= 30;
        }

        return {
          primitive,
          score,
          area: footprint ? footprint.max_w * footprint.max_h : 0,
        };
      })
      .sort((left, right) => {
        const familyDelta = right.score - left.score;
        if (familyDelta !== 0) {
          return familyDelta;
        }

        if (sectionKind === 'settlement') {
          return right.area - left.area;
        }

        return left.area - right.area;
      });

    const topScore = ranked[0]?.score ?? 0;
    const candidates = ranked.filter((entry) => entry.score >= topScore - 12);
    const chosen =
      candidates[Math.floor(nextRandom() * Math.max(1, candidates.length))] ?? ranked[0];

    return chosen?.primitive ?? roomPrimitives[0];
  }

  const constrainedEligible =
    allowedPrimitiveIds.size > 0
      ? eligible.filter((primitive) => allowedPrimitiveIds.has(primitive.id))
      : eligible;
  const candidatePool = constrainedEligible.length > 0 ? constrainedEligible : eligible;
  const openness = sectionProfile?.openSpaceRatio ?? 0;
  const density =
    sectionProfile?.roomPrimitiveDensity ?? (sectionKind === 'settlement' ? 0.7 : 0.55);
  const corridorDensity = sectionProfile?.corridorDensity ?? 0.5;
  const desiredCoverage = clampNumber(
    0.48 + density * 0.3 - openness * 0.18 + (sectionKind === 'settlement' ? 0.04 : 0),
    0.38,
    0.9
  );

  const rankPrimitive = (primitive: RoomPrimitive) => {
      const family = primitive.family ?? 'square';
      const footprint = primitive.grid_footprint;
      const area = footprint ? footprint.max_w * footprint.max_h : 0;
      const areaCoverage = slotArea > 0 ? area / slotArea : 0;
      let score = family === 'square' ? 10 : 22;

      if (allowedPrimitiveIds.has(primitive.id)) {
        score += 120;
      }

      if (preferredPrimitiveIds.has(primitive.id)) {
        score += 90;
      }

      score += Math.round((1 - Math.abs(areaCoverage - desiredCoverage)) * 50);

      if (tags.includes('courtyard') || tags.includes('hub')) {
        if (primitive.id === 'courtyard_open') score += 160;
        if (primitive.id === 'ring_room') score += 80;
        if (
          family === 'circle' ||
          family === 'oval' ||
          family === 'polygon' ||
          family === 'open_space'
        ) {
          score += 60;
        }
        if (family === 'cross' || family === 'compound') score += 45;
      }

      if (tags.includes('landmark')) {
        if (family === 'polygon' || family === 'circle' || family === 'ring') score += 70;
        if (family === 'cross' || family === 'compound') score += 50;
      }

      if (tags.includes('service')) {
        if (family === 'compound') score += 55;
        if (family === 'rectangle') score += 45;
        if (family === 'polygon') score += 25;
      }

      if (tags.includes('street_edge')) {
        if (family === 'compound' || family === 'rectangle') score += 35;
      }

      if (tags.includes('residence')) {
        if (family === 'compound') score += 45;
        if (family === 'rectangle' || family === 'square') score += 35;
      }

      if (tags.includes('branch') || tags.includes('side')) {
        if (family === 'polygon' || family === 'oval') score += 40;
        if (family === 'compound') score += 28;
      }

      if (tags.includes('dense') && family === 'rectangle') {
        score += 12;
      }

      if (sectionKind === 'settlement' && slotArea > 240 && primitive.id === 'ring_room') {
        score += 35;
      }

      if (openness >= 0.45) {
        if (
          family === 'circle' ||
          family === 'ring' ||
          family === 'open_space' ||
          family === 'polygon'
        ) {
          score += 45;
        }
        if (family === 'rectangle' || family === 'compound') {
          score -= 18;
        }
      } else if (corridorDensity >= 0.6 || density >= 0.72) {
        if (family === 'rectangle' || family === 'compound' || family === 'square') {
          score += 28;
        }
        if (family === 'open_space' || family === 'ring') {
          score -= 15;
        }
      }

      if (primitive.id === 'rectangle_long' && slot.width < 16) {
        score -= 30;
      }

      return score;
  };

  const ranked = candidatePool
    .map((primitive) => {
      const footprint = primitive.grid_footprint;
      const area = footprint ? footprint.max_w * footprint.max_h : 0;
      return {
        primitive,
        score: rankPrimitive(primitive),
        area,
      };
    })
    .sort((left, right) => {
      const familyDelta = right.score - left.score;
      if (familyDelta !== 0) {
        return familyDelta;
      }

      if (sectionKind === 'settlement') {
        return right.area - left.area;
      }

      return left.area - right.area;
    });

  const topScore = ranked[0]?.score ?? 0;
  const candidates = ranked.filter((entry) => entry.score >= topScore - 12);
  const chosen =
    candidates[Math.floor(nextRandom() * Math.max(1, candidates.length))] ?? ranked[0];

  return chosen?.primitive ?? roomPrimitives[0];
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
  sectionKind: SectionKind,
  sectionProfile: ResolvedSectionProfile | undefined
): PlacedRoom => {
  const footprint = primitive.grid_footprint ?? {
    min_w: slot.width,
    max_w: slot.width,
    min_h: slot.height,
    max_h: slot.height,
  };

  const densityFloor = sectionProfile
    ? clampNumber(
        0.48 +
          sectionProfile.roomPrimitiveDensity * 0.34 -
          sectionProfile.openSpaceRatio * 0.26 +
          (sectionKind === 'settlement' ? 0.06 : 0),
        0.48,
        0.92
      )
    : sectionKind === 'settlement'
      ? 0.84
      : 0.8;
  const densityRange = sectionProfile
    ? clampNumber(
        0.18 -
          sectionProfile.roomPrimitiveDensity * 0.06 +
          sectionProfile.openSpaceRatio * 0.12,
        0.06,
        0.24
      )
    : sectionKind === 'settlement'
      ? 0.1
      : 0.18;
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

const clampRoomToSlot = (room: PlacedRoom, slot: LayoutSlot): PlacedRoom => ({
  ...room,
  bounds: {
    ...room.bounds,
    x: Math.max(slot.x, Math.min(room.bounds.x, slot.x + slot.width - room.bounds.width)),
    y: Math.max(slot.y, Math.min(room.bounds.y, slot.y + slot.height - room.bounds.height)),
  },
});

const resolvePlacementCollision = ({
  room,
  slot,
  primitive,
  placedRooms,
}: {
  room: PlacedRoom;
  slot: LayoutSlot;
  primitive: RoomPrimitive;
  placedRooms: PlacedRoom[];
}): PlacedRoom => {
  const footprint = primitive.grid_footprint ?? {
    min_w: room.bounds.width,
    max_w: room.bounds.width,
    min_h: room.bounds.height,
    max_h: room.bounds.height,
  };

  let current = clampRoomToSlot(room, slot);

  for (let attempt = 0; attempt < 32; attempt++) {
    const overlapping = placedRooms.find((placedRoom) =>
      rectsOverlap(current.bounds, placedRoom.bounds)
    );

    if (!overlapping) {
      return current;
    }

    const candidates: PlacedRoom[] = [
      {
        ...current,
        bounds: {
          ...current.bounds,
          x: overlapping.bounds.x - current.bounds.width,
        },
      },
      {
        ...current,
        bounds: {
          ...current.bounds,
          x: overlapping.bounds.x + overlapping.bounds.width,
        },
      },
      {
        ...current,
        bounds: {
          ...current.bounds,
          y: overlapping.bounds.y - current.bounds.height,
        },
      },
      {
        ...current,
        bounds: {
          ...current.bounds,
          y: overlapping.bounds.y + overlapping.bounds.height,
        },
      },
    ]
      .map((candidate) => clampRoomToSlot(candidate, slot))
      .filter(
        (candidate, index, allCandidates) =>
          allCandidates.findIndex(
            (other) =>
              other.bounds.x === candidate.bounds.x &&
              other.bounds.y === candidate.bounds.y &&
              other.bounds.width === candidate.bounds.width &&
              other.bounds.height === candidate.bounds.height
          ) === index
      );

    const resolvedCandidate = candidates.find(
      (candidate) =>
        !placedRooms.some((placedRoom) => rectsOverlap(candidate.bounds, placedRoom.bounds))
    );

    if (resolvedCandidate) {
      return resolvedCandidate;
    }

    const overlapWidth =
      Math.min(current.bounds.x + current.bounds.width, overlapping.bounds.x + overlapping.bounds.width) -
      Math.max(current.bounds.x, overlapping.bounds.x);
    const overlapHeight =
      Math.min(current.bounds.y + current.bounds.height, overlapping.bounds.y + overlapping.bounds.height) -
      Math.max(current.bounds.y, overlapping.bounds.y);

    const canShrinkWidth = current.bounds.width > footprint.min_w;
    const canShrinkHeight = current.bounds.height > footprint.min_h;

    if ((overlapWidth >= overlapHeight && canShrinkWidth) || !canShrinkHeight) {
      current = clampRoomToSlot(
        {
          ...current,
          bounds: {
            ...current.bounds,
            width: current.bounds.width - 1,
          },
        },
        slot
      );
      continue;
    }

    if (canShrinkHeight) {
      current = clampRoomToSlot(
        {
          ...current,
          bounds: {
            ...current.bounds,
            height: current.bounds.height - 1,
          },
        },
        slot
      );
    }
  }

  return current;
};

export const placeRoomsForPreset = ({
  preset,
  roomPrimitives,
  nextRandom,
  sectionKind,
  sectionProfile,
}: RoomPlacementInput): PlacedRoom[] => {
  const placedRooms: PlacedRoom[] = [];

  for (const [index, slot] of preset.slots.entries()) {
    const primitive = choosePrimitiveForSlot(
      slot,
      roomPrimitives,
      sectionKind,
      nextRandom,
      sectionProfile
    );
    const room = placeRoomInSlot(
      slot,
      primitive,
      nextRandom,
      `room_${String(index + 1).padStart(3, '0')}`,
      sectionKind,
      sectionProfile
    );
    placedRooms.push(
      resolvePlacementCollision({
        room,
        slot,
        primitive,
        placedRooms,
      })
    );
  }

  return placedRooms;
};
