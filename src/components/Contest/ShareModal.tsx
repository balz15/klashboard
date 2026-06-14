import { useState } from 'react';
import { X, Copy, CheckCircle } from 'lucide-react';
import { getContestDeepLink } from '../../lib/shareLinks';

type ShareModalProps = {
  contestId: string;
  contestName: string;
  contestDescription: string;
  inviteCode: string;
  participantCount: number;
  daysRemaining?: number;
  metricsCount: number;
  onClose: () => void;
};

export function ShareModal({
  contestId,
  contestName,
  contestDescription,
  inviteCode,
  participantCount,
  daysRemaining,
  metricsCount,
  onClose,
}: ShareModalProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);

  const getShareMessage = () => {
    const daysText = daysRemaining !== undefined ? `\n⏰ ${daysRemaining} days left to join\n` : '';
    return `🎯 Join me in the "${contestName}" challenge!

${contestDescription}

📊 ${metricsCount} goal${metricsCount !== 1 ? 's' : ''} to track
👥 ${participantCount} people already committed${daysText}
Let's build better habits together! 💪

Use code: ${inviteCode}

Join here: ${getContestDeepLink(contestId)}`;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(getShareMessage());
      setMessageCopied(true);
      setTimeout(() => setMessageCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  const handleShareWhatsApp = () => {
    const text = getShareMessage();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const url = isMobile
      ? `whatsapp://send?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareTwitter = () => {
    const text = `🎯 Join me in the "${contestName}" challenge!\n\n${participantCount} people are already in. Let's build better habits together! 💪\n\nCode: ${inviteCode}`;
    const url = getContestDeepLink(contestId);
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      '_blank'
    );
  };

  const handleShareFacebook = () => {
    const url = getContestDeepLink(contestId);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  };

  const handleShareLinkedIn = () => {
    const url = getContestDeepLink(contestId);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      '_blank'
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900">Share Challenge</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="space-y-5">
          <button
            onClick={handleShareWhatsApp}
            className="w-full p-6 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition transform hover:scale-105 shadow-lg"
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              <div className="text-left">
                <p className="text-xl font-bold">Share on WhatsApp</p>
                <p className="text-sm text-green-100">Invite your friends to join</p>
              </div>
            </div>
          </button>

          <div className="p-5 bg-gray-50 border-2 border-gray-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Message Preview</p>
              <button
                onClick={handleCopyMessage}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition font-medium"
              >
                {messageCopied ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 max-h-64 overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                {getShareMessage()}
              </pre>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-sm font-medium text-emerald-900 mb-2">Just the Code</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold font-mono text-emerald-700 tracking-wider">
                  {inviteCode}
                </p>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
              >
                {copySuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-3 font-medium">Other platforms</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleShareTwitter}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition"
              >
                <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  𝕏
                </div>
                <span className="text-xs font-semibold text-gray-700">X (Twitter)</span>
              </button>

              <button
                onClick={handleShareFacebook}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  f
                </div>
                <span className="text-xs font-semibold text-gray-700">Facebook</span>
              </button>

              <button
                onClick={handleShareLinkedIn}
                className="flex flex-col items-center gap-2 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-700 hover:bg-blue-50 transition"
              >
                <div className="w-12 h-12 bg-blue-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  in
                </div>
                <span className="text-xs font-semibold text-gray-700">LinkedIn</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
