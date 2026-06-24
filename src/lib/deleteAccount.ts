import { supabase } from './supabase';

async function removeUserContestIcons(userId: string): Promise<void> {
  try {
    const { data: files, error } = await supabase.storage.from('contest-icons').list(userId);
    if (error || !files?.length) return;
    const paths = files.map((f: { name: string }) => `${userId}/${f.name}`);
    await supabase.storage.from('contest-icons').remove(paths);
  } catch {
    /* best-effort */
  }
}

/** Permanently deletes the signed-in user's account and server-side data. */
export async function deleteOwnAccount(): Promise<void> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in to delete your account.');

  await removeUserContestIcons(user.id);

  try {
    localStorage.removeItem('clashboard_daily_reminder_v2');
  } catch {
    /* ignore */
  }

  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    if (error.message?.includes('delete_own_account') || error.code === 'PGRST202') {
      throw new Error(
        'Account deletion is not enabled on the server yet. Ask the app owner to run supabase/repair_delete_own_account.sql in Supabase.'
      );
    }
    throw error;
  }

  await supabase.auth.signOut({ scope: 'local' });
}
