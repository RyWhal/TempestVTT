/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapCanvas } from './MapCanvas';
import { useMapStore } from '../../stores/mapStore';
import { useSessionStore } from '../../stores/sessionStore';
import type { DrawingRegion, Map, Session } from '../../types';

const mocks = vi.hoisted(() => ({
  erase: vi.fn().mockResolvedValue({ success: true }), update: vi.fn(), toast: vi.fn(),
  pointer: { x: 20, y: 20 },
  stageProps: {} as Record<string, (event: unknown) => void>,
}));
vi.mock('react-konva', () => ({
  Stage: React.forwardRef((props: { children: React.ReactNode }, ref) => {
    React.useImperativeHandle(ref, () => ({ getPointerPosition: () => mocks.pointer }));
    mocks.stageProps = props as unknown as typeof mocks.stageProps;
    return <>{props.children}</>;
  }),
  Layer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Group: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Image: () => null, Rect: () => null, Line: () => null, Circle: () => null, Text: () => null, Wedge: () => null,
}));
vi.mock('use-image', () => ({ default: () => [null] }));
vi.mock('./TokenPopover', () => ({ TokenPopover: () => null }));
vi.mock('./DrawingLayer', () => ({ DrawingLayer: () => null }));
vi.mock('../../hooks/useCharacters', () => ({ useCharacters: () => ({ characters: [], moveCharacterPosition: vi.fn() }) }));
vi.mock('../../hooks/useNPCs', () => ({ useNPCs: () => ({ currentMapNPCs: [] }) }));
vi.mock('../../hooks/useMap', () => ({ useMap: () => ({ eraseDrawingRegions: mocks.erase, updateDrawingData: mocks.update }) }));
vi.mock('../shared/Toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));

const drawing = (id: string, x: number): DrawingRegion => ({ id, shape: 'free', type: 'draw', color: '#000000', strokeWidth: 2, points: [{ x, y: 20 }, { x: x + 10, y: 20 }], visibility: 'public', createdBy: 'GM' } as unknown as DrawingRegion);

describe('map eraser persistence', () => {
  beforeEach(() => {
    mocks.erase.mockClear(); mocks.update.mockClear(); mocks.toast.mockClear();
    mocks.pointer = { x: 20, y: 20 };
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    useSessionStore.setState({ session: { id: 'session' } as Session, currentUser: { username: 'GM', characterId: null, isGm: true } });
    useMapStore.getState().clearMapState();
    const map = { id: 'a', width: 500, height: 500, drawingData: [drawing('first', 20), drawing('second', 200)], effectData: [], fogEnabled: false, gridEnabled: false } as unknown as Map;
    useMapStore.setState({ maps: [map], activeMap: map, drawingData: map.drawingData, drawingTool: 'eraser' });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('erases locally during the stroke and sends one ID batch on mouse-up', async () => {
    render(<MapCanvas />);
    act(() => mocks.stageProps.onMouseDown({}));
    mocks.pointer = { x: 200, y: 20 };
    act(() => mocks.stageProps.onMouseMove({}));
    act(() => mocks.stageProps.onMouseMove({}));
    expect(useMapStore.getState().drawingData).toEqual([]);
    expect(mocks.erase).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    await act(async () => mocks.stageProps.onMouseUp({}));
    expect(mocks.erase).toHaveBeenCalledTimes(1);
    expect(mocks.erase).toHaveBeenCalledWith('a', ['first', 'second']);
  });

  it('flushes a pending stroke to its original map when switching maps', async () => {
    render(<MapCanvas />);
    act(() => mocks.stageProps.onMouseDown({}));
    await act(async () => useMapStore.setState({ activeMap: { ...useMapStore.getState().activeMap!, id: 'b' }, drawingData: [] }));
    expect(mocks.erase).toHaveBeenCalledTimes(1);
    expect(mocks.erase).toHaveBeenCalledWith('a', ['first']);
  });
});
