/* @vitest-environment jsdom */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Token } from './Token';

const handlers = vi.hoisted(() => ({ dragEnd: null as null | ((event: unknown) => Promise<void>) }));

vi.mock('use-image', () => ({
  default: () => [null],
}));

vi.mock('react-konva', () => ({
  Group: React.forwardRef<HTMLDivElement, { children: React.ReactNode; onDragEnd: typeof handlers.dragEnd }>(({ children, onDragEnd }, ref) => {
    if (onDragEnd) handlers.dragEnd = onDragEnd;
    return <div ref={ref}>{children}</div>;
  }),
  Circle: (props: { radius: number }) => <div data-testid="token-circle" data-radius={String(props.radius)} />,
  Text: (props: { text: string }) => <div>{props.text}</div>,
  Image: () => <div />,
  Ring: () => <div />,
}));

describe('Token token-size override rendering', () => {
  it('restores the rendered node to its saved coordinates when a drag cannot be saved', async () => {
    const onDragEnd = vi.fn().mockResolvedValue(undefined);
    render(<Token id="pc" type="character" name="PC" imageUrl={null}
      x={10} y={20} size="medium" gridCellSize={50} tokenSizeOverrideEnabled={false}
      mediumTokenSizePx={null} isSelected isDraggable isHidden={false} isGM
      onSelect={() => {}} onDragEnd={onDragEnd} />);
    const batchDraw = vi.fn();
    const node = { x: () => 200, y: () => 300, position: vi.fn(), getLayer: () => ({ batchDraw }) };
    await act(async () => { await handlers.dragEnd?.({ target: node }); });
    expect(onDragEnd).toHaveBeenCalledWith(200, 300);
    expect(node.position).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(batchDraw).toHaveBeenCalledOnce();
  });

  it('uses mediumTokenSizePx when computing footprint with override enabled', () => {
    render(
      <Token
        id="char_001"
        type="character"
        name="Kaladin"
        imageUrl={null}
        x={0}
        y={0}
        size="large"
        gridCellSize={50}
        tokenSizeOverrideEnabled
        mediumTokenSizePx={72}
        isSelected={false}
        isDraggable={false}
        isHidden={false}
        isGM
        onSelect={() => {}}
        onDragEnd={() => {}}
      />
    );

    expect(screen.getByTestId('token-circle').getAttribute('data-radius')).toBe('72');
  });
});
