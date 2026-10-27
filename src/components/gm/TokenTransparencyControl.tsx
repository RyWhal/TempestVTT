import { useEffect, useId, useRef, useState } from 'react';
import { useSessionStore } from '../../stores/sessionStore';
import { useSession } from '../../hooks/useSession';
import { normalizeTokenOpacity } from '../../lib/tokenAppearance';
import { useToast } from '../shared/Toast';

export function TokenTransparencyControl() {
  const session = useSessionStore(state => state.session);
  const isGM = useSessionStore(state => state.currentUser?.isGm);
  const { updateSessionSettings } = useSession();
  const { showToast } = useToast();
  const id = useId();
  const [transparency, setTransparency] = useState(() => Math.round((1 - normalizeTokenOpacity(session?.tokenOpacity)) * 100));
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    setTransparency(Math.round((1 - normalizeTokenOpacity(session?.tokenOpacity)) * 100));
  }, [session?.id, session?.tokenOpacity]);

  const save = async () => {
    const current = useSessionStore.getState().session;
    const tokenOpacity = (100 - transparency) / 100;
    if (!session || current?.id !== session.id || busy.current || tokenOpacity === normalizeTokenOpacity(current.tokenOpacity)) return;
    busy.current = true;
    setSaving(true);
    try {
      const result = await updateSessionSettings({ tokenOpacity });
      if (!result.success && useSessionStore.getState().session?.id === session.id) {
        setTransparency(Math.round((1 - normalizeTokenOpacity(useSessionStore.getState().session?.tokenOpacity)) * 100));
        showToast(result.error || 'Failed to save token transparency', 'error');
      }
    } catch {
      if (useSessionStore.getState().session?.id === session.id) {
        setTransparency(Math.round((1 - normalizeTokenOpacity(useSessionStore.getState().session?.tokenOpacity)) * 100));
        showToast('Failed to save token transparency', 'error');
      }
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  if (!session || !isGM) return null;
  return <div className="space-y-2 border-t border-slate-700/60 pt-3">
    <label htmlFor={id} className="flex items-center justify-between text-sm text-slate-300">
      <span>Token transparency</span><span className="font-mono text-xs">{transparency}%</span>
    </label>
    <input id={id} type="range" min={0} max={100} step={1} value={transparency} disabled={saving}
      aria-label="Token transparency" aria-valuetext={`${transparency}% transparent`}
      onChange={event => setTransparency(Number(event.target.value))}
      onPointerUp={() => void save()} onBlur={() => void save()}
      onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) void save(); }}
      className="w-full accent-blue-500 disabled:opacity-50" />
    <div className="flex justify-between text-[10px] text-slate-400"><span>Opaque</span><span>Invisible</span></div>
    <p className="text-xs text-slate-400">Applies to all tokens and names for everyone at this table.</p>
    {saving && <p role="status" className="text-xs text-slate-400">Saving…</p>}
  </div>;
}
