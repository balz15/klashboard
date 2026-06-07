import { useState, useEffect } from 'react';
import { Navbar } from '../components/Layout/Navbar';
import { Plus, Trophy, ExternalLink, Users, Check, Copy, Share2, Settings, LogOut, AlertCircle, X } from 'lucide-react';
import { supabase, Contest, ChallengeTemplate } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ContestWizard } from '../components/ContestWizard/ContestWizard';
import { ParticipantManager } from '../components/Contest/ParticipantManager';
import { ContestSettingsModal } from '../components/Contest/ContestSettingsModal';
import { LeaveContestModal } from '../components/Contest/LeaveContestModal';
import { ShareModal } from '../components/Contest/ShareModal';
import { EngagementReminderCard } from '../components/Dashboard/EngagementReminderCard';
import { ChallengeHabitStrip } from '../components/Dashboard/ChallengeHabitStrip';

import { navigate } from '../lib/router';

type ContestWithParticipation = Contest & {
  userRole?: 'admin' | 'participant';
  participantId?: string;
  participantCount?: number;
};

const ICON_MAP: Record<string, any> = {
  'footprints': '👣',
  'dumbbell': '🏋️',
  'brain': '🧠',
  'moon': '🌙',
  'droplet': '💧',
  'book-open': '📖',
  'smartphone': '📱',
  'activity': '🏃',
  'heart': '❤️',
  'target': '🎯',
};

