import { ArrowLeft } from 'lucide-react';
import { navigate } from '../lib/router';

export function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/about')}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-emerald-600 font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to About
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-emerald-600 transition"
          >
            Home
          </button>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12 prose prose-gray">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">KlashBoard Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

        <p className="text-gray-700 leading-relaxed mb-6">
          KlashBoard (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;the app&rdquo;) helps small groups track shared habit
          challenges. This policy explains what information we collect, how we use it, and your choices.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Information we collect</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>
            <strong>Account information</strong> — email address and profile details you provide when you sign up.
          </li>
          <li>
            <strong>Challenge data</strong> — challenge names, daily check-ins, metrics, streaks, and progress you submit.
          </li>
          <li>
            <strong>Social features</strong> — group chat messages and reactions within challenges you join.
          </li>
          <li>
            <strong>Device information</strong> — basic technical data needed to run the app (e.g. device type, app
            version) and notification preferences stored on your device.
          </li>
        </ul>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">How we use information</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>Provide and operate the KlashBoard service</li>
          <li>Display progress and leaderboards to members of your challenges</li>
          <li>Send optional local reminders you enable on your device</li>
          <li>Improve reliability and fix bugs</li>
          <li>Respond to support requests</li>
        </ul>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Sharing</h2>
        <p className="text-gray-700 leading-relaxed">
          Your challenge activity is visible to other participants in the same challenge. We do not sell your personal
          information. We use{' '}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 underline"
          >
            Supabase
          </a>{' '}
          to host authentication and data storage under industry-standard security practices.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Data retention</h2>
        <p className="text-gray-700 leading-relaxed">
          We retain account and challenge data while your account is active. You may request deletion of your account and
          associated data by contacting us at the email listed below or via our Google Play store listing.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Security</h2>
        <p className="text-gray-700 leading-relaxed">
          Data is transmitted over encrypted connections (HTTPS). Access to production systems is restricted. No method of
          transmission or storage is 100% secure; we work to protect your information using reasonable measures.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Children</h2>
        <p className="text-gray-700 leading-relaxed">
          KlashBoard is not directed at children under 13. We do not knowingly collect personal information from children
          under 13.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Your choices</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>You can turn off notifications and reminders in the app settings.</li>
          <li>You can leave challenges or delete your account by contacting support.</li>
        </ul>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Changes</h2>
        <p className="text-gray-700 leading-relaxed">
          We may update this policy from time to time. We will post the revised policy on this page and update the
          &ldquo;Last updated&rdquo; date.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3">Contact</h2>
        <p className="text-gray-700 leading-relaxed">
          Email:{' '}
          <a href="mailto:balajee.varradan@gmail.com" className="text-emerald-600 hover:text-emerald-700 underline">
            balajee.varradan@gmail.com
          </a>
          <br />
          Website:{' '}
          <a href="https://www.klashboard.com" className="text-emerald-600 hover:text-emerald-700 underline">
            https://www.klashboard.com
          </a>
        </p>
      </article>
    </div>
  );
}
