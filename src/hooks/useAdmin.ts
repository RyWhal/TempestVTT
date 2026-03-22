import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAdminStore } from '../stores/adminStore';
import {
  dbSessionToSession,
  type DbSession,
  type Session,
  type SessionPlayer,
} from '../types';

export interface SessionWithDetails extends Session {
  playerCount: number;
  mapCount: number;
  characterCount: number;
  lastActivity: string;
}

export interface AdminLog {
  id: string;
  action: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface GlobalAsset {
  id: string;
  assetType: 'token' | 'map';
  name: string;
  description: string;
  imageUrl: string;
  defaultSize?: string;
  category?: string;
  width?: number;
  height?: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type RpcError = { message?: string };

const getRpcErrorMessage = (error: RpcError | null, fallback: string): string => {
  if (!error?.message) return fallback;
  if (error.message.toLowerCase().includes('invalid or expired')) {
    return 'Session expired';
  }
  return error.message;
};

export const useAdmin = () => {
  const { sessionToken, setSessionToken, updateActivity, logout } = useAdminStore();
  const [isLoading, setIsLoading] = useState(false);

  const ensureActiveSession = useCallback((): { ok: true; token: string } | { ok: false; error: string } => {
    if (!sessionToken) {
      return { ok: false, error: 'Session expired' };
    }

    return { ok: true, token: sessionToken };
  }, [sessionToken]);

  const invalidateSession = useCallback(() => {
    logout();
  }, [logout]);

  const login = useCallback(
    async (password: string): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);

      try {
        const { data, error } = await supabase.rpc('app_admin_login', {
          p_password: password,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: getRpcErrorMessage(error, 'Failed to verify password') };
        }

        if (!data || typeof data !== 'string') {
          setIsLoading(false);
          return { success: false, error: 'Invalid password' };
        }

        setSessionToken(data);
        setIsLoading(false);
        return { success: true };
      } catch (error) {
        setIsLoading(false);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [setSessionToken]
  );

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ success: boolean; error?: string }> => {
      const validation = ensureActiveSession();
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      try {
        const { data, error } = await supabase.rpc('app_admin_change_password', {
          p_token: validation.token,
          p_current_password: currentPassword,
          p_new_password: newPassword,
        });

        if (error) {
          const message = getRpcErrorMessage(error, 'Failed to change password');
          if (message === 'Session expired') invalidateSession();
          return { success: false, error: message };
        }

        if (!data) {
          return { success: false, error: 'Current password is incorrect' };
        }

        updateActivity();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const getSessions = useCallback(async (): Promise<SessionWithDetails[]> => {
    const validation = ensureActiveSession();
    if (!validation.ok) return [];

    const { data, error } = await supabase.rpc('app_admin_get_sessions_with_counts', {
      p_token: validation.token,
    });

    if (error) {
      if (getRpcErrorMessage(error, '') === 'Session expired') {
        invalidateSession();
      }
      return [];
    }

    updateActivity();

    return ((data || []) as Array<DbSession & {
      player_count: number;
      map_count: number;
      character_count: number;
      last_activity: string;
    }>).map((session) => ({
      ...dbSessionToSession(session),
      playerCount: Number(session.player_count) || 0,
      mapCount: Number(session.map_count) || 0,
      characterCount: Number(session.character_count) || 0,
      lastActivity: session.last_activity,
    }));
  }, [ensureActiveSession, invalidateSession, updateActivity]);

  const getSessionPlayers = useCallback(
    async (sessionId: string): Promise<SessionPlayer[]> => {
      const validation = ensureActiveSession();
      if (!validation.ok) return [];

      const { error: sessionError } = await supabase.rpc('app_require_admin_session', {
        p_token: validation.token,
      });

      if (sessionError) {
        if (getRpcErrorMessage(sessionError, '') === 'Session expired') {
          invalidateSession();
        }
        return [];
      }

      updateActivity();

      const { data } = await supabase
        .from('session_players')
        .select('*')
        .eq('session_id', sessionId);

      return (data || []).map((p: any) => ({
        id: p.id,
        sessionId: p.session_id,
        username: p.username,
        characterId: p.character_id,
        isGm: p.is_gm,
        initiativeModifier: p.initiative_modifier ?? 0,
        lastSeen: p.last_seen,
      }));
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
      const validation = ensureActiveSession();
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      try {
        const { error: sessionError } = await supabase.rpc('app_require_admin_session', {
          p_token: validation.token,
        });

        if (sessionError) {
          const message = getRpcErrorMessage(sessionError, 'Session expired');
          if (message === 'Session expired') invalidateSession();
          return { success: false, error: message };
        }

        const { error } = await supabase.from('sessions').delete().eq('id', sessionId);

        if (error) {
          return { success: false, error: error.message };
        }

        await supabase.rpc('app_admin_log_action', {
          p_token: validation.token,
          p_action: 'session_deleted',
          p_details: { sessionId },
        });

        updateActivity();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const removePlayer = useCallback(
    async (
      sessionId: string,
      playerId: string
    ): Promise<{ success: boolean; error?: string }> => {
      const validation = ensureActiveSession();
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      try {
        const { error: sessionError } = await supabase.rpc('app_require_admin_session', {
          p_token: validation.token,
        });

        if (sessionError) {
          const message = getRpcErrorMessage(sessionError, 'Session expired');
          if (message === 'Session expired') invalidateSession();
          return { success: false, error: message };
        }

        const { error } = await supabase.from('session_players').delete().eq('id', playerId);

        if (error) {
          return { success: false, error: error.message };
        }

        await supabase.rpc('app_admin_log_action', {
          p_token: validation.token,
          p_action: 'player_removed',
          p_details: { sessionId, playerId },
        });

        updateActivity();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const getAdminLogs = useCallback(
    async (limit = 100): Promise<AdminLog[]> => {
      const validation = ensureActiveSession();
      if (!validation.ok) return [];

      const { data, error } = await supabase.rpc('app_admin_get_logs', {
        p_token: validation.token,
        p_limit: limit,
      });

      if (error) {
        if (getRpcErrorMessage(error, '') === 'Session expired') {
          invalidateSession();
        }
        return [];
      }

      updateActivity();

      return (data || []).map((log: any) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        ipAddress: log.ip_address,
        createdAt: log.created_at,
      }));
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const getGlobalAssets = useCallback(
    async (type?: 'token' | 'map'): Promise<GlobalAsset[]> => {
      const validation = ensureActiveSession();
      if (!validation.ok) return [];

      const { error: sessionError } = await supabase.rpc('app_require_admin_session', {
        p_token: validation.token,
      });

      if (sessionError) {
        if (getRpcErrorMessage(sessionError, '') === 'Session expired') {
          invalidateSession();
        }
        return [];
      }

      updateActivity();

      let query = supabase
        .from('global_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('asset_type', type);
      }

      const { data } = await query;

      return (data || []).map((asset: any) => ({
        id: asset.id,
        assetType: asset.asset_type,
        name: asset.name,
        description: asset.description,
        imageUrl: asset.image_url,
        defaultSize: asset.default_size,
        category: asset.category,
        width: asset.width,
        height: asset.height,
        tags: asset.tags || [],
        isActive: asset.is_active,
        createdAt: asset.created_at,
        updatedAt: asset.updated_at,
      }));
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const createGlobalAsset = useCallback(
    async (
      asset: Omit<GlobalAsset, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<{ success: boolean; asset?: GlobalAsset; error?: string }> => {
      const validation = ensureActiveSession();
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      try {
        const { error: sessionError } = await supabase.rpc('app_require_admin_session', {
          p_token: validation.token,
        });

        if (sessionError) {
          const message = getRpcErrorMessage(sessionError, 'Session expired');
          if (message === 'Session expired') invalidateSession();
          return { success: false, error: message };
        }

        const { data, error } = await supabase
          .from('global_assets')
          .insert({
            asset_type: asset.assetType,
            name: asset.name,
            description: asset.description,
            image_url: asset.imageUrl,
            default_size: asset.defaultSize,
            category: asset.category,
            width: asset.width,
            height: asset.height,
            tags: asset.tags,
            is_active: asset.isActive,
          })
          .select()
          .single();

        if (error || !data) {
          return { success: false, error: error?.message || 'Failed to create asset' };
        }

        await supabase.rpc('app_admin_log_action', {
          p_token: validation.token,
          p_action: 'asset_created',
          p_details: { assetId: data.id, name: asset.name },
        });

        updateActivity();

        return {
          success: true,
          asset: {
            id: data.id,
            assetType: data.asset_type,
            name: data.name,
            description: data.description,
            imageUrl: data.image_url,
            defaultSize: data.default_size,
            category: data.category,
            width: data.width,
            height: data.height,
            tags: data.tags || [],
            isActive: data.is_active,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const deleteGlobalAsset = useCallback(
    async (assetId: string): Promise<{ success: boolean; error?: string }> => {
      const validation = ensureActiveSession();
      if (!validation.ok) {
        return { success: false, error: validation.error };
      }

      try {
        const { error: sessionError } = await supabase.rpc('app_require_admin_session', {
          p_token: validation.token,
        });

        if (sessionError) {
          const message = getRpcErrorMessage(sessionError, 'Session expired');
          if (message === 'Session expired') invalidateSession();
          return { success: false, error: message };
        }

        const { error } = await supabase.from('global_assets').delete().eq('id', assetId);

        if (error) {
          return { success: false, error: error.message };
        }

        await supabase.rpc('app_admin_log_action', {
          p_token: validation.token,
          p_action: 'asset_deleted',
          p_details: { assetId },
        });

        updateActivity();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    [ensureActiveSession, invalidateSession, updateActivity]
  );

  const adminLogout = useCallback(() => {
    if (sessionToken) {
      void supabase.rpc('app_admin_logout', { p_token: sessionToken });
    }
    logout();
  }, [sessionToken, logout]);

  return {
    isAuthenticated: Boolean(sessionToken),
    isLoading,
    login,
    logout: adminLogout,
    changePassword,
    getSessions,
    getSessionPlayers,
    deleteSession,
    removePlayer,
    getAdminLogs,
    getGlobalAssets,
    createGlobalAsset,
    deleteGlobalAsset,
  };
};
