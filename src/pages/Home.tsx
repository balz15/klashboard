import { Users, Flame, Calendar, TrendingUp, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { navigate } from '../lib/router';

export function Home() {
  const { user } = useAuth();

  if (user) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-500" />
            <span className="text-xl font-bold text-gray-900">Klashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/about')}
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              How it works
            </button>
            <button
              onClick={() => navigate('/auth')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-full text-orange-700 text-sm font-medium mb-6">
          <Flame className="w-4 h-4" />
          For small groups who want real accountability
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Daily habits.<br />
          Group pressure.<br />
          Actual results.
        </h1>

        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Turn personal goals into shared challenges with 2-5 friends. Simple daily check-ins. Visible progress. Real accountability when someone slips.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <button
            onClick={() => navigate('/auth')}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-lg transition shadow-lg hover:shadow-xl inline-flex items-center gap-2"
          >
            Start a Challenge
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/about')}
            className="px-8 py-4 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-bold rounded-xl text-lg transition"
          >
            See how it works
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-left">
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">2-5</div>
            <div className="text-sm text-gray-600">People per group</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">&lt;30s</div>
            <div className="text-sm text-gray-600">Daily check-in</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">7-30</div>
            <div className="text-sm text-gray-600">Day challenges</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 mb-1">100%</div>
            <div className="text-sm text-gray-600">Visible to group</div>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Not another habit tracker
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              This is for people who need real accountability, not gamification.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Who this is for
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">Small private groups</div>
                    <div className="text-gray-600">You and 1-4 accountability partners</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">Finite challenges</div>
                    <div className="text-gray-600">7-day, 14-day, or 30-day commitments</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">One goal at a time</div>
                    <div className="text-gray-600">Focus on what matters most right now</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-gray-900">Need social pressure</div>
                    <div className="text-gray-600">You show up because others are watching</div>
                  </div>
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              <h4 className="text-xl font-bold text-gray-900 mb-6">How it works</h4>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-bold">1</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Create a challenge</div>
                    <div className="text-sm text-gray-600">Pick a habit. Set duration. Choose yes/no or a number to track.</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-blue-700 font-bold">2</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Invite your group</div>
                    <div className="text-sm text-gray-600">Share a private link. Everyone commits to the same goal.</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-700 font-bold">3</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Check in daily</div>
                    <div className="text-sm text-gray-600">Log your progress in under 30 seconds. Every day.</div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-red-700 font-bold">4</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 mb-1">Stay accountable</div>
                    <div className="text-sm text-gray-600">See everyone's progress. Group streak resets if anyone misses 3+ days.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Simple by design
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Flame className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Group Streak</h3>
              <p className="text-gray-600">
                One shared streak. If anyone misses 3+ days, everyone resets. That's the pressure that works.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Fast Check-ins</h3>
              <p className="text-gray-600">
                Click a date. Enter yes/no or a number. Done. No friction, no excuses.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Full Visibility</h3>
              <p className="text-gray-600">
                Everyone sees who's on track and who's falling behind. Transparency creates accountability.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Personal Stats</h3>
              <p className="text-gray-600">
                Track your individual streak alongside the group. See your consistency over time.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Finite Duration</h3>
              <p className="text-gray-600">
                Set an end date. Build momentum. Finish together. Then start a new challenge.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-gray-700" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">One Metric</h3>
              <p className="text-gray-600">
                Track one thing. Yes/no completion or a daily number. Simple focus, better results.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-emerald-50 to-teal-50 py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center border border-emerald-200">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Why this works
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              You're 95% more likely to complete a goal when you commit to someone else. Klashboard makes that commitment visible to your entire group.
            </p>

            <div className="grid md:grid-cols-3 gap-8 mb-10 text-left">
              <div>
                <h4 className="font-bold text-gray-900 mb-2">Social pressure</h4>
                <p className="text-sm text-gray-600">
                  When you know your friends are watching, you show up. Period.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-2">Daily consistency</h4>
                <p className="text-sm text-gray-600">
                  Small actions compound. Showing up matters more than intensity.
                </p>
              </div>
              <div>
                <h4 className="font-bold text-gray-900 mb-2">Shared stakes</h4>
                <p className="text-sm text-gray-600">
                  The group streak means everyone wins together or resets together.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-lg transition shadow-lg inline-flex items-center gap-2"
            >
              Start Your First Challenge
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple pricing
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Start free. Pay when you're committed.
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="bg-gray-50 rounded-2xl p-8 border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free Trial</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">$0</div>
              <p className="text-gray-600 mb-6">Try your first challenge completely free</p>
              <ul className="space-y-3 text-left mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">Up to 5 participants</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">7-day challenge duration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">All core features</span>
                </li>
              </ul>
              <button
                onClick={() => navigate('/auth')}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition"
              >
                Start Free
              </button>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-8 border-2 border-emerald-600 text-white relative">
              <div className="absolute -top-3 right-8 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                COMING SOON
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-4">$5<span className="text-lg">/mo</span></div>
              <p className="text-emerald-50 mb-6">Per person, when you're ready for more</p>
              <ul className="space-y-3 text-left mb-8">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Unlimited challenges</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Up to 30-day challenges</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Advanced analytics</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0 mt-0.5" />
                  <span>Priority support</span>
                </li>
              </ul>
              <button
                disabled
                className="w-full py-3 bg-white/20 text-white font-semibold rounded-lg cursor-not-allowed"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" />
              <span className="text-xl font-bold">Klashboard</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-400">
              <button onClick={() => navigate('/about')} className="hover:text-white transition">
                About
              </button>
              <button onClick={() => navigate('/auth')} className="hover:text-white transition">
                Login
              </button>
            </div>
          </div>
          <div className="text-center text-sm text-gray-500 mt-8">
            Made for people who show up.
          </div>
        </div>
      </footer>
    </div>
  );
}
