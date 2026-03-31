import { describe, expect, it } from 'vitest';
import {
  resolveLaunchSectionId,
  shouldPersistActiveMapSelection,
} from '../integration/navigationPolicy';

describe('navigationPolicy', () => {
  it('does not persist generated map selections into the session active map id', () => {
    expect(
      shouldPersistActiveMapSelection({
        sourceType: 'generated',
      } as const)
    ).toBe(false);

    expect(
      shouldPersistActiveMapSelection({
        sourceType: 'uploaded',
      } as const)
    ).toBe(true);
  });

  it('prefers the focused visited section when launching back into play', () => {
    expect(
      resolveLaunchSectionId({
        activeSectionId: 'section_start_village_east',
      })
    ).toBe('section_start_village_east');

    expect(
      resolveLaunchSectionId({
        activeSectionId: 'section_start_village_east',
      })
    ).toBe('section_start_village_east');
  });

  it('returns the currently active generated section id when provided by the caller', () => {
    expect(
      resolveLaunchSectionId({
        activeSectionId: 'section_current_table_map',
      })
    ).toBe('section_current_table_map');
  });
});
