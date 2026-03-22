import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Card, CardHeader, CardTitle } from '../shared/Card';
import { useToast } from '../shared/Toast';
import { useSession } from '../../hooks/useSession';
import { validateUsername } from '../../lib/validation';
import { isValidSessionCodeFormat, normalizeSessionCode } from '../../lib/sessionCode';
import { supabase } from '../../lib/supabase';

type SessionPlayerOption = {
  username: string;
  isGm: boolean;
};

export const SessionJoin: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { joinSession } = useSession();

  const [sessionCode, setSessionCode] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ sessionCode?: string; username?: string }>({});
  const [existingPlayers, setExistingPlayers] = useState<SessionPlayerOption[]>([]);
  const [isLoadingPlayers, setIsLoadingPlayers] = useState(false);

  useEffect(() => {
    const normalizedCode = normalizeSessionCode(sessionCode);
    if (!isValidSessionCodeFormat(normalizedCode)) {
      setExistingPlayers([]);
      return;
    }

    let isActive = true;

    const loadPlayers = async () => {
      setIsLoadingPlayers(true);

      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('code', normalizedCode)
        .single();

      if (sessionError || !sessionData) {
        if (isActive) {
          setExistingPlayers([]);
          setIsLoadingPlayers(false);
        }
        return;
      }

      const { data: playersData } = await supabase
        .from('session_players')
        .select('username, is_gm')
        .eq('session_id', sessionData.id);

      if (!isActive) return;

      const players =
        playersData?.map((player) => ({
          username: player.username,
          isGm: player.is_gm,
        })) ?? [];

      players.sort((a, b) => a.username.localeCompare(b.username));
      setExistingPlayers(players);
      setIsLoadingPlayers(false);
    };

    void loadPlayers();
    return () => {
      isActive = false;
    };
  }, [sessionCode]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9-]/g, '');
    if (value.length <= 9) {
      setSessionCode(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedCode = normalizeSessionCode(sessionCode);
    const usernameValidation = validateUsername(username);
    const newErrors: { sessionCode?: string; username?: string } = {};

    if (!isValidSessionCodeFormat(normalizedCode)) {
      newErrors.sessionCode = 'Invalid session code format (e.g., ABCD-1234)';
    }

    if (!usernameValidation.valid) {
      newErrors.username = usernameValidation.error;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    const result = await joinSession(normalizedCode, username);
    setIsLoading(false);

    if (result.success) {
      showToast('Joined session!', 'success');
      navigate('/lobby');
      return;
    }

    showToast(result.error || 'Failed to join session', 'error');
  };

  return (
    <main className="tempest-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-tempest-300" />
              Join Session
            </CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Session Code"
              placeholder="XXXX-XXXX"
              value={sessionCode}
              onChange={handleCodeChange}
              error={errors.sessionCode}
              className="text-center font-mono text-lg tracking-wider"
              autoFocus
            />

            <Input
              label="Your Username"
              placeholder="e.g., Aria"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={errors.username}
            />

            {isLoadingPlayers ? (
              <div className="text-sm text-slate-400">Loading current players…</div>
            ) : existingPlayers.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">Rejoin as</p>
                <div className="flex flex-wrap gap-2">
                  {existingPlayers.map((player) => (
                    <button
                      key={player.username}
                      type="button"
                      onClick={() => setUsername(player.username)}
                      className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200 transition-colors hover:bg-slate-700"
                    >
                      {player.username}
                      {player.isGm && ' (GM)'}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
              Join Session
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
};
