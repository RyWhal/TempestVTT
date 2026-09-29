import { Crown, Users } from 'lucide-react';
import { usePlayerAccent } from '../../hooks/usePlayerAccents';
import { useSessionStore } from '../../stores/sessionStore';
import type { SessionPlayer } from '../../types';

function PlayerRow({ player }: { player: SessionPlayer }) {
  const color = usePlayerAccent(player.username);
  return <li className="flex items-center gap-2 py-1.5 text-sm text-slate-100">
    <span className="h-3 w-3 shrink-0 rounded-full border border-white/50" style={{ backgroundColor: color }} />
    <span className="min-w-0 break-words">{player.username}</span>
    {player.isGm && <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-amber-300"><Crown className="h-3 w-3" />GM</span>}
  </li>;
}
export function PlayerAccentList() {
  const players = useSessionStore((s) => s.players);
  return <details className="relative">
    <summary aria-label="Players and accent colors" className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-slate-300">
      <Users className="h-3.5 w-3.5" />{players.length}
    </summary>
    <div className="absolute right-0 top-8 z-50 max-h-72 w-56 max-w-[75vw] overflow-y-auto rounded-xl border border-slate-600 bg-slate-950 p-3 shadow-xl">
      <p className="mb-1 text-xs font-semibold text-slate-400">Players</p>
      <ul>{players.map((player) => <PlayerRow key={player.id} player={player} />)}</ul>
    </div>
  </details>;
}
