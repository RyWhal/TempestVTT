import React, { useState } from 'react';
import { Search, Plus, Sparkles, User, X } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useNPCs } from '../../hooks/useNPCs';
import { useCharacters } from '../../hooks/useCharacters';
import { useToast } from '../shared/Toast';

interface TokenHubPanelProps {
  onClose?: () => void;
}

export const TokenHubPanel: React.FC<TokenHubPanelProps> = ({ onClose }) => {
  const { showToast } = useToast();
  const activeMap = useMapStore((state) => state.activeMap);
  const characters = useMapStore((state) => state.characters);
  const npcTemplates = useMapStore((state) => state.npcTemplates);
  const npcInstances = useMapStore((state) => state.npcInstances);

  const { addNPCToMap } = useNPCs();
  const { claimCharacter } = useCharacters();

  const [activeTab, setActiveTab] = useState<'pcs' | 'library' | 'active'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  const tags = ['All', 'Monsters', 'Beasts', 'Singers', 'NPCs', 'Bosses'];

  // Filter templates
  const filteredTemplates = npcTemplates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleSpawnNPC = async (templateId: string, name: string) => {
    if (!activeMap) {
      showToast('No active map to spawn tokens onto', 'error');
      return;
    }

    const randomPos = {
      x: 150 + Math.random() * 50,
      y: 150 + Math.random() * 50,
    };

    const result = await addNPCToMap(templateId, randomPos, name);

    if (result.success) {
      showToast(`Spawned ${name} onto map`, 'success');
    } else {
      showToast(result.error || 'Failed to spawn token', 'error');
    }
  };

  const handleClaimPC = async (characterId: string) => {
    const result = await claimCharacter(characterId);
    if (result.success) {
      showToast('Character claimed', 'success');
    } else {
      showToast(result.error || 'Failed to claim character', 'error');
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-slate-900/95 text-slate-100 backdrop-blur-lg">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-400" />
            Token Hub
          </h2>
          <p className="text-xs text-slate-400">Characters & Monsters</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/50 p-1">
        <button
          onClick={() => setActiveTab('pcs')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
            activeTab === 'pcs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          PCs ({characters.length})
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
            activeTab === 'library'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Library ({npcTemplates.length})
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Active ({npcInstances.length})
        </button>
      </div>

      {/* Search & AI Gen Bar */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search token library..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => showToast('AI Token Generation coming soon', 'info')}
            className="flex items-center gap-1 rounded-xl bg-purple-600/20 px-2.5 py-1.5 text-xs font-semibold text-purple-300 border border-purple-500/30 hover:bg-purple-600/30 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" /> AI Gen
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all whitespace-nowrap ${
                selectedTag === tag
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-800/60 text-slate-400 border border-slate-700/40 hover:text-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Token List / Cards Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'pcs' && (
          <div className="grid grid-cols-2 gap-2.5">
            {characters.map((pc) => (
              <div
                key={pc.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 transition-all hover:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300 border border-blue-500/30">
                    {pc.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">{pc.name}</p>
                    <span className="uppercase text-[10px] text-slate-500 font-mono">
                      {pc.size}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-400">
                    {pc.isClaimed ? `@${pc.claimedByUsername}` : 'Unclaimed'}
                  </span>
                  {!pc.isClaimed && (
                    <button
                      onClick={() => void handleClaimPC(pc.id)}
                      className="rounded-md bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-600/40"
                    >
                      Claim
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'library' && (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredTemplates.map((npc) => (
              <div
                key={npc.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 transition-all hover:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-600/20 text-xs font-bold text-rose-300 border border-rose-500/30">
                    {npc.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">{npc.name}</p>
                    <span className="uppercase text-[10px] text-slate-500 font-mono">
                      {npc.defaultSize}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-400">Template</span>
                  <button
                    onClick={() => void handleSpawnNPC(npc.id, npc.name)}
                    className="flex items-center gap-0.5 rounded-md bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-600/40"
                  >
                    <Plus className="h-3 w-3" /> Spawn
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'active' && (
          <div className="grid grid-cols-2 gap-2.5">
            {npcInstances.map((npc) => (
              <div
                key={npc.id}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 transition-all hover:border-slate-700"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600/20 text-xs font-bold text-amber-300 border border-amber-500/30">
                    {(npc.displayName || 'NPC').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">
                      {npc.displayName || 'NPC'}
                    </p>
                    <span className="uppercase text-[10px] text-slate-500 font-mono">
                      {npc.size || 'medium'}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-400">
                    {npc.isVisible ? 'Visible' : 'Hidden'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
