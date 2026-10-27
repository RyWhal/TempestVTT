/* @vitest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenLayer } from './TokenLayer';
import type { TokenProps } from './Token';

vi.mock('use-image', () => ({ default: () => [null] }));
// The canvas raster and circular hit regions are covered by browser checks.
vi.mock('react-konva', () => ({
  Layer: ({ children, name, opacity = 1, listening = true }: { children: React.ReactNode; name: string; opacity?: number; listening?: boolean }) =>
    <div data-testid={name} data-opacity={opacity} data-listening={String(listening)}>{children}</div>,
  Group: React.forwardRef<HTMLDivElement, { children: React.ReactNode; name?: string; opacity?: number }>(({ children, name, opacity = 1 }, ref) =>
    <div ref={ref} data-token={name} data-opacity={opacity}>{children}</div>),
  Text: ({ text, name, opacity = 1 }: { text: string; name?: string; opacity?: number }) => <span data-label={name} data-opacity={opacity}>{text}</span>,
  Circle: () => null, Ring: () => null, Image: () => null,
}));
afterEach(cleanup);

const token = (id: string, type: TokenProps['type'], isHidden = false, isGM = false): TokenProps => ({
  id, type, name: id, imageUrl: null, x: 100, y: 100, size: 'tiny', gridCellSize: 50,
  tokenSizeOverrideEnabled: false, mediumTokenSizePx: null,
  isSelected: false, isDraggable: true, isHidden, isGM, onSelect: vi.fn(), onDragEnd: vi.fn(),
});
const tokens = [token('Tama', 'character'), token('Amaram', 'npc'), token('5', 'npc'), token('Secret', 'npc', true)];

describe('token name transparency', () => {
  it('fades only names and restores every PC/NPC name across repeated transparency cycles', () => {
    const { rerender } = render(<TokenLayer tokens={tokens} nameOpacity={1} />);
    for (const opacity of [0.5, 0, 1, 0, 1, 0.25, 1]) {
      rerender(<TokenLayer tokens={tokens} nameOpacity={opacity} />);
      const labels = screen.getByTestId('token-labels');
      const bodies = screen.getByTestId('token-bodies');
      expect(labels.getAttribute('data-opacity')).toBe(String(opacity));
      expect(labels.getAttribute('data-listening')).toBe('false');
      expect(bodies.getAttribute('data-opacity')).toBe('1');
      expect(bodies.getAttribute('data-listening')).toBe('true');
      expect([...labels.querySelectorAll('[data-label]')].map(node => node.textContent)).toEqual(['Tama', 'Amaram', '5']);
      expect(bodies.querySelectorAll('[data-token]')).toHaveLength(3);
      expect(within(labels).queryByText('Secret')).toBeNull();
    }
  });

  it('preserves hidden NPC treatment for GMs when names are faded and restored', () => {
    const gmTokens = tokens.map(item => ({ ...item, isGM: true }));
    const { rerender } = render(<TokenLayer tokens={gmTokens} nameOpacity={0} />);
    for (const opacity of [0, 0.5, 1]) {
      rerender(<TokenLayer tokens={gmTokens} nameOpacity={opacity} />);
      expect(within(screen.getByTestId('token-labels')).getByText('Secret').getAttribute('data-opacity')).toBe('0.4');
      expect(screen.getByTestId('token-bodies').querySelector('[data-token="token:npc:Secret"]')?.getAttribute('data-opacity')).toBe('0.4');
    }
  });

  it('keeps drawing-mode token interaction disabled regardless of name transparency', () => {
    render(<TokenLayer tokens={tokens} nameOpacity={0} interactionEnabled={false} />);
    expect(screen.getByTestId('token-bodies').getAttribute('data-listening')).toBe('false');
    expect(screen.getByTestId('token-bodies').getAttribute('data-opacity')).toBe('1');
  });
});
