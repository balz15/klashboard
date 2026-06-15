import { Users, Target, Flame, Trophy, ArrowLeft } from 'lucide-react';
import { navigate } from '../lib/router';

export function About() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-emerald-600 font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <button
            type="button"
            onClick={() => navigate('/privacy')}
            className="text-sm font-medium text-gray-600 hover:text-emerald-600 transition shrink-0"
          >
            Privacy Policy
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Your Goals Don't Have to Be Lonely Anymore
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Stop letting motivation slip. Start challenges with friends who won't let you quit.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg"
          >
            Start Your First Challenge
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            Why We Built This
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            <strong>We've all been there.</strong> You set a goal. Week 1? Crushing it. Week 2? Still going. Week 3? ...what goal?
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            Goals fail when they're invisible and boring. You skip one day, then two, then you forget why you even started. No one notices. No one cares. So why keep going?
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-4">
            <strong>Here's what we learned:</strong> You don't need more willpower. You need people who give a damn if you show up.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed">
            Klashboard turns goals into group challenges where everyone's progress is visible, everyone's counting on you, and quitting means letting down people you actually care about. That changes everything.
          </p>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            From "I Should..." to "We Did It"
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-emerald-50 rounded-xl p-6 border-2 border-emerald-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <h3 className="text-xl font-bold text-gray-900">Create a Challenge</h3>
              </div>
              <p className="text-gray-700">
                Pick something you actually want to do but keep flaking on. Working out? Reading? Coding? Takes 30 seconds to set up.
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  2
                </div>
                <h3 className="text-xl font-bold text-gray-900">Drag Your Friends In</h3>
              </div>
              <p className="text-gray-700">
                Share your invite code. They join. Now you're in this together. No backing out.
              </p>
            </div>

            <div className="bg-orange-50 rounded-xl p-6 border-2 border-orange-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                  3
                </div>
                <h3 className="text-xl font-bold text-gray-900">Check In Daily</h3>
              </div>
              <p className="text-gray-700">
                Log your progress every day. Takes 10 seconds. Everyone can see if you showed up or skipped.
              </p>
            </div>

            <div className="bg-teal-50 rounded-xl p-6 border-2 border-teal-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                  4
                </div>
                <h3 className="text-xl font-bold text-gray-900">Watch the Streak Grow</h3>
              </div>
              <p className="text-gray-700">
                Your group builds a streak together. Day 5 becomes day 10 becomes day 30. Suddenly, you've built a habit.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl shadow-lg border-2 border-red-300 p-8 mb-12">
          <div className="flex items-start gap-4 mb-4">
            <Flame className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                The Group Streak Rule
              </h3>
              <p className="text-lg text-gray-800 leading-relaxed mb-3">
                Here's what makes Klashboard different: <strong>The entire group shares one streak. If anyone misses more than 2 consecutive days, the group streak resets to zero.</strong>
              </p>
              <p className="text-lg text-gray-800 leading-relaxed mb-3">
                Every day all members submit, the group streak increases by 1. But if someone drops the ball for 3+ days, everyone starts from scratch.
              </p>
              <p className="text-lg text-gray-800 leading-relaxed">
                This isn't about punishment—it's about mutual commitment. When you know your friends are counting on you to protect the group streak, you show up. That's the power of collective accountability.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Why Klashboard Beats Every Other Habit Tracker
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flame className="w-8 h-8 text-red-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Your streak affects theirs</h4>
              <p className="text-gray-600">
                Most apps track YOUR progress. We track THE GROUP. Miss 3 days? Everyone's streak resets. Suddenly, you care.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-emerald-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Everyone sees everything</h4>
              <p className="text-gray-600">
                No hiding. No excuses. Your friends know if you checked in today. Public accountability is the cheat code.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Built for groups, not soloists</h4>
              <p className="text-gray-600">
                Other apps gamify YOU. We gamify US. The leaderboard isn't toxic competition—it's your crew leveling up together.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl shadow-lg border border-blue-200 p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            What People Are Saying
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-800 mb-4 italic">
                "Hit a 21-day streak with my roommates. I've never stuck with working out this long. The group pressure is real."
              </p>
              <p className="text-sm font-bold text-gray-900">— Maya, college student</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-800 mb-4 italic">
                "Started a reading challenge with 4 friends. Two weeks in and I've read more than I did all last year. The streak gets addictive."
              </p>
              <p className="text-sm font-bold text-gray-900">— Jordan, software engineer</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <p className="text-gray-800 mb-4 italic">
                "Our group chat is just us roasting whoever forgets to check in. It's annoying but it works. Day 45 and counting."
              </p>
              <p className="text-sm font-bold text-gray-900">— Alex, designer</p>
            </div>
          </div>

          <div className="text-center mt-8">
            <p className="text-2xl font-bold text-gray-900 mb-2">500+ challenges started</p>
            <p className="text-gray-600">Join the community of people who actually follow through</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl shadow-lg border border-emerald-200 p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            The Science (Sort Of)
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <Users className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">You're 95% more likely to follow through</h4>
                <p className="text-gray-700">
                  When you commit to someone else instead of just yourself. That's not us—that's research. We just made it fun.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Target className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Showing up beats trying hard</h4>
                <p className="text-gray-700">
                  Daily consistency matters more than intensity. Do 5 pushups every day for 30 days? You just built a real habit.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Flame className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Streaks are addictive</h4>
                <p className="text-gray-700">
                  Hit day 10? No one wants to be the person who breaks it. That pressure? That's the feature, not a bug.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Trophy className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">Competition makes it fun</h4>
                <p className="text-gray-700">
                  Seeing your friends win makes you want to keep up. The leaderboard isn't about beating them—it's about all of you winning together.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
            Who Built This?
          </h2>
          <p className="text-lg text-gray-700 leading-relaxed mb-4 max-w-2xl mx-auto">
            Klashboard started because we kept failing at our own goals. New Year's resolutions that lasted 3 weeks. Gym memberships we forgot about. Books we never finished.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed mb-4 max-w-2xl mx-auto">
            We realized the problem wasn't motivation—it was isolation. Goals are lonely. So we built something that makes them social.
          </p>
          <p className="text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto">
            Now we're a small team that believes accountability shouldn't feel like a chore. It should feel like your friends cheering you on (and also roasting you when you skip leg day).
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl shadow-xl p-12 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Start a Challenge. Drag Your Friends In.
          </h2>
          <p className="text-xl text-emerald-50 mb-8 max-w-2xl mx-auto">
            Pick something you keep flaking on. Invite your squad. See who lasts 30 days.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-block bg-white text-emerald-600 hover:bg-emerald-50 font-bold px-8 py-4 rounded-xl text-lg transition-all transform hover:scale-105 shadow-lg mb-4"
          >
            Create Your First Challenge
          </button>
          <p className="text-emerald-100 text-sm mt-4">
            Free. No credit card. Just you and your crew.
          </p>
        </div>
      </div>
    </div>
  );
}
