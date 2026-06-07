import { supabase } from './supabase';

export async function sendContestPoke(contestId: string, toUserId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === toUserId) {
    return { error: new Error('Invalid poke') };
  }
  const { error } = await supabase.from('contest_pokes').insert({
    contest_id: contestId,
    from_user_id: user.id,
    to_user_id: toUserId,
  });
  return { error: error ?? null };
}
