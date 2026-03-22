import type { SectionKind, SectionLayoutType } from '../types';

export interface LayoutSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  tags?: string[];
}

export interface LayoutPreset {
  layoutType: SectionLayoutType;
  slots: LayoutSlot[];
  edges: Array<[string, string]>;
  entranceSlotId: string;
  exitSlotIds: string[];
}

const explorationPresets: LayoutPreset[] = [
  {
    layoutType: 'linear_path',
    entranceSlotId: 'entry',
    exitSlotIds: ['sanctum'],
    slots: [
      { id: 'entry', x: 12, y: 44, width: 12, height: 12, tags: ['entry'] },
      { id: 'hall', x: 28, y: 42, width: 16, height: 16, tags: ['spine'] },
      { id: 'mid', x: 50, y: 38, width: 16, height: 18, tags: ['spine'] },
      { id: 'side_north', x: 50, y: 14, width: 18, height: 16, tags: ['side'] },
      { id: 'side_south', x: 48, y: 66, width: 18, height: 18, tags: ['side'] },
      { id: 'sanctum', x: 74, y: 34, width: 20, height: 22, tags: ['landmark', 'exit'] },
    ],
    edges: [
      ['entry', 'hall'],
      ['hall', 'mid'],
      ['mid', 'side_north'],
      ['mid', 'side_south'],
      ['mid', 'sanctum'],
    ],
  },
  {
    layoutType: 'branching_paths',
    entranceSlotId: 'entry',
    exitSlotIds: ['vault'],
    slots: [
      { id: 'entry', x: 8, y: 44, width: 12, height: 12, tags: ['entry'] },
      { id: 'hub', x: 34, y: 38, width: 18, height: 18, tags: ['hub'] },
      { id: 'north_arm', x: 36, y: 12, width: 16, height: 16, tags: ['branch'] },
      { id: 'south_arm', x: 34, y: 68, width: 16, height: 16, tags: ['branch'] },
      { id: 'east_mid', x: 60, y: 42, width: 14, height: 14, tags: ['spine'] },
      { id: 'vault', x: 76, y: 30, width: 18, height: 24, tags: ['landmark', 'exit'] },
    ],
    edges: [
      ['entry', 'hub'],
      ['hub', 'north_arm'],
      ['hub', 'south_arm'],
      ['hub', 'east_mid'],
      ['east_mid', 'vault'],
    ],
  },
  {
    layoutType: 'central_hub',
    entranceSlotId: 'entry',
    exitSlotIds: ['shrine'],
    slots: [
      { id: 'entry', x: 16, y: 46, width: 12, height: 12, tags: ['entry'] },
      { id: 'west_room', x: 24, y: 18, width: 16, height: 16, tags: ['side'] },
      { id: 'hub', x: 40, y: 36, width: 20, height: 20, tags: ['hub', 'landmark'] },
      { id: 'north_room', x: 56, y: 10, width: 16, height: 16, tags: ['side'] },
      { id: 'south_room', x: 58, y: 66, width: 18, height: 18, tags: ['side'] },
      { id: 'shrine', x: 78, y: 38, width: 16, height: 20, tags: ['exit', 'landmark'] },
    ],
    edges: [
      ['entry', 'hub'],
      ['west_room', 'hub'],
      ['north_room', 'hub'],
      ['south_room', 'hub'],
      ['hub', 'shrine'],
    ],
  },
];

const settlementPresets: LayoutPreset[] = [
  {
    layoutType: 'clustered_rooms',
    entranceSlotId: 'gate',
    exitSlotIds: ['gate', 'east_gate'],
    slots: [
      { id: 'gate', x: 6, y: 42, width: 12, height: 16, tags: ['entry'] },
      { id: 'market_west', x: 18, y: 24, width: 16, height: 16, tags: ['dense'] },
      { id: 'market_center', x: 35, y: 23, width: 20, height: 20, tags: ['dense', 'hub'] },
      { id: 'market_east', x: 56, y: 24, width: 16, height: 16, tags: ['dense'] },
      { id: 'inn', x: 72, y: 20, width: 20, height: 20, tags: ['landmark'] },
      { id: 'commons_west', x: 20, y: 48, width: 16, height: 18, tags: ['dense'] },
      { id: 'plaza', x: 39, y: 45, width: 22, height: 22, tags: ['dense', 'hub', 'landmark'] },
      { id: 'commons_east', x: 64, y: 48, width: 18, height: 18, tags: ['dense'] },
      { id: 'residence_sw', x: 24, y: 72, width: 16, height: 16, tags: ['dense'] },
      { id: 'residence_s', x: 44, y: 72, width: 16, height: 16, tags: ['dense'] },
      { id: 'residence_se', x: 64, y: 72, width: 16, height: 16, tags: ['dense'] },
      { id: 'east_gate', x: 86, y: 44, width: 8, height: 14, tags: ['exit'] },
    ],
    edges: [
      ['gate', 'market_west'],
      ['market_west', 'market_center'],
      ['market_center', 'market_east'],
      ['market_east', 'inn'],
      ['market_west', 'commons_west'],
      ['market_center', 'plaza'],
      ['market_east', 'commons_east'],
      ['commons_west', 'plaza'],
      ['plaza', 'commons_east'],
      ['commons_west', 'residence_sw'],
      ['plaza', 'residence_s'],
      ['commons_east', 'residence_se'],
      ['commons_east', 'east_gate'],
    ],
  },
];

export const getLayoutPresets = (sectionKind: SectionKind): LayoutPreset[] => {
  return sectionKind === 'settlement' ? settlementPresets : explorationPresets;
};
