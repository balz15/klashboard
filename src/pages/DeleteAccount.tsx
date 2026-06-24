import { useState } from 'react';
import { ArrowLeft, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';

const DELETE_CONFIRM_TEXT = 'DELETE';

export function DeleteAccount() {
  const { user, profile, deleteAccount } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const canDelete =
    user && understood && confirmText.trim().toUpperCase() === DELETE_CONFIRM_TEXT && !loading;

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      await deleteAccount();
      setDone(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not delete account';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate(user ? '/dashboard' : '/')}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-emerald-600 font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            {user ? 'Back to dashboard' : 'Home'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="text-sm text-gray-500 hover:text-emerald-600 transition"
          >
            Privacy
          </button>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Delete your KlashBoard account</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: June 2026</p>

        {done ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
            <p className="font-semibold mb-2">Your account has been deleted.</p>
            <p className="text-sm">
              Your sign-in and personal data have been removed from KlashBoard. You can close this page or return to the
              home screen.
            </p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
            >
              Go to home
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-700 leading-relaxed mb-6">
              KlashBoard lets you delete your account yourself. You do not need to email support for a standard account
              deletion request.
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How to delete your account (app or website)</h2>
            <ol className="list-decimal pl-6 space-y-3 text-gray-700 mb-8">
              <li>
                Sign in at{' '}
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="text-emerald-600 hover:text-emerald-700 underline font-medium"
                >
                  klashboard.com
                </button>{' '}
                (or open the KlashBoard Android app and sign in).
              </li>
              <li>
                Open your <strong>profile menu</strong> (top-right avatar) and choose{' '}
                <strong>Delete account</strong>, or go directly to this page:{' '}
                <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">/delete-account</span>
              </li>
              <li>Read what will be removed, check the confirmation box, type DELETE, and confirm.</li>
              <li>You will be signed out immediately. Deletion is permanent.</li>
            </ol>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What we delete</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
              <li>Your account email, profile name, and login credentials</li>
              <li>Challenges you created, including members, check-ins, streaks, and chat in those challenges</li>
              <li>Your participation, daily logs, chat messages, and reactions in challenges you joined</li>
              <li>Custom challenge icons you uploaded to our storage</li>
              <li>Template submissions tied to your account</li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">What may remain</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
              <li>
                <strong>On your device:</strong> optional reminder settings in local storage (cleared when you delete in
                the app)
              </li>
              <li>
                <strong>Backups / logs:</strong> short-lived server backups or security logs held by our hosting
                provider (Supabase) under their retention policies
              </li>
              <li>
                <strong>Other members&apos; challenges:</strong> challenges you did not create stay with their creators;
                only your personal participation and content are removed
              </li>
            </ul>

            <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Need help?</h2>
            <p className="text-gray-700 leading-relaxed mb-8">
              If you cannot sign in, email{' '}
              <a
                href="mailto:balajee.varradan@gmail.com?subject=KlashBoard%20account%20deletion%20request"
                className="text-emerald-600 hover:text-emerald-700 underline"
              >
                balajee.varradan@gmail.com
              </a>{' '}
              from the address on your account with the subject &ldquo;Account deletion request.&rdquo;
            </p>

            {user ? (
              <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">Delete account now</h2>
                    <p className="text-sm text-gray-700 mt-1">
                      Signed in as <strong>{profile?.email ?? user.email}</strong>. This cannot be undone.
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={understood}
                    onChange={(e) => setUnderstood(e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm text-gray-800">
                    I understand that my account and associated data listed above will be permanently deleted.
                  </span>
                </label>

                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-mono font-bold">{DELETE_CONFIRM_TEXT}</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={DELETE_CONFIRM_TEXT}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="off"
                />

                {error && (
                  <div className="mb-4 p-3 bg-white border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
                )}

                <button
                  type="button"
                  disabled={!canDelete}
                  onClick={() => void handleDelete()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Permanently delete my account
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-gray-700 mb-4">Sign in to delete your account from this page.</p>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition"
                >
                  Sign in
                </button>
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}
