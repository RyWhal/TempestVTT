import { Circle, Group, Layer, Line, Rect, Text, Wedge } from 'react-konva';
import { usePlayerAccent } from '../../hooks/usePlayerAccents';
import { MEASUREMENT_FADE_MS } from '../../lib/sharedMeasurements';
import type { VisibleMeasurement } from '../../hooks/useSharedMeasurements';

function Measurement({ measurement: m, scale, cellSize, own, now }: {
  measurement: VisibleMeasurement; scale: number; cellSize: number; own: boolean; now: number;
}) {
  const color = usePlayerAccent(m.owner);
  const dx = m.end.x - m.start.x;
  const dy = m.end.y - m.start.y;
  const radius = Math.hypot(dx, dy);
  const feet = Math.round(radius / cellSize * 5);
  const squares = (radius / cellSize).toFixed(1);
  const title = m.shape === 'line' ? '' : m.shape === 'radius' ? 'Radius ' : 'Cone ';
  const label = `${m.owner.slice(0, 32)}${m.private ? ' (private)' : ''} · ${title}${feet} ft (${squares} sq)`;
  const width = Math.max(150, Math.min(420, label.length * 6.5 + 20));
  const x = m.shape === 'cone' ? m.end.x : (m.start.x + m.end.x) / 2;
  const y = m.shape === 'cone' ? m.end.y : (m.start.y + m.end.y) / 2;
  const opacity = Math.max(0, Math.min(1, (m.expiresAt + MEASUREMENT_FADE_MS - now) / MEASUREMENT_FADE_MS));
  return <Group opacity={opacity} listening={false}>
    {m.shape === 'radius' && <Circle x={m.start.x} y={m.start.y} radius={radius}
      fill={color} opacity={own ? 0.14 : 0.06} />}
    {m.shape === 'radius' && <Circle x={m.start.x} y={m.start.y} radius={radius}
      stroke={color} strokeWidth={(own ? 2 : 1.5) / scale} dash={[8 / scale, 4 / scale]} />}
    {m.shape === 'cone' && <Wedge x={m.start.x} y={m.start.y} radius={radius}
      angle={60} rotation={Math.atan2(dy, dx) * 180 / Math.PI - 30}
      fill={color} opacity={own ? 0.14 : 0.06} />}
    {m.shape === 'cone' && <Wedge x={m.start.x} y={m.start.y} radius={radius}
      angle={60} rotation={Math.atan2(dy, dx) * 180 / Math.PI - 30}
      stroke={color} strokeWidth={(own ? 2 : 1.5) / scale} dash={[8 / scale, 4 / scale]} />}
    <Line points={[m.start.x, m.start.y, m.end.x, m.end.y]} stroke={color}
      strokeWidth={(own ? 3 : 1.5) / scale} dash={[8 / scale, 4 / scale]} />
    <Circle x={m.start.x} y={m.start.y} radius={4 / scale} fill={color} />
    <Circle x={m.end.x} y={m.end.y} radius={4 / scale} fill={color} />
    <Group x={x} y={y - 20 / scale}>
      <Rect x={-width / 2 / scale} y={-12 / scale} width={width / scale} height={24 / scale}
        fill="rgba(15, 23, 42, 0.94)" stroke={color} strokeWidth={1 / scale} cornerRadius={6 / scale} />
      <Text x={-width / 2 / scale} y={-5.5 / scale} width={width / scale} text={label}
        align="center" fontSize={11 / scale} fontStyle="bold" fill={color} />
    </Group>
  </Group>;
}

export function MeasurementOverlay({ measurements, scale, cellSize, owner, showOthers, now }: {
  measurements: VisibleMeasurement[]; scale: number; cellSize: number; owner?: string; showOthers: boolean; now: number;
}) {
  return <Layer listening={false} hitGraphEnabled={false}>
    {measurements.filter((m) => (showOthers || m.owner === owner)
      && Math.hypot(m.end.x - m.start.x, m.end.y - m.start.y) >= 2).map((m) =>
      <Measurement key={`${m.owner}:${m.id}`} measurement={m} scale={scale} cellSize={cellSize || 50}
        own={m.owner === owner} now={now} />)}
  </Layer>;
}
