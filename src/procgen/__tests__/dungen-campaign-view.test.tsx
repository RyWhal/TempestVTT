import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createStarterCampaignSnapshot, visitSectionPreview } from '../engine/campaignFlow';
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
    expect(html).toContain('Preview');
    expect(html).toContain('Campaign Entries');
    expect(html).toContain('Narrative');
    expect(html).toContain('NPCs');
    expect(html).toContain('Encounters');
    expect(html).toContain('[AI Generated intro goes here]');
  });

  it('shows only previews adjacent to the current active section in the preview list', () => {
    const starter = createStarterCampaignSnapshot({
      sessionId: 'session_001',
      campaignName: 'The Bloom Beneath',
      worldSeed: 'world_ironbell_042',
    });
    const snapshot = visitSectionPreview(starter, 'preview_section_start_village_east');

    const html = renderToString(
      <MemoryRouter>
        <DunGENCampaignView snapshotOverride={snapshot} />
      </MemoryRouter>
    );

    const previewButtons = html.match(/>Preview</g) ?? [];
    expect(previewButtons).toHaveLength(3);
  });
});
