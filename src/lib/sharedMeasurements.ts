export type MeasurementPoint = { x: number; y: number };
export type SharedMeasurement = {
  sessionId: string;
  mapId: string;
  owner: string;
  id: string;
  startedAt: number;
  sequence: number;
  sentAt: number;
  phase: 'dragging' | 'released' | 'dismissed';
  shape: 'line' | 'radius' | 'cone';
  start: MeasurementPoint;
  end: MeasurementPoint;
};

export const MEASUREMENT_HOLD_MS = 10_000;
export const MEASUREMENT_FADE_MS = 300;
export const MEASUREMENT_STALE_MS = 4_000;

/** Ephemeral messages are never accepted for another map or persisted as map data. */
export function parseMeasurement(raw: unknown, sessionId: string, mapId: string, now: number): SharedMeasurement | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as SharedMeasurement;
  const point = (v: MeasurementPoint) => v && Number.isFinite(v.x) && Number.isFinite(v.y)
    && Math.abs(v.x) <= 1_000_000 && Math.abs(v.y) <= 1_000_000;
  if (p.sessionId !== sessionId || p.mapId !== mapId
    || typeof p.owner !== 'string' || !p.owner || p.owner.length > 200
    || typeof p.id !== 'string' || !p.id || p.id.length > 100
    || !Number.isSafeInteger(p.startedAt) || p.startedAt < 0
    || !Number.isSafeInteger(p.sequence) || p.sequence < 0
    || !Number.isSafeInteger(p.sentAt) || Math.abs(now - p.sentAt) > 15_000
    || !['dragging', 'released', 'dismissed'].includes(p.phase)
    || !['line', 'radius', 'cone'].includes(p.shape)
    || !point(p.start) || !point(p.end)) return null;
  return p;
}

/** Retaining the last packet also retains dismissal tombstones against late packets. */
export function acceptMeasurement(previous: SharedMeasurement | undefined, next: SharedMeasurement): boolean {
  if (!previous) return true;
  if (previous.id !== next.id) {
    return next.startedAt > previous.startedAt
      || (next.startedAt === previous.startedAt && next.id > previous.id);
  }
  if (next.sequence <= previous.sequence || previous.phase === 'dismissed') return false;
  return previous.phase !== 'released' || next.phase === 'dismissed';
}
