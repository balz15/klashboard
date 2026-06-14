import { useState, useEffect } from 'react';
import { Navbar } from '../components/Layout/Navbar';
import {
  Trophy,
  Users,
  Calendar,
  Share2,
  CheckCircle,
  TrendingUp,
  PlusCircle,
  Lock,
  LogOut,
  Settings,
  MessageCircle,
  Flame,
} from 'lucide-react';
import { supabase, Contest } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getTodayString } from '../lib/dateUtils';
import { SubmissionForm } from '../components/Contest/SubmissionForm';
import { LeaveContestModal } from '../components/Contest/LeaveContestModal';
import { ContestSettingsModal } from '../components/Contest/ContestSettingsModal';
import { DailyTracker } from '../components/Contest/DailyTracker';
import { HabitAnalytics } from '../components/Contest/HabitAnalytics';
import { GroupProgress } from '../components/Contest/GroupProgress';
import { QuickCheckIn } from '../components/Contest/QuickCheckIn';
import { ChallengeCountdown } from '../components/Contest/ChallengeCountdown';
import { ActivityFeed } from '../components/Contest/ActivityFeed';
import { GroupStatus } from '../components/Contest/GroupStatus';
import { ContestChat } from '../components/Contest/ContestChat';
import { ShareModal } from '../components/Contest/ShareModal';
import { ChallengeIcon } from '../components/Contest/ChallengeIcon';

type Participant = {
  id: string;
  user_id: string;
  role: 'admin' | 'participant';
  current_score?: number;
  joined_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
};

type ParticipantWithStreak = Participant & {
  current_streak?: number;
  longest_streak?: number;
};

type ContestDetailProps = {
  contestId: string;
};

