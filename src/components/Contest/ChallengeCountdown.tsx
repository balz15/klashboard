import { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingDown } from 'lucide-react';

type ChallengeCountdownProps = {
  startDate: string;
  endDate: string;
};

export function ChallengeCountdown({ startDate, endDate }: ChallengeCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    daysRemaining: number;
    totalDays: number;
    percentComplete: number;
    hasStarted: boolean;
    hasEnded: boolean;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      const hasStarted = now >= start;
      const hasEnded = now > end;

      const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const daysRemaining = Math.max(0, Math.floor((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const daysElapsed = totalDays - daysRemaining;
      const percentComplete = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

      setTimeLeft({
        daysRemaining,
        totalDays,
        percentComplete,
        hasStarted,
        hasEnded,
      });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 3600000);
    return () => clearInterval(interval);
  }, [startDate, endDate]);

  if (!timeLeft) {
    return null;
  }

  if (!timeLeft.hasStarted) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">Challenge Starts Soon</h3>
            <p className="text-sm text-gray-600">
              Starting {new Date(startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (timeLeft.hasEnded) {
    return (
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">Challenge Completed</h3>
            <p className="text-sm text-gray-600">
              Ended {new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const urgencyColor = timeLeft.daysRemaining <= 3 ? 'red' : timeLeft.daysRemaining <= 7 ? 'yellow' : 'emerald';
  const bgColor = `bg-${urgencyColor}-50`;
  const borderColor = `border-${urgencyColor}-200`;
  const textColor = `text-${urgencyColor}-700`;
  const progressColor = `bg-${urgencyColor}-500`;

  return (
    <div className={`${bgColor} border-2 ${borderColor} rounded-xl p-6`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 ${progressColor} rounded-full flex items-center justify-center`}>
            <TrendingDown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {timeLeft.daysRemaining} {timeLeft.daysRemaining === 1 ? 'Day' : 'Days'} Left
            </h3>
            <p className="text-sm text-gray-600">
              {timeLeft.totalDays} day challenge
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-3xl font-bold ${textColor}`}>{timeLeft.percentComplete}%</p>
          <p className="text-xs text-gray-600">Complete</p>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full ${progressColor} transition-all duration-500 rounded-full`}
          style={{ width: `${timeLeft.percentComplete}%` }}
        />
      </div>

      <p className="text-xs text-gray-600 mt-3 text-center">
        Challenge ends {new Date(endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  );
}
