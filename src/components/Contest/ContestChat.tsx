import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Reply, Smile } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getContestCalendarDate, getTodayString } from '../../lib/dateUtils';
import { useAuth } from '../../contexts/AuthContext';

const REACTIONS = ['👍', '❤️', '🔥', '🎉', '💪'];
const QUICK_EMOJIS = ['😀', '😂', '👍', '❤️', '🔥', '💪', '🎯', '✅'];

type ChatMessage = {
  id: string;
  contest_id: string;
  user_id: string;
  body: string;
  reply_to_id: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string } | { full_name: string | null; email: string }[];
};

type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

type ContestChatProps = {
  contestId: string;
  endDate: string;
  contestStatus: string;
  endedAt?: string | null;
};

function displayName(profile: ChatMessage['profiles']): string {
  const p = Array.isArray(profile) ? profile[0] : profile;
  if (!p?.email) return 'Member';
  return p.full_name?.trim() || p.email.split('@')[0];
}

function isChatOpen(endDate: string, contestStatus: string, endedAt?: string | null): boolean {
  const today = getTodayString();
  const graceEnd = getContestCalendarDate(endedAt || endDate);
  const grace = new Date(graceEnd + 'T00:00:00');
  grace.setDate(grace.getDate() + 7);
  const graceStr = `${grace.getFullYear()}-${String(grace.getMonth() + 1).padStart(2, '0')}-${String(grace.getDate()).padStart(2, '0')}`;
  if (contestStatus === 'completed') return today <= graceStr;
  const end = getContestCalendarDate(endDate);
  if (today > end) {
    return today <= graceStr;
  }
  return true;
}

export function ContestChat({ contestId, endDate, contestStatus, endedAt }: ContestChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const chatOpen = isChatOpen(endDate, contestStatus, endedAt);

  useEffect(() => {
    void loadMessages();
    const msgChannel = supabase
      .channel(`chat-${contestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contest_chat_messages',
          filter: `contest_id=eq.${contestId}`,
        },
        () => void loadMessages()
      )
      .subscribe();

    const reactChannel = supabase
      .channel(`chat-react-${contestId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contest_chat_reactions' },
        () => void loadReactions()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(msgChannel);
      void supabase.removeChannel(reactChannel);
    };
  }, [contestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('contest_chat_messages')
      .select('*, profiles(full_name, email)')
      .eq('contest_id', contestId)
      .order('created_at', { ascending: true });
    const rows = (data as ChatMessage[]) || [];
    setMessages(rows);
    setLoading(false);
    if (rows.length > 0) {
      const { data: rx } = await supabase
        .from('contest_chat_reactions')
        .select('*')
        .in(
          'message_id',
          rows.map((m) => m.id)
        );
      setReactions((rx as Reaction[]) || []);
    } else {
      setReactions([]);
    }
  };

  const loadReactions = async () => {
    if (messages.length === 0) return;
    const { data } = await supabase
      .from('contest_chat_reactions')
      .select('*')
      .in(
        'message_id',
        messages.map((m) => m.id)
      );
    setReactions((data as Reaction[]) || []);
  };

  const handleSend = async () => {
    const text = body.trim();
    if (!text || !user || !chatOpen) return;
    setSending(true);
    const { error } = await supabase.from('contest_chat_messages').insert({
      contest_id: contestId,
      user_id: user.id,
      body: text.slice(0, 140),
      reply_to_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (!error) {
      setBody('');
      setReplyTo(null);
      setShowEmoji(false);
    }
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find(
      (r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji
    );
    if (existing) {
      await supabase.from('contest_chat_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('contest_chat_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
    void loadReactions();
  };

  const reactionsFor = (messageId: string) => {
    const grouped = new Map<string, number>();
    reactions
      .filter((r) => r.message_id === messageId)
      .forEach((r) => grouped.set(r.emoji, (grouped.get(r.emoji) || 0) + 1));
    return [...grouped.entries()];
  };

  const parentMessage = (replyId: string | null) =>
    replyId ? messages.find((m) => m.id === replyId) : undefined;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[min(70vh,560px)]">
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          Group chat
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {chatOpen
            ? '140 characters max · Replies & reactions · Closes 7 days after the challenge ends'
            : 'Chat is closed for this challenge (grace period ended).'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">No messages yet. Say hello to the group!</p>
        )}
        {messages.map((msg) => {
          const isSelf = msg.user_id === user?.id;
          const parent = parentMessage(msg.reply_to_id);
          return (
            <div
              key={msg.id}
              className={`max-w-[90%] ${isSelf ? 'ml-auto' : ''}`}
            >
              {parent && (
                <p className="text-[10px] text-gray-500 mb-1 truncate border-l-2 border-emerald-400 pl-2">
                  ↩ {displayName(parent.profiles)}: {parent.body}
                </p>
              )}
              <div
                className={`rounded-2xl px-3 py-2 ${
                  isSelf ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <p className={`text-xs font-semibold mb-0.5 ${isSelf ? 'text-emerald-100' : 'text-gray-500'}`}>
                  {displayName(msg.profiles)}
                </p>
                <p className="text-sm break-words">{msg.body}</p>
                <p className={`text-[10px] mt-1 ${isSelf ? 'text-emerald-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {reactionsFor(msg.id).map(([emoji, count]) => (
                  <span
                    key={emoji}
                    className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5"
                  >
                    {emoji} {count}
                  </span>
                ))}
                {chatOpen && (
                  <>
                    <button
                      type="button"
                      onClick={() => setReplyTo(msg)}
                      className="text-xs text-gray-500 hover:text-emerald-600 px-1"
                    >
                      <Reply className="w-3 h-3 inline" /> Reply
                    </button>
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => void toggleReaction(msg.id, emoji)}
                        className="text-sm hover:scale-110 transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {chatOpen && (
        <div className="p-3 border-t border-gray-200 bg-white">
          {replyTo && (
            <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 rounded-lg px-2 py-1 mb-2">
              <span className="truncate">Replying to: {replyTo.body}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="shrink-0 ml-2 font-medium">
                Cancel
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value.slice(0, 140))}
                placeholder="Message the group…"
                rows={2}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className="absolute right-2 bottom-2 p-1 text-gray-500 hover:text-gray-700"
              >
                <Smile className="w-5 h-5" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full mb-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 flex flex-wrap gap-1 max-w-[220px]">
                  {QUICK_EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      className="text-lg p-1 hover:bg-gray-100 rounded"
                      onClick={() => setBody((b) => (b + e).slice(0, 140))}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={!body.trim() || sending}
              onClick={() => void handleSend()}
              className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 shrink-0"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 text-right mt-1">{body.length}/140</p>
        </div>
      )}
    </div>
  );
}
