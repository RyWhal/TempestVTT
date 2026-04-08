import React, { useState, useRef } from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useMapStore } from '../../stores/mapStore';
import { buildSessionExport } from '../../lib/sessionExport';
import { Button } from '../shared/Button';
import { useToast } from '../shared/Toast';
import type { SessionExport as SessionExportType } from '../../types';

export const SessionExport: React.FC = () => {
  const { showToast } = useToast();
  const session = useSessionStore((state) => state.session);
  const { maps, characters, npcTemplates, npcInstances } = useMapStore();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!session) return;

    setIsExporting(true);

    try {
      const exportData = await buildSessionExport({
        session,
        maps,
        characters,
        npcTemplates,
        npcInstances,
        fetchAsBase64: async (url) => {
          const response = await fetch(url);
          const blob = await response.blob();
          return blobToBase64(blob);
        },
      });

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Session exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Failed to export session', 'error');
    }

    setIsExporting(false);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as SessionExportType;

      if (data.version !== '1.0') {
        showToast('Unsupported export version', 'error');
        setIsImporting(false);
        return;
      }

      // For now, just show info - full import would require creating a new session
      showToast(
        `Import preview: ${data.session.name} with ${data.maps.length} maps, ${data.characters.length} characters`,
        'info'
      );

      // TODO: Implement full import functionality
      // This would involve:
      // 1. Creating a new session
      // 2. Uploading all images from base64
      // 3. Creating all maps, characters, NPCs

    } catch (error) {
      console.error('Import error:', error);
      showToast('Failed to read import file', 'error');
    }

    setIsImporting(false);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-6">
        {/* Export section */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">
            Export Session
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Download the entire session as a JSON file including maps, characters,
            NPCs, and their images.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={handleExport}
            isLoading={isExporting}
          >
            <Download className="w-4 h-4 mr-2" />
            Export to JSON
          </Button>
          <p className="text-xs text-slate-500 mt-2">
            Note: Chat messages and dice rolls are not included in exports.
          </p>
        </div>

        {/* Import section */}
        <div>
          <h3 className="text-sm font-medium text-slate-300 mb-2">
            Import Session
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Import a previously exported session. This will create a new session
            with all the saved data.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            aria-label="Import Session File"
            onChange={handleImportFile}
            className="hidden"
          />

          <Button
            variant="secondary"
            className="w-full"
            onClick={handleImportClick}
            isLoading={isImporting}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import from JSON
          </Button>

          <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
            <div className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-yellow-400">
                  Import functionality is limited in this version. Exported files
                  can be used to manually recreate sessions or for backup purposes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Session info */}
        {session && (
          <div className="bg-slate-800/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-slate-300 mb-2">
              Current Session Info
            </h4>
            <div className="text-xs text-slate-400 space-y-1">
              <p>Name: {session.name}</p>
              <p>Code: {session.code}</p>
              <p>Maps: {maps.length}</p>
              <p>Characters: {characters.length}</p>
              <p>NPC Templates: {npcTemplates.length}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
