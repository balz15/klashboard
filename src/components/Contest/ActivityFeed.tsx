import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Flame, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTodayString } from '../../lib/dateUtils';

type ActivityItem = {
  type: 'submission' | 'missed' | 'streak_milestone' | 'poke';
  participantName: string;
  targetName?: string;
  date: string;
  timestamp: string;
  streakCount?: number;
};

type ActivityFeedProps = {
  contestId: string;
};

export function ActivityFeed({ contestId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, [contestId]);

  const loadActivities = async () => {
    try {
      const { data: participants, error: participantsError } = await supabase
        .from('contest_participants')
        .select('*, profiles(email, full_name)')
        .eq('contest_id', contestId)
        .is('left_at', null);

      if (participantsError) throw participantsError;

      const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('*')
        .eq('contest_id', contestId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (submissionsError) throw submissionsError;

      const { data: pokes, error: pokesError } = await supabase
        .from('contest_pokes')
        .select('from_user_id, to_user_id, created_at')
        .eq('contest_id', contestId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (pokesError) {
        console.warn('contest_pokes:', pokesError.message);
      }

      const activityItems: ActivityItem[] = [];

      pokes?.forEach((poke) => {
        const fromP = participants?.find((p) => p.user_id === poke.from_user_id);
        const toP = participants?.find((p) => p.user_id === poke.to_user_id);
        if (!fromP || !toP) return;
        const fromName = fromP.profiles.full_name || fromP.profiles.email.split('@')[0];
        const toName = toP.profiles.full_name || toP.profiles.email.split('@')[0];
        activityItems.push({
          type: 'poke',
          participantName: fromName,
          targetName: toName,
          date: poke.created_at.slice(0, 10),
          timestamp: poke.created_at,
        });
      });

      submissions?.forEach((sub) => {
        const participant = participants?.find((p) => p.id === sub.participant_id);
        if (!participant) return;

        const participantName = participant.profiles.full_name || participant.profiles.email.split('@')[0];

        activityItems.push({
          type: 'submission',
          participantName,
          date: sub.submission_date,
          timestamp: sub.created_at,
          streakCount: sub.streak_count,
        });

        if (sub.streak_count >= 7 && sub.streak_count % 7 === 0) {
          activityItems.push({
            type: 'streak_milestone',
            participantName,
            date: sub.submission_date,
            timestamp: sub.created_at,
            streakCount: sub.streak_count,
          });
        }
      });

      const todayStr = getTodayString();

      participants?.forEach((participant) => {
        const todaySubmission = submissions?.find(
          (s) => s.participant_id === participant.id && s.submission_date === todayStr
        );

        if (!todaySubmission) {
          const participantName = participant.profiles.full_name || participant.profiles.email.split('@')[0];
          activityItems.push({
            type: 'missed',
            participantName,
            date: todayStr,
            timestamp: new Date().toISOString(),
          });
        }
      });

      activityItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(activityItems.slice(0, 10));
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'submission':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'missed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'streak_milestone':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'poke':
        return <Zap className="w-5 h-5 text-indigo-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActivityText = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'submission':
        return (
          <span>
            <span className="font-semibold">{activity.participantName}</span> logged day{' '}
            {activity.streakCount && activity.streakCount > 1 && (
              <span className="text-emerald-600 font-semibold">{activity.streakCount}</span>
            )}
          </span>
        );
      case 'missed':
        return (
          <span>
            <span className="font-semibold">{activity.participantName}</span>{' '}
            <span className="text-red-600">hasn't logged today</span>
          </span>
        );
      case 'streak_milestone':
        return (
          <span>
            <span className="font-semibold">{activity.participantName}</span> hit a{' '}
            <span className="text-orange-600 font-bold">{activity.streakCount}-day streak!</span>
          </span>
        );
      case 'poke':
        return (
          <span>
            <span className="font-semibold">{activity.participantName}</span> nudged{' '}
            <span className="font-semibold text-indigo-700">{activity.targetName}</span>
          </span>
        );
      default:
        return '';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-32">
          <div className="inline-block w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-emerald-600" />
        Recent Activity
      </h2>

      <div className="space-y-3">
        {activities.map((activity, index) => (
          <div
            key={`${activity.type}-${activity.participantName}-${activity.timestamp}-${index}`}
            className={`flex items-start gap-3 p-3 rounded-lg transition ${
              activity.type === 'missed' ? 'bg-red-50' : 'bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900">{getActivityText(activity)}</p>
              <p className="text-xs text-gray-500 mt-1">{getTimeAgo(activity.timestamp)}</p>
            </div>
          </div>
        ))}

        {activities.length === 0 && (
          <div className="text-center py-8">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
}