export function ContestDetail({ contestId }: ContestDetailProps) {
  const { user, profile } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [participants, setParticipants] = useState<ParticipantWithStreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [userParticipantId, setUserParticipantId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userStreak, setUserStreak] = useState<number>(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracker' | 'stats' | 'leaderboard' | 'group' | 'chat'>('tracker');
  const [hasLoggedToday, setHasLoggedToday] = useState(false);

  useEffect(() => {
    loadContestDetails();
  }, [contestId, user]);

  const updateGroupStreak = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-group-streak`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contestId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update group streak');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error updating group streak:', error);
    }
  };

  const loadContestDetails = async () => {
    try {
      const { data: contestData, error: contestError } = await supabase
        .from('contests')
        .select('*, profiles!contests_creator_id_fkey(email, full_name)')
        .eq('id', contestId)
        .single();

      if (contestError) throw contestError;
      setContest(contestData);

      const { data: participantsData, error: participantsError } = await supabase
        .from('contest_participants')
        .select('*, profiles(email, full_name)')
        .eq('contest_id', contestId)
        .is('left_at', null)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;

      let rows = participantsData || [];

      // Creators should always be members; repair rows missing after failed setup
      if (user && contestData.creator_id === user.id) {
        const creatorRow = rows.find((p) => p.user_id === user.id);
        if (!creatorRow) {
          const { data: repaired, error: repairError } = await supabase
            .from('contest_participants')
            .insert({
              contest_id: contestId,
              user_id: user.id,
              role: 'admin',
            })
            .select('*, profiles(email, full_name)')
            .single();
          if (!repairError && repaired) {
            rows = [...rows, repaired];
          }
        }
      }

      const participantsWithStreaks: ParticipantWithStreak[] = await Promise.all(
        rows.map(async (p) => {
          const { data: latestSubmission } = await supabase
            .from('submissions')
            .select('streak_count')
            .eq('contest_id', contestId)
            .eq('participant_id', p.id)
            .order('submission_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          const { data: allSubmissions } = await supabase
            .from('submissions')
            .select('streak_count')
            .eq('contest_id', contestId)
            .eq('participant_id', p.id)
            .order('streak_count', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...p,
            current_streak: latestSubmission?.streak_count || 0,
            longest_streak: allSubmissions?.streak_count || 0,
          };
        })
      );

      setParticipants(participantsWithStreaks);

      if (user) {
        const userParticipant = participantsWithStreaks.find((p) => p.user_id === user.id);
        const isCreator = contestData.creator_id === user.id;
        setHasJoined(!!userParticipant || isCreator);
        setUserParticipantId(userParticipant?.id || null);
        setUserRole(userParticipant?.role || (isCreator ? 'admin' : null));
        setUserStreak(userParticipant?.current_streak || 0);

        if (userParticipant) {
          const todayStr = getTodayString();
          const { data: todaySubmission } = await supabase
            .from('submissions')
            .select('id')
            .eq('contest_id', contestId)
            .eq('participant_id', userParticipant.id)
            .eq('submission_date', todayStr)
            .maybeSingle();

          setHasLoggedToday(!!todaySubmission);
        }
      }

      await updateGroupStreak();
    } catch (error) {
      console.error('Error loading challenge details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinContest = async () => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    if (hasJoined) {
      alert('You have already joined this challenge');
      return;
    }

    if (contest?.is_closed_for_joining) {
      alert('This challenge is closed for new members');
      return;
    }

    setJoining(true);
    try {
      const { data: existing } = await supabase
        .from('contest_participants')
        .select('id')
        .eq('contest_id', contestId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        alert('You have already joined this challenge');
        await loadContestDetails();
        return;
      }

      const { error } = await supabase.from('contest_participants').insert({
        contest_id: contestId,
        user_id: user.id,
        role: 'participant',
      });

      if (error) {
        if (error.code === '23505') {
          alert('You have already joined this challenge');
        } else {
          throw error;
        }
      }

      await loadContestDetails();
    } catch (error: any) {
      console.error('Error joining challenge:', error);
      alert(error.message || 'Failed to join challenge');
    } finally {
      setJoining(false);
    }
  };

  const isAdmin = userRole === 'admin' || (contest && user && contest.creator_id === user.id);

  const getDaysRemaining = () => {
    const now = new Date();
    const end = new Date(contest?.end_date || '');
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Challenge not found</h1>
          <p className="text-gray-600">This challenge may have been deleted or made private.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 sm:p-8 mb-8 text-white shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-2">
                <ChallengeIcon icon={contest.icon} iconUrl={contest.icon_url} size="lg" />
                <div className="min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <h1 className="text-2xl sm:text-4xl font-bold break-words">{contest.name}</h1>
                {contest.is_closed_for_joining && (
                  <span className="flex items-center gap-1 px-3 py-1 bg-red-500 bg-opacity-20 backdrop-blur-sm rounded-lg text-sm font-medium shrink-0 self-start">
                    <Lock className="w-4 h-4" />
                    Closed
                  </span>
                )}
              </div>
              <p className="text-emerald-50 text-base sm:text-lg break-words mt-1">{contest.description}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 w-full lg:w-auto lg:shrink-0">
              {isAdmin && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition font-medium min-w-0 flex-1 sm:flex-initial"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Settings</span>
                </button>
              )}
              <button
                onClick={() => setShowShareModal(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition font-medium min-w-0 flex-1 sm:flex-initial"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>Share</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium text-emerald-50">Partners</span>
              </div>
              <p className="text-3xl font-bold">{participants.length}</p>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-red-500 bg-opacity-90 rounded-xl p-4 border-2 border-white border-opacity-30">
              <div className="flex items-center gap-3 mb-2">
                <Flame className="w-5 h-5 text-orange-100" />
                <span className="text-sm font-medium text-orange-50">Group Streak</span>
              </div>
              <p className="text-3xl font-bold flex items-center gap-2">
                {contest.group_streak_count || 0} <span className="text-lg">days</span>
              </p>
              <p className="text-xs text-orange-100 mt-1">Everyone committed!</p>
            </div>

            {hasJoined && userStreak > 0 && (
              <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Flame className="w-5 h-5 text-orange-300" />
                  <span className="text-sm font-medium text-emerald-50">Your Streak</span>
                </div>
                <p className="text-3xl font-bold flex items-center gap-2">
                  {userStreak} <span className="text-lg">days</span>
                </p>
              </div>
            )}

            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5" />
                <span className="text-sm font-medium text-emerald-50">Start Date</span>
              </div>
              <p className="text-lg font-semibold">{formatDate(contest.start_date)}</p>
            </div>

            <div className="bg-white bg-opacity-20 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="w-5 h-5" />
                <span className="text-sm font-medium text-emerald-50">End Date</span>
              </div>
              <p className="text-lg font-semibold">{formatDate(contest.end_date)}</p>
            </div>
          </div>

          {hasJoined && (
            <div className="mt-6 bg-orange-500 bg-opacity-20 backdrop-blur-sm border-2 border-orange-300 border-opacity-30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Flame className="w-5 h-5 text-orange-200" />
                <div>
                  <h3 className="font-bold text-orange-100">Group Accountability</h3>
                  <p className="text-sm text-orange-50 mt-1">
                    The group streak resets if anyone misses more than 2 consecutive days. Stay committed together!
                  </p>
                </div>
              </div>
            </div>
          )}

          {user && (
            <div className="mt-6 flex gap-3 flex-wrap">
              {!hasJoined ? (
                <>
                  <button
                    onClick={handleJoinContest}
                    disabled={joining || contest.is_closed_for_joining}
                    className="px-8 py-3 bg-white text-emerald-600 font-bold rounded-lg hover:bg-emerald-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                  >
                    {joining ? 'Joining...' : contest.is_closed_for_joining ? 'Closed for New Members' : 'Join This Challenge'}
                  </button>
                  {contest.is_closed_for_joining && (
                    <div className="flex items-center gap-2 text-emerald-50 bg-red-500 bg-opacity-20 backdrop-blur-sm rounded-lg px-4 py-3">
                      <Lock className="w-5 h-5" />
                      <span className="text-sm">This challenge is not accepting new members</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-emerald-50 bg-white bg-opacity-20 backdrop-blur-sm rounded-lg px-6 py-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">You're participating</span>
                  </div>
                  {contest.status !== 'completed' && (
                    <button
                      onClick={() => setShowSubmissionForm(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-600 font-bold rounded-lg hover:bg-emerald-50 transition text-lg"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Log Progress
                    </button>
                  )}
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-red-500 bg-opacity-20 backdrop-blur-sm text-white font-bold rounded-lg hover:bg-red-500 hover:bg-opacity-30 transition text-lg"
                  >
                    <LogOut className="w-5 h-5" />
                    Leave
                  </button>
                </>
              )}
            </div>
          )}

          {!user && (
            <div className="mt-6">
              <button
                onClick={() => (window.location.href = '/auth')}
                className="w-full md:w-auto px-8 py-3 bg-white text-emerald-600 font-bold rounded-lg hover:bg-emerald-50 transition text-lg"
              >
                Sign In to Join
              </button>
            </div>
          )}
        </div>

        {hasJoined && userParticipantId ? (
          <div>
            <div className="mb-6">
              <ChallengeCountdown startDate={contest.start_date} endDate={contest.end_date} />
            </div>

            {contest.status !== 'completed' && !hasLoggedToday && (
              <div className="mb-6">
                <QuickCheckIn
                  contestId={contestId}
                  participantId={userParticipantId}
                  metrics={contest.metrics || []}
                  onSuccess={loadContestDetails}
                />
              </div>
            )}

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 bg-white rounded-xl shadow-sm border border-gray-200 p-2 mb-6">
              <button
                onClick={() => setActiveTab('tracker')}
                className={`min-w-0 py-3 px-2 sm:px-4 rounded-lg transition font-medium text-sm sm:text-base sm:flex-1 sm:min-w-[140px] ${
                  activeTab === 'tracker'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-1 sm:mr-2 align-text-bottom" />
                Daily Tracker
              </button>
              <button
                onClick={() => setActiveTab('group')}
                className={`min-w-0 py-3 px-2 sm:px-4 rounded-lg transition font-medium text-sm sm:text-base sm:flex-1 sm:min-w-[140px] ${
                  activeTab === 'group'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1 sm:mr-2 align-text-bottom" />
                Group
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`min-w-0 py-3 px-2 sm:px-4 rounded-lg transition font-medium text-sm sm:text-base sm:flex-1 sm:min-w-[140px] ${
                  activeTab === 'stats'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-1 sm:mr-2 align-text-bottom" />
                Stats & Insights
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`min-w-0 py-3 px-2 sm:px-4 rounded-lg transition font-medium text-sm sm:text-base sm:flex-1 sm:min-w-[120px] ${
                  activeTab === 'leaderboard'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Trophy className="w-4 h-4 inline mr-1 sm:mr-2 align-text-bottom" />
                Group Progress
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`min-w-0 py-3 px-2 sm:px-4 rounded-lg transition font-medium text-sm sm:text-base sm:flex-1 sm:min-w-[100px] col-span-2 sm:col-span-1 ${
                  activeTab === 'chat'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <MessageCircle className="w-4 h-4 inline mr-1 sm:mr-2 align-text-bottom" />
                Chat
              </button>
            </div>

            {activeTab === 'tracker' && (
              <DailyTracker
                contestId={contestId}
                participantId={userParticipantId}
                metrics={contest.metrics || []}
                startDate={contest.start_date}
                endDate={contest.end_date}
                onSubmissionUpdate={loadContestDetails}
              />
            )}

            {activeTab === 'group' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GroupStatus
                  contestId={contestId}
                  startDate={contest.start_date}
                  currentUserId={user?.id}
                />
                <ActivityFeed contestId={contestId} />
              </div>
            )}

            {activeTab === 'stats' && userParticipantId && (
              <HabitAnalytics
                contestId={contestId}
                participantId={userParticipantId}
                metrics={contest.metrics || []}
                startDate={contest.start_date}
                endDate={contest.end_date}
                scoringRules={contest.scoring_rules}
                contestName={contest.name}
                userDisplayName={profile?.full_name || profile?.email?.split('@')[0] || 'Me'}
                participants={participants.map((p) => ({
                  id: p.id,
                  name: p.profiles.full_name || p.profiles.email.split('@')[0],
                  isSelf: p.user_id === user?.id,
                }))}
              />
            )}

            {activeTab === 'leaderboard' && (
              <GroupProgress
                contestId={contestId}
                startDate={contest.start_date}
                endDate={contest.end_date}
                currentUserId={user?.id}
                metrics={contest.metrics || []}
              />
            )}

            {activeTab === 'chat' && (
              <ContestChat
                contestId={contestId}
                endDate={contest.end_date}
                contestStatus={contest.status}
                endedAt={contest.ended_at}
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-emerald-600" />
                  Metrics to Track
                </h2>

                <div className="space-y-3">
                  {contest.metrics?.map((metric: any) => (
                    <div key={metric.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{metric.label}</h3>
                        <p className="text-sm text-gray-600">
                          Type: {metric.type === 'boolean' ? 'Yes/No' : `Measurable (${metric.unit})`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Log your daily progress for these metrics to build your streak and stay accountable with your group.
                </p>
              </div>
            </div>

            <div>
              <GroupProgress
                contestId={contestId}
                startDate={contest.start_date}
                endDate={contest.end_date}
                currentUserId={user?.id}
                metrics={contest.metrics || []}
              />
            </div>
          </div>
        )}
      </div>

      {showShareModal && contest && contest.invite_code && (
        <ShareModal
          contestId={contestId}
          contestName={contest.name}
          contestDescription={contest.description}
          inviteCode={contest.invite_code}
          participantCount={participants.length}
          daysRemaining={getDaysRemaining()}
          metricsCount={contest.metrics?.length || 0}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showSubmissionForm && contest && userParticipantId && (
        <SubmissionForm
          contestId={contestId}
          participantId={userParticipantId}
          metrics={contest.metrics || []}
          onClose={() => setShowSubmissionForm(false)}
          onSuccess={() => {
            setShowSubmissionForm(false);
            loadContestDetails();
          }}
        />
      )}

      {showLeaveModal && userParticipantId && (
        <LeaveContestModal
          contestId={contestId}
          contestName={contest.name}
          participantId={userParticipantId}
          onClose={() => setShowLeaveModal(false)}
          onSuccess={() => {
            setShowLeaveModal(false);
            window.location.href = '/dashboard';
          }}
        />
      )}

      {showSettingsModal && isAdmin && (
        <ContestSettingsModal
          contestId={contestId}
          contestName={contest.name}
          contestDescription={contest.description}
          contestIcon={contest.icon}
          contestIconUrl={contest.icon_url}
          currentStatus={contest.status}
          isClosedForJoining={contest.is_closed_for_joining || false}
          startDate={contest.start_date}
          endDate={contest.end_date}
          metrics={contest.metrics || []}
          scoringRules={contest.scoring_rules}
          autoDeleteAt={contest.auto_delete_at || null}
          onClose={() => setShowSettingsModal(false)}
          onSuccess={() => {
            loadContestDetails();
          }}
        />
      )}
    </div>
  );
}
