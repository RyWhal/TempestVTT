import React, { useState, useMemo } from 'react';
import { Search, X, Image as ImageIcon, User, Map as MapIcon, Loader2 } from 'lucide-react';
import { useGlobalAssets, GlobalAsset } from '../../hooks/useGlobalAssets';

interface GlobalAssetBrowserProps {
  assetType: 'token' | 'map';
  onSelect: (asset: GlobalAsset) => void;
  onClose: () => void;
}

export const GlobalAssetBrowser: React.FC<GlobalAssetBrowserProps> = ({
  assetType,
  onSelect,
  onClose,
}) => {
  const { tokens, maps, isLoading, error, getCategories } = useGlobalAssets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const assets = assetType === 'token' ? tokens : maps;
  const categories = getCategories(assetType);

  const filteredAssets = useMemo(() => {
    let result = assets;

    // Filter by category
    if (selectedCategory) {
      result = result.filter((a) => a.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    return result;
  }, [assets, selectedCategory, searchQuery]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            {assetType === 'token' ? (
              <User className="w-5 h-5 text-slate-400" />
            ) : (
              <MapIcon className="w-5 h-5 text-slate-400" />
            )}
            <h2 className="text-lg font-semibold text-slate-100">
              Global {assetType === 'token' ? 'Token' : 'Map'} Library
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, tag, or description..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-tempest-400"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-200"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400">{error}</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">
                {assets.length === 0
                  ? `No global ${assetType}s available yet`
                  : 'No assets match your search'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onClick={() => onSelect(asset)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700">
          <p className="text-sm text-slate-500 text-center">
            {filteredAssets.length} {assetType}
            {filteredAssets.length !== 1 ? 's' : ''} available
          </p>
        </div>
      </div>
    </div>
  );
};

interface AssetCardProps {
  asset: GlobalAsset;
  onClick: () => void;
}

const AssetCard: React.FC<AssetCardProps> = ({ asset, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="group relative bg-slate-800 rounded-lg border border-slate-700 overflow-hidden hover:border-tempest-500 transition-colors text-left"
    >
      {/* Image */}
      <div
        className={`${
          asset.assetType === 'token' ? 'aspect-square' : 'aspect-video'
        } bg-slate-900`}
      >
        <img
          src={asset.imageUrl}
          alt={asset.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
      </div>

      {/* Info */}
      <div className="p-2">
        <h4 className="font-medium text-slate-200 text-sm truncate">{asset.name}</h4>
        {asset.category && (
          <p className="text-xs text-slate-500 capitalize">{asset.category}</p>
        )}
        {asset.assetType === 'token' && asset.defaultSize && (
          <span className="inline-block mt-1 px-1.5 py-0.5 bg-slate-700 rounded text-xs text-slate-400 capitalize">
            {asset.defaultSize}
          </span>
        )}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-tempest-500/0 group-hover:bg-tempest-500/10 transition-colors flex items-center justify-center">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-slate-900/90 rounded-lg text-sm text-slate-200">
          Select
        </span>
      </div>
    </button>
  );
};
