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
  const shouldAutoJoin =
    searchParams.get('autojoin') === '1' &&
    Boolean(searchParams.get('code')) &&
    Boolean(searchParams.get('username'));
  const isLaunchPreparation = searchParams.get('launching') === '1';

  if (shouldAutoJoin) {
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
