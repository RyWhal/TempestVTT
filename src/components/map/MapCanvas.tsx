import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Text, Group, Wedge } from 'react-konva';
import useImage from 'use-image';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { useMapStore, getFogBrushPixelSize } from '../../stores/mapStore';
import { useSessionStore, useIsGM } from '../../stores/sessionStore';
import { useCharacters } from '../../hooks/useCharacters';
import { useNPCs } from '../../hooks/useNPCs';
import { useMap } from '../../hooks/useMap';
import { broadcastTokenLock, broadcastTokenUnlock, broadcastMapPing } from '../../lib/tokenBroadcast';
import { Token } from './Token';
import { TokenPopover } from './TokenPopover';
import { GridOverlay } from './GridOverlay';
import { FogLayer } from './FogLayer';
import { DrawingLayer } from './DrawingLayer';
import { MapEffectsLayer } from './MapEffectsLayer';
import type { FogRegion, DrawingRegion, DrawingShape, TokenSize, MapEffectTile, MapPing } from '../../types';
import { isDrawingColor } from '../../types';
import { nanoid } from 'nanoid';

const TOKEN_SIZE_ORDER: TokenSize[] = [
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
];

interface PingMarkerProps {
  ping: MapPing;
  onComplete: (id: string) => void;
}

const PingMarker: React.FC<PingMarkerProps> = ({ ping, onComplete }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const duration = 3500;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= duration) {
        clearInterval(interval);
        onComplete(ping.id);
      } else {
        setFrame(elapsed);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [ping.id, onComplete]);

  const progress = Math.min(1, frame / 3500);

  // Outer ripple 1
  const ripple1Radius = 10 + progress * 80;
  const ripple1Opacity = Math.max(0, 1 - progress);

  // Staggered ripple 2
  const progress2 = (progress + 0.35) % 1;
  const ripple2Radius = 10 + progress2 * 80;
  const ripple2Opacity = progress > 0.15 ? Math.max(0, 1 - progress2) : 0;

  // Blinking inner red dot
  const pulse = Math.abs(Math.sin(frame * 0.012));
  const dotRadius = 9 + pulse * 4;
  const dotOpacity = 0.85 + pulse * 0.15;

  return (
    <Group x={ping.x} y={ping.y}>
      <Circle
        radius={ripple1Radius}
        stroke="#ef4444"
        strokeWidth={3}
        opacity={ripple1Opacity * 0.9}
        listening={false}
      />
      <Circle
        radius={ripple2Radius}
        stroke="#f87171"
        strokeWidth={2}
        opacity={ripple2Opacity * 0.7}
        listening={false}
      />
      <Circle
        radius={18}
        fill="#ef4444"
        opacity={0.35 * dotOpacity}
        listening={false}
      />
      <Circle
        radius={dotRadius}
        fill="#ef4444"
        stroke="#ffffff"
        strokeWidth={2.5}
        shadowColor="#ef4444"
        shadowBlur={18}
        shadowOpacity={1}
        opacity={dotOpacity}
        listening={false}
      />
    </Group>
  );
};

interface MapCanvasProps {
  isMeasureMode?: boolean;
  isPingMode?: boolean;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({ isMeasureMode = false, isPingMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  const activeMap = useMapStore((state) => state.activeMap);
  const {
    viewportScale,
    viewportX,
    viewportY,
    stageWidth,
    stageHeight,
    selectedTokenId,
    selectedTokenType,
    fogToolMode,
    fogBrushSize,
    fogToolShape,
    drawingData,
    drawingTool,
    drawingColor,
    drawingStrokeWidth,
    drawingEmoji,
    drawingEmojiScale,
    effectPaintMode,
    effectType,
    addDrawingRegion,
    removeDrawingRegion,
    setEffectData,
    setViewportScale,
    setViewportPosition,
    setStageSize,
    selectToken,
    clearSelection,
    tokenLocks,
    setTokenLock,
    clearTokenLock,
    pings,
    addPing,
    removePing,
    fitMapToView,
    zoomTo,
  } = useMapStore();

  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const isGM = useIsGM();
  const tokenPositionsByMap = useMapStore((state) => state.tokenPositionsByMap);
  const measureShape = useMapStore((state) => state.measureShape);
  const { characters, moveCharacterPosition, updateCharacterDetails } = useCharacters();
  const { currentMapNPCs, moveNPCPosition, updateNPCInstanceDetails } = useNPCs();
  const { updateFogData, updateDrawingData, updateEffectData } = useMap();
  const canDrawOnMap = isGM || Boolean(session?.allowPlayersDrawings);

  const placedCharacters = useMemo(() => {
    if (!activeMap) return [];
    const mapPositions = tokenPositionsByMap[activeMap.id]?.characters;
    if (!mapPositions) return [];
    return characters
      .filter((char) => Boolean(mapPositions[char.id]))
      .map((char) => ({
        ...char,
        positionX: mapPositions[char.id].x,
        positionY: mapPositions[char.id].y,
      }));
  }, [activeMap, characters, tokenPositionsByMap]);

  useEffect(() => {
    clearSelection();
  }, [activeMap?.id, clearSelection]);

  const [mapImage] = useImage(activeMap?.imageUrl || '');
  const [currentFogStroke, setCurrentFogStroke] = useState<{ x: number; y: number }[]>([]);
  const [isPainting, setIsPainting] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectEnd, setRectEnd] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingRegion | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [selectedTokenKeys, setSelectedTokenKeys] = useState<string[]>([]);
  const [groupDragStartPositions, setGroupDragStartPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [effectPulse, setEffectPulse] = useState(0);

  const syncStageSize = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    setStageSize(width, height);
  }, [setStageSize]);

