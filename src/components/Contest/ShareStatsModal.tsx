import { useState } from 'react';
import { X, Copy, CheckCircle, Share2 } from 'lucide-react';
import type { MetricDef } from '../../lib/habitAnalytics';
import {
  buildStatsShareMessage,
  getContestDeepLink,
  openInstagramShareHint,
  openWhatsAppShare,
  shareText,
} from '../../lib/shareLinks';

type ShareStatsModalProps = {
  contestId: string;
  contestName: string;
  userName: string;
  metric: MetricDef;
  periodLabel: string;
  achieved: number;
  goal?: number;
  scorePct?: number;
  currentStreak: number;
  bestStreak: number;
  onClose: () => void;
};

export function ShareStatsModal({
  contestId,
  contestName,
  userName,
  metric,
  periodLabel,
  achieved,
  goal,
  scorePct,
  currentStreak,
  bestStreak,
  onClose,
}: ShareStatsModalProps) {
  const [copied, setCopied] = useState(false);

  const message = buildStatsShareMessage({
    contestId,
    contestName,
    userName,
    metricLabel: metric.label,
    periodLabel,
    achieved,
    goal,
    scorePct,
    currentStreak,
    bestStreak,
    unit: metric.type === 'number' ? metric.unit : undefined,
  });

  const link = getContestDeepLink(contestId);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    const ok = await shareText(`${contestName} on KlashBoard`, message, link);
    if (!ok) await handleCopy();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Share your progress</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <p className="text-sm opacity-90">KlashBoard · {contestName}</p>
            <p className="text-2xl font-bold mt-2">{metric.label}</p>
            <p className="text-lg mt-1">
              {achieved}
              {metric.type === 'number' && metric.unit ? ` ${metric.unit}` : ''}{' '}
              {goal != null ? `/ ${goal} goal` : ''}
            </p>
            <p className="text-sm mt-2 opacity-90">
              🔥 {currentStreak}d streak · Best {bestStreak}d
              {scorePct != null ? ` · ${scorePct}% score` : ''}
            </p>
          </div>

          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 whitespace-pre-wrap font-sans text-gray-800 max-h-40 overflow-y-auto">
            {message}
          </pre>

          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
          >
            <Share2 className="w-5 h-5" />
            Share (WhatsApp, Instagram, more…)
          </button>

          <button
            type="button"
            onClick={() => openWhatsAppShare(message)}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700"
          >
            Share on WhatsApp
          </button>

          <button
            type="button"
            onClick={() => {
              handleCopy();
              openInstagramShareHint();
            }}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-semibold hover:opacity-90"
          >
            Copy for Instagram Story / Post
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-gray-200 rounded-xl font-medium hover:bg-gray-50"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy message + link'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Friends opening <span className="font-mono text-emerald-700">{link}</span> land on this challenge
            (install KlashBoard on Android when prompted).
          </p>
        </div>
      </div>
    </div>
  );
}
