import { useRef, useState } from 'react';
import { Layer } from 'react-konva';
import { Token, type TokenProps } from './Token';
import { TokenNameLabel } from './TokenNameLabel';
import { normalizeTokenOpacity } from '../../lib/tokenAppearance';

interface TokenLayerProps {
  tokens: TokenProps[];
  opacity?: number;
  interactionEnabled?: boolean;
}
interface DragPosition { x: number; y: number; sequence: number }

/** A single label pass below every body, including labels for the PC/NPC boundary. */
export function TokenLayer({ tokens, opacity, interactionEnabled = true }: TokenLayerProps) {
  const alpha = normalizeTokenOpacity(opacity);
  const [dragPositions, setDragPositions] = useState<Record<string, DragPosition>>({});
  const sequences = useRef<Record<string, number>>({});
  const nextSequence = useRef(0);
  const visibleTokens = tokens.filter(token => !token.isHidden || token.isGM);

  return <>
    <Layer name="token-labels" opacity={alpha} listening={false}>
      {visibleTokens.map(token => {
        const key = `${token.type}:${token.id}`;
        const position = dragPositions[key];
        return <TokenNameLabel key={key} {...token} x={position?.x ?? token.x} y={position?.y ?? token.y} />;
      })}
    </Layer>
    <Layer name="token-bodies" opacity={alpha} listening={interactionEnabled && alpha > 0}>
      {visibleTokens.map(token => {
        const key = `${token.type}:${token.id}`;
        return <Token key={key} {...token}
          onDragStart={() => {
            const sequence = ++nextSequence.current;
            sequences.current[key] = sequence;
            setDragPositions(previous => ({ ...previous, [key]: { x: token.x, y: token.y, sequence } }));
            token.onDragStart?.();
          }}
          onDragMove={(x, y) => {
            setDragPositions(previous => ({ ...previous, [key]: { x, y, sequence: sequences.current[key] } }));
            token.onDragMove?.(x, y);
          }}
          onDragEnd={async (x, y) => {
            const sequence = sequences.current[key];
            try {
              await token.onDragEnd(x, y);
            } finally {
              // A slow earlier save must not erase the position of a newer drag.
              if (sequences.current[key] === sequence) {
                delete sequences.current[key];
                setDragPositions(previous => {
                  if (previous[key]?.sequence !== sequence) return previous;
                  const next = { ...previous };
                  delete next[key];
                  return next;
                });
              }
            }
          }} />;
      })}
    </Layer>
  </>;
}
