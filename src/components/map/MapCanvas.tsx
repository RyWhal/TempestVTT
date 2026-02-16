import React, { useRef, useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import useImage from 'use-image';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Move,
} from 'lucide-react';
import { useMapStore, getFogBrushPixelSize } from '../../stores/mapStore';
import { useSessionStore, useIsGM } from '../../stores/sessionStore';
import { useCharacters } from '../../hooks/useCharacters';
import { useNPCs } from '../../hooks/useNPCs';
import { useMap } from '../../hooks/useMap';
import { broadcastTokenLock, broadcastTokenUnlock } from '../../lib/tokenBroadcast';
import { Token } from './Token';
import { GridOverlay } from './GridOverlay';
import { FogLayer } from './FogLayer';
import { DrawingLayer } from './DrawingLayer';
import { MapEffectsLayer } from './MapEffectsLayer';
import { HandoutViewer } from './HandoutViewer';
import type { FogRegion, DrawingRegion, DrawingShape, TokenSize, MapEffectTile } from '../../types';
import { isDrawingColor } from '../../types';
import { nanoid } from 'nanoid';
import { useSoundEffects } from '../../hooks/useSoundEffects';

const TOKEN_SIZE_ORDER: TokenSize[] = [
  'tiny',
  'small',
  'medium',
  'large',
  'huge',
  'gargantuan',
];

