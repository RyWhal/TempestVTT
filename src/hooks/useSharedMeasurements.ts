import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { supabase } from '../lib/supabase';
import { acceptMeasurement, parseMeasurement, MEASUREMENT_HOLD_MS, MEASUREMENT_FADE_MS,
  MEASUREMENT_STALE_MS, type SharedMeasurement, type MeasurementPoint } from '../lib/sharedMeasurements';

export type VisibleMeasurement = SharedMeasurement & { expiresAt: number; private: boolean };
type Options = { sessionId?: string; mapId?: string; owner?: string; privateMeasurement: boolean };

/** One short-lived gesture per player. Transport is independent of map persistence. */
export function useSharedMeasurements({ sessionId, mapId, owner, privateMeasurement }: Options) {
  const [measurements, setMeasurements] = useState<VisibleMeasurement[]>([]);
  const [now, setNow] = useState(Date.now);
  const channel = useRef<RealtimeChannel | null>(null);
  const ready = useRef(false);
  const own = useRef<VisibleMeasurement | null>(null);
  const entries = useRef(new Map<string, VisibleMeasurement>());
  const lastSent = useRef(0);
  const pendingSend = useRef<ReturnType<typeof setTimeout>>();
  const refresh = useCallback(() => setMeasurements([...entries.current.values()]), []);

  const send = useCallback((measurement: VisibleMeasurement) => {
    if (!measurement.private && ready.current) {
      const { expiresAt: _expiresAt, private: _private, ...payload } = measurement;
      void channel.current?.send({ type: 'broadcast', event: 'measurement', payload }).catch(() => undefined);
      lastSent.current = Date.now();
    }
  }, []);

  const dismiss = useCallback(() => {
    const current = own.current;
    if (!current || current.phase === 'dismissed') return;
    const next: VisibleMeasurement = { ...current, phase: 'dismissed', sequence: current.sequence + 1,
      sentAt: Date.now(), expiresAt: Date.now() };
    own.current = next;
    clearTimeout(pendingSend.current);
    entries.current.set(current.owner, next);
    send(next);
    refresh();
  }, [refresh, send]);

  const release = useCallback(() => {
    const current = own.current;
    if (!current || current.phase !== 'dragging') return;
    // A click without a drag dismisses the previous ruler instead of leaving a zero-length one.
    if (Math.hypot(current.end.x - current.start.x, current.end.y - current.start.y) < 2) {
      dismiss();
      return;
    }
    const next: VisibleMeasurement = { ...current, phase: 'released', sequence: current.sequence + 1,
      sentAt: Date.now(), expiresAt: Date.now() + MEASUREMENT_HOLD_MS };
    own.current = next;
    clearTimeout(pendingSend.current);
    entries.current.set(current.owner, next);
    send(next);
    refresh();
  }, [dismiss, refresh, send]);

  useEffect(() => {
    entries.current.clear(); own.current = null; ready.current = false; refresh();
    if (!sessionId || !mapId || !owner) return;
    const connection = supabase.channel(`measurements:${sessionId}:${mapId}`, { config: { broadcast: { self: false } } });
    channel.current = connection;
    connection.on('broadcast', { event: 'measurement' }, ({ payload }) => {
      const receivedAt = Date.now();
      const parsed = parseMeasurement(payload, sessionId, mapId, receivedAt);
      if (!parsed || parsed.owner === owner || !acceptMeasurement(entries.current.get(parsed.owner), parsed)) return;
      // Cap retained owners, including tombstones, for malformed or hostile traffic.
      if (!entries.current.has(parsed.owner) && entries.current.size >= 256) return;
      entries.current.set(parsed.owner, { ...parsed, private: false,
        expiresAt: parsed.phase === 'dismissed' ? receivedAt
          : Math.min(receivedAt, parsed.sentAt) + (parsed.phase === 'released' ? MEASUREMENT_HOLD_MS : MEASUREMENT_STALE_MS) });
      refresh();
    }).subscribe((status) => {
      ready.current = status === 'SUBSCRIBED';
      if (ready.current && own.current && own.current.expiresAt > Date.now()) send(own.current);
    });
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      const current = own.current;
      if (current?.phase === 'dragging' && time - lastSent.current >= 1000) {
        const next = { ...current, sequence: current.sequence + 1, sentAt: time, expiresAt: time + MEASUREMENT_STALE_MS };
        own.current = next; entries.current.set(owner, next); send(next); refresh();
      }
    }, 100);
    const onPointerUp = () => release();
    const onCancel = () => dismiss();
    const onHidden = () => { if (document.hidden) dismiss(); };
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      dismiss();
      ready.current = false;
      channel.current = null;
      void supabase.removeChannel(connection);
      clearInterval(interval);
      clearTimeout(pendingSend.current);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [sessionId, mapId, owner, dismiss, refresh, release, send]);

  // Switching to private must retract anything previously shared, never rebroadcast it.
  useEffect(() => { dismiss(); }, [privateMeasurement, dismiss]);

  const begin = useCallback((start: MeasurementPoint, shape: SharedMeasurement['shape']) => {
    if (!sessionId || !mapId || !owner) return;
    const time = Date.now();
    const next: VisibleMeasurement = { sessionId, mapId, owner, id: nanoid(),
      startedAt: Math.max(time, (own.current?.startedAt || 0) + 1), sequence: 0, sentAt: time,
      start, end: start, shape, phase: 'dragging', private: privateMeasurement,
      expiresAt: time + MEASUREMENT_STALE_MS };
    clearTimeout(pendingSend.current);
    own.current = next; entries.current.set(owner, next); send(next); refresh();
  }, [sessionId, mapId, owner, privateMeasurement, refresh, send]);

  const move = useCallback((end: MeasurementPoint) => {
    const current = own.current;
    if (!current || current.phase !== 'dragging') return;
    const time = Date.now();
    const next: VisibleMeasurement = { ...current, end, sequence: current.sequence + 1,
      sentAt: time, expiresAt: time + MEASUREMENT_STALE_MS };
    own.current = next; entries.current.set(current.owner, next);
    clearTimeout(pendingSend.current);
    if (time - lastSent.current >= 120) send(next);
    else pendingSend.current = setTimeout(() => {
      if (own.current?.phase === 'dragging') send(own.current);
    }, 120 - (time - lastSent.current));
    refresh();
  }, [refresh, send]);

  return { measurements: measurements.filter((m) => m.expiresAt + MEASUREMENT_FADE_MS > now),
    now, begin, move, release, dismiss, isDragging: own.current?.phase === 'dragging' };
}
