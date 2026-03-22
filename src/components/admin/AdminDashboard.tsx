import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  LogOut,
  Users,
  Map,
  FileText,
  Trash2,
  RefreshCw,
  UserMinus,
  ChevronDown,
  ChevronRight,
  Image,
  Key,
  Activity,
} from 'lucide-react';
import { Button } from '../shared/Button';
import { Card, CardHeader, CardTitle } from '../shared/Card';
import { Input } from '../shared/Input';
import { useToast } from '../shared/Toast';
import {
  useAdmin,
  type SessionWithDetails,
  type AdminLog,
  type GlobalAsset,
} from '../../hooks/useAdmin';
import type { SessionPlayer } from '../../types';

type TabType = 'sessions' | 'assets' | 'logs' | 'settings';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    isAuthenticated,
    logout,
    getSessions,
    getSessionPlayers,
    deleteSession,
    removePlayer,
    getAdminLogs,
    getGlobalAssets,
    deleteGlobalAsset,
    changePassword,
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<TabType>('sessions');
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [assets, setAssets] = useState<GlobalAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionPlayers, setSessionPlayers] = useState<Record<string, SessionPlayer[]>>({});

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);

    if (activeTab === 'sessions') {
      const data = await getSessions();
      setSessions(data);
    } else if (activeTab === 'logs') {
      const data = await getAdminLogs();
      setLogs(data);
    } else if (activeTab === 'assets') {
      const data = await getGlobalAssets();
      setAssets(data);
    }

    setIsLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const handleDeleteSession = async (sessionId: string, sessionName: string) => {
    if (!confirm(`Delete session "${sessionName}"? This cannot be undone.`)) return;

    const result = await deleteSession(sessionId);
    if (result.success) {
      showToast('Session deleted', 'success');
      loadData();
    } else {
      showToast(result.error || 'Failed to delete session', 'error');
    }
  };

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }

    setExpandedSession(sessionId);

    if (!sessionPlayers[sessionId]) {
      const players = await getSessionPlayers(sessionId);
      setSessionPlayers((prev) => ({ ...prev, [sessionId]: players }));
    }
  };

  const handleRemovePlayer = async (sessionId: string, playerId: string, username: string) => {
    if (!confirm(`Remove player "${username}" from session?`)) return;

    const result = await removePlayer(sessionId, playerId);
    if (result.success) {
      showToast('Player removed', 'success');
      // Refresh players
      const players = await getSessionPlayers(sessionId);
      setSessionPlayers((prev) => ({ ...prev, [sessionId]: players }));
    } else {
      showToast(result.error || 'Failed to remove player', 'error');
    }
  };

  const handleDeleteAsset = async (assetId: string, assetName: string) => {
    if (!confirm(`Delete asset "${assetName}"?`)) return;

    const result = await deleteGlobalAsset(assetId);
    if (result.success) {
      showToast('Asset deleted', 'success');
      loadData();
    } else {
      showToast(result.error || 'Failed to delete asset', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }

    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      showToast('Password changed successfully', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      showToast(result.error || 'Failed to change password', 'error');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-yellow-500" />
            <h1 className="text-xl font-bold text-slate-100">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
          {[
            { id: 'sessions', label: 'Sessions', icon: FileText },
            { id: 'assets', label: 'Global Assets', icon: Image },
            { id: 'logs', label: 'Activity Logs', icon: Activity },
            { id: 'settings', label: 'Settings', icon: Key },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as TabType)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors
                ${
                  activeTab === id
                    ? 'bg-slate-800 text-slate-100 border-b-2 border-tempest-400'
                    : 'text-slate-400 hover:text-slate-200'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Refresh button */}
          {activeTab !== 'settings' && (
            <div className="flex justify-end">
              <Button variant="ghost" onClick={loadData} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          )}

          {/* Sessions Tab */}
          {activeTab === 'sessions' && (
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <Card>
                  <div className="text-center py-8 text-slate-400">
                    No sessions found
                  </div>
                </Card>
              ) : (
                sessions.map((session) => (
                  <Card key={session.id}>
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => handleExpandSession(session.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-slate-400">
                          {expandedSession === session.id ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-100">{session.name}</h3>
                          <p className="text-sm text-slate-400 font-mono">{session.code}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {session.playerCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <Map className="w-4 h-4" />
                            {session.mapCount}
                          </span>
                          <span>{formatRelativeTime(session.lastActivity)}</span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id, session.name);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedSession === session.id && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                          <div>
                            <span className="text-slate-400">Created:</span>{' '}
                            <span className="text-slate-200">{formatDate(session.createdAt)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">GM:</span>{' '}
                            <span className="text-slate-200">
                              {session.currentGmUsername || 'None'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Characters:</span>{' '}
                            <span className="text-slate-200">{session.characterCount}</span>
                          </div>
                        </div>

                        {/* Players list */}
                        <div>
                          <h4 className="text-sm font-medium text-slate-300 mb-2">
                            Active Players
                          </h4>
                          {sessionPlayers[session.id]?.length === 0 ? (
                            <p className="text-sm text-slate-500">No active players</p>
                          ) : (
                            <div className="space-y-2">
                              {sessionPlayers[session.id]?.map((player) => (
                                <div
                                  key={player.id}
                                  className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-200">{player.username}</span>
                                    {player.isGm && (
                                      <span className="text-xs bg-yellow-600/20 text-yellow-400 px-2 py-0.5 rounded">
                                        GM
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleRemovePlayer(session.id, player.id, player.username)
                                    }
                                  >
                                    <UserMinus className="w-4 h-4 text-red-400" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Assets Tab */}
          {activeTab === 'assets' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-slate-400">
                  Global assets can be used by GMs across all sessions.
                </p>
                <Button variant="primary" onClick={() => navigate('/admin/assets/new')}>
                  Add Asset
                </Button>
              </div>

              {assets.length === 0 ? (
                <Card>
                  <div className="text-center py-8 text-slate-400">
                    No global assets. Add tokens or maps for GMs to use.
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map((asset) => (
                    <Card key={asset.id}>
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded bg-slate-700 overflow-hidden flex-shrink-0">
                          <img
                            src={asset.imageUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-slate-100 truncate">{asset.name}</h3>
                          <p className="text-sm text-slate-400 capitalize">
                            {asset.assetType}
                            {asset.category && ` - ${asset.category}`}
                          </p>
                          {!asset.isActive && (
                            <span className="text-xs text-yellow-400">Inactive</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteAsset(asset.id, asset.name)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <Card>
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
              </CardHeader>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-slate-400">No logs found</div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between bg-slate-800/50 rounded px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="text-slate-200 font-medium">{log.action}</span>
                        {Object.keys(log.details).length > 0 && (
                          <span className="text-slate-400 ml-2">
                            {JSON.stringify(log.details)}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500">{formatDate(log.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <Card>
              <CardHeader>
                <CardTitle>Change Admin Password</CardTitle>
              </CardHeader>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <Input
                  label="Current Password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <Input
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  helperText="Minimum 8 characters"
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button type="submit" variant="primary">
                  Change Password
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
