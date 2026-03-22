import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createStarterCampaignSnapshot } from '../engine/campaignFlow';
import { DunGENCampaignView } from '../../components/dungen/DunGENCampaignView';

describe('DunGENCampaignView', () => {
  it('renders tabs, the overview graph, and the campaign book for the current campaign', () => {
    const snapshot = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });

    const html = renderToString(
      <MemoryRouter>
        <DunGENCampaignView snapshotOverride={snapshot} />
      </MemoryRouter>
    );

    expect(html).toContain('Visited Sections');
    expect(html).toContain('Overview');
    expect(html).toContain('Campaign Book');
    expect(html).toContain('Hometown');
  });
});
