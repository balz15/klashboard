import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import {
  CHALLENGE_ICON_OPTIONS,
  MAX_CONTEST_ICON_KB,
  getIconEmoji,
  validateContestIconFile,
  type IconPickerValue,
} from '../../lib/contestIcons';

type ChallengeIconPickerProps = {
  value: IconPickerValue;
  onChange: (value: IconPickerValue) => void;
  disabled?: boolean;
};

export function ChallengeIconPicker({ value, onChange, disabled }: ChallengeIconPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectPreset = (iconId: string) => {
    if (value.iconUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(value.iconUrl);
    }
    onChange({ icon: iconId, iconUrl: null, customFile: null });
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    const validation = validateContestIconFile(file);
    if (!validation.ok) {
      alert(validation.error);
      return;
    }
    if (value.iconUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(value.iconUrl);
    }
    onChange({
      icon: 'custom',
      iconUrl: URL.createObjectURL(file),
      customFile: file,
    });
  };

  const clearCustom = () => {
    if (value.iconUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(value.iconUrl);
    }
    onChange({ icon: 'target', iconUrl: null, customFile: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewUrl = value.customFile ? value.iconUrl : null;
  const activePreset = value.customFile ? null : value.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {previewUrl ? (
          <img src={previewUrl} alt="Custom icon preview" className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-400" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-3xl">
            {getIconEmoji(activePreset)}
          </div>
        )}
        <div className="text-sm text-gray-600">
          <p className="font-medium text-gray-900">Challenge icon</p>
          <p>Pick an emoji icon or upload your own (max {MAX_CONTEST_ICON_KB} KB).</p>
        </div>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
        {CHALLENGE_ICON_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            title={option.label}
            onClick={() => selectPreset(option.id)}
            className={`aspect-square rounded-xl border-2 text-xl flex items-center justify-center transition ${
              activePreset === option.id
                ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                : 'border-gray-200 bg-white hover:border-emerald-300'
            } disabled:opacity-50`}
          >
            {getIconEmoji(option.id)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <ImagePlus className="w-4 h-4" />
          Upload custom image
        </button>
        {value.customFile && (
          <button
            type="button"
            disabled={disabled}
            onClick={clearCustom}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Remove upload
          </button>
        )}
      </div>
    </div>
  );
}
