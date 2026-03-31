import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { SessionCreateForm } from './SessionCreateForm';
import { useSessionStore } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { useChatStore } from '../../stores/chatStore';

export const SessionCreate: React.FC = () => {
  const navigate = useNavigate();
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearMapState = useMapStore((state) => state.clearMapState);
  const clearChatState = useChatStore((state) => state.clearChatState);

  useEffect(() => {
    clearSession();
    clearMapState();
    clearChatState();
  }, [clearSession, clearMapState, clearChatState]);

  return (
    <main className="tempest-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <SessionCreateForm onSuccess={() => navigate('/play')} />
        </Card>
      </div>
    </main>
  );
};
