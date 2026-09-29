import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { accentForPlayer } from '../lib/playerAccents';
import { usePlayerAccentsStore } from '../stores/playerAccentsStore';
import { useSessionStore } from '../stores/sessionStore';

export function getPlayerAccent(username: string | null | undefined) {
  const state = usePlayerAccentsStore.getState();
  return accentForPlayer(state.sessionId === useSessionStore.getState().session?.id ? state.reservations : [], username);
}
export function usePlayerAccent(username: string | null | undefined) {
  const sessionId = useSessionStore((s) => s.session?.id);
  return usePlayerAccentsStore((s) => accentForPlayer(s.sessionId === sessionId ? s.reservations : [], username));
}
export function usePlayerAccentReservations() {
  const revision = useRef(0);
  const sessionId = useSessionStore((s) => s.session?.id);
  const username = useSessionStore((s) => s.currentUser?.username);
  const connected = useSessionStore((s) => s.connectionStatus === 'connected');
  const claim = useCallback(async (color?: string) => {
    if (!sessionId || !username) return;
    const request = ++revision.current;
    try {
      const { data, error } = await supabase.rpc('claim_player_accent', { p_session_id: sessionId, p_username: username, p_color: color ?? null });
      if (request !== revision.current || useSessionStore.getState().session?.id !== sessionId || useSessionStore.getState().currentUser?.username !== username) return;
      if (error) throw error;
      usePlayerAccentsStore.getState().setReservations(sessionId, (data ?? []).map((row: { username: string; color: string; expires_at: string }) => ({ username: row.username, color: row.color, expiresAt: row.expires_at })));
    } catch (error) {
      if (request === revision.current && useSessionStore.getState().session?.id === sessionId) {
        usePlayerAccentsStore.setState({ error: error instanceof Error ? error.message : (error as { message?: string })?.message ?? 'Player colors are temporarily unavailable.' });
      }
    }
  }, [sessionId, username]);
  useEffect(() => {
    if (usePlayerAccentsStore.getState().sessionId !== sessionId) usePlayerAccentsStore.getState().reset();
    if (!connected || !sessionId || !username) return;
    void claim();
    const timer = window.setInterval(() => void claim(), 60_000);
    const channel = sessionId ? supabase.channel(`player-accents:${sessionId}:${username}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_player_accents', filter: `session_id=eq.${sessionId}` }, async () => {
        const request = ++revision.current;
        try {
          const { data, error } = await supabase.from('session_player_accents').select('username,color,expires_at').eq('session_id', sessionId);
          if (error) throw error;
          if (request === revision.current && useSessionStore.getState().session?.id === sessionId) {
            usePlayerAccentsStore.getState().setReservations(sessionId, (data ?? []).map((row) => ({ username: row.username, color: row.color, expiresAt: row.expires_at })));
          }
        } catch {
          if (request === revision.current && useSessionStore.getState().session?.id === sessionId) {
            usePlayerAccentsStore.setState({ error: 'Unable to refresh player colors. Reconnecting shortly.' });
          }
        }
      }).subscribe() : null;
    const resume = () => { if (document.visibilityState === 'visible') void claim(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); if (channel) void supabase.removeChannel(channel); };
  }, [claim, connected, sessionId, username]);
  return claim;
}
