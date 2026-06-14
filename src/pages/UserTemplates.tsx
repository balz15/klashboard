import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Search, Users } from 'lucide-react';
import { Navbar } from '../components/Layout/Navbar';
import { ContestWizard } from '../components/ContestWizard/ContestWizard';
import { supabase, ChallengeTemplate } from '../lib/supabase';
import { navigate } from '../lib/router';
import {
  getTemplateCategoryColor,
  filterTemplatesByQuery,
  openDashboardTemplatesTab,
  getIconEmoji,
} from '../lib/challengeTemplates';

export function UserTemplates() {
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ChallengeTemplate | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    void loadUserTemplates();
  }, []);

  const loadUserTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('challenge_templates')
        .select('*')
        .eq('category', 'user_created')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading user templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () => filterTemplatesByQuery(templates, search),
    [templates, search]
  );

  const handleBack = () => {
    openDashboardTemplatesTab();
    navigate('/');
  };

  const handleSelect = (template: ChallengeTemplate) => {
    setSelectedTemplate(template);
    setShowWizard(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-700 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to templates
        </button>

        <div className="mb-8">
          <div className="flex items-start gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User created templates</h1>
              <p className="text-gray-600 text-sm sm:text-base mt-1">
                Community challenges shared by other KlashBoard users. Search by name, description, or metric.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <label htmlFor="user-template-search" className="sr-only">
            Search user templates
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="user-template-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search e.g. steps, meditation, pushups…"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {loading
              ? 'Loading…'
              : search.trim()
                ? `${filtered.length} of ${templates.length} template${templates.length === 1 ? '' : 's'} match`
                : `${templates.length} community template${templates.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-900 font-semibold mb-2">No community templates yet</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              When users submit challenges as templates and they are approved, they will appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-900 font-semibold mb-2">No matches for &quot;{search.trim()}&quot;</p>
            <p className="text-sm text-gray-500">Try different keywords or clear the search box.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelect(template)}
                className="bg-white rounded-xl p-5 shadow-sm border-2 border-violet-200 hover:border-violet-400 hover:shadow-lg transition-all text-left group"
              >
                <div
                  className={`w-12 h-12 bg-gradient-to-br ${getTemplateCategoryColor('user_created')} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-2xl overflow-hidden`}
                >
                  {template.icon_url ? (
                    <img src={template.icon_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getIconEmoji(template.icon) || '⭐'
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wide font-semibold text-violet-600">
                  User created
                </span>
                <h3 className="text-base font-semibold text-gray-900 mb-1 mt-1 line-clamp-2">{template.name}</h3>
                <p className="text-xs text-gray-600 mb-3 line-clamp-3">{template.description}</p>
                <div className="flex items-center text-violet-600 font-medium text-sm">
                  Use template
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showWizard && (
        <ContestWizard
          template={selectedTemplate}
          onClose={() => {
            setShowWizard(false);
            setSelectedTemplate(null);
          }}
          onSuccess={() => {
            setShowWizard(false);
            setSelectedTemplate(null);
            navigate('/');
          }}
        />
      )}
    </div>
  );
}
