import React, { useRef, useState } from 'react';
import { Search, Plus, User, Upload, X } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { useIsGM } from '../../stores/sessionStore';
import { useNPCs } from '../../hooks/useNPCs';
import { useCharacters } from '../../hooks/useCharacters';
import { useToast } from '../shared/Toast';
import { validateTokenUpload } from '../../lib/validation';
import type { TokenSize } from '../../types';

const SIZE_OPTIONS: TokenSize[] = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];

interface TokenHubPanelProps {
  onClose?: () => void;
}

export const TokenHubPanel: React.FC<TokenHubPanelProps> = ({ onClose }) => {
  const isGM = useIsGM();
  const { showToast } = useToast();
  const activeMap = useMapStore((state) => state.activeMap);
  const characters = useMapStore((state) => state.characters);
  const npcTemplates = useMapStore((state) => state.npcTemplates);
  const npcInstances = useMapStore((state) => state.npcInstances);

  const getMapViewportCenter = useMapStore((state) => state.getMapViewportCenter);
  const centerViewportOnToken = useMapStore((state) => state.centerViewportOnToken);
  const selectToken = useMapStore((state) => state.selectToken);
  const moveCharacter = useMapStore((state) => state.moveCharacter);

  const { addNPCToMap, createNPCTemplate } = useNPCs();
  const { claimCharacter, createCharacter } = useCharacters();

  const [activeTab, setActiveTab] = useState<'pcs' | 'library' | 'active'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('All');

  // Creation form states
  const [isCreatingPC, setIsCreatingPC] = useState(false);
  const [isCreatingNPC, setIsCreatingNPC] = useState(false);
  const [newPcName, setNewPcName] = useState('');
  const [newNpcName, setNewNpcName] = useState('');
  const [newNpcSize, setNewNpcSize] = useState<TokenSize>('medium');
  const [newNpcHp, setNewNpcHp] = useState<number>(30);
  const [tokenFile, setTokenFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tags = ['All', 'Monsters', 'Beasts', 'Singers', 'NPCs', 'Bosses'];

  // Filter templates
  const filteredTemplates = npcTemplates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateTokenUpload(file);
    if (!validation.valid) {
      showToast(validation.error || 'Invalid file', 'error');
      return;
    }

    setTokenFile(file);
  };

  const handleCreatePC = async () => {
    if (!newPcName.trim()) return;

    setIsSubmitting(true);
    const result = await createCharacter(newPcName.trim(), tokenFile || undefined);
    setIsSubmitting(false);

    if (result.success && result.character) {
      const spawnPos = getMapViewportCenter();
      moveCharacter(result.character.id, spawnPos.x, spawnPos.y);
      selectToken(result.character.id, 'character');
      centerViewportOnToken(result.character.id, 'character');
      showToast('Character PC created', 'success');
      setNewPcName('');
      setTokenFile(null);
      setIsCreatingPC(false);
    } else {
      showToast(result.error || 'Failed to create character', 'error');
    }
  };

  const handleCreateNPC = async () => {
    if (!newNpcName.trim()) return;

    setIsSubmitting(true);
    const result = await createNPCTemplate(
      newNpcName.trim(),
      newNpcSize,
      tokenFile || undefined,
      undefined,
      undefined,
      newNpcHp
    );
    setIsSubmitting(false);

    if (result.success) {
      showToast('NPC Template created', 'success');
      setNewNpcName('');
      setNewNpcHp(30);
      setTokenFile(null);
      setIsCreatingNPC(false);
    } else {
      showToast(result.error || 'Failed to create NPC template', 'error');
    }
  };

  const handleSpawnNPC = async (templateId: string, name: string) => {
    if (!isGM) return;
    if (!activeMap) {
      showToast('No active map to spawn tokens onto', 'error');
      return;
    }

    const spawnPos = getMapViewportCenter();
    const result = await addNPCToMap(templateId, spawnPos, name);

    if (result.success) {
      if (result.instance) {
        selectToken(result.instance.id, 'npc');
        centerViewportOnToken(result.instance.id, 'npc');
      }
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
    <div className="flex h-full w-full flex-col bg-transparent text-slate-100">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-400" />
            Players & Tokens
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

      {/* Search & Action Bar */}
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

          {isGM && activeTab === 'pcs' && (
            <button
              onClick={() => setIsCreatingPC((prev) => !prev)}
              className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add PC
            </button>
          )}

          {isGM && activeTab === 'library' && (
            <button
              onClick={() => setIsCreatingNPC((prev) => !prev)}
              className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-500 transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Add NPC
            </button>
          )}
        </div>

        {/* Inline Create PC Form (GM only) */}
        {isGM && isCreatingPC && activeTab === 'pcs' && (
          <div className="mt-3 rounded-xl border border-blue-500/30 bg-slate-950 p-3 text-xs shadow-xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-blue-300">Create New PC</span>
              <button
                onClick={() => setIsCreatingPC(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              type="text"
              value={newPcName}
              onChange={(e) => setNewPcName(e.target.value)}
              placeholder="Character Name"
              className="mt-2.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />

            <div className="mt-2 flex items-center justify-between">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
              >
                <Upload className="h-3 w-3" />
                {tokenFile ? tokenFile.name : 'Token Image (Optional)'}
              </button>

              <button
                onClick={handleCreatePC}
                disabled={isSubmitting || !newPcName.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Save PC'}
              </button>
            </div>
          </div>
        )}

        {/* Inline Create NPC Form (GM only) */}
        {isGM && isCreatingNPC && activeTab === 'library' && (
          <div className="mt-3 rounded-xl border border-blue-500/30 bg-slate-950 p-3 text-xs shadow-xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-blue-300">Create New NPC Template</span>
              <button
                onClick={() => setIsCreatingNPC(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <input
              type="text"
              value={newNpcName}
              onChange={(e) => setNewNpcName(e.target.value)}
              placeholder="NPC Name (e.g. Chasm Fiend)"
              className="mt-2.5 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />

            <div className="mt-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase text-slate-400">HP:</span>
                  <input
                    type="number"
                    min={1}
                    value={newNpcHp}
                    onChange={(e) => setNewNpcHp(parseInt(e.target.value, 10) || 1)}
                    className="w-14 rounded-lg border border-slate-800 bg-slate-900 px-1.5 py-1 text-xs text-slate-200 focus:outline-none"
                  />
                </div>

                <select
                  value={newNpcSize}
                  onChange={(e) => setNewNpcSize(e.target.value as TokenSize)}
                  className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs uppercase text-slate-300 focus:outline-none"
                >
                  {SIZE_OPTIONS.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  <Upload className="h-3 w-3" />
                  {tokenFile ? tokenFile.name : 'Image'}
                </button>
              </div>

              <button
                onClick={handleCreateNPC}
                disabled={isSubmitting || !newNpcName.trim()}
                className="w-full rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-blue-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Creating...' : 'Save Template'}
              </button>
            </div>
          </div>
        )}

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
                onClick={() => {
                  selectToken(pc.id, 'character');
                  centerViewportOnToken(pc.id, 'character');
                }}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 transition-all hover:border-blue-500/60 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {pc.tokenUrl ? (
                    <img
                      src={pc.tokenUrl}
                      alt={pc.name}
                      className="h-8 w-8 flex-shrink-0 rounded-full object-cover border border-blue-500/30"
                    />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-xs font-bold text-blue-300 border border-blue-500/30">
                      {pc.name.charAt(0).toUpperCase()}
                    </div>
                  )}
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
                  {npc.tokenUrl ? (
                    <img
                      src={npc.tokenUrl}
                      alt={npc.name}
                      className="h-8 w-8 flex-shrink-0 rounded-full object-cover border border-rose-500/30"
                    />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-rose-600/20 text-xs font-bold text-rose-300 border border-rose-500/30">
                      {npc.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-200">{npc.name}</p>
                    <span className="uppercase text-[10px] text-slate-500 font-mono">
                      {npc.defaultSize}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-400">Template</span>
                  {isGM && (
                    <button
                      onClick={() => void handleSpawnNPC(npc.id, npc.name)}
                      className="flex items-center gap-0.5 rounded-md bg-blue-600/20 px-2 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-600/40"
                    >
                      <Plus className="h-3 w-3" /> Spawn
                    </button>
                  )}
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
                onClick={() => {
                  selectToken(npc.id, 'npc');
                  centerViewportOnToken(npc.id, 'npc');
                }}
                className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 transition-all hover:border-amber-500/60 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {npc.tokenUrl ? (
                    <img
                      src={npc.tokenUrl}
                      alt={npc.displayName || 'NPC'}
                      className="h-8 w-8 flex-shrink-0 rounded-full object-cover border border-amber-500/30"
                    />
                  ) : (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-600/20 text-xs font-bold text-amber-300 border border-amber-500/30">
                      {(npc.displayName || 'NPC').charAt(0).toUpperCase()}
                    </div>
                  )}
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
