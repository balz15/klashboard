import { supabase } from './supabase';

export async function sendContestPoke(
  contestId: string,
  toUserId: string,
  message?: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === toUserId) {
    return { error: new Error('Invalid poke') };
  }
  const trimmed = message?.trim().slice(0, 140) || null;
  const { error } = await supabase.from('contest_pokes').insert({
    contest_id: contestId,
    from_user_id: user.id,
    to_user_id: toUserId,
    message: trimmed,
  });
  return { error: error ?? null };
}
