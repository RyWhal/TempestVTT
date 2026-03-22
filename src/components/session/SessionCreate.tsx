import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { Card, CardHeader, CardTitle } from '../shared/Card';
import { useToast } from '../shared/Toast';
import { useSession } from '../../hooks/useSession';
import { useSessionStore } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { useChatStore } from '../../stores/chatStore';
import { validateSessionName, validateUsername } from '../../lib/validation';

export const SessionCreate: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { createSession } = useSession();
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearMapState = useMapStore((state) => state.clearMapState);
  const clearChatState = useChatStore((state) => state.clearChatState);

  useEffect(() => {
    clearSession();
    clearMapState();
    clearChatState();
  }, [clearSession, clearMapState, clearChatState]);

  const [sessionName, setSessionName] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ sessionName?: string; username?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sessionNameValidation = validateSessionName(sessionName);
    const usernameValidation = validateUsername(username);

    if (!sessionNameValidation.valid || !usernameValidation.valid) {
      setErrors({ sessionName: sessionNameValidation.error, username: usernameValidation.error });
      return;
    }

    setErrors({});
    setIsLoading(true);
    const result = await createSession(sessionName, username);
    setIsLoading(false);

    if (result.success && result.code) {
      showToast(`Session created! Code: ${result.code}`, 'success');
      navigate('/play');
      return;
    }

    showToast(result.error || 'Failed to create session', 'error');
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
              <Sparkles className="h-5 w-5 text-tempest-300" />
              Create Session
            </CardTitle>
            <p className="mt-2 text-sm text-slate-400">Start a new Tempest table and invite players with a code.</p>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Session Name"
              placeholder="e.g., Saturday Night Campaign"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              error={errors.sessionName}
              autoFocus
            />

            <Input
              label="Your Username"
              placeholder="e.g., GameMaster"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={errors.username}
              helperText="You will enter as GM."
            />

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
              Create Session
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
};