export function Dashboard() {
  const { user } = useAuth();
  const [createdChallenges, setCreatedChallenges] = useState<ContestWithParticipation[]>([]);
  const [participatingChallenges, setParticipatingChallenges] = useState<ContestWithParticipation[]>([]);
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ChallengeTemplate | null>(null);
  const [managingChallengeId, setManagingChallengeId] = useState<string | null>(null);
  const [settingsChallenge, setSettingsChallenge] = useState<ContestWithParticipation | null>(null);
  const [leavingChallenge, setLeavingChallenge] = useState<ContestWithParticipation | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharingChallenge, setSharingChallenge] = useState<ContestWithParticipation | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    loadChallenges();
    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('challenge_templates')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const loadChallenges = async () => {
    if (!user) return;

    try {
      const { data: createdData, error: createdError } = await supabase
        .from('contests')
        .select('*')
        .eq('creator_id', user.id)
        .order('created_at', { ascending: false });

      if (createdError) throw createdError;

      const { data: participantData, error: participantError } = await supabase
        .from('contest_participants')
        .select('contest_id, role, id, left_at, contests(*)')
        .eq('user_id', user.id)
        .is('left_at', null);

      if (participantError) throw participantError;

      const contestIds = createdData?.map(c => c.id) || [];
      const participantCounts = await Promise.all(
        contestIds.map(async (id) => {
          const { count } = await supabase
            .from('contest_participants')
            .select('*', { count: 'exact', head: true })
            .eq('contest_id', id)
            .is('left_at', null);
          return { id, count: count || 0 };
        })
      );

      const countMap = Object.fromEntries(
        participantCounts.map(({ id, count }) => [id, count])
      );

      const createdWithParticipantData = (createdData || []).map((challenge) => {
        const participantRecord = (participantData || []).find(
          (p) => p.contest_id === challenge.id
        );
        return {
          ...challenge,
          userRole: participantRecord?.role as 'admin' | 'participant' | undefined,
          participantId: participantRecord?.id,
          participantCount: countMap[challenge.id] || 0,
        };
      });

      setCreatedChallenges(createdWithParticipantData);

      const participatingContestIds = (participantData || [])
        .filter((p) => p.contests && (p.contests as any).creator_id !== user.id)
        .map((p) => p.contest_id);

      const participatingCounts = await Promise.all(
        participatingContestIds.map(async (id) => {
          const { count } = await supabase
            .from('contest_participants')
            .select('*', { count: 'exact', head: true })
            .eq('contest_id', id)
            .is('left_at', null);
          return { id, count: count || 0 };
        })
      );

      const participatingCountMap = Object.fromEntries(
        participatingCounts.map(({ id, count }) => [id, count])
      );

      const participating = (participantData || [])
        .filter((p) => p.contests && (p.contests as any).creator_id !== user.id)
        .map((p) => ({
          ...(p.contests as unknown as Contest),
          userRole: p.role as 'admin' | 'participant',
          participantId: p.id,
          participantCount: participatingCountMap[p.contest_id] || 0,
        }));

      setParticipatingChallenges(participating);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInviteCode = async (code: string, challengeId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(challengeId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleJoinWithCode = async () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    setJoiningByCode(true);
    setJoinError(null);

    try {
      const { data: contest, error: contestError } = await supabase
        .from('contests')
        .select('id, name, is_closed_for_joining')
        .eq('invite_code', joinCode.trim().toUpperCase())
        .maybeSingle();

      if (contestError) throw contestError;

      if (!contest) {
        setJoinError('Invalid challenge code. Please check and try again.');
        setJoiningByCode(false);
        return;
      }

      if (contest.is_closed_for_joining) {
        setJoinError('This challenge is closed for new members.');
        setJoiningByCode(false);
        return;
      }

      const { data: existing } = await supabase
        .from('contest_participants')
        .select('id')
        .eq('contest_id', contest.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        setJoinError('You have already joined this challenge.');
        setJoiningByCode(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('contest_participants')
        .insert({
          contest_id: contest.id,
          user_id: user.id,
          role: 'participant',
        });

      if (insertError) throw insertError;

      setShowJoinModal(false);
      setJoinCode('');
      await loadChallenges();
      navigate(`/contest/${contest.id}`);
    } catch (error: any) {
      console.error('Error joining challenge:', error);
      setJoinError(error.message || 'Failed to join challenge. Please try again.');
    } finally {
      setJoiningByCode(false);
    }
  };

  const handleTemplateSelect = (template: ChallengeTemplate) => {
    setSelectedTemplate(template);
    setShowWizard(true);
  };

  const handleCreateFromScratch = () => {
    setSelectedTemplate(templates.find(t => t.category === 'custom') || null);
    setShowWizard(true);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fitness': return 'from-green-500 to-emerald-600';
      case 'health': return 'from-blue-500 to-cyan-600';
      case 'productivity': return 'from-orange-500 to-amber-600';
      case 'mindfulness': return 'from-pink-500 to-rose-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">My Challenges</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Start a challenge and invite accountability partners
            </p>
          </div>
          <button
            onClick={() => setShowJoinModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium w-full sm:w-auto shrink-0"
          >
            <Plus className="w-5 h-5" />
            Join with Code
          </button>
        </div>

        {user && <EngagementReminderCard />}

        <div className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Challenge Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {templates
              .filter(t => t.category !== 'custom')
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="bg-white rounded-xl p-5 shadow-sm border-2 border-gray-200 hover:border-emerald-400 hover:shadow-lg transition-all text-left group"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${getCategoryColor(template.category)} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-2xl`}>
                    {ICON_MAP[template.icon] || '🎯'}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{template.name}</h3>
                  <p className="text-xs text-gray-600 mb-3 line-clamp-2">{template.description}</p>
                  <div className="flex items-center text-emerald-600 font-medium text-sm">
                    Use Template
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}

            <button
              onClick={handleCreateFromScratch}
              className="bg-white rounded-xl p-5 shadow-sm border-2 border-dashed border-gray-300 hover:border-emerald-400 hover:shadow-lg transition-all text-left group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Custom Challenge</h3>
              <p className="text-xs text-gray-600 mb-3">Create with your own metrics</p>
              <div className="flex items-center text-emerald-600 font-medium text-sm">
                Create Custom
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-xl font-bold text-gray-900">My Challenges</h3>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={(e) => setShowCompleted(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  Show Completed
                </label>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : createdChallenges.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">No challenges created yet</p>
                  <p className="text-sm text-gray-500">Use a template to get started</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {createdChallenges
                    .filter((challenge) => showCompleted || challenge.status !== 'completed')
                    .map((challenge) => (
                    <div
                      key={challenge.id}
                      className="border border-gray-200 rounded-lg p-6 hover:border-emerald-300 hover:shadow-md transition"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-3">
                        <button
                          onClick={() => navigate(`/contest/${challenge.id}`)}
                          className="flex-1 min-w-0 text-left group"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-emerald-600 transition break-words">
                              {challenge.name}
                            </h3>
                            <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                          </div>
                          <p className="text-sm text-gray-600 break-words">{challenge.description}</p>
                        </button>
                        <span
                          className={`self-start px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                            challenge.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : challenge.status === 'draft'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {challenge.status}
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                          <span>{challenge.metrics?.length || 0} metrics</span>
                          {challenge.invite_code && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyInviteCode(challenge.invite_code!, challenge.id);
                              }}
                              className="flex items-center gap-1 font-mono text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition"
                            >
                              Code: {challenge.invite_code}
                              {copiedId === challenge.id ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-600" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          {challenge.invite_code && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSharingChallenge(challenge);
                              }}
                              className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
                            >
                              <Share2 className="w-4 h-4 shrink-0" />
                              Share
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setManagingChallengeId(challenge.id);
                            }}
                            className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                          >
                            <Users className="w-4 h-4 shrink-0" />
                            Partners
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSettingsChallenge(challenge);
                            }}
                            className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium"
                          >
                            <Settings className="w-4 h-4 shrink-0" />
                            Settings
                          </button>

                          {challenge.participantId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeavingChallenge(challenge);
                              }}
                              className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                            >
                              <LogOut className="w-4 h-4 shrink-0" />
                              Leave
                            </button>
                          )}
                        </div>
                        <ChallengeHabitStrip
                          contestId={challenge.id}
                          participantId={challenge.participantId}
                          startDate={challenge.start_date}
                          endDate={challenge.end_date}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!loading && participatingChallenges.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-bold text-gray-900">Joined Challenges</h3>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={showCompleted}
                      onChange={(e) => setShowCompleted(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    Show Completed
                  </label>
                </div>
              </div>

              <div className="p-6">
                <div className="grid gap-4">
                  {participatingChallenges
                    .filter((challenge) => showCompleted || challenge.status !== 'completed')
                    .map((challenge) => (
                      <div
                        key={challenge.id}
                        className="border border-gray-200 rounded-lg p-6 hover:border-emerald-300 hover:shadow-md transition"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-3">
                          <button
                            onClick={() => navigate(`/contest/${challenge.id}`)}
                            className="flex-1 min-w-0 text-left group"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-emerald-600 transition break-words">
                                {challenge.name}
                              </h3>
                              <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                            </div>
                            <p className="text-sm text-gray-600 break-words">{challenge.description}</p>
                          </button>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                            {challenge.userRole === 'admin' && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Admin
                              </span>
                            )}
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                challenge.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : challenge.status === 'draft'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {challenge.status}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>{challenge.metrics?.length || 0} metrics</span>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSharingChallenge(challenge);
                              }}
                              className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
                            >
                              <Share2 className="w-4 h-4 shrink-0" />
                              Share
                            </button>

                            {challenge.userRole === 'admin' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setManagingChallengeId(challenge.id);
                                  }}
                                  className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                                >
                                  <Users className="w-4 h-4 shrink-0" />
                                  Partners
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSettingsChallenge(challenge);
                                  }}
                                  className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm font-medium"
                                >
                                  <Settings className="w-4 h-4 shrink-0" />
                                  Settings
                                </button>
                              </>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLeavingChallenge(challenge);
                              }}
                              className="flex flex-1 min-w-[calc(50%-4px)] sm:flex-initial items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                            >
                              <LogOut className="w-4 h-4 shrink-0" />
                              Leave
                            </button>
                          </div>
                          <ChallengeHabitStrip
                            contestId={challenge.id}
                            participantId={challenge.participantId}
                            startDate={challenge.start_date}
                            endDate={challenge.end_date}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showWizard && (
        <ContestWizard
          template={selectedTemplate}
          onClose={() => {
            setShowWizard(false);
            setSelectedTemplate(null);
          }}
          onSuccess={() => loadChallenges()}
        />
      )}

      {managingChallengeId && (
        <ParticipantManager
          contestId={managingChallengeId}
          onClose={() => setManagingChallengeId(null)}
        />
      )}

      {settingsChallenge && (
        <ContestSettingsModal
          contestId={settingsChallenge.id}
          contestName={settingsChallenge.name}
          contestDescription={settingsChallenge.description}
          currentStatus={settingsChallenge.status}
          isClosedForJoining={settingsChallenge.is_closed_for_joining || false}
          startDate={settingsChallenge.start_date}
          endDate={settingsChallenge.end_date}
          metrics={settingsChallenge.metrics || []}
          autoDeleteAt={settingsChallenge.auto_delete_at || null}
          onClose={() => setSettingsChallenge(null)}
          onSuccess={() => {
            loadChallenges();
            setSettingsChallenge(null);
          }}
        />
      )}

      {leavingChallenge && leavingChallenge.participantId && (
        <LeaveContestModal
          contestId={leavingChallenge.id}
          contestName={leavingChallenge.name}
          participantId={leavingChallenge.participantId}
          onClose={() => setLeavingChallenge(null)}
          onSuccess={() => {
            loadChallenges();
            setLeavingChallenge(null);
          }}
        />
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Join Challenge</h2>
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setJoinCode('');
                  setJoinError(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Challenge Code
                </label>
                <input
                  id="joinCode"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character code"
                  maxLength={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-lg text-center uppercase"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Ask the challenge creator for their invite code
                </p>
              </div>

              {joinError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{joinError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinCode('');
                    setJoinError(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinWithCode}
                  disabled={joiningByCode || joinCode.trim().length !== 8}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {joiningByCode ? 'Joining...' : 'Join Challenge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {sharingChallenge && sharingChallenge.invite_code && (
        <ShareModal
          contestId={sharingChallenge.id}
          contestName={sharingChallenge.name}
          contestDescription={sharingChallenge.description}
          inviteCode={sharingChallenge.invite_code}
          participantCount={sharingChallenge.participantCount || 0}
          daysRemaining={getDaysRemaining(sharingChallenge.end_date)}
          metricsCount={sharingChallenge.metrics?.length || 0}
          onClose={() => setSharingChallenge(null)}
        />
      )}
    </div>
  );
}
