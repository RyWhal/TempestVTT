import { describe, expect, it, vi } from 'vitest';
import { drawCenteredDieLabel, drawPlotFace } from './diceLabels';

describe('dice numeral centering', () => {
  it.each([
    ['4', -3, 61, 72, 0],
    ['1', -12, 48, 71, 0],
    ['20', 2, 119, 73, 2],
    ['00', -4, 120, 72, 1],
    ['6', -2, 60, 72, 2],
    ['9', -1, 61, 71, 3],
  ] as const)('centers the visible bounds of %s including its orientation mark', (text, left, right, ascent, descent) => {
    const fillText = vi.fn(), fillRect = vi.fn();
    const ctx = {
      measureText: () => ({ actualBoundingBoxLeft: left, actualBoundingBoxRight: right,
        actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent }),
      fillText, fillRect,
    } as unknown as CanvasRenderingContext2D;
    const underline = text === '6' || text === '9';
    drawCenteredDieLabel(ctx, text, 128, 128, 100, underline);
    const [, x, baseline] = fillText.mock.calls[0];
    expect((x - left + x + right) / 2).toBeCloseTo(128);
    const bottom = underline ? fillRect.mock.calls[0][1] + fillRect.mock.calls[0][3] : baseline + descent;
    expect((baseline - ascent + bottom) / 2).toBeCloseTo(128);
    expect(fillRect).toHaveBeenCalledTimes(underline ? 1 : 0);
    expect(ctx.textBaseline).toBe('alphabetic');
  });
});

describe('plot face labels', () => {
  it.each([1, 2, 3, 4, 5, 6])('fits and centers both lines within face %i', value => {
    const bounds: { left: number; right: number; top: number; bottom: number }[] = [];
    const ctx = {
      font: '',
      measureText(this: CanvasRenderingContext2D, text: string) {
        const size = Number(this.font.match(/[\d.]+/)![0]);
        return { actualBoundingBoxLeft: -size * 0.04, actualBoundingBoxRight: size * text.length * 0.8,
          actualBoundingBoxAscent: size * 0.75, actualBoundingBoxDescent: size * 0.05 };
      },
      fillText(this: CanvasRenderingContext2D, text: string, x: number, y: number) {
        const m = this.measureText(text);
        bounds.push({ left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight,
          top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
      },
    } as unknown as CanvasRenderingContext2D;
    drawPlotFace(ctx, value, 0, 0, 80);
    expect(bounds).toHaveLength(2);
    for (const box of bounds) {
      expect((box.left + box.right) / 2).toBeCloseTo(0);
      for (const x of [box.left, box.right]) for (const y of [box.top, box.bottom]) {
        expect(Math.abs(x) + Math.abs(y)).toBeLessThan(80 * Math.SQRT2 * 0.91);
      }
    }
    expect((bounds[0].top + bounds[1].bottom) / 2).toBeCloseTo(0);
    expect(bounds[1].top).toBeGreaterThan(bounds[0].bottom);
  });
});
