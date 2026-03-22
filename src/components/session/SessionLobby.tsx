import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, Crown, ArrowRight, LogOut } from 'lucide-react';
import { Button } from '../shared/Button';
import { Card, CardHeader, CardTitle } from '../shared/Card';
import { useToast } from '../shared/Toast';
import { useSessionStore } from '../../stores/sessionStore';
import { useCharacters } from '../../hooks/useCharacters';
import { useSession } from '../../hooks/useSession';
import type { Character } from '../../types';

export const SessionLobby: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const players = useSessionStore((state) => state.players);
  const { characters, claimCharacter } = useCharacters();
  const { leaveSession } = useSession();

  if (!session || !currentUser) {
    navigate('/');
    return null;
  }

  const handleClaimCharacter = async (character: Character) => {
    const result = await claimCharacter(character.id);
    if (result.success) {
      showToast(`You are now playing as ${character.name}!`, 'success');
    } else {
      showToast(result.error || 'Failed to claim character', 'error');
    }
  };

  const myCharacter = characters.find((c) => c.claimedByUsername === currentUser.username);

  return (
    <main className="tempest-shell px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{session.name}</CardTitle>
                <p className="mt-1 font-mono text-sm text-slate-400">Code: {session.code}</p>
              </div>
              {currentUser.isGm && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-sm text-amber-300">
                  <Crown className="h-4 w-4" />
                  GM
                </span>
              )}
            </div>
          </CardHeader>

          <div className="mb-8">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
              <Users className="h-4 w-4" />
              Players Online ({players.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {players.map((player) => (
                <span
                  key={player.id}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    player.isGm
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                      : 'border-slate-700 bg-slate-800 text-slate-200'
                  }`}
                >
                  {player.username}
                  {player.isGm && <Crown className="ml-1 inline h-3 w-3" />}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-slate-300">Choose Your Character</h3>

            {characters.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 py-10 text-center">
                <User className="mx-auto mb-2 h-12 w-12 text-slate-500" />
                <p className="text-slate-400">
                  {currentUser.isGm
                    ? 'Create characters in the GM panel after entering the session.'
                    : 'Waiting for the GM to add characters...'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {characters.map((character) => {
                  const isMine = character.claimedByUsername === currentUser.username;
                  const isClaimed = character.isClaimed && !isMine;

                  return (
                    <button
                      key={character.id}
                      type="button"
                      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                        isMine
                          ? 'border-tempest-400 bg-tempest-500/10'
                          : isClaimed
                            ? 'border-slate-800 bg-slate-900/50 opacity-60'
                            : 'border-slate-700 bg-slate-900 hover:border-tempest-500'
                      }`}
                      onClick={() => !isClaimed && !isMine && handleClaimCharacter(character)}
                    >
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
                        {character.tokenUrl ? (
                          <img src={character.tokenUrl} alt={character.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xl font-bold text-slate-200">{character.name.charAt(0)}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-medium text-slate-100">{character.name}</h4>
                        <p className="text-sm text-slate-400">
                          {isMine
                            ? 'Your character'
                            : isClaimed
                              ? `Controlled by ${character.claimedByUsername}`
                              : 'Available'}
                        </p>
                      </div>

                      {isMine && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">Selected</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={async () => { await leaveSession(); navigate('/'); }} className="flex-shrink-0">
              <LogOut className="mr-2 h-4 w-4" />
              Leave
            </Button>

            <Button variant="primary" size="lg" className="flex-1" onClick={() => navigate('/play')}>
              Enter Session
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {!myCharacter && !currentUser.isGm && (
            <p className="mt-3 text-center text-sm text-slate-400">You can still enter without selecting a character.</p>
          )}
        </Card>
      </div>
    </main>
  );
};
