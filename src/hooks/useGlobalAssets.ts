import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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
}

interface UseGlobalAssetsReturn {
  tokens: GlobalAsset[];
  maps: GlobalAsset[];
  isLoading: boolean;
  error: string | null;
  fetchAssets: () => Promise<void>;
  searchAssets: (query: string, type?: 'token' | 'map') => GlobalAsset[];
  getAssetsByCategory: (category: string, type: 'token' | 'map') => GlobalAsset[];
  getCategories: (type: 'token' | 'map') => string[];
}

export const useGlobalAssets = (): UseGlobalAssetsReturn => {
  const [tokens, setTokens] = useState<GlobalAsset[]>([]);
  const [maps, setMaps] = useState<GlobalAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('global_assets')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw fetchError;

      const assets: GlobalAsset[] = (data || []).map((row) => ({
        id: row.id,
        assetType: row.asset_type,
        name: row.name,
        description: row.description || '',
        imageUrl: row.image_url,
        defaultSize: row.default_size,
        category: row.category,
        width: row.width,
        height: row.height,
        tags: row.tags || [],
        isActive: row.is_active,
        createdAt: row.created_at,
      }));

      setTokens(assets.filter((a) => a.assetType === 'token'));
      setMaps(assets.filter((a) => a.assetType === 'map'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const searchAssets = useCallback(
    (query: string, type?: 'token' | 'map'): GlobalAsset[] => {
      const searchTerm = query.toLowerCase().trim();
      if (!searchTerm) {
        return type === 'token' ? tokens : type === 'map' ? maps : [...tokens, ...maps];
      }

      const allAssets = type === 'token' ? tokens : type === 'map' ? maps : [...tokens, ...maps];

      return allAssets.filter(
        (asset) =>
          asset.name.toLowerCase().includes(searchTerm) ||
          asset.description.toLowerCase().includes(searchTerm) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
          (asset.category && asset.category.toLowerCase().includes(searchTerm))
      );
    },
    [tokens, maps]
  );

  const getAssetsByCategory = useCallback(
    (category: string, type: 'token' | 'map'): GlobalAsset[] => {
      const assets = type === 'token' ? tokens : maps;
      if (!category) return assets;
      return assets.filter((a) => a.category === category);
    },
    [tokens, maps]
  );

  const getCategories = useCallback(
    (type: 'token' | 'map'): string[] => {
      const assets = type === 'token' ? tokens : maps;
      const categories = new Set(assets.map((a) => a.category).filter(Boolean) as string[]);
      return Array.from(categories).sort();
    },
    [tokens, maps]
  );

  return {
    tokens,
    maps,
    isLoading,
    error,
    fetchAssets,
    searchAssets,
    getAssetsByCategory,
    getCategories,
  };
};
