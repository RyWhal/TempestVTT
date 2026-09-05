/* @vitest-environment jsdom */
import type { ReactNode } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FogLayer } from './FogLayer';
import type { FogRegion } from '../../types';

const capture = vi.hoisted(() => ({ images: [] as Array<{ image: HTMLCanvasElement; width: number; height: number }> }));
vi.mock('react-konva', () => ({
  Group: ({ children }: { children: ReactNode }) => <>{children}</>,
  Image: (props: { image: HTMLCanvasElement; width: number; height: number }) => { capture.images.push(props); return null; },
  Line: () => null,
  Rect: () => null,
}));

const contexts = new Map<HTMLCanvasElement, { scale: ReturnType<typeof vi.fn>; fillRect: ReturnType<typeof vi.fn>; clearRect: ReturnType<typeof vi.fn>; globalCompositeOperation: string }>();
const base = { width: 1000, height: 800, fogData: [] as FogRegion[], defaultState: 'fogged' as const, isGM: false, currentStroke: [], currentBrushSize: 20, currentMode: null };

describe('FogLayer mask freshness', () => {
  beforeEach(() => {
    capture.images.length = 0;
    contexts.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      const context = { scale: vi.fn(), fillRect: vi.fn(), clearRect: vi.fn(), globalCompositeOperation: 'source-over' };
      contexts.set(this, context);
      return context as unknown as CanvasRenderingContext2D;
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('provides the composed mask on the first rendered image', () => {
    render(<FogLayer {...base} />);
    expect(capture.images).toHaveLength(1);
    const canvas = capture.images[0].image;
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(contexts.get(canvas)?.fillRect).toHaveBeenCalledWith(0, 0, 1000, 800);
  });

  it('renders changed fog with its new mask immediately', () => {
    const { rerender } = render(<FogLayer {...base} />);
    const previous = capture.images[0].image;
    const reveal: FogRegion = { type: 'reveal', brushSize: 20, points: [{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 50, y: 60 }, { x: 10, y: 60 }, { x: 10, y: 20 }] };
    capture.images.length = 0;
    rerender(<FogLayer {...base} fogData={[reveal]} />);
    expect(capture.images).toHaveLength(1);
    const canvas = capture.images[0].image;
    expect(canvas).not.toBe(previous);
    expect(contexts.get(canvas)?.globalCompositeOperation).toBe('destination-out');
    expect(contexts.get(canvas)?.fillRect).toHaveBeenLastCalledWith(10, 20, 40, 40);
  });

  it.each([[20000, 10000], [10000, 20000], [5000, 5000]])('bounds mask allocation for a %s x %s map without shrinking display dimensions', (width, height) => {
    render(<FogLayer {...base} width={width} height={height} />);
    const props = capture.images[0];
    expect(props.width).toBe(width);
    expect(props.height).toBe(height);
    expect(props.image.width).toBeLessThanOrEqual(4096);
    expect(props.image.height).toBeLessThanOrEqual(4096);
    expect(contexts.get(props.image)?.scale).toHaveBeenCalledWith(props.image.width / width, props.image.height / height);
  });
});
