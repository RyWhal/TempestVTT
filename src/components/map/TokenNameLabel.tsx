import { Text } from 'react-konva';
import { getTokenPixelSize } from '../../lib/tokenSizing';
import type { TokenProps } from './Token';

type TokenNameLabelProps = Pick<TokenProps, 'id' | 'type' | 'name' | 'x' | 'y' | 'size' | 'gridCellSize' | 'tokenSizeOverrideEnabled' | 'mediumTokenSizePx' | 'isHidden' | 'isGM'>;

export function TokenNameLabel(props: TokenNameLabelProps) {
  if (props.isHidden && !props.isGM) return null;
  const pixelSize = getTokenPixelSize(props);
  const width = Math.max(80, pixelSize, props.gridCellSize * 1.8);
  return <Text name={`token-label:${props.type}:${props.id}`} x={props.x + (pixelSize - width) / 2}
    y={props.y + pixelSize + 4} width={width} text={props.name} fontSize={12}
    fill="#e5e7eb" align="center" ellipsis wrap="none" listening={false}
    opacity={props.isHidden ? 0.4 : 1} />;
}
