import { useMapStore } from '../stores/mapStore';

export interface CharacterPlacement {
  session_id: string;
  map_id: string;
  character_id: string;
  position_x: number;
  position_y: number;
  is_placed: boolean;
}

export function applyCharacterPlacement(row: CharacterPlacement) {
  const store = useMapStore.getState();
  if (row.is_placed) {
    store.moveCharacter(row.character_id, row.position_x, row.position_y, row.map_id);
  } else {
    store.removeCharacterFromMap(row.character_id, row.map_id);
  }
}

export function hydrateCharacterPlacements(rows: CharacterPlacement[]) {
  const positions: ReturnType<typeof useMapStore.getState>['tokenPositionsByMap'] = {};
  for (const row of rows) {
    if (!row.is_placed) continue;
    const map = positions[row.map_id] ??= { characters: {}, npcs: {} };
    map.characters[row.character_id] = { x: row.position_x, y: row.position_y };
  }
  useMapStore.setState({ tokenPositionsByMap: positions });
  const store = useMapStore.getState();
  store.setCharacters(store.characters);
}
