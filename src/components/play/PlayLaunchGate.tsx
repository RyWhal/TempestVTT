import React from 'react';
import { Card } from '../shared/Card';

export const PlayLaunchGate: React.FC = () => (
  <main className="tempest-shell flex items-center justify-center px-4 py-10">
    <div className="w-full max-w-lg">
      <Card className="p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-tempest-300">Tempest Table</p>
        <h1 className="mt-3 text-3xl font-semibold tempest-heading">Preparing live table</h1>
        <p className="mt-4 text-sm text-slate-400">
          Endless Dungeon is creating the session and syncing the generated maps. This tab will
          continue automatically.
        </p>
      </Card>
    </div>
  </main>
);
