import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { sendContestPoke } from '../../lib/pokeParticipant';

type NudgeModalProps = {
  contestId: string;
  toUserId: string;
  toUserName: string;
  onClose: () => void;
  onSent?: () => void;
};

export function NudgeModal({ contestId, toUserId, toUserName, onClose, onSent }: NudgeModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setSending(true);
    setError(null);
    const { error: pokeError } = await sendContestPoke(contestId, toUserId, message);
    setSending(false);
    if (pokeError) {
      setError(pokeError.message || 'Could not send nudge');
      return;
    }
    onSent?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-indigo-600" />
            Nudge {toUserName}
          </h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            Send a quick reminder to log today&apos;s entry. They&apos;ll get an instant notification.
          </p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 140))}
            placeholder="Optional message (e.g. Let's keep the group streak alive!)"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 text-right">{message.length}/140</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex gap-2 p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="flex-1 py-2 text-gray-700 hover:bg-gray-200 rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSend()}
            className="flex-1 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send nudge'}
          </button>
        </div>
      </div>
    </div>
  );
}