export const MapCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

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
    fitMapToView,
    panBy,
    zoomTo,
  } = useMapStore();

  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const isGM = useIsGM();
  const { characters, moveCharacterPosition, updateCharacterDetails } = useCharacters();
  const { currentMapNPCs, moveNPCPosition, updateNPCInstanceDetails } = useNPCs();
  const { updateFogData, updateDrawingData, updateEffectData } = useMap();
  const canDrawOnMap = isGM || Boolean(session?.allowPlayersDrawings);
  const { playSound } = useSoundEffects();

  const [mapImage] = useImage(activeMap?.imageUrl || '');
  const [currentFogStroke, setCurrentFogStroke] = useState<{ x: number; y: number }[]>([]);
  const [isPainting, setIsPainting] = useState(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(null);
  const [rectEnd, setRectEnd] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingRegion | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'handouts'>('map');
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
      void playSound('tokenPickup');
    },
    [session, currentUser, buildTokenKey, setTokenLock, selectedTokenKeys, characters, currentMapNPCs, playSound]
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
        void playSound('tokenDrop');
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
      playSound,
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
      void playSound('tokenSelect');

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
      playSound,
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
      void playSound('tokenSelect');
    },
    [buildTokenKey, selectToken, playSound]
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
    [drawingColor, drawingStrokeWidth, drawingEmoji, drawingEmojiScale, isGM]
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

  const handleDrawingMouseDown = useCallback(() => {
    if (!drawingTool || !activeMap || !canDrawOnMap) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));

    if (drawingTool === 'eraser') {
      const reversed = [...drawingData].reverse();
      const erased = reversed.find((region) => {
        const { minX, maxX, minY, maxY } = getDrawingBounds(region);
        return mapPos.x >= minX && mapPos.x <= maxX && mapPos.y >= minY && mapPos.y <= maxY;
      });

      if (erased) {
        const newDrawingData = drawingData.filter((region) => region.id !== erased.id);
        removeDrawingRegion(activeMap.id, erased.id);
        void updateDrawingData(activeMap.id, newDrawingData);
      }
      return;
    }

    const newRegion = createDrawingRegion(drawingTool, mapPos);
    if (!newRegion) return;

    setIsDrawing(true);
    setCurrentDrawing(newRegion);
  }, [
    drawingTool,
    activeMap,
    canDrawOnMap,
    drawingData,
    clampToMapBounds,
    screenToMap,
    createDrawingRegion,
    getDrawingBounds,
    removeDrawingRegion,
    updateDrawingData,
  ]);

  const handleDrawingMouseMove = useCallback(() => {
    if (!isDrawing || !currentDrawing || !canDrawOnMap) return;

    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    const mapPos = clampToMapBounds(screenToMap(pointer.x, pointer.y));

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
  }, [isDrawing, currentDrawing, canDrawOnMap, clampToMapBounds, screenToMap]);

  const handleDrawingMouseUp = useCallback(() => {
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


  const handleEffectPaint = useCallback(() => {
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

  const handleFogMouseUp = useCallback(async () => {
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

  // Pan controls
  const panStep = 100;
  const handlePanUp = () => panBy(0, panStep);
  const handlePanDown = () => panBy(0, -panStep);
  const handlePanLeft = () => panBy(panStep, 0);
  const handlePanRight = () => panBy(-panStep, 0);

  const isMapTab = activeTab === 'map';
  const gridCellSize = activeMap?.gridCellSize ?? 0;
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
      style={{ cursor: isMapTab && (effectPaintMode || fogToolMode || (canDrawOnMap && drawingTool)) ? 'crosshair' : 'default' }}
    >
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 backdrop-blur-sm p-1">
        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            isMapTab ? 'bg-slate-700 text-slate-100' : 'text-slate-300 hover:text-slate-100'
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('handouts')}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            !isMapTab ? 'bg-slate-700 text-slate-100' : 'text-slate-300 hover:text-slate-100'
          }`}
        >
          Handouts
        </button>
      </div>
      {isMapTab ? (
        activeMap ? (
          <Stage
            ref={stageRef}
            width={Math.max(1, stageWidth)}
            height={Math.max(1, stageHeight)}
            scaleX={viewportScale}
            scaleY={viewportScale}
            x={viewportX}
            y={viewportY}
            draggable={!effectPaintMode && !fogToolMode && !(canDrawOnMap && drawingTool)}
            onWheel={handleWheel}
            onDragEnd={handleDragEnd}
            onClick={handleStageClick}
            onMouseDown={
              effectPaintMode
                ? handleEffectPaint
                : fogToolMode
                  ? handleFogMouseDown
                  : canDrawOnMap && drawingTool
                    ? handleDrawingMouseDown
                    : undefined
            }
            onMouseMove={
              fogToolMode ? handleFogMouseMove : canDrawOnMap && drawingTool ? handleDrawingMouseMove : undefined
            }
            onMouseUp={
              fogToolMode ? handleFogMouseUp : canDrawOnMap && drawingTool ? handleDrawingMouseUp : undefined
            }
            onMouseLeave={
              fogToolMode ? handleFogMouseUp : canDrawOnMap && drawingTool ? handleDrawingMouseUp : undefined
            }
          >
            {/* Map image layer */}
            <Layer>
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
            <Layer>
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
              <Layer>
                {characters.map((char) => (
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
                />
              </Layer>
            )}

            {/* Rectangle selection preview for fog */}
            {fogToolMode && fogToolShape === 'rectangle' && rectStart && rectEnd && (
              <Layer listening={false} hitGraphEnabled={false}>
                <Rect
                  x={Math.min(rectStart.x, rectEnd.x)}
                  y={Math.min(rectStart.y, rectEnd.y)}
                  width={Math.abs(rectEnd.x - rectStart.x)}
                  height={Math.abs(rectEnd.y - rectStart.y)}
                  stroke={fogToolMode === 'reveal' ? '#00ff00' : '#ff0000'}
                  strokeWidth={2 / viewportScale}
                  dash={[10 / viewportScale, 5 / viewportScale]}
                  fill={fogToolMode === 'reveal' ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.2)'}
                />
              </Layer>
            )}
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
        )
      ) : (
        <HandoutViewer />
      )}

      {/* Fog tool indicator */}
      {fogToolMode && isMapTab && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
          <span className="text-slate-100">
            Fog Tool: <span className="font-semibold capitalize">{fogToolMode}</span>
            {' - '}
            <span className="capitalize">{fogToolShape}</span>
          </span>
        </div>
      )}

      {effectPaintMode && isMapTab && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 text-white px-3 py-1 rounded-lg text-sm">
          Effect Paint: <span className="font-semibold capitalize">{effectType}</span>
        </div>
      )}

      {/* Drawing tool indicator */}
      {drawingTool && canDrawOnMap && isMapTab && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
          <span className="text-slate-100">
            Drawing Tool: <span className="font-semibold capitalize">{drawingTool}</span>
          </span>
        </div>
      )}

      {/* Map controls overlay - Bottom left */}
      {isMapTab && activeMap && (
        <div className="absolute bottom-4 left-4 flex flex-col gap-2">
          {/* Zoom controls */}
          <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-2">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-slate-100"
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
                className="w-24 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-tempest-400"
              />

              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-slate-100"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">{zoomPercent}%</span>
              <button
                onClick={handleFitToView}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-slate-100"
                title="Fit to View"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Pan controls */}
          <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-2">
            <div className="grid grid-cols-3 gap-0.5 w-fit">
              <div />
              <button
                onClick={handlePanUp}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-slate-100"
                title="Pan Up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <div />
              <button
                onClick={handlePanLeft}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-slate-100"
                title="Pan Left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="p-1.5 flex items-center justify-center text-slate-500">
                <Move className="w-3 h-3" />
              </div>
              <button
                onClick={handlePanRight}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-slate-100"
                title="Pan Right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div />
              <button
                onClick={handlePanDown}
                className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-slate-100"
                title="Pan Down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <div />
            </div>
          </div>
          {selectedNpc && canResizeNpc && selectedNpcSizeIndex >= 0 && (
            <div className="bg-slate-900/90 backdrop-blur-sm rounded-lg border border-slate-700 p-2">
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

      {/* Map info overlay - Top right */}
      {isMapTab && activeMap && (
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700 pointer-events-none">
          <span className="text-sm text-slate-300">
            {activeMap.name} ({activeMap.width}x{activeMap.height})
          </span>
        </div>
      )}
    </div>
  );
};
