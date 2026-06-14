import { useState, useEffect, useMemo } from 'react';
import { Navbar } from '../components/Layout/Navbar';
import { Plus, Trophy, ExternalLink, Users, Check, Copy, Share2, Settings, LogOut, AlertCircle, X, LayoutGrid, ListChecks, ChevronRight } from 'lucide-react';
import { supabase, Contest, ChallengeTemplate } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ContestWizard } from '../components/ContestWizard/ContestWizard';
import { ParticipantManager } from '../components/Contest/ParticipantManager';
import { ContestSettingsModal } from '../components/Contest/ContestSettingsModal';
import { LeaveContestModal } from '../components/Contest/LeaveContestModal';
import { ShareModal } from '../components/Contest/ShareModal';
import { EngagementReminderCard } from '../components/Dashboard/EngagementReminderCard';
import { AdminTemplateReview } from '../components/Dashboard/AdminTemplateReview';
import { ChallengeHabitStrip } from '../components/Dashboard/ChallengeHabitStrip';
import { DailyQuickLog } from '../components/Dashboard/DailyQuickLog';
import { ChallengeIcon } from '../components/Contest/ChallengeIcon';
import { isContestVisibleOnDashboard, isContestActiveForLogging, getContestLifecycle, lifecycleLabel, lifecycleBadgeClass } from '../lib/contestStatus';
import { getTodayString } from '../lib/dateUtils';
import { initRealtimeNotifications } from '../lib/realtimeNotifications';
import { setReminderUserId } from '../lib/engagementReminders';
import { navigate } from '../lib/router';
import {
  TEMPLATE_ICON_MAP,
  getTemplateCategoryColor,
  isSystemTemplate,
  isUserCreatedTemplate,
} from '../lib/challengeTemplates';

type ContestWithParticipation = Contest & {
  userRole?: 'admin' | 'participant';
  participantId?: string;
  participantCount?: number;
};

const ICON_MAP = TEMPLATE_ICON_MAP;

