import { supabase } from './supabase';
import { notifyGroupEvent } from './engagementReminders';

let channel: ReturnType<typeof supabase.channel> | null = null;

export function initRealtimeNotifications(userId: string, contestIds: string[]): () => void {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }

  if (!userId || contestIds.length === 0) return () => undefined;

  channel = supabase
    .channel(`user-events-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'contest_pokes',
        filter: `to_user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as {
          from_user_id: string;
          message?: string | null;
          contest_id: string;
        };
        void (async () => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', row.from_user_id)
            .maybeSingle();
          const name = profile?.full_name || profile?.email?.split('@')[0] || 'Someone';
          const body =
            row.message?.trim() ||
            'Nudged you to log your progress — open the challenge and check in!';
          await notifyGroupEvent(`${name} nudged you`, body);
        })();
      }
    )
    .subscribe();

  const chatChannel = supabase
    .channel(`user-chat-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'contest_chat_messages' },
      (payload) => {
        const row = payload.new as { user_id: string; contest_id: string; body: string };
        if (row.user_id === userId) return;
        if (!contestIds.includes(row.contest_id)) return;
        void (async () => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', row.user_id)
            .maybeSingle();
          const name = profile?.full_name || profile?.email?.split('@')[0] || 'Member';
          await notifyGroupEvent(`New group message`, `${name}: ${row.body.slice(0, 80)}`);
        })();
      }
    )
    .subscribe();

  return () => {
    if (channel) void supabase.removeChannel(channel);
    void supabase.removeChannel(chatChannel);
    channel = null;
  };
}