  // Handle container resize
  useLayoutEffect(() => {
    syncStageSize();

    // Use ResizeObserver for more accurate resize detection
    const resizeObserver = new ResizeObserver(() => {
      syncStageSize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', syncStageSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', syncStageSize);
    };
  }, [syncStageSize]);

  // Fit map to view when map changes or image loads
  useEffect(() => {
    if (activeMap && stageWidth > 0 && stageHeight > 0 && mapImage) {
      // Small delay to ensure stage size is properly set
      const timer = setTimeout(() => fitMapToView(), 100);
      return () => clearTimeout(timer);
    }
  }, [activeMap?.id, mapImage, stageWidth, stageHeight, fitMapToView]);

  useEffect(() => {
    setCurrentDrawing(null);
    setIsDrawing(false);
  }, [activeMap?.id]);

  useEffect(() => {
    if (!drawingTool || !canDrawOnMap) {
      setCurrentDrawing(null);
      setIsDrawing(false);
    }
  }, [drawingTool, canDrawOnMap]);

  useEffect(() => {
    if (!isMeasureMode) {
      setRulerStart(null);
      setRulerEnd(null);
      setIsMeasuring(false);
    }
  }, [isMeasureMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setEffectPulse((prev) => (prev + 1) % 100000), 40);
    return () => window.clearInterval(timer);
  }, []);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: any) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = viewportScale;
      const pointer = stage.getPointerPosition();

      const scaleBy = 1.1;
      const newScale =
        e.evt.deltaY > 0
          ? Math.max(0.1, oldScale / scaleBy)
          : Math.min(5, oldScale * scaleBy);

      // Calculate new position to zoom towards pointer
      const mousePointTo = {
        x: (pointer.x - viewportX) / oldScale,
        y: (pointer.y - viewportY) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      setViewportScale(newScale);
      setViewportPosition(newPos.x, newPos.y);
    },
    [viewportScale, viewportX, viewportY, setViewportScale, setViewportPosition]
  );

  // Handle stage drag
  const handleDragEnd = useCallback(
    (e: any) => {
      if (e.target === stageRef.current) {
        setViewportPosition(e.target.x(), e.target.y());
      }
    },
    [setViewportPosition]
  );

  // Handle background click to deselect
  const handleStageClick = useCallback(
    (e: any) => {
      if (e.target === stageRef.current || e.target.attrs?.name === 'background') {
        clearSelection();
        setSelectedTokenKeys([]);
      }
    },
    [clearSelection]
  );

  const buildTokenKey = useCallback(
    (type: 'character' | 'npc', id: string) => `${type}:${id}`,
    []
  );

  useEffect(() => {
    if (!selectedTokenId || !selectedTokenType) return;
    const key = buildTokenKey(selectedTokenType, selectedTokenId);
    setSelectedTokenKeys((prev) => (prev.includes(key) ? prev : [key]));
  }, [selectedTokenId, selectedTokenType, buildTokenKey]);


  const handleTokenDragStart = useCallback(
    async (id: string, type: 'character' | 'npc') => {
      if (!session || !currentUser) return;
      const tokenKey = buildTokenKey(type, id);
      setTokenLock(tokenKey, currentUser.username);
      const draggedKey = buildTokenKey(type, id);
      if (selectedTokenKeys.includes(draggedKey) && selectedTokenKeys.length > 1) {
        const positions: Record<string, { x: number; y: number }> = {};
        selectedTokenKeys.forEach((key) => {
          const [tokenType, tokenId] = key.split(':') as ['character' | 'npc', string];
          if (tokenType === 'character') {
            const token = characters.find((char) => char.id === tokenId);
            if (token) positions[key] = { x: token.positionX, y: token.positionY };
          } else {
            const token = currentMapNPCs.find((npc) => npc.id === tokenId);
            if (token) positions[key] = { x: token.positionX, y: token.positionY };
          }
        });
        setGroupDragStartPositions(positions);
      } else {
        setGroupDragStartPositions({});
      }
      await broadcastTokenLock({
        sessionId: session.id,
        tokenId: id,
        tokenType: type,
        username: currentUser.username,
      });
    },
    [session, currentUser, buildTokenKey, setTokenLock, selectedTokenKeys, characters, currentMapNPCs]
  );

  // Handle token movement
  const handleTokenDragEnd = useCallback(
    async (id: string, type: 'character' | 'npc', x: number, y: number) => {
      if (!session || !currentUser) return;
      const tokenKey = buildTokenKey(type, id);

      const draggedKey = buildTokenKey(type, id);
      const multiDrag = selectedTokenKeys.includes(draggedKey) && selectedTokenKeys.length > 1;

      try {
        if (multiDrag) {
          const start = groupDragStartPositions[draggedKey];
          if (start) {
            const deltaX = x - start.x;
            const deltaY = y - start.y;
            await Promise.all(
              selectedTokenKeys.map((key) => {
                const [tokenType, tokenId] = key.split(':') as ['character' | 'npc', string];
                const origin = groupDragStartPositions[key];
                if (!origin) return Promise.resolve({ success: true });
                const nextX = origin.x + deltaX;
                const nextY = origin.y + deltaY;
                return tokenType === 'character'
                  ? moveCharacterPosition(tokenId, nextX, nextY)
                  : moveNPCPosition(tokenId, nextX, nextY);
              })
            );
          }
        } else if (type === 'character') {
          await moveCharacterPosition(id, x, y);
        } else {
          await moveNPCPosition(id, x, y);
        }
      } finally {
        setGroupDragStartPositions({});
        clearTokenLock(tokenKey);
        await broadcastTokenUnlock({
          sessionId: session.id,
          tokenId: id,
          tokenType: type,
          username: currentUser.username,
        });
      }
    },
    [
      session,
      currentUser,
      buildTokenKey,
      moveCharacterPosition,
      moveNPCPosition,
      selectedTokenKeys,
      groupDragStartPositions,
      clearTokenLock,
    ]
  );

  // Can user move this token?
  const canMoveToken = useCallback(
    (type: 'character' | 'npc', id: string) => {
      if (isGM) return true;
      if (!currentUser) return false;
      const tokenKey = buildTokenKey(type, id);
      const lockOwner = tokenLocks[tokenKey];
      if (lockOwner && lockOwner !== currentUser.username) return false;
      return true;
    },
    [isGM, currentUser, tokenLocks, buildTokenKey]
  );

  const handleNPCSelect = useCallback(
    async (npcId: string, event?: any) => {
      const npc = currentMapNPCs.find((entry) => entry.id === npcId);
      if (!npc) return;

      const tokenKey = buildTokenKey('npc', npcId);
      const isAdditive = Boolean(event?.evt?.shiftKey || event?.evt?.ctrlKey || event?.evt?.metaKey);
      if (isAdditive) {
        setSelectedTokenKeys((prev) =>
          prev.includes(tokenKey) ? prev.filter((key) => key !== tokenKey) : [...prev, tokenKey]
        );
      } else {
        setSelectedTokenKeys([tokenKey]);
      }

      const isAlreadySelected = selectedTokenId === npcId && selectedTokenType === 'npc';
      selectToken(npcId, 'npc');

      const canRename = isGM || session?.allowPlayersRenameNpcs;
      if (!isAlreadySelected || !canRename) return;

      const nextName = prompt('Rename NPC', npc.displayName || 'NPC');
      if (nextName === null) return;
      const trimmed = nextName.trim();
      if (!trimmed || trimmed === npc.displayName) return;

      await updateNPCInstanceDetails(npcId, { displayName: trimmed });
    },
    [
      currentMapNPCs,
      buildTokenKey,
      selectedTokenId,
      selectedTokenType,
      selectToken,
      isGM,
      session?.allowPlayersRenameNpcs,
      updateNPCInstanceDetails,
    ]
  );

  const handleCharacterResize = useCallback(
    async (characterId: string, direction: 'increase' | 'decrease') => {
      const character = characters.find((entry) => entry.id === characterId);
      if (!character) return;

      const currentSize = character.size || 'medium';
      const currentIndex = TOKEN_SIZE_ORDER.indexOf(currentSize);
      if (currentIndex < 0) return;
      const nextIndex =
        direction === 'increase'
          ? Math.min(TOKEN_SIZE_ORDER.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      if (nextIndex === currentIndex) return;

      await updateCharacterDetails(characterId, { size: TOKEN_SIZE_ORDER[nextIndex] });
    },
    [characters, updateCharacterDetails]
  );

  const handleCharacterSelect = useCallback(
    (characterId: string, event?: any) => {
      const tokenKey = buildTokenKey('character', characterId);
      const isAdditive = Boolean(event?.evt?.shiftKey || event?.evt?.ctrlKey || event?.evt?.metaKey);
      if (isAdditive) {
        setSelectedTokenKeys((prev) =>
          prev.includes(tokenKey) ? prev.filter((key) => key !== tokenKey) : [...prev, tokenKey]
        );
      } else {
        setSelectedTokenKeys([tokenKey]);
      }
      selectToken(characterId, 'character');
    },
    [buildTokenKey, selectToken]
  );

  const handleNPCResize = useCallback(
    async (npcId: string, direction: 'increase' | 'decrease') => {
      const npc = currentMapNPCs.find((entry) => entry.id === npcId);
      if (!npc) return;
      const canResize = isGM || session?.allowPlayersMoveNpcs;
      if (!canResize) return;

      const currentSize = npc.size || 'medium';
      const currentIndex = TOKEN_SIZE_ORDER.indexOf(currentSize);
      if (currentIndex < 0) return;
      const nextIndex =
        direction === 'increase'
          ? Math.min(TOKEN_SIZE_ORDER.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);

      if (nextIndex === currentIndex) return;
      await updateNPCInstanceDetails(npcId, { size: TOKEN_SIZE_ORDER[nextIndex] });
    },
    [currentMapNPCs, isGM, session?.allowPlayersMoveNpcs, updateNPCInstanceDetails]
  );

  // Convert screen coordinates to map coordinates
  const screenToMap = useCallback(
    (screenX: number, screenY: number) => {
      return {
        x: (screenX - viewportX) / viewportScale,
        y: (screenY - viewportY) / viewportScale,
      };
    },
    [viewportX, viewportY, viewportScale]
  );

  const clampToMapBounds = useCallback(
    (point: { x: number; y: number }) => {
      if (!activeMap) return point;

      return {
        x: Math.max(0, Math.min(activeMap.width, point.x)),
        y: Math.max(0, Math.min(activeMap.height, point.y)),
      };
    },
    [activeMap]
  );

  const createDrawingRegion = useCallback(
    (shape: DrawingShape, startPoint: { x: number; y: number }): DrawingRegion | null => {
      if (!isDrawingColor(drawingColor)) return null;
      return {
        id: nanoid(),
        authorRole: isGM ? 'gm' : 'player',
        authorUsername: currentUser?.username,
        shape,
        points: shape === 'free' ? [startPoint] : [startPoint, startPoint],
        strokeWidth: drawingStrokeWidth,
        color: drawingColor,
        filled: false,
        emoji: shape === 'emoji' ? drawingEmoji : undefined,
        emojiScale: shape === 'emoji' ? drawingEmojiScale : undefined,
        createdAt: new Date().toISOString(),
      };
    },
    [drawingColor, drawingStrokeWidth, drawingEmoji, drawingEmojiScale, isGM, currentUser?.username]
  );

  const getDrawingBounds = useCallback((region: DrawingRegion) => {
    const xs = region.points.map((point) => point.x);
    const ys = region.points.map((point) => point.y);
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    if (region.shape === 'emoji') {
      const halfSize = Math.max(20, region.strokeWidth * 8 * (region.emojiScale ?? 1)) / 2;
      minX -= halfSize;
      maxX += halfSize;
      minY -= halfSize;
      maxY += halfSize;
    }

    return { minX, maxX, minY, maxY };
  }, []);

  const eraseAtPoint = useCallback(
    (mapPos: { x: number; y: number }) => {
      if (!activeMap || !canDrawOnMap) return;

      const pointToSegmentDist = (
        p: { x: number; y: number },
        v: { x: number; y: number },
        w: { x: number; y: number }
      ) => {
        const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
      };

      const reversed = [...drawingData].reverse();
      const erased = reversed.find((region) => {
        const hitRadius = Math.max(24, (region.strokeWidth || 3) * 4);
        const { minX, maxX, minY, maxY } = getDrawingBounds(region);

        if (
          mapPos.x < minX - hitRadius ||
          mapPos.x > maxX + hitRadius ||
          mapPos.y < minY - hitRadius ||
          mapPos.y > maxY + hitRadius
        ) {
          return false;
        }

        if (region.shape === 'emoji') {
          return true;
        }

        const points = region.points;
        if (!points || points.length === 0) return false;
        if (points.length === 1) {
          return Math.hypot(mapPos.x - points[0].x, mapPos.y - points[0].y) <= hitRadius;
        }

        for (let i = 0; i < points.length - 1; i++) {
          const dist = pointToSegmentDist(mapPos, points[i], points[i + 1]);
          if (dist <= hitRadius) {
            return true;
          }
        }
        return false;
      });

      if (erased) {
        const newDrawingData = drawingData.filter((region) => region.id !== erased.id);
        removeDrawingRegion(activeMap.id, erased.id);
        void updateDrawingData(activeMap.id, newDrawingData);
      }
    },
    [activeMap, canDrawOnMap, drawingData, getDrawingBounds, removeDrawingRegion, updateDrawingData]
  );

  const handleDrawingMouseDown = useCallback(
    (_e?: unknown) => {
      if (!drawingTool || !activeMap || !canDrawOnMap) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));

      if (drawingTool === 'eraser') {
        setIsErasing(true);
        eraseAtPoint(mapPos);
        return;
      }

      const newRegion = createDrawingRegion(drawingTool, mapPos);
      if (!newRegion) return;

      setIsDrawing(true);
      setCurrentDrawing(newRegion);
    },
    [
      drawingTool,
      activeMap,
      canDrawOnMap,
      clampToMapBounds,
      screenToMap,
      createDrawingRegion,
      eraseAtPoint,
    ]
  );

  const handleDrawingMouseMove = useCallback(
    (_e?: unknown) => {
      if (!drawingTool || !canDrawOnMap) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));

      if (drawingTool === 'eraser') {
        if (isErasing) {
          eraseAtPoint(mapPos);
        }
        return;
      }

      if (!isDrawing || !currentDrawing) return;

      setCurrentDrawing((prev) => {
        if (!prev) return prev;
        if (prev.shape === 'free') {
          const lastPoint = prev.points[prev.points.length - 1];
          if (lastPoint && lastPoint.x === mapPos.x && lastPoint.y === mapPos.y) {
            return prev;
          }
          return { ...prev, points: [...prev.points, mapPos] };
        }

        const nextPoints = [...prev.points];
        nextPoints[nextPoints.length - 1] = mapPos;
        return { ...prev, points: nextPoints };
      });
    },
    [drawingTool, canDrawOnMap, isErasing, eraseAtPoint, isDrawing, currentDrawing, clampToMapBounds, screenToMap]
  );

  const handleDrawingMouseUp = useCallback(
    (_e?: unknown) => {
      if (drawingTool === 'eraser') {
        setIsErasing(false);
        return;
      }

      if (!isDrawing || !currentDrawing || !activeMap || !canDrawOnMap) return;

    const start = currentDrawing.points[0];
    const end = currentDrawing.points[currentDrawing.points.length - 1];
    const delta = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
    const hasEnoughPoints =
      currentDrawing.shape === 'free'
        ? currentDrawing.points.length > 1
        : currentDrawing.shape === 'emoji'
          ? true
          : delta > 5;

    if (hasEnoughPoints) {
      const newDrawingData = [...drawingData, currentDrawing];
      addDrawingRegion(activeMap.id, currentDrawing);
      void updateDrawingData(activeMap.id, newDrawingData);
    }

    setIsDrawing(false);
    setCurrentDrawing(null);
  }, [
    isDrawing,
    currentDrawing,
    activeMap,
    drawingData,
    addDrawingRegion,
    updateDrawingData,
  ]);


  const handleEffectPaint = useCallback((_e?: unknown) => {
    if (!effectPaintMode || !isGM || !activeMap?.effectsEnabled || !activeMap.gridEnabled) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));
    const gridX = Math.floor((mapPos.x - activeMap.gridOffsetX) / activeMap.gridCellSize);
    const gridY = Math.floor((mapPos.y - activeMap.gridOffsetY) / activeMap.gridCellSize);
    if (gridX < 0 || gridY < 0) return;

    const existing = activeMap.effectData.find((tile) => tile.gridX === gridX && tile.gridY === gridY);
    const nextTiles: MapEffectTile[] = existing
      ? existing.type === effectType
        ? activeMap.effectData.filter((tile) => tile.id !== existing.id)
        : activeMap.effectData.map((tile) =>
            tile.id === existing.id
              ? { ...tile, type: effectType, seed: Math.floor(Math.random() * 100000) }
              : tile
          )
      : [
          ...activeMap.effectData,
          { id: nanoid(), gridX, gridY, type: effectType, seed: Math.floor(Math.random() * 100000) },
        ];

    setEffectData(activeMap.id, nextTiles);
    void updateEffectData(activeMap.id, nextTiles);
  }, [
    effectPaintMode,
    isGM,
    activeMap,
    clampToMapBounds,
    screenToMap,
    effectType,
    setEffectData,
    updateEffectData,
  ]);

  // Fog painting handlers
  const handleFogMouseDown = useCallback(
    (_e: unknown) => {
      if (!fogToolMode || !isGM || !activeMap) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));

      if (fogToolShape === 'rectangle') {
        setRectStart(mapPos);
        setRectEnd(mapPos);
      } else {
        setIsPainting(true);
        setCurrentFogStroke([mapPos]);
      }
    },
    [fogToolMode, fogToolShape, isGM, activeMap, screenToMap, clampToMapBounds]
  );

  const handleFogMouseMove = useCallback(
    (_e: unknown) => {
      if (!fogToolMode || !isGM) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));

      if (fogToolShape === 'rectangle' && rectStart) {
        setRectEnd(mapPos);
      } else if (isPainting) {
        setCurrentFogStroke((prev) => {
          const lastPoint = prev[prev.length - 1];
          if (lastPoint && lastPoint.x === mapPos.x && lastPoint.y === mapPos.y) {
            return prev;
          }
          return [...prev, mapPos];
        });
      }
    },
    [fogToolMode, fogToolShape, isGM, isPainting, rectStart, screenToMap, clampToMapBounds]
  );

  const handleFogMouseUp = useCallback(async (_e?: unknown) => {
    if (!fogToolMode || !isGM || !activeMap) return;

    const isWithinMap = (point: { x: number; y: number }) =>
      point.x >= 0 && point.y >= 0 && point.x <= activeMap.width && point.y <= activeMap.height;

    if (fogToolShape === 'rectangle' && rectStart && rectEnd) {
      // Create rectangle fog region constrained to map bounds
      const minX = Math.max(0, Math.min(rectStart.x, rectEnd.x));
      const minY = Math.max(0, Math.min(rectStart.y, rectEnd.y));
      const maxX = Math.min(activeMap.width, Math.max(rectStart.x, rectEnd.x));
      const maxY = Math.min(activeMap.height, Math.max(rectStart.y, rectEnd.y));

      // Only create if rectangle has some size
      if (maxX - minX > 5 && maxY - minY > 5) {
        // Convert rectangle to points (4 corners forming a closed path)
        const points = [
          { x: minX, y: minY },
          { x: maxX, y: minY },
          { x: maxX, y: maxY },
          { x: minX, y: maxY },
          { x: minX, y: minY },
        ];

        const newRegion: FogRegion = {
          type: fogToolMode,
          points,
          brushSize: Math.max(maxX - minX, maxY - minY),
        };

        const newFogData = [...activeMap.fogData, newRegion];
        await updateFogData(activeMap.id, newFogData);
      }

      setRectStart(null);
      setRectEnd(null);
    } else if (isPainting && currentFogStroke.length > 1) {
      const boundedStroke = currentFogStroke.filter(isWithinMap);

      if (boundedStroke.length > 1) {
        const newRegion: FogRegion = {
          type: fogToolMode,
          points: boundedStroke,
          brushSize: getFogBrushPixelSize(fogBrushSize),
        };

        const newFogData = [...activeMap.fogData, newRegion];
        await updateFogData(activeMap.id, newFogData);
      }

      setIsPainting(false);
      setCurrentFogStroke([]);
    }
  }, [
    fogToolMode,
    fogToolShape,
    isGM,
    activeMap,
    rectStart,
    rectEnd,
    isPainting,
    currentFogStroke,
    fogBrushSize,
    updateFogData,
  ]);

  // Zoom controls
  const handleZoomIn = () => zoomTo(viewportScale * 1.25);
  const handleZoomOut = () => zoomTo(viewportScale / 1.25);
  const handleFitToView = () => {
    // Ensure fit uses current container size (avoids stale stage dimensions)
    syncStageSize();
    requestAnimationFrame(() => fitMapToView());
  };



  const gridCellSize = activeMap?.gridCellSize ?? 0;
  const tokenSizeOverrideEnabled = activeMap?.tokenSizeOverrideEnabled ?? false;
  const mediumTokenSizePx = activeMap?.mediumTokenSizePx ?? null;
  const zoomPercent = Math.round(viewportScale * 100);
  const selectedNpc = useMemo(() => {
    if (selectedTokenType !== 'npc' || !selectedTokenId) return null;
    return currentMapNPCs.find((npc) => npc.id === selectedTokenId) ?? null;
  }, [currentMapNPCs, selectedTokenId, selectedTokenType]);
  const canResizeNpc = Boolean(isGM || session?.allowPlayersMoveNpcs);
  const selectedNpcSizeIndex = selectedNpc
    ? TOKEN_SIZE_ORDER.indexOf(selectedNpc.size || 'medium')
    : -1;

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-950 overflow-hidden relative"
      style={{ cursor: isPingMode || effectPaintMode || fogToolMode || (canDrawOnMap && drawingTool) ? 'crosshair' : 'default' }}
    >
      {activeMap ? (
          <Stage
            ref={stageRef}
            width={Math.max(1, stageWidth)}
            height={Math.max(1, stageHeight)}
            scaleX={viewportScale}
            scaleY={viewportScale}
            x={viewportX}
            y={viewportY}
            draggable={!isPingMode && !isMeasureMode && !effectPaintMode && !fogToolMode && !(canDrawOnMap && drawingTool)}
            onWheel={handleWheel}
            onDragEnd={handleDragEnd}
            onClick={handleStageClick}
            onMouseDown={(e) => {
              if (isPingMode) {
                const stage = stageRef.current;
                if (stage && activeMap) {
                  const pointer = stage.getPointerPosition();
                  const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));
                  const pingId = `ping_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
                  const ping = {
                    id: pingId,
                    mapId: activeMap.id,
                    x: mapPos.x,
                    y: mapPos.y,
                    createdAt: Date.now(),
                  };
                  addPing(ping);
                  if (session?.id) {
                    void broadcastMapPing({
                      sessionId: session.id,
                      mapId: activeMap.id,
                      x: mapPos.x,
                      y: mapPos.y,
                      id: pingId,
                    });
                  }
                }
                return;
              }
              if (isMeasureMode) {
                const stage = stageRef.current;
                if (stage) {
                  const pointer = stage.getPointerPosition();
                  const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));
                  setRulerStart(mapPos);
                  setRulerEnd(mapPos);
                  setIsMeasuring(true);
                }
                return;
              }
              if (effectPaintMode) handleEffectPaint(e);
              else if (fogToolMode) handleFogMouseDown(e);
              else if (canDrawOnMap && drawingTool) handleDrawingMouseDown(e);
            }}
            onMouseMove={(e) => {
              if (isMeasureMode && isMeasuring) {
                const stage = stageRef.current;
                if (stage) {
                  const pointer = stage.getPointerPosition();
                  const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));
                  setRulerEnd(mapPos);
                }
                return;
              }
              if (fogToolMode) handleFogMouseMove(e);
              else if (canDrawOnMap && drawingTool) handleDrawingMouseMove(e);
            }}
            onMouseUp={(e) => {
              if (isMeasureMode && isMeasuring) {
                setIsMeasuring(false);
                return;
              }
              if (fogToolMode) handleFogMouseUp(e);
              else if (canDrawOnMap && drawingTool) handleDrawingMouseUp(e);
            }}
            onMouseLeave={(e) => {
              if (fogToolMode) handleFogMouseUp(e);
              else if (canDrawOnMap && drawingTool) handleDrawingMouseUp(e);
            }}
          >
            {/* Map image layer */}
            <Layer key={`map-surface-${activeMap.id}`}>
              <KonvaImage
                image={mapImage}
                width={activeMap.width}
                height={activeMap.height}
                name="background"
              />
            </Layer>

            {/* Grid overlay */}
            {activeMap.gridEnabled && (
              <Layer>
                <GridOverlay
                  width={activeMap.width}
                  height={activeMap.height}
                  cellSize={gridCellSize}
                  offsetX={activeMap.gridOffsetX}
                  offsetY={activeMap.gridOffsetY}
                  color={activeMap.gridColor}
                />
              </Layer>
            )}

            {/* Drawing layer */}
            <Layer listening={false} hitGraphEnabled={false}>
              <DrawingLayer
                drawings={drawingData}
                isGM={isGM}
                currentDrawing={isDrawing ? currentDrawing : null}
              />
            </Layer>

            {activeMap.effectsEnabled && activeMap.gridEnabled && (
              <Layer listening={false} hitGraphEnabled={false}>
                <MapEffectsLayer map={activeMap} pulse={effectPulse} />
              </Layer>
            )}

            {/* NPC tokens (below player tokens) */}
            <Layer listening={!isMeasureMode && !isPingMode}>
              {currentMapNPCs
                .filter((npc) => npc.isVisible || isGM)
                .map((npc) => (
                  <Token
                    key={npc.id}
                    id={npc.id}
                    type="npc"
                    name={npc.displayName || 'NPC'}
                    imageUrl={npc.tokenUrl}
                    x={npc.positionX}
                    y={npc.positionY}
                    size={npc.size || 'medium'}
                    gridCellSize={gridCellSize}
                    tokenSizeOverrideEnabled={tokenSizeOverrideEnabled}
                    mediumTokenSizePx={mediumTokenSizePx}
                    isSelected={selectedTokenKeys.includes(buildTokenKey('npc', npc.id))}
                    isDraggable={canMoveToken('npc', npc.id)}
                    isHidden={!npc.isVisible}
                    isGM={isGM}
                    statusRingColor={npc.statusRingColor}
                    showResizeControls={isGM || session?.allowPlayersMoveNpcs}
                    onResize={(direction) => handleNPCResize(npc.id, direction)}
                    onSelect={(event) => handleNPCSelect(npc.id, event)}
                    onDragStart={() => handleTokenDragStart(npc.id, 'npc')}
                    onDragEnd={(x, y) => handleTokenDragEnd(npc.id, 'npc', x, y)}
                  />
                ))}
            </Layer>

            {/* Player character tokens */}
            {activeMap.showPlayerTokens && (
              <Layer listening={!isMeasureMode && !isPingMode}>
                {placedCharacters.map((char) => (
                  <Token
                    key={char.id}
                    id={char.id}
                    type="character"
                    name={char.name}
                    imageUrl={char.tokenUrl}
                    x={char.positionX}
                    y={char.positionY}
                    size={char.size || 'medium'}
                    gridCellSize={gridCellSize}
                    tokenSizeOverrideEnabled={tokenSizeOverrideEnabled}
                    mediumTokenSizePx={mediumTokenSizePx}
                    isSelected={selectedTokenKeys.includes(buildTokenKey('character', char.id))}
                    isDraggable={canMoveToken('character', char.id)}
                    isHidden={false}
                    isGM={isGM}
                    statusRingColor={char.statusRingColor}
                    showResizeControls={isGM}
                    onResize={(direction) => handleCharacterResize(char.id, direction)}
                    onSelect={(event) => handleCharacterSelect(char.id, event)}
                    onDragStart={() => handleTokenDragStart(char.id, 'character')}
                    onDragEnd={(x, y) => handleTokenDragEnd(char.id, 'character', x, y)}
                  />
                ))}
              </Layer>
            )}

            {/* Fog of war layer */}
            {activeMap.fogEnabled && (
              <Layer listening={false} hitGraphEnabled={false}>
                <FogLayer
                  width={activeMap.width}
                  height={activeMap.height}
                  fogData={activeMap.fogData}
                  defaultState={activeMap.fogDefaultState}
                  isGM={isGM}
                  currentStroke={isPainting ? currentFogStroke : []}
                  currentBrushSize={getFogBrushPixelSize(fogBrushSize)}
                  currentMode={fogToolMode}
                  rectStart={rectStart}
                  rectEnd={rectEnd}
                  fogToolShape={fogToolShape}
                />
              </Layer>
            )}

            {/* Distance / AoE Measurement Ruler Layer */}
            {rulerStart && rulerEnd && (
              <Layer listening={false} hitGraphEnabled={false}>
                {(() => {
                  const dx = rulerEnd.x - rulerStart.x;
                  const dy = rulerEnd.y - rulerStart.y;
                  const distancePx = Math.hypot(dx, dy);
                  const cellSize = activeMap?.gridCellSize || 50;
                  const feet = Math.round((distancePx / cellSize) * 5);
                  const squares = (distancePx / cellSize).toFixed(1);

                  if (measureShape === 'radius') {
                    const midX = (rulerStart.x + rulerEnd.x) / 2;
                    const midY = (rulerStart.y + rulerEnd.y) / 2;

                    return (
                      <>
                        <Circle
                          x={rulerStart.x}
                          y={rulerStart.y}
                          radius={distancePx}
                          fill="rgba(56, 189, 248, 0.25)"
                          stroke="#38bdf8"
                          strokeWidth={2 / viewportScale}
                          dash={[8 / viewportScale, 4 / viewportScale]}
                        />
                        <Line
                          points={[rulerStart.x, rulerStart.y, rulerEnd.x, rulerEnd.y]}
                          stroke="#38bdf8"
                          strokeWidth={3 / viewportScale}
                          dash={[6 / viewportScale, 3 / viewportScale]}
                        />
                        <Circle x={rulerStart.x} y={rulerStart.y} radius={5 / viewportScale} fill="#38bdf8" />
                        <Circle x={rulerEnd.x} y={rulerEnd.y} radius={5 / viewportScale} fill="#38bdf8" />

                        <Group x={midX} y={midY - 18 / viewportScale}>
                          <Rect
                            x={-70 / viewportScale}
                            y={-12 / viewportScale}
                            width={140 / viewportScale}
                            height={24 / viewportScale}
                            fill="rgba(15, 23, 42, 0.9)"
                            stroke="#38bdf8"
                            strokeWidth={1 / viewportScale}
                            cornerRadius={6 / viewportScale}
                          />
                          <Text
                            x={-70 / viewportScale}
                            y={-6 / viewportScale}
                            width={140 / viewportScale}
                            align="center"
                            text={`Radius: ${feet} ft (${squares} sq)`}
                            fontSize={11 / viewportScale}
                            fontStyle="bold"
                            fill="#38bdf8"
                          />
                        </Group>
                      </>
                    );
                  }

                  if (measureShape === 'cone') {
                    const angleRad = Math.atan2(dy, dx);
                    const angleDeg = (angleRad * 180) / Math.PI;
                    const rotationDeg = angleDeg - 30;

                    return (
                      <>
                        <Wedge
                          x={rulerStart.x}
                          y={rulerStart.y}
                          radius={distancePx}
                          angle={60}
                          rotation={rotationDeg}
                          fill="rgba(56, 189, 248, 0.25)"
                          stroke="#38bdf8"
                          strokeWidth={2 / viewportScale}
                          dash={[8 / viewportScale, 4 / viewportScale]}
                        />
                        <Line
                          points={[rulerStart.x, rulerStart.y, rulerEnd.x, rulerEnd.y]}
                          stroke="#38bdf8"
                          strokeWidth={3 / viewportScale}
                          dash={[6 / viewportScale, 3 / viewportScale]}
                        />
                        <Circle x={rulerStart.x} y={rulerStart.y} radius={5 / viewportScale} fill="#38bdf8" />
                        <Circle x={rulerEnd.x} y={rulerEnd.y} radius={5 / viewportScale} fill="#38bdf8" />

                        <Group x={rulerEnd.x} y={rulerEnd.y - 18 / viewportScale}>
                          <Rect
                            x={-65 / viewportScale}
                            y={-12 / viewportScale}
                            width={130 / viewportScale}
                            height={24 / viewportScale}
                            fill="rgba(15, 23, 42, 0.9)"
                            stroke="#38bdf8"
                            strokeWidth={1 / viewportScale}
                            cornerRadius={6 / viewportScale}
                          />
                          <Text
                            x={-65 / viewportScale}
                            y={-6 / viewportScale}
                            width={130 / viewportScale}
                            align="center"
                            text={`Cone: ${feet} ft (${squares} sq)`}
                            fontSize={11 / viewportScale}
                            fontStyle="bold"
                            fill="#38bdf8"
                          />
                        </Group>
                      </>
                    );
                  }

                  // Default Line measurement
                  const midX = (rulerStart.x + rulerEnd.x) / 2;
                  const midY = (rulerStart.y + rulerEnd.y) / 2;

                  return (
                    <>
                      <Line
                        points={[rulerStart.x, rulerStart.y, rulerEnd.x, rulerEnd.y]}
                        stroke="#38bdf8"
                        strokeWidth={4 / viewportScale}
                        dash={[8 / viewportScale, 4 / viewportScale]}
                      />
                      <Circle x={rulerStart.x} y={rulerStart.y} radius={5 / viewportScale} fill="#38bdf8" />
                      <Circle x={rulerEnd.x} y={rulerEnd.y} radius={5 / viewportScale} fill="#38bdf8" />

                      <Group x={midX} y={midY - 18 / viewportScale}>
                        <Rect
                          x={-55 / viewportScale}
                          y={-12 / viewportScale}
                          width={110 / viewportScale}
                          height={24 / viewportScale}
                          fill="rgba(15, 23, 42, 0.9)"
                          stroke="#38bdf8"
                          strokeWidth={1 / viewportScale}
                          cornerRadius={6 / viewportScale}
                        />
                        <Text
                          x={-55 / viewportScale}
                          y={-6 / viewportScale}
                          width={110 / viewportScale}
                          align="center"
                          text={`${feet} ft (${squares} sq)`}
                          fontSize={11 / viewportScale}
                          fontStyle="bold"
                          fill="#38bdf8"
                        />
                      </Group>
                    </>
                  );
                })()}
              </Layer>
            )}

            {/* Pings Overlay Layer */}
            <Layer key="pings-layer">
              {pings
                .filter((p) => p.mapId === activeMap.id)
                .map((ping) => (
                  <PingMarker key={ping.id} ping={ping} onComplete={removePing} />
                ))}
            </Layer>
          </Stage>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 text-lg mb-2">No map loaded</p>
              {isGM ? (
                <p className="text-slate-500 text-sm">
                  Upload a map from the GM panel to get started
                </p>
              ) : (
                <p className="text-slate-500 text-sm">
                  Waiting for GM to load a map...
                </p>
              )}
            </div>
          </div>
        )}

      {/* Fog tool indicator */}
      {fogToolMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
          <span className="text-slate-100">
            Fog Tool: <span className="font-semibold capitalize">{fogToolMode}</span>
            {' - '}
            <span className="capitalize">{fogToolShape}</span>
          </span>
        </div>
      )}

      {effectPaintMode && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 text-white px-3 py-1 rounded-lg text-sm">
          Effect Paint: <span className="font-semibold capitalize">{effectType}</span>
        </div>
      )}

      {/* Drawing tool indicator */}
      {drawingTool && canDrawOnMap && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-slate-950/50 px-4 py-1.5 backdrop-blur-2xl shadow-2xl text-slate-100 text-xs font-semibold">
          <span>
            Drawing Tool: <span className="font-semibold capitalize text-blue-400">{drawingTool}</span>
          </span>
        </div>
      )}

      {/* Map controls overlay - Bottom left */}
      {activeMap && (
        <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-30">
          {/* Zoom controls */}
          <div className="bg-slate-950/50 backdrop-blur-2xl rounded-2xl border border-white/15 p-2.5 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-slate-700/60 rounded-xl transition-colors text-slate-300 hover:text-slate-100"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {/* Zoom slider */}
              <input
                type="range"
                min="10"
                max="500"
                value={zoomPercent}
                onChange={(e) => zoomTo(parseInt(e.target.value) / 100)}
                className="w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />

              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-slate-700/60 rounded-xl transition-colors text-slate-300 hover:text-slate-100"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">{zoomPercent}%</span>
              <button
                onClick={handleFitToView}
                className="p-1.5 hover:bg-slate-700/60 rounded-xl transition-colors text-slate-300 hover:text-slate-100"
                title="Fit to View"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
          {selectedNpc && canResizeNpc && selectedNpcSizeIndex >= 0 && (
            <div className="bg-slate-950/50 backdrop-blur-2xl rounded-2xl border border-white/15 p-2.5 shadow-2xl">
              <div className="text-xs text-slate-400 mb-2">
                NPC Size:{' '}
                <span className="text-slate-200">{selectedNpc.displayName || 'NPC'}</span>
              </div>
              <input
                type="range"
                min="0"
                max={TOKEN_SIZE_ORDER.length - 1}
                value={selectedNpcSizeIndex}
                onChange={(e) => {
                  const nextIndex = parseInt(e.target.value, 10);
                  const nextSize = TOKEN_SIZE_ORDER[nextIndex];
                  if (nextSize) {
                    void updateNPCInstanceDetails(selectedNpc.id, { size: nextSize });
                  }
                }}
                className="w-40 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-tempest-400"
              />
              <div className="mt-1 text-xs text-slate-500 capitalize">
                {TOKEN_SIZE_ORDER[selectedNpcSizeIndex]}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Token Popover */}
      <TokenPopover />
    </div>
  );
};
