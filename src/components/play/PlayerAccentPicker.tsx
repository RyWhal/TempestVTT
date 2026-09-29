import { useState } from 'react';
import { PLAYER_ACCENTS } from '../../lib/playerAccents';
import { usePlayerAccent, usePlayerAccentReservations } from '../../hooks/usePlayerAccents';
import { usePlayerAccentsStore } from '../../stores/playerAccentsStore';
import { useSessionStore } from '../../stores/sessionStore';

export function PlayerAccentPicker() {
  const claim = usePlayerAccentReservations();
  const username = useSessionStore((s) => s.currentUser?.username);
  const color = usePlayerAccent(username);
  const reservations = usePlayerAccentsStore((s) => s.reservations);
  const error = usePlayerAccentsStore((s) => s.error);
  const [busy, setBusy] = useState(false);
  return <details className="relative">
    <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-1 text-xs text-slate-200" aria-label="Choose player accent color" title="Your accent color">
      <span className="h-3 w-3 rounded-full border border-white/50" style={{ backgroundColor: color }} /> Color
    </summary>
    <div className="absolute right-0 top-8 z-50 w-64 rounded-xl border border-slate-600 bg-slate-950 p-3 shadow-xl">
      <p className="mb-2 text-sm font-semibold text-slate-100">Your accent color</p>
      <div className="grid grid-cols-4 gap-2">
        {PLAYER_ACCENTS.map(([name, value]) => {
          const owner = reservations.find((r) => r.color === value && Date.parse(r.expiresAt) > Date.now());
          const taken = !!owner && owner.username !== username;
          return <button key={value} type="button" disabled={taken || busy} aria-pressed={value === color}
            aria-label={`${name}${taken ? ` — reserved by ${owner.username}` : ''}`}
            title={`${name}${owner ? ` · ${owner.username}` : ''}`}
            onClick={async () => { setBusy(true); try { await claim(value); } finally { setBusy(false); } }}
            className="flex flex-col items-center gap-1 rounded p-1 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-40">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/60 text-black" style={{ backgroundColor: value }}>{value === color ? '✓' : taken ? '×' : ''}</span>{name}
          </button>;
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">Colors stay reserved for two hours after disconnecting.</p>
      {error && <p role="status" className="mt-2 text-xs text-amber-300">{error}</p>}
    </div>
  </details>;
}
