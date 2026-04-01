import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlaySession } from './PlaySession';
import { PlayEntryHub } from './PlayEntryHub';
import { PlayAutoJoinGate } from './PlayAutoJoinGate';
import { PlayLaunchGate } from './PlayLaunchGate';
import { useSessionStore } from '../../stores/sessionStore';

export const PlayRoute: React.FC = () => {
  const [searchParams] = useSearchParams();
  const session = useSessionStore((state) => state.session);
  const currentUser = useSessionStore((state) => state.currentUser);
  const autoJoinCode = searchParams.get('code');
  const autoJoinUsername = searchParams.get('username');
  const shouldAutoJoin =
    searchParams.get('autojoin') === '1' &&
    Boolean(autoJoinCode) &&
    Boolean(autoJoinUsername);
  const isLaunchPreparation = searchParams.get('launching') === '1';
  const hasActiveAutoJoinTarget =
    shouldAutoJoin &&
    Boolean(session?.code) &&
    Boolean(currentUser?.username) &&
    session?.code.toUpperCase() === autoJoinCode?.toUpperCase() &&
    currentUser?.username === autoJoinUsername;

  if (shouldAutoJoin && !hasActiveAutoJoinTarget) {
    return <PlayAutoJoinGate />;
  }

  if (isLaunchPreparation) {
    return <PlayLaunchGate />;
  }

  if (!session || !currentUser) {
    return <PlayEntryHub />;
  }

  return <PlaySession />;
};
