"use client";
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Sparkles, CheckCircle2, Loader2, AlertTriangle, HelpCircle, Languages, ChevronDown, ChevronRight, ArrowRight, SkipForward } from 'lucide-react';
import { AiProgressOverlay, type AiProgressStep } from '@/components/ui/AiProgressOverlay';
import { cn } from '@/lib/utils';

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'auto', label: 'Auto (AI decides based on content)' },
  { value: 'mixed', label: 'Mixed (30% Easy / 50% Medium / 20% Hard)' },
  { value: 'easy', label: 'Easy Only' },
  { value: 'medium', label: 'Medium Only' },
  { value: 'hard', label: 'Hard Only' },
];

interface Subject { id: number; slug: string; is_active: boolean; english_name?: string }
interface Chapter { id: number; slug: string; subject_id: number; is_active: boolean; english_name?: string; display_order?: number }
interface Topic { id: number; slug: string; chapter_id: number; is_active: boolean; english_name?: string; display_order?: number }
interface SubTopic { id: number; slug: string; topic_id: number; is_active: boolean; english_name?: string; display_order?: number }
interface MaterialLang { id: number; name: string; iso_code: string }

interface OrderingItem {
  id: number;
  item_text: string;
  correct_position: number;
}

interface GeneratedQuestion {
  ordering_question_id: number;
  code: string;
  slug: string;
  difficulty_level: string;
  points: number;
  partial_scoring: boolean;
  question_text: string;
  hint: string;
  explanation: string;
  items: OrderingItem[];
  translations_created: string[];
}

export default function AutoOrderingGenerationPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in p-8 text-center text-slate-400">Loading...</div>}>
      <AutoOrderingGenerationContent />
    </Suspense>
  );
}

