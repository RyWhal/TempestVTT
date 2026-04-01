import type { CampaignSnapshot } from '../engine/campaignFlow';

const LOCAL_CAMPAIGN_STORAGE_PREFIX = 'tempest:endless-dungeon:campaign:';
const LOCAL_CAMPAIGN_BROADCAST_CHANNEL = 'tempest:endless-dungeon:campaign-updates';

type LocalCampaignSnapshotUpdateMessage = {
  type: 'snapshot_saved';
  sessionId: string;
};

const getStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
};

const getBroadcastChannel = () => {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
    return null;
  }

  return new window.BroadcastChannel(LOCAL_CAMPAIGN_BROADCAST_CHANNEL);
};

export const getLocalCampaignStorageKey = (sessionId: string) =>
  `${LOCAL_CAMPAIGN_STORAGE_PREFIX}${sessionId}`;

const compactSnapshotForLocalStorage = (snapshot: CampaignSnapshot): CampaignSnapshot => ({
  ...snapshot,
  sections: snapshot.sections.map((section) => ({
    ...section,
    renderPayloadCache: null,
  })),
});

const isCampaignSnapshot = (value: unknown): value is CampaignSnapshot => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    candidate.campaign !== null &&
    typeof candidate.campaign === 'object' &&
    Array.isArray(candidate.sections) &&
    Array.isArray(candidate.previews)
  );
};

export const saveLocalCampaignSnapshot = ({
  sessionId,
  snapshot,
}: {
  sessionId: string;
  snapshot: CampaignSnapshot;
}) => {
  const storage = getStorage();
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(
      getLocalCampaignStorageKey(sessionId),
      JSON.stringify({
        version: 1,
        snapshot: compactSnapshotForLocalStorage(snapshot),
      })
    );
    const channel = getBroadcastChannel();
    channel?.postMessage({
      type: 'snapshot_saved',
      sessionId,
    } satisfies LocalCampaignSnapshotUpdateMessage);
    channel?.close();
    return true;
  } catch (error) {
    console.warn('Failed to save Endless Dungeon snapshot locally.', error);
    return false;
  }
};

export const subscribeLocalCampaignSnapshotUpdates = (
  sessionId: string,
  onSnapshotSaved: () => void
) => {
  const channel = getBroadcastChannel();
  if (!channel) {
    return () => undefined;
  }

  channel.onmessage = (event: MessageEvent<LocalCampaignSnapshotUpdateMessage>) => {
    if (event.data?.type === 'snapshot_saved' && event.data.sessionId === sessionId) {
      onSnapshotSaved();
    }
  };

  return () => {
    channel.close();
  };
};

export const loadLocalCampaignSnapshot = (sessionId: string): CampaignSnapshot | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(getLocalCampaignStorageKey(sessionId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { snapshot?: unknown } | unknown;
    const snapshotCandidate =
      parsed && typeof parsed === 'object' && 'snapshot' in parsed
        ? (parsed as { snapshot?: unknown }).snapshot
        : parsed;

    return isCampaignSnapshot(snapshotCandidate) ? snapshotCandidate : null;
  } catch (error) {
    console.warn('Failed to load Endless Dungeon snapshot locally.', error);
    return null;
  }
};