function unwrapContest(raw: unknown): Contest | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as Contest) ?? null;
  return raw as Contest;
}

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
  const [dashboardTab, setDashboardTab] = useState<'challenges' | 'templates'>('challenges');
  const [loggedTodayContestIds, setLoggedTodayContestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadChallenges();
    loadTemplates();
    const tab = sessionStorage.getItem('dashboardTab');
    if (tab === 'templates') {
      setDashboardTab('templates');
      sessionStorage.removeItem('dashboardTab');
    }
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

      const missingContestIds = (participantData || [])
        .filter((p) => !unwrapContest(p.contests))
        .map((p) => p.contest_id);

      let fallbackContests: Record<string, Contest> = {};
      if (missingContestIds.length > 0) {
        const { data: fallbackData } = await supabase
          .from('contests')
          .select('*')
          .in('id', missingContestIds);
        fallbackContests = Object.fromEntries((fallbackData || []).map((c) => [c.id, c]));
      }

      const resolveContest = (p: { contest_id: string; contests: unknown }): Contest | null =>
        unwrapContest(p.contests) ?? fallbackContests[p.contest_id] ?? null;

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
        .filter((p) => {
          const contest = resolveContest(p);
          return contest && contest.creator_id !== user.id;
        })
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
        .filter((p) => {
          const contest = resolveContest(p);
          return contest && contest.creator_id !== user.id;
        })
        .map((p) => {
          const contest = resolveContest(p)!;
          return {
            ...contest,
            userRole: p.role as 'admin' | 'participant',
            participantId: p.id,
            participantCount: participatingCountMap[p.contest_id] || 0,
          };
        });

      setParticipatingChallenges(participating);

      const participantIds = (participantData || []).map((p) => p.id);
      if (participantIds.length > 0) {
        const { data: todayLogs } = await supabase
          .from('submissions')
          .select('contest_id')
          .in('participant_id', participantIds)
          .eq('submission_date', getTodayString());
        setLoggedTodayContestIds(new Set((todayLogs || []).map((s) => s.contest_id)));
      } else {
        setLoggedTodayContestIds(new Set());
      }
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

  const getCategoryColor = getTemplateCategoryColor;

  const userTemplateCount = useMemo(
    () => templates.filter(isUserCreatedTemplate).length,
    [templates]
  );

  const allMyChallenges = useMemo(() => {
    const byId = new Map<string, ContestWithParticipation>();
    createdChallenges.forEach((c) => byId.set(c.id, c));
    participatingChallenges.forEach((c) => byId.set(c.id, c));
    return [...byId.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [createdChallenges, participatingChallenges]);

  const visibleChallenges = useMemo(
    () =>
      allMyChallenges.filter((c) => showCompleted || isContestVisibleOnDashboard(c)),
    [allMyChallenges, showCompleted]
  );

  const quickLogChallenges = useMemo(
    () =>
      allMyChallenges
        .filter(
          (c) =>
            c.participantId &&
            isContestActiveForLogging(c) &&
            !loggedTodayContestIds.has(c.id)
        )
        .map((c) => ({
          id: c.id,
          name: c.name,
          participantId: c.participantId!,
          metrics: c.metrics || [],
        })),
    [allMyChallenges, loggedTodayContestIds]
  );

  const activeLoggingCount = useMemo(
    () =>
      allMyChallenges.filter((c) => c.participantId && isContestActiveForLogging(c)).length,
    [allMyChallenges]
  );

  useEffect(() => {
    if (!user) {
      setReminderUserId(null);
      return;
    }
    setReminderUserId(user.id);
    const contestIds = allMyChallenges.filter((c) => c.participantId).map((c) => c.id);
    return initRealtimeNotifications(user.id, contestIds);
  }, [user, allMyChallenges]);

  const reminderChallengeOptions = useMemo(
    () =>
      allMyChallenges
        .filter((c) => c.participantId && isContestActiveForLogging(c))
        .map((c) => ({ id: c.id, name: c.name })),
    [allMyChallenges]
  );

  const renderChallengeCard = (challenge: ContestWithParticipation) => {
    const lifecycle = getContestLifecycle(challenge);
    return (
    <div
      key={challenge.id}
      className="border border-gray-200 rounded-lg p-6 hover:border-emerald-300 hover:shadow-md transition"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-3">
        <button
          onClick={() => navigate(`/contest/${challenge.id}`)}
          className="flex-1 min-w-0 text-left group flex items-start gap-3"
        >
          <ChallengeIcon icon={challenge.icon} iconUrl={challenge.icon_url} size="sm" className="bg-emerald-50 border border-emerald-100" />
          <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-emerald-600 transition break-words">
              {challenge.name}
            </h3>
            <ExternalLink className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
          </div>
          <p className="text-sm text-gray-600 break-words">{challenge.description}</p>
          </div>
        </button>
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
          {challenge.creator_id === user?.id && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
              Created
            </span>
          )}
          {challenge.userRole === 'admin' && challenge.creator_id !== user?.id && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
              Admin
            </span>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${lifecycleBadgeClass(lifecycle)}`}
          >
            {lifecycleLabel(lifecycle)}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
          <span>{challenge.metrics?.length || 0} metrics</span>
          {loggedTodayContestIds.has(challenge.id) && isContestActiveForLogging(challenge) && (
            <span className="text-emerald-600 font-medium">Logged today</span>
          )}
          {challenge.invite_code && challenge.creator_id === user?.id && (
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
    );
  };

  const renderTemplatesTab = () => {
    const systemTemplates = templates.filter(isSystemTemplate);

    return (
    <div>
      <AdminTemplateReview />
      <p className="text-gray-600 text-sm mb-6">
        Pick a ready-made template to start quickly, or build a custom challenge from scratch.
      </p>

      <button
        type="button"
        onClick={() => navigate('/templates/community')}
        className="w-full mb-6 flex items-center gap-4 rounded-xl border-2 border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-5 text-left hover:border-violet-400 hover:shadow-md transition group"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Browse user created templates</p>
          <p className="text-sm text-gray-600 mt-0.5">
            Community challenges with keyword search — kept separate so ready-made templates stay easy to scan.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-violet-700 font-semibold text-sm">
          {userTemplateCount > 0 ? (
            <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-violet-200/80 text-violet-900 text-xs">
              {userTemplateCount} available
            </span>
          ) : null}
          <span className="group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
            Open
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {systemTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              className="bg-white rounded-xl p-5 shadow-sm border-2 border-gray-200 hover:border-emerald-400 hover:shadow-lg transition-all text-left group"
            >
              <div
                className={`w-12 h-12 bg-gradient-to-br ${getCategoryColor(template.category)} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-2xl`}
              >
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
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Track progress and stay accountable with your group
          </p>
        </div>

        <div className="flex gap-2 mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-1.5">
          <button
            type="button"
            onClick={() => setDashboardTab('challenges')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              dashboardTab === 'challenges'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            My Challenges
          </button>
          <button
            type="button"
            onClick={() => setDashboardTab('templates')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              dashboardTab === 'templates'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Templates
          </button>
        </div>

        {dashboardTab === 'challenges' && (
          <>
            {user && <EngagementReminderCard challenges={reminderChallengeOptions} />}

            {!loading && activeLoggingCount > 0 && (
              <DailyQuickLog
                challenges={quickLogChallenges}
                onSuccess={() => void loadChallenges()}
              />
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-bold text-gray-900">My Challenges</h2>
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={showCompleted}
                        onChange={(e) => setShowCompleted(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      Show ended
                    </label>
                    <button
                      onClick={() => setShowJoinModal(true)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 transition text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Join with Code
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : visibleChallenges.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Trophy className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-900 font-semibold mb-1">No active challenges</p>
                    <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
                      Create a new challenge or join one with an invite code to get started.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        onClick={() => setDashboardTab('templates')}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
                      >
                        <Plus className="w-5 h-5" />
                        Create Challenge
                      </button>
                      <button
                        onClick={() => setShowJoinModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-emerald-600 text-emerald-700 rounded-lg hover:bg-emerald-50 transition font-medium"
                      >
                        Join with Code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {visibleChallenges.map((challenge) => renderChallengeCard(challenge))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {dashboardTab === 'templates' && renderTemplatesTab()}
      </div>

      {showWizard && (
        <ContestWizard
          template={selectedTemplate}
          onClose={() => {
            setShowWizard(false);
            setSelectedTemplate(null);
          }}
          onSuccess={() => {
            loadChallenges();
            setDashboardTab('challenges');
          }}
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
          contestIcon={settingsChallenge.icon}
          contestIconUrl={settingsChallenge.icon_url}
          currentStatus={settingsChallenge.status}
          isClosedForJoining={settingsChallenge.is_closed_for_joining || false}
          startDate={settingsChallenge.start_date}
          endDate={settingsChallenge.end_date}
          metrics={settingsChallenge.metrics || []}
          scoringRules={settingsChallenge.scoring_rules}
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
