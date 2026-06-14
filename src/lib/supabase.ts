import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as any);

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  is_app_admin?: boolean;
  created_at: string;
};

export type Contest = {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  visibility: 'public' | 'private';
  status: 'draft' | 'active' | 'completed' | 'pending_approval';
  metrics: any[];
  scoring_rules: Record<string, any>;
  invite_code?: string;
  is_closed_for_joining?: boolean;
  ended_at?: string;
  auto_delete_at?: string;
  group_streak_count?: number;
  last_group_streak_date?: string;
  icon?: string;
  icon_url?: string | null;
  created_at: string;
};

export type ContestParticipant = {
  id: string;
  contest_id: string;
  user_id: string;
  role: 'admin' | 'participant';
  joined_at: string;
};

export type Submission = {
  id: string;
  contest_id: string;
  participant_id: string;
  submission_date: string;
  metric_values: Record<string, number>;
  notes?: string;
  streak_count: number;
  created_at: string;
};

export type ChallengeTemplate = {
  id: string;
  name: string;
  description: string;
  category: 'fitness' | 'health' | 'productivity' | 'mindfulness' | 'custom' | 'user_created';
  default_metrics: Array<{ name: string; unit: string }>;
  suggested_duration_days: number;
  icon: string;
  icon_url?: string | null;
  created_at: string;
};
