import { supabase } from './supabase';

export const MAX_CONTEST_ICON_KB = 200;
export const MAX_CONTEST_ICON_BYTES = MAX_CONTEST_ICON_KB * 1024;

export const TEMPLATE_ICON_MAP: Record<string, string> = {
  target: '🎯',
  footprints: '👣',
  dumbbell: '🏋️',
  brain: '🧠',
  moon: '🌙',
  droplet: '💧',
  'book-open': '📖',
  smartphone: '📱',
  activity: '🏃',
  heart: '❤️',
  flame: '🔥',
  star: '⭐',
  trophy: '🏆',
  zap: '⚡',
  coffee: '☕',
  apple: '🍎',
  bike: '🚴',
  music: '🎵',
  sun: '☀️',
  salad: '🥗',
  pencil: '✏️',
  meditating: '🧘',
};

export const CHALLENGE_ICON_OPTIONS = [
  { id: 'target', label: 'Target' },
  { id: 'footprints', label: 'Steps' },
  { id: 'dumbbell', label: 'Strength' },
  { id: 'activity', label: 'Cardio' },
  { id: 'flame', label: 'Streak' },
  { id: 'brain', label: 'Focus' },
  { id: 'meditating', label: 'Mindful' },
  { id: 'moon', label: 'Sleep' },
  { id: 'droplet', label: 'Hydration' },
  { id: 'book-open', label: 'Reading' },
  { id: 'pencil', label: 'Writing' },
  { id: 'smartphone', label: 'Screen time' },
  { id: 'heart', label: 'Wellness' },
  { id: 'salad', label: 'Nutrition' },
  { id: 'coffee', label: 'Energy' },
  { id: 'apple', label: 'Healthy eating' },
  { id: 'bike', label: 'Cycling' },
  { id: 'music', label: 'Practice' },
  { id: 'sun', label: 'Morning' },
  { id: 'star', label: 'Goals' },
  { id: 'trophy', label: 'Challenge' },
  { id: 'zap', label: 'Power' },
] as const;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export function getIconEmoji(icon?: string | null): string {
  if (!icon || icon === 'custom') return TEMPLATE_ICON_MAP.target;
  return TEMPLATE_ICON_MAP[icon] || TEMPLATE_ICON_MAP.target;
}

export function validateContestIconFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED_MIME.has(file.type)) {
    return { ok: false, error: 'Use JPG, PNG, WebP, or GIF.' };
  }
  if (file.size > MAX_CONTEST_ICON_BYTES) {
    return { ok: false, error: `Image must be ${MAX_CONTEST_ICON_KB} KB or smaller.` };
  }
  return { ok: true };
}

export async function uploadContestIcon(userId: string, file: File): Promise<string> {
  const validation = validateContestIconFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const extFromName = file.name.split('.').pop()?.toLowerCase() || 'png';
  const ext =
    extFromName === 'jpeg' ? 'jpg' : ['jpg', 'png', 'webp', 'gif'].includes(extFromName) ? extFromName : 'png';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from('contest-icons').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from('contest-icons').getPublicUrl(path);
  return data.publicUrl;
}

export type IconPickerValue = {
  icon: string;
  iconUrl: string | null;
  customFile: File | null;
};

export function resolveIconForSave(
  value: IconPickerValue
): { icon: string; iconUrl: string | null; customFile: File | null } {
  if (value.customFile) {
    return { icon: 'custom', iconUrl: value.iconUrl, customFile: value.customFile };
  }
  return { icon: value.icon || 'target', iconUrl: null, customFile: null };
}
