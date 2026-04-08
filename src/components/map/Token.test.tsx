/* @vitest-environment jsdom */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Token } from './Token';

vi.mock('use-image', () => ({
  default: () => [null],
}));

vi.mock('react-konva', () => ({
  Group: React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(({ children }, ref) => (
    <div ref={ref}>{children}</div>
  )),
  Circle: (props: { radius: number }) => <div data-testid="token-circle" data-radius={String(props.radius)} />,
  Text: (props: { text: string }) => <div>{props.text}</div>,
  Image: () => <div />,
  Ring: () => <div />,
}));

describe('Token token-size override rendering', () => {
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
