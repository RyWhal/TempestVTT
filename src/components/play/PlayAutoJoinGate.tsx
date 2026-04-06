import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../shared/Card';
import { useSession } from '../../hooks/useSession';

const getLaunchJoinParams = (searchParams: URLSearchParams) => {
  const autoJoin = searchParams.get('autojoin');
  const code = searchParams.get('code');
  const username = searchParams.get('username');

  if (autoJoin !== '1' || !code || !username) {
    return null;
  }

  return { code, username };
};

export const PlayAutoJoinGate: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { joinSession } = useSession();
  const [error, setError] = useState<string | null>(null);
  const autoJoinFlag = searchParams.get('autojoin');
  const code = searchParams.get('code');
  const username = searchParams.get('username');
  const attemptedJoinKeyRef = useRef<string | null>(null);
  const params = useMemo(
    () =>
      getLaunchJoinParams(
        new URLSearchParams({
          ...(autoJoinFlag ? { autojoin: autoJoinFlag } : {}),
          ...(code ? { code } : {}),
          ...(username ? { username } : {}),
        })
      ),
    [autoJoinFlag, code, username]
  );
  const joinKey = params ? `${params.code}:${params.username}` : null;

  useEffect(() => {
    if (!params || !joinKey) {
      return;
    }

    if (attemptedJoinKeyRef.current === joinKey) {
      return;
    }

    attemptedJoinKeyRef.current = joinKey;

    let cancelled = false;

    const autoJoinSession = async () => {
      const result = await joinSession(params.code, params.username, {
        hydrateSession: false,
      });
      if (cancelled) {
        return;
      }

      if (result.success) {
        navigate('/play', { replace: true });
        return;
      }

      setError(result.error || 'Failed to join the live Tempest session.');
    };

    void autoJoinSession();

    return () => {
      cancelled = true;
    };
  }, [joinSession, navigate, params, joinKey]);

  return (
    <main className="tempest-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Card className="p-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-tempest-300">Tempest Table</p>
          <h1 className="mt-3 text-3xl font-semibold tempest-heading">Opening live table</h1>
          <p className="mt-4 text-sm text-slate-400">
            {error ??
              'Joining the launched session and loading the live table. This should only take a moment.'}
          </p>
        </Card>
      </div>
    </main>
  );
};
