import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const { joinSession } = useSession();
  const [error, setError] = useState<string | null>(null);
  const params = getLaunchJoinParams(searchParams);

  useEffect(() => {
    if (!params) {
      return;
    }

    let cancelled = false;

    const autoJoinSession = async () => {
      const result = await joinSession(params.code, params.username);
      if (cancelled || result.success) {
        return;
      }

      setError(result.error || 'Failed to join the live Tempest session.');
    };

    void autoJoinSession();

    return () => {
      cancelled = true;
    };
  }, [joinSession, params]);

  return (
    <main className="tempest-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Card className="p-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-tempest-300">Tempest Table</p>
          <h1 className="mt-3 text-3xl font-semibold tempest-heading">Opening live table</h1>
          <p className="mt-4 text-sm text-slate-400">
            {error ??
              'Joining the launched session and syncing the generated maps. This should only take a moment.'}
          </p>
        </Card>
      </div>
    </main>
  );
};
