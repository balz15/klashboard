import { useState } from 'react';
import { X, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type LeaveContestModalProps = {
  contestId: string;
  contestName: string;
  participantId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function LeaveContestModal({
  contestId,
  contestName,
  participantId,
  onClose,
  onSuccess,
}: LeaveContestModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const handleLeaveContest = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();

      const { data: participantData, error: fetchError } = await supabase
        .from('contest_participants')
        .select('user_id')
        .eq('id', participantId)
        .single();

      if (fetchError) throw fetchError;

      const { error: updateError } = await supabase
        .from('contest_participants')
        .update({
          left_at: now,
          exit_reason: reason || null,
        })
        .eq('id', participantId);

      if (updateError) throw updateError;

      const { error: auditError } = await supabase.from('contest_member_exits').insert({
        contest_id: contestId,
        user_id: participantData.user_id,
        participant_id: participantId,
        exit_reason: reason || null,
      });

      if (auditError) throw auditError;

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to leave contest');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Leave Contest</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900 mb-1">
                Are you sure you want to leave this contest?
              </p>
              <p className="text-sm text-yellow-800">
                You are about to leave "{contestName}". Your progress will be saved, but you will no
                longer participate in this contest.
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for leaving (optional)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Let us know why you're leaving..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleLeaveContest}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                'Leaving...'
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Leave Contest
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
