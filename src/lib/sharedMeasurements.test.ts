import { describe, expect, it } from 'vitest';
import { acceptMeasurement, parseMeasurement, type SharedMeasurement } from './sharedMeasurements';

const frame = (changes: Partial<SharedMeasurement> = {}): SharedMeasurement => ({
  sessionId: 'session', mapId: 'map', owner: 'Kaladin', id: 'stroke',
  startedAt: 1000, sequence: 1, sentAt: 1000, phase: 'dragging',
  shape: 'line', start: { x: 10, y: 20 }, end: { x: 110, y: 20 }, ...changes,
});

describe('shared measurement packets', () => {
  it('validates map scope and finite coordinates', () => {
    expect(parseMeasurement(frame(), 'session', 'map', 1000)).toEqual(frame());
    expect(parseMeasurement(frame(), 'other', 'map', 1000)).toBeNull();
    expect(parseMeasurement(frame(), 'session', 'other', 1000)).toBeNull();
    expect(parseMeasurement(frame({ end: { x: Infinity, y: 0 } }), 'session', 'map', 1000)).toBeNull();
    expect(parseMeasurement(frame({ owner: '' }), 'session', 'map', 1000)).toBeNull();
    expect(parseMeasurement(frame({ sentAt: 1 }), 'session', 'map', 20000)).toBeNull();
  });

  it('ignores older or duplicate updates and keeps a dismissal tombstone', () => {
    const previous = frame({ sequence: 3, phase: 'dismissed' });
    expect(acceptMeasurement(previous, frame({ sequence: 2 }))).toBe(false);
    expect(acceptMeasurement(previous, frame({ sequence: 3 }))).toBe(false);
    expect(acceptMeasurement(previous, frame({ sequence: 4 }))).toBe(false);
    expect(acceptMeasurement(previous, frame({ id: 'next', startedAt: 2000 }))).toBe(true);
  });

  it('cannot restore dragging after release and replaces only with a newer gesture', () => {
    const released = frame({ phase: 'released', sequence: 4 });
    expect(acceptMeasurement(released, frame({ sequence: 5 }))).toBe(false);
    expect(acceptMeasurement(released, frame({ phase: 'dismissed', sequence: 5 }))).toBe(true);
    expect(acceptMeasurement(released, frame({ id: 'old', startedAt: 999 }))).toBe(false);
  });
});
