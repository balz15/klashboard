import { getIconEmoji } from '../../lib/contestIcons';

type ChallengeIconProps = {
  icon?: string | null;
  iconUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_CLASS = {
  sm: 'w-9 h-9 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
};

export function ChallengeIcon({ icon, iconUrl, size = 'md', className = '' }: ChallengeIconProps) {
  const sizeClass = SIZE_CLASS[size];

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        className={`${sizeClass} rounded-xl object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl bg-white/20 flex items-center justify-center shrink-0 ${className}`}
      aria-hidden
    >
      {getIconEmoji(icon)}
    </div>
  );
}
