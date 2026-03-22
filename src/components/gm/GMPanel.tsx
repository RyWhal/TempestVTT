import React, { useState } from 'react';
import {
  X,
  Map as MapIcon,
  Users,
  Skull,
  Eye,
  SlidersHorizontal,
  ListOrdered,
} from 'lucide-react';
import { MapManager } from './MapManager';
import { CharacterManager } from './CharacterManager';
import { NPCManager } from './NPCManager';
import { FogTools } from './FogTools';
import { GMSettings } from './GMSettings';
import { InitiativePanel } from '../initiative/InitiativePanel';
import { useMapStore } from '../../stores/mapStore';

type GMTab = 'maps' | 'characters' | 'npcs' | 'fog' | 'initiative' | 'settings';

interface GMPanelProps {
  onClose: () => void;
}

export const GMPanel: React.FC<GMPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<GMTab>('maps');
  const setFogToolMode = useMapStore((state) => state.setFogToolMode);

  const handleTabChange = (tab: GMTab) => {
    // Prevent fog painting from remaining active when leaving the Fog tab.
    if (activeTab === 'fog' && tab !== 'fog') {
      setFogToolMode(null);
    }

    setActiveTab(tab);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <h2 className="font-semibold text-slate-100">GM Controls</h2>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700 overflow-x-auto">
        <GMTabButton
          active={activeTab === 'maps'}
          onClick={() => handleTabChange('maps')}
          icon={<MapIcon className="w-4 h-4" />}
          label="Maps"
        />
        <GMTabButton
          active={activeTab === 'characters'}
          onClick={() => handleTabChange('characters')}
          icon={<Users className="w-4 h-4" />}
          label="PCs"
        />
        <GMTabButton
          active={activeTab === 'npcs'}
          onClick={() => handleTabChange('npcs')}
          icon={<Skull className="w-4 h-4" />}
          label="NPCs"
        />
        <GMTabButton
          active={activeTab === 'fog'}
          onClick={() => handleTabChange('fog')}
          icon={<Eye className="w-4 h-4" />}
          label="Fog"
        />
        <GMTabButton
          active={activeTab === 'initiative'}
          onClick={() => handleTabChange('initiative')}
          icon={<ListOrdered className="w-4 h-4" />}
          label="Initiative"
        />
        <GMTabButton
          active={activeTab === 'settings'}
          onClick={() => handleTabChange('settings')}
          icon={<SlidersHorizontal className="w-4 h-4" />}
          label="Settings"
        />
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'maps' && <MapManager />}
        {activeTab === 'characters' && <CharacterManager />}
        {activeTab === 'npcs' && <NPCManager />}
        {activeTab === 'fog' && <FogTools />}
        {activeTab === 'initiative' && <InitiativePanel gmView />}
        {activeTab === 'settings' && <GMSettings />}
      </div>
    </div>
  );
};

interface GMTabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const GMTabButton: React.FC<GMTabButtonProps> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`
      flex-1 min-w-[72px] flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium
      transition-colors border-b-2
      ${
        active
          ? 'text-slate-100 border-tempest-400 bg-slate-800/50'
          : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30'
      }
    `}
  >
    {icon}
    {label}
  </button>
);
