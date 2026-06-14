import type { ChallengeTemplate } from './supabase';

export { TEMPLATE_ICON_MAP, getIconEmoji } from './contestIcons';

export function getTemplateCategoryColor(category: string): string {
  switch (category) {
    case 'fitness':
      return 'from-green-500 to-emerald-600';
    case 'health':
      return 'from-blue-500 to-cyan-600';
    case 'productivity':
      return 'from-orange-500 to-amber-600';
    case 'mindfulness':
      return 'from-pink-500 to-rose-600';
    case 'user_created':
      return 'from-violet-500 to-purple-600';
    default:
      return 'from-gray-400 to-gray-600';
  }
}

export function isSystemTemplate(template: ChallengeTemplate): boolean {
  return template.category !== 'custom' && template.category !== 'user_created';
}

export function isUserCreatedTemplate(template: ChallengeTemplate): boolean {
  return template.category === 'user_created';
}

export function filterTemplatesByQuery(templates: ChallengeTemplate[], query: string): ChallengeTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return templates;

  return templates.filter((template) => {
    const metricText = (template.default_metrics || [])
      .map((m) => `${m.name} ${m.unit}`)
      .join(' ')
      .toLowerCase();
    const haystack = `${template.name} ${template.description} ${template.category} ${metricText}`.toLowerCase();
    return q.split(/\s+/).every((word) => haystack.includes(word));
  });
}

export function openDashboardTemplatesTab(): void {
  sessionStorage.setItem('dashboardTab', 'templates');
}
