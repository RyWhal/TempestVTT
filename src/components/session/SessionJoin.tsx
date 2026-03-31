import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../shared/Button';
import { Card } from '../shared/Card';
import { SessionJoinForm } from './SessionJoinForm';

export const SessionJoin: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="tempest-shell flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card>
          <SessionJoinForm onSuccess={() => navigate('/play')} />
        </Card>
      </div>
    </main>
  );
};
