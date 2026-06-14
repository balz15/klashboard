import { useState, useEffect } from 'react';
import { Check, X, Clock, Shield, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  getAppAdminStatus,
  approveTemplateSubmission,
  rejectTemplateSubmission,
  type AppAdminStatus,
} from '../../lib/appAdmin';

type Submission = {
  id: string;
  name: string;
  description: string;
  status: string;
  created_at: string;
  submitted_by: string;
};

export function AdminTemplateReview() {
  const { user } = useAuth();
  const [adminStatus, setAdminStatus] = useState<AppAdminStatus | null>(null);
  const [pending, setPending] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, [user]);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const status = await getAppAdminStatus(user.id);
    setAdminStatus(status);

    if (!status.canSeeQueue) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_template_submissions')
      .select('id, name, description, status, created_at, submitted_by')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      setMessage({ type: 'err', text: error.message });
    }

    setPending((data as Submission[]) || []);
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!user) return;
    if (!adminStatus?.canApprove) {
      setMessage({
        type: 'err',
        text:
          adminStatus?.setupHint ??
          'You cannot approve yet. Set is_app_admin = true on your profile in Supabase.',
      });
      return;
    }

    setActing(id);
    setMessage(null);
    const { error } = await approveTemplateSubmission(id, user.id);
    setActing(null);

    if (error) {
      setMessage({ type: 'err', text: error.message });
      return;
    }

    setMessage({ type: 'ok', text: 'Template approved — it now appears under User created templates.' });
    void load();
  };

  const handleReject = async (id: string) => {
    if (!user) return;
    if (!adminStatus?.canApprove) {
      setMessage({
        type: 'err',
        text:
          adminStatus?.setupHint ??
          'You cannot reject yet. Set is_app_admin = true on your profile in Supabase.',
      });
      return;
    }

    const note = window.prompt('Optional note to submitter:') ?? undefined;
    setActing(id);
    setMessage(null);
    const { error } = await rejectTemplateSubmission(id, user.id, note);
    setActing(null);

    if (error) {
      setMessage({ type: 'err', text: error.message });
      return;
    }

    setMessage({ type: 'ok', text: 'Template rejected.' });
    void load();
  };

  if (loading || !adminStatus?.canSeeQueue) return null;

  if (pending.length === 0 && !adminStatus.setupHint) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8">
      <h2 className="text-lg font-bold text-amber-900 flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5" />
        Template approvals (admin)
      </h2>
      <p className="text-sm text-amber-800 mb-4">
        Review user-submitted templates before they appear under &quot;User created templates&quot;.
      </p>

      {adminStatus.setupHint && (
        <div className="mb-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-100/80 p-3 text-sm text-amber-950">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="font-mono text-xs sm:text-sm break-all">{adminStatus.setupHint}</p>
        </div>
      )}

      {message && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            message.type === 'ok'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
              : 'bg-red-100 text-red-900 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {pending.length === 0 ? (
        <p className="text-sm text-amber-800">No pending templates right now.</p>
      ) : (
        <div className="space-y-3">
          {pending.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-lg border border-amber-100 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{sub.name}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{sub.description}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Submitted {new Date(sub.created_at).toLocaleDateString()}
                  {sub.submitted_by === user?.id ? ' · yours' : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={acting === sub.id || !adminStatus.canApprove}
                  onClick={() => void handleApprove(sub.id)}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={acting === sub.id || !adminStatus.canApprove}
                  onClick={() => void handleReject(sub.id)}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
