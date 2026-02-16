import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { STORAGE_BUCKETS, uploadFile } from '../lib/supabase';

export type SoundEffectAction = 'tokenSelect' | 'tokenPickup' | 'tokenDrop' | 'diceRoll' | 'chatMessageReceive';

export interface SoundEffectsConfig {
  enabled: boolean;
  volume: number;
  sounds: Record<SoundEffectAction, string | null>;
}

const DEFAULT_SOUND_EFFECTS_CONFIG: SoundEffectsConfig = {
  enabled: true,
  volume: 0.5,
  sounds: {
    tokenSelect: null,
    tokenPickup: null,
    tokenDrop: null,
    diceRoll: null,
    chatMessageReceive: null,
  },
};

const clampVolume = (value: number) => Math.max(0, Math.min(1, value));

const getStorageKey = (sessionId: string) => `tempest:sfx:${sessionId}`;

const sanitizeConfig = (value: unknown): SoundEffectsConfig => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_SOUND_EFFECTS_CONFIG;
  }

  const maybeConfig = value as Partial<SoundEffectsConfig>;
  const maybeSounds = maybeConfig.sounds as Partial<Record<SoundEffectAction, string | null>> | undefined;

  return {
    enabled: maybeConfig.enabled ?? DEFAULT_SOUND_EFFECTS_CONFIG.enabled,
    volume: clampVolume(typeof maybeConfig.volume === 'number' ? maybeConfig.volume : DEFAULT_SOUND_EFFECTS_CONFIG.volume),
    sounds: {
      tokenSelect: maybeSounds?.tokenSelect ?? DEFAULT_SOUND_EFFECTS_CONFIG.sounds.tokenSelect,
      tokenPickup: maybeSounds?.tokenPickup ?? DEFAULT_SOUND_EFFECTS_CONFIG.sounds.tokenPickup,
      tokenDrop: maybeSounds?.tokenDrop ?? DEFAULT_SOUND_EFFECTS_CONFIG.sounds.tokenDrop,
      diceRoll: maybeSounds?.diceRoll ?? DEFAULT_SOUND_EFFECTS_CONFIG.sounds.diceRoll,
      chatMessageReceive: maybeSounds?.chatMessageReceive ?? DEFAULT_SOUND_EFFECTS_CONFIG.sounds.chatMessageReceive,
    },
  };
};

export const useSoundEffects = () => {
  const sessionId = useSessionStore((state) => state.session?.id);
  const [config, setConfig] = useState<SoundEffectsConfig>(DEFAULT_SOUND_EFFECTS_CONFIG);

  useEffect(() => {
    if (!sessionId) {
      setConfig(DEFAULT_SOUND_EFFECTS_CONFIG);
      return;
    }

    const raw = localStorage.getItem(getStorageKey(sessionId));
    if (!raw) {
      setConfig(DEFAULT_SOUND_EFFECTS_CONFIG);
      return;
    }

    try {
      setConfig(sanitizeConfig(JSON.parse(raw)));
    } catch {
      setConfig(DEFAULT_SOUND_EFFECTS_CONFIG);
    }
  }, [sessionId]);

  const persistConfig = useCallback(
    (nextConfig: SoundEffectsConfig) => {
      setConfig(nextConfig);
      if (!sessionId) return;
      localStorage.setItem(getStorageKey(sessionId), JSON.stringify(nextConfig));
    },
    [sessionId]
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      persistConfig({ ...config, enabled });
    },
    [config, persistConfig]
  );

  const setVolume = useCallback(
    (volume: number) => {
      persistConfig({ ...config, volume: clampVolume(volume) });
    },
    [config, persistConfig]
  );

  const setSoundUrl = useCallback(
    (action: SoundEffectAction, url: string | null) => {
      persistConfig({
        ...config,
        sounds: {
          ...config.sounds,
          [action]: url,
        },
      });
    },
    [config, persistConfig]
  );

  const playSound = useCallback(
    async (action: SoundEffectAction) => {
      if (!config.enabled) return;
      const url = config.sounds[action];
      if (!url) return;

      const audio = new Audio(url);
      audio.volume = clampVolume(config.volume);
      await audio.play().catch(() => undefined);
    },
    [config]
  );

  const uploadSound = useCallback(
    async (action: SoundEffectAction, file: File): Promise<{ success: true; url: string } | { success: false; error: string }> => {
      if (!sessionId) {
        return { success: false, error: 'Join a session before uploading sound files.' };
      }

      const extension = file.name.split('.').pop() || 'mp3';
      const sanitizedAction = action.toLowerCase();
      const path = `${sessionId}/sfx/${sanitizedAction}-${Date.now()}.${extension}`;
      const uploadResult = await uploadFile(STORAGE_BUCKETS.HANDOUTS, path, file);

      if ('error' in uploadResult) {
        return { success: false, error: uploadResult.error };
      }

      const url = uploadResult.url;
      setSoundUrl(action, url);
      return { success: true, url };
    },
    [sessionId, setSoundUrl]
  );

  return useMemo(
    () => ({
      config,
      setEnabled,
      setVolume,
      setSoundUrl,
      playSound,
      uploadSound,
    }),
    [config, setEnabled, setVolume, setSoundUrl, playSound, uploadSound]
  );
};
