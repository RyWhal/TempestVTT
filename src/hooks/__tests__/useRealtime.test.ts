import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canUseInitiativeRealtimeTable,
  resetInitiativeRealtimeAvailabilityForTests,
} from '../useRealtime';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: fromMock,
  },
}));

describe('useRealtime initiative table availability cache', () => {
  beforeEach(() => {
    fromMock.mockReset();
    resetInitiativeRealtimeAvailabilityForTests();
  });

  it('caches initiative table availability checks so repeated lookups do not re-query Supabase', async () => {
    const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });

    fromMock.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        limit: limitMock,
      }),
    }));

    const first = await canUseInitiativeRealtimeTable('initiative_entries');
    const second = await canUseInitiativeRealtimeTable('initiative_entries');

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('initiative_entries');
    expect(limitMock).toHaveBeenCalledTimes(1);
  });
});
