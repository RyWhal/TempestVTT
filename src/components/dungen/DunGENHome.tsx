import React from 'react';
import { Castle, Compass, LibraryBig } from 'lucide-react';
import { Button } from '../shared/Button';

export const DunGENHome: React.FC = () => {
  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-storm-700 bg-storm-900 px-3 py-1 text-sm text-storm-300">
          <Castle className="h-4 w-4" />
          DunGEN Preview
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight">DunGEN Campaigns</h1>
          <p className="max-w-3xl text-lg text-storm-300">
            DunGEN is the content-first campaign surface for procedural dungeon play.
            Use it to create campaigns, preview sections, lock canon, and launch
            the active section into the table play shell.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-storm-800 bg-storm-900 p-5">
          <Compass className="mb-3 h-6 w-6 text-storm-300" />
          <h2 className="mb-2 text-lg font-medium">Create Campaign</h2>
          <p className="mb-4 text-sm text-storm-400">
            Start a seeded campaign, choose tone and difficulty, and generate your
            first preview section.
          </p>
          <Button variant="primary" disabled>
            Create Campaign
          </Button>
        </div>

        <div className="rounded-2xl border border-storm-800 bg-storm-900 p-5">
          <LibraryBig className="mb-3 h-6 w-6 text-storm-300" />
          <h2 className="mb-2 text-lg font-medium">Resume Campaign</h2>
          <p className="mb-4 text-sm text-storm-400">
            Open a DunGEN campaign hub to review locked canon, history, and upcoming
            sections.
          </p>
          <Button variant="secondary" disabled>
            Resume Campaign
          </Button>
        </div>

        <div className="rounded-2xl border border-storm-800 bg-storm-900 p-5">
          <Castle className="mb-3 h-6 w-6 text-storm-300" />
          <h2 className="mb-2 text-lg font-medium">Shared Assets</h2>
          <p className="text-sm text-storm-400">
            Portraits and future generated art will be global shared assets, reused
            across campaigns and only auto-generated for locked content.
          </p>
        </div>
      </section>
    </div>
  );
};
