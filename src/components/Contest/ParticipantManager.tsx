import { useState, useEffect } from 'react';
import { Users, Crown, Shield, UserPlus, X, MoreVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type Participant = {
  id: string;
  user_id: string;
  role: 'owner' | 'co_admin' | 'participant';
  current_score: number;
  joined_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
};

type ParticipantManagerProps = {
  contestId: string;
  onClose: () => void;
};

export function ParticipantManager({ contestId, onClose }: ParticipantManagerProps) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'owner' | 'co_admin' | 'participant'>('participant');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'participant' | 'co_admin'>('participant');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadParticipants();
  }, [contestId]);

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('contest_participants')
        .select('*, profiles(email, full_name)')
        .eq('contest_id', contestId)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (error) throw error;

      setParticipants(data || []);

      const currentUser = data?.find((p) => p.user_id === user?.id);
      if (currentUser) {
        setUserRole(currentUser.role as 'owner' | 'co_admin' | 'participant');
      }
    } catch (err: any) {
      console.error('Error loading participants:', err);
    } finally {
      setLoading(false);
    }
  };

  const canManageRole = (targetRole: string) => {
    if (userRole === 'owner') return targetRole !== 'owner';
    if (userRole === 'co_admin') return targetRole === 'participant';
    return false;
  };

  const handlePromoteToCoAdmin = async (participantId: string) => {
    if (userRole !== 'owner') return;

    try {
      const { error } = await supabase
        .from('contest_participants')
        .update({ role: 'co_admin', assigned_by: user?.id })
        .eq('id', participantId);

      if (error) throw error;

      await loadParticipants();
      setMenuOpen(null);
    } catch (err: any) {
      console.error('Error promoting to co-admin:', err);
      setError(err.message);
    }
  };

  const handleDemoteToParticipant = async (participantId: string, targetRole: string) => {
    if (!canManageRole(targetRole)) return;

    try {
      const { error } = await supabase
        .from('contest_participants')
        .update({ role: 'participant' })
        .eq('id', participantId);

      if (error) throw error;

      await loadParticipants();
      setMenuOpen(null);
    } catch (err: any) {
      console.error('Error demoting participant:', err);
      setError(err.message);
    }
  };

  const handleRemoveParticipant = async (participantId: string, targetRole: string) => {
    if (!canManageRole(targetRole)) return;

    if (!confirm('Are you sure you want to remove this participant?')) return;

    try {
      const { error } = await supabase
        .from('contest_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      await loadParticipants();
      setMenuOpen(null);
    } catch (err: any) {
      console.error('Error removing participant:', err);
      setError(err.message);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError('');

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim())
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        setError('No user found with this email address');
        return;
      }

      const { error: insertError } = await supabase
        .from('contest_participants')
        .insert({
          contest_id: contestId,
          user_id: profile.id,
          role: inviteRole,
          assigned_by: user?.id,
        });

      if (insertError) throw insertError;

      setInviteEmail('');
      setInviteRole('participant');
      await loadParticipants();
    } catch (err: any) {
      console.error('Error inviting participant:', err);
      setError(err.message || 'Failed to invite participant');
    } finally {
      setInviting(false);
    }
  };

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="w-4 h-4 text-yellow-600" />;
    if (role === 'co_admin') return <Shield className="w-4 h-4 text-blue-600" />;
    return null;
  };

  const getRoleBadge = (role: string) => {
    if (role === 'owner')
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">Owner</span>;
    if (role === 'co_admin')
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Co-Admin</span>;
    return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded">Participant</span>;
  };

  const isAdmin = userRole === 'owner' || userRole === 'co_admin';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-emerald-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Manage Participants</h2>
              <p className="text-sm text-gray-600">
                {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {isAdmin && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-semibold text-gray-900">Invite Participant</h3>
              </div>

              <div className="flex gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />

                {userRole === 'owner' && (
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'participant' | 'co_admin')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="participant">Participant</option>
                    <option value="co_admin">Co-Admin</option>
                  </select>
                )}

                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full text-white font-semibold">
                      {participant.profiles.full_name?.[0]?.toUpperCase() ||
                        participant.profiles.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {participant.profiles.full_name || participant.profiles.email}
                        </span>
                        {getRoleIcon(participant.role)}
                      </div>
                      <span className="text-sm text-gray-600">{participant.profiles.email}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getRoleBadge(participant.role)}

                    {isAdmin && participant.role !== 'owner' && participant.user_id !== user?.id && (
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === participant.id ? null : participant.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>

                        {menuOpen === participant.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            {userRole === 'owner' && participant.role === 'participant' && (
                              <button
                                onClick={() => handlePromoteToCoAdmin(participant.id)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                              >
                                Promote to Co-Admin
                              </button>
                            )}

                            {canManageRole(participant.role) && participant.role === 'co_admin' && (
                              <button
                                onClick={() => handleDemoteToParticipant(participant.id, participant.role)}
                                className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-700"
                              >
                                Demote to Participant
                              </button>
                            )}

                            {canManageRole(participant.role) && (
                              <button
                                onClick={() => handleRemoveParticipant(participant.id, participant.role)}
                                className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600 border-t border-gray-100"
                              >
                                Remove from Contest
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600 space-y-1">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-600" />
              <span>
                <strong>Owner:</strong> Full control of the contest (cannot be changed)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>
                <strong>Co-Admin:</strong> Can manage participants and settings
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
