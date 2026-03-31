import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStarterCampaignSnapshot, visitSectionPreview } from '../engine/campaignFlow';
import { DunGENCampaignView } from '../../components/dungen/DunGENCampaignView';
import { ToastProvider } from '../../components/shared/Toast';
import { useProcgenStore } from '../../stores/procgenStore';
import { useSessionStore } from '../../stores/sessionStore';

describe('DunGENCampaignView', () => {
  beforeEach(() => {
    useProcgenStore.getState().clearProcgenState();
    useSessionStore.getState().clearSession();
  });

  it('renders tabs, the overview graph, and the campaign book for the current campaign', () => {
    const snapshot = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    const html = renderToString(
      <ToastProvider>
        <MemoryRouter>
          <DunGENCampaignView snapshotOverride={snapshot} />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(html).toContain('Visited Sections');
    expect(html).toContain('Overview');
    expect(html).toContain('Campaign Book');
    expect(html).toContain('Hometown');
    expect(html).toContain('Campaign Entries');
    expect(html).toContain('Narrative');
    expect(html).toContain('NPCs');
    expect(html).toContain('Encounters');
    expect(html).toContain('[AI Generated intro goes here]');
    expect(html).not.toContain('Upcoming Previews');
  });

  it('keeps the campaign-book surface focused on the active/current section details', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const snapshot = visitSectionPreview(starter, 'preview_section_start_village_east');

    const html = renderToString(
      <ToastProvider>
        <MemoryRouter>
          <DunGENCampaignView snapshotOverride={snapshot} />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(html).toContain('Table Of Contents');
    expect(html).toContain('Visited Entry');
    expect(html).toContain(snapshot.sections[1]?.name ?? '');
    expect(html).not.toContain('Upcoming Previews');
  });

  it('shows a prelaunch Endless Dungeon setup form before a Tempest session exists', () => {
    const html = renderToString(
      <ToastProvider>
        <MemoryRouter>
          <DunGENCampaignView />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(html).toContain('Endless Dungeon');
    expect(html).toContain('Campaign Name');
    expect(html).toContain('GM Name');
    expect(html).toContain('Launch Into Tempest Table');
  });

  it('keeps rendering a usable campaign surface while a linked session is only partially hydrated', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    useProcgenStore.getState().setCampaign(starter.campaign);
    useSessionStore.getState().setSession({
      id: 'session_001',
      code: 'ABCD12',
      name: 'The Bloom Beneath',
      activeMapId: null,
      currentGmUsername: 'DungeonMaster',
      notepadContent: '',
      allowPlayersRenameNpcs: false,
      allowPlayersMoveNpcs: false,
      enableInitiativePhase: false,
      enablePlotDice: false,
      allowPlayersDrawings: false,
      createdAt: '2026-03-30T12:00:00.000Z',
      updatedAt: '2026-03-30T12:00:00.000Z',
    });
    useSessionStore.getState().setCurrentUser({
      username: 'DungeonMaster',
      characterId: null,
      isGm: true,
    });

    const html = renderToString(
      <ToastProvider>
        <MemoryRouter>
          <DunGENCampaignView />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(html).not.toContain('Preparing Endless Dungeon campaign surface...');
    expect(html).toContain('Visited Sections');
    expect(html).toContain('Campaign Book');
  });
});