function AutoOrderingGenerationContent() {
  const router = useRouter();
  const pageSize = usePageSize();

  // Cascade dropdowns
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subTopics, setSubTopics] = useState<SubTopic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedSubTopic, setSelectedSubTopic] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Material languages (dynamic)
  const [materialLangs, setMaterialLangs] = useState<MaterialLang[]>([]);

  // Per-topic ordering counts (to show badges)
  const [topicOrderingCounts, setTopicOrderingCounts] = useState<Record<number, number>>({});

  // Config
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [numQuestions, setNumQuestions] = useState(0); // 0 = auto
  const [difficultyMix, setDifficultyMix] = useState('auto');
  const [autoTranslate, setAutoTranslate] = useState(true);

  // State
  const [generating, setGenerating] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [results, setResults] = useState<GeneratedQuestion[]>([]);
  const [resultSummary, setResultSummary] = useState<any>(null);
  const [translateResults, setTranslateResults] = useState<any>(null);
  const [expandedQ, setExpandedQ] = useState<Set<number>>(new Set());

  // Progress overlay
  const [progressSteps, setProgressSteps] = useState<AiProgressStep[]>([]);
  const [showProgress, setShowProgress] = useState(false);

  useKeyboardShortcuts([
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g m', action: () => router.push('/ordering-questions') },
  ]);

  // Current topic/chapter position for navigation
  const currentTopicIndex = useMemo(() => topics.findIndex(t => String(t.id) === selectedTopic), [topics, selectedTopic]);
  const currentChapterIndex = useMemo(() => chapters.findIndex(c => String(c.id) === selectedChapter), [chapters, selectedChapter]);
  const hasNextTopic = currentTopicIndex >= 0 && currentTopicIndex < topics.length - 1;
  const hasNextChapter = currentChapterIndex >= 0 && currentChapterIndex < chapters.length - 1;
  const isLastTopicInChapter = currentTopicIndex >= 0 && currentTopicIndex === topics.length - 1;

  // Load subjects + languages on mount
  useEffect(() => {
    api.listSubjects('?limit=500&is_active=true').then(res => {
      if (res.success) setSubjects(res.data || []);
      setInitialized(true);
    });
    // Load for_material languages (non-English)
    api.listLanguages('?for_material=true&limit=100').then(res => {
      if (res.success) {
        const nonEnglish = (res.data || []).filter((l: any) => l.id !== 7 && l.is_active);
        setMaterialLangs(nonEnglish);
      }
    });
  }, []);

  // Cascade: subject -> chapters
  useEffect(() => {
    if (!initialized) return;
    setSelectedChapter(''); setSelectedTopic(''); setSelectedSubTopic('');
    setChapters([]); setTopics([]); setSubTopics([]);
    setTopicOrderingCounts({});
    if (selectedSubject) {
      api.listChapters(`?limit=500&is_active=true&subject_id=${selectedSubject}&sort=display_order&ascending=true`).then(res => {
        if (res.success) setChapters(res.data || []);
      });
    }
  }, [selectedSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cascade: chapter -> topics + load ordering counts
  useEffect(() => {
    if (!initialized) return;
    setSelectedTopic(''); setSelectedSubTopic('');
    setTopics([]); setSubTopics([]);
    setTopicOrderingCounts({});
    if (selectedChapter) {
      api.listTopics(`?limit=500&is_active=true&chapter_id=${selectedChapter}&sort=display_order&ascending=true`).then(async (res) => {
        if (res.success) {
          const topicList = res.data || [];
          setTopics(topicList);

          // Load ordering counts per topic for badges
          const counts: Record<number, number> = {};
          for (const t of topicList) {
            const orderRes = await api.listOrderingQuestions(`?topic_id=${t.id}&limit=1`);
            if (orderRes.success) counts[t.id] = orderRes.pagination?.total || 0;
          }
          setTopicOrderingCounts(counts);
        }
      });
    }
  }, [selectedChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cascade: topic -> sub-topics
  useEffect(() => {
    if (!initialized) return;
    setSelectedSubTopic('');
    setSubTopics([]);
    if (selectedTopic) {
      api.listSubTopics(`?limit=500&is_active=true&topic_id=${selectedTopic}&sort=display_order&ascending=true`).then(res => {
        if (res.success) setSubTopics(res.data || []);
      });
    }
  }, [selectedTopic]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset results when topic changes
  useEffect(() => {
    setResults([]);
    setResultSummary(null);
    setTranslateResults(null);
    setErrorMsg('');
    setExpandedQ(new Set());
  }, [selectedTopic]);

  function toggleExpanded(qId: number) {
    setExpandedQ(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId); else next.add(qId);
      return next;
    });
  }

  // Navigate to next topic
  function goNextTopic() {
    if (hasNextTopic) {
      const nextTopic = topics[currentTopicIndex + 1];
      setSelectedTopic(String(nextTopic.id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Navigate to next chapter's first topic
  async function goNextChapter() {
    if (!hasNextChapter) return;
    const nextChapter = chapters[currentChapterIndex + 1];
    setSelectedChapter(String(nextChapter.id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Auto-select first topic when chapter changes and topics load (after "Next Chapter")
  useEffect(() => {
    if (topics.length > 0 && !selectedTopic && selectedChapter) {
      setSelectedTopic(String(topics[0].id));
    }
  }, [topics]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    if (!selectedTopic) { toast.error('Please select a topic first'); return; }

    setGenerating(true);
    setErrorMsg('');
    setResults([]);
    setResultSummary(null);
    setTranslateResults(null);

    const langNames = materialLangs.map(l => l.name).join(', ');
    const steps: AiProgressStep[] = [
      { label: 'Finding sub-topic tutorial files', status: 'active' },
      { label: 'Generating Ordering questions with AI', status: 'pending' },
      { label: 'Saving questions, items & translations', status: 'pending' },
    ];
    if (autoTranslate && materialLangs.length > 0) {
      steps.push({ label: `Translating to ${langNames}`, status: 'pending' });
    }
    setProgressSteps(steps);
    setShowProgress(true);

    try {
      setTimeout(() => {
        setProgressSteps(prev => prev.map((s, i) =>
          i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'active' } : s
        ));
      }, 2000);

      setTimeout(() => {
        setProgressSteps(prev => prev.map((s, i) =>
          i <= 1 ? { ...s, status: 'done' } : i === 2 ? { ...s, status: 'active' } : s
        ));
      }, 6000);

      const topicId = parseInt(selectedTopic);
      const requestBody: any = {
        topic_id: topicId,
        num_questions: numQuestions, // 0 = auto
        difficulty_mix: difficultyMix,
        provider: aiProvider,
        auto_translate: autoTranslate && materialLangs.length > 0,
      };
      if (selectedSubTopic) {
        requestBody.sub_topic_id = parseInt(selectedSubTopic);
      }

      const res = await api.autoGenerateOrdering(requestBody);

      if (res.success) {
        const data = res.data;
        setResults(data.questions || []);
        setResultSummary(data.summary || null);

        // Mark all done
        setProgressSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })));
        setTimeout(() => setShowProgress(false), 1500);

        const qCount = data.questions?.length || 0;
        toast.success(`Generated ${qCount} Ordering question${qCount !== 1 ? 's' : ''} successfully!`);

        // Update ordering count for this topic
        setTopicOrderingCounts(prev => ({
          ...prev,
          [topicId]: (prev[topicId] || 0) + qCount,
        }));
      } else {
        throw new Error(res.error || 'Generation failed');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'An error occurred during generation');
      setProgressSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const } : s));
      setTimeout(() => setShowProgress(false), 2000);
      toast.error(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleTranslateExisting() {
    if (!selectedTopic) { toast.error('Please select a topic first'); return; }

    setTranslating(true);
    setTranslateResults(null);

    try {
      const res = await api.autoTranslateOrdering({
        topic_id: parseInt(selectedTopic),
        provider: aiProvider,
      });

      if (res.success) {
        setTranslateResults(res.data?.summary || res.data);
        const count = res.data?.summary?.translations_created || res.data?.translated_count || 0;
        toast.success(`Translation complete! ${count} translations created.`);
      } else {
        throw new Error(res.error || 'Translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }

  const selectedTopicName = topics.find(t => String(t.id) === selectedTopic)?.english_name || '';
  const selectedChapterName = chapters.find(c => String(c.id) === selectedChapter)?.english_name || '';

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Auto Ordering Generation" description="Generate Ordering questions automatically from sub-topic tutorials using AI" />

      {showProgress && <AiProgressOverlay active={generating} steps={progressSteps} title="Generating Ordering Questions..." />}

      {/* Configuration Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Configuration
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Cascade Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
              >
                <option value="">Select subject...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.english_name || s.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Chapter *
                {chapters.length > 0 && selectedChapter && (
                  <span className="text-xs text-slate-400 ml-2">
                    ({currentChapterIndex + 1} of {chapters.length})
                  </span>
                )}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                value={selectedChapter}
                onChange={e => setSelectedChapter(e.target.value)}
                disabled={!selectedSubject}
              >
                <option value="">{selectedSubject ? 'Select chapter...' : 'Select subject first'}</option>
                {chapters.map((c, ci) => (
                  <option key={c.id} value={c.id}>{ci + 1}. {c.english_name || c.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Topic *
                {topics.length > 0 && selectedTopic && (
                  <span className="text-xs text-slate-400 ml-2">
                    ({currentTopicIndex + 1} of {topics.length})
                  </span>
                )}
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                disabled={!selectedChapter}
              >
                <option value="">{selectedChapter ? 'Select topic...' : 'Select chapter first'}</option>
                {topics.map((t, ti) => (
                  <option key={t.id} value={t.id}>
                    {ti + 1}. {t.english_name || t.slug}
                    {topicOrderingCounts[t.id] ? ` (${topicOrderingCounts[t.id]} ordering)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub-topic selector (optional) */}
          {subTopics.length > 0 && (
            <div className="max-w-md">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sub-topic <span className="text-xs text-slate-400">(optional - generate for specific sub-topic only)</span>
              </label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                value={selectedSubTopic}
                onChange={e => setSelectedSubTopic(e.target.value)}
              >
                <option value="">All sub-topics</option>
                {subTopics.map((st, sti) => (
                  <option key={st.id} value={st.id}>{sti + 1}. {st.english_name || st.slug}</option>
                ))}
              </select>
            </div>
          )}

          {/* Generation Config */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                value={aiProvider}
                onChange={e => setAiProvider(e.target.value as AIProvider)}
              >
                {AI_PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label} — {p.model}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of Questions</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                value={numQuestions}
                onChange={e => setNumQuestions(parseInt(e.target.value) || 0)}
              >
                <option value={0}>Auto (AI decides based on content)</option>
                <option value={5}>5 questions</option>
                <option value={10}>10 questions</option>
                <option value={15}>15 questions</option>
                <option value={20}>20 questions</option>
                <option value={25}>25 questions</option>
                <option value={30}>30 questions</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
              <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                value={difficultyMix}
                onChange={e => setDifficultyMix(e.target.value)}
              >
                {DIFFICULTY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Auto-Translate</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="autoTranslate"
                  checked={autoTranslate}
                  onChange={e => setAutoTranslate(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  disabled={materialLangs.length === 0}
                />
                <label htmlFor="autoTranslate" className="text-sm text-slate-600">
                  {materialLangs.length > 0
                    ? materialLangs.map(l => l.name).join(', ')
                    : 'No material languages configured'}
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedTopic}
              className="bg-violet-600 hover:bg-violet-700 text-white px-6"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Ordering Questions</>
              )}
            </Button>

            <Button
              onClick={handleTranslateExisting}
              disabled={translating || !selectedTopic}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50 px-6"
            >
              {translating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Translating...</>
              ) : (
                <><Languages className="w-4 h-4 mr-2" /> Translate Existing Ordering Questions</>
              )}
            </Button>

            {selectedTopic && (
              <span className="text-sm text-slate-500 ml-2">
                Topic: <strong>{selectedTopicName}</strong>
                {topicOrderingCounts[parseInt(selectedTopic)] > 0 && (
                  <Badge variant="info" className="ml-2 text-xs">{topicOrderingCounts[parseInt(selectedTopic)]} existing ordering</Badge>
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">Generation Failed</p>
            <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Translation Results */}
      {translateResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-blue-800 flex items-center gap-2 mb-2">
            <Languages className="w-4 h-4" />
            Translation Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <span className="text-slate-500">Questions processed</span>
              <p className="text-lg font-semibold text-slate-800">{translateResults.questions_processed || 0}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <span className="text-slate-500">Translations created</span>
              <p className="text-lg font-semibold text-green-600">{translateResults.translations_created || translateResults.translated_count || 0}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-blue-100">
              <span className="text-slate-500">Errors</span>
              <p className="text-lg font-semibold text-red-600">{translateResults.errors || translateResults.error_count || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary stats from generation */}
      {resultSummary && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <span className="text-slate-500">Questions created</span>
              <p className="text-lg font-semibold text-green-600">{resultSummary.total_questions_created || 0}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <span className="text-slate-500">Items created</span>
              <p className="text-lg font-semibold text-slate-800">{resultSummary.total_items_created || 0}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <span className="text-slate-500">Translations</span>
              <p className="text-lg font-semibold text-blue-600">{resultSummary.total_translations_created || 0}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100">
              <span className="text-slate-500">Errors</span>
              <p className="text-lg font-semibold text-red-600">{resultSummary.errors || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generated Questions Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-green-50 to-emerald-50 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Generated {results.length} Ordering Question{results.length !== 1 ? 's' : ''}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (expandedQ.size === results.length) setExpandedQ(new Set());
                else setExpandedQ(new Set(results.map(q => q.ordering_question_id)));
              }}
              className="text-xs"
            >
              {expandedQ.size === results.length ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>

          <div className="divide-y divide-slate-100">
            {results.map((q, idx) => (
              <div key={q.ordering_question_id} className="group">
                <button
                  onClick={() => toggleExpanded(q.ordering_question_id)}
                  className="w-full px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                >
                  {expandedQ.has(q.ordering_question_id) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className="text-xs font-mono text-slate-400 shrink-0 w-8">#{idx + 1}</span>
                  <span className="text-sm text-slate-800 flex-1 truncate">{q.question_text}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="info" className="text-xs">
                      {q.items?.length || 0} items
                    </Badge>
                    <Badge variant={q.difficulty_level === 'hard' ? 'danger' : q.difficulty_level === 'medium' ? 'warning' : 'success'} className="text-xs">
                      {q.difficulty_level}
                    </Badge>
                    <Badge variant={q.partial_scoring ? 'success' : 'default'} className="text-xs">
                      {q.partial_scoring ? 'Partial' : 'All-or-nothing'}
                    </Badge>
                    {q.translations_created && q.translations_created.length > 0 && (
                      <Badge variant="info" className="text-xs">
                        <Languages className="w-3 h-3 mr-1" />
                        {q.translations_created.length} langs
                      </Badge>
                    )}
                  </div>
                </button>

                {expandedQ.has(q.ordering_question_id) && (
                  <div className="px-6 pb-4 pl-16 space-y-3">
                    {/* Ordering Items */}
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ordering Items</span>
                      <div className="mt-2 space-y-2">
                        {q.items?.sort((a, b) => a.correct_position - b.correct_position).map((item) => (
                          <div key={item.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-lg px-4 py-2.5">
                            <span className="text-xs font-mono text-slate-400 shrink-0 w-6">{item.correct_position}.</span>
                            <span className="text-sm text-slate-800 font-medium flex-1">{item.item_text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hint */}
                    {q.hint && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hint</span>
                        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-1">{q.hint}</p>
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div>
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Explanation</span>
                        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-1">{q.explanation}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span>Code: {q.code}</span>
                      <span>Points: {q.points}</span>
                      <span>Partial scoring: {q.partial_scoring ? 'Yes' : 'No'}</span>
                      <span>ID: {q.ordering_question_id}</span>
                      {q.translations_created && q.translations_created.length > 0 && (
                        <span className="text-blue-500">Translated: {q.translations_created.join(', ')}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation: Next Topic / Next Chapter */}
      {results.length > 0 && !generating && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            <span className="font-medium">{selectedChapterName}</span>
            <span className="text-slate-400 mx-2">&rarr;</span>
            <span>Topic {currentTopicIndex + 1} of {topics.length}</span>
            <span className="text-slate-400 mx-2">|</span>
            <span>Chapter {currentChapterIndex + 1} of {chapters.length}</span>
          </div>
          <div className="flex items-center gap-3">
            {hasNextTopic && (
              <Button
                onClick={goNextTopic}
                className="bg-green-600 hover:bg-green-700 text-white px-5"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Next Topic: {topics[currentTopicIndex + 1]?.english_name || topics[currentTopicIndex + 1]?.slug}
              </Button>
            )}
            {isLastTopicInChapter && hasNextChapter && (
              <Button
                onClick={goNextChapter}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Next Chapter: {chapters[currentChapterIndex + 1]?.english_name || chapters[currentChapterIndex + 1]?.slug}
              </Button>
            )}
            {isLastTopicInChapter && !hasNextChapter && (
              <Badge variant="success" className="text-sm px-4 py-2">
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                All topics in all chapters complete!
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!generating && results.length === 0 && !errorMsg && selectedTopic && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Click &quot;Generate Ordering Questions&quot; to create questions from this topic&apos;s tutorial files.</p>
          <p className="text-xs text-slate-400 mt-1">The system will find English sub-topic HTML files, extract content, and generate ordering questions with sequenced items.</p>
        </div>
      )}
    </div>
  );
}
