import { describe, expect, it, vi } from 'vitest';
import { drawCenteredDieLabel } from './diceLabels';

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
