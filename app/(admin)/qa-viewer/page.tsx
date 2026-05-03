"use client";
import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuestionViewDialog } from '@/components/ui/QuestionViewDialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Eye, HelpCircle, BookOpen, Filter } from 'lucide-react';

/* ─── Constants ─── */
type QuestionTab = 'mcq' | 'ow' | 'desc' | 'matching' | 'ordering';

const TABS: { key: QuestionTab; label: string }[] = [
  { key: 'mcq', label: 'MCQ' },
  { key: 'ow', label: 'One Word' },
  { key: 'desc', label: 'Descriptive' },
  { key: 'matching', label: 'Matching' },
  { key: 'ordering', label: 'Ordering' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

/* ─── API loader per tab ─── */
function fetchQuestions(tab: QuestionTab, topicId: string) {
  const qs = `?page_size=50&topic_id=${topicId}`;
  switch (tab) {
    case 'mcq': return api.listMcqQuestions(qs);
    case 'ow': return api.listOwQuestions(qs);
    case 'desc': return api.listDescQuestions(qs);
    case 'matching': return api.listMatchingQuestions(qs);
    case 'ordering': return api.listOrderingQuestions(qs);
  }
}

/* ─── Component ─── */
export default function QaViewerPage() {
  // Filter state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');

  // Tab state
  const [activeTab, setActiveTab] = useState<QuestionTab>('mcq');

  // Questions per tab
  const [questions, setQuestions] = useState<Record<QuestionTab, any[]>>({
    mcq: [], ow: [], desc: [], matching: [], ordering: [],
  });
  const [counts, setCounts] = useState<Record<QuestionTab, number>>({
    mcq: 0, ow: 0, desc: 0, matching: 0, ordering: 0,
  });
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // View dialog
  const [viewDialogQuestion, setViewDialogQuestion] = useState<{
    id: number; code: string; type: QuestionTab;
  } | null>(null);

  // ── Load subjects on mount ──
  useEffect(() => {
    api.listSubjects('?page_size=200&is_active=true').then(res => {
      if (res.success) setSubjects(res.data || []);
      setFiltersLoading(false);
    });
  }, []);

  // ── Cascade: subject -> chapters ──
  useEffect(() => {
    setChapterId('');
    setTopicId('');
    setChapters([]);
    setTopics([]);
    if (subjectId) {
      api.listChapters(`?page_size=200&is_active=true&subject_id=${subjectId}`).then(res => {
        if (res.success) setChapters(res.data || []);
      });
    }
  }, [subjectId]);

  // ── Cascade: chapter -> topics ──
  useEffect(() => {
    setTopicId('');
    setTopics([]);
    if (chapterId) {
      api.listTopics(`?page_size=200&is_active=true&chapter_id=${chapterId}`).then(res => {
        if (res.success) setTopics(res.data || []);
      });
    }
  }, [chapterId]);

  // ── Load ALL tabs when topic changes ──
  const loadAllTabs = useCallback(async (tid: string) => {
    if (!tid) {
      setQuestions({ mcq: [], ow: [], desc: [], matching: [], ordering: [] });
      setCounts({ mcq: 0, ow: 0, desc: 0, matching: 0, ordering: 0 });
      return;
    }
    setLoading(true);
    const results = await Promise.all(
      TABS.map(t => fetchQuestions(t.key, tid))
    );
    const newQuestions: Record<QuestionTab, any[]> = { mcq: [], ow: [], desc: [], matching: [], ordering: [] };
    const newCounts: Record<QuestionTab, number> = { mcq: 0, ow: 0, desc: 0, matching: 0, ordering: 0 };
    TABS.forEach((t, i) => {
      const res = results[i];
      if (res.success) {
        newQuestions[t.key] = res.data || [];
        newCounts[t.key] = res.pagination?.total ?? (res.data?.length || 0);
      }
    });
    setQuestions(newQuestions);
    setCounts(newCounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAllTabs(topicId);
  }, [topicId, loadAllTabs]);

  // ── Current tab data ──
  const currentQuestions = questions[activeTab];
  const totalQuestions = counts.mcq + counts.ow + counts.desc + counts.matching + counts.ordering;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Q&A Viewer"
        description="Browse questions by subject, chapter, and topic"
      />

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Filter Questions</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Subject</label>
            <select
              className={cn(selectClass, 'w-full')}
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              disabled={filtersLoading}
            >
              <option value="">Select subject...</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.english_name || s.name || `Subject ${s.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Chapter</label>
            <select
              className={cn(selectClass, 'w-full')}
              value={chapterId}
              onChange={e => setChapterId(e.target.value)}
              disabled={!subjectId}
            >
              <option value="">{subjectId ? 'Select chapter...' : 'Select a subject first'}</option>
              {chapters.map(c => (
                <option key={c.id} value={c.id}>
                  {c.english_name || c.name || `Chapter ${c.id}`}
                </option>
              ))}
            </select>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Topic</label>
            <select
              className={cn(selectClass, 'w-full')}
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              disabled={!chapterId}
            >
              <option value="">{chapterId ? 'Select topic...' : 'Select a chapter first'}</option>
              {topics.map(t => (
                <option key={t.id} value={t.id}>
                  {t.english_name || t.name || `Topic ${t.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
              activeTab === tab.key
                ? 'text-brand-600 border-brand-500'
                : 'text-slate-500 border-transparent hover:text-slate-700'
            )}
          >
            {tab.label}
            {topicId && (
              <span className={cn(
                'ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
                activeTab === tab.key
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-slate-100 text-slate-600'
              )}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}

        {/* Total badge */}
        {topicId && totalQuestions > 0 && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 pr-2">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{totalQuestions} total question{totalQuestions !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {!topicId ? (
        <EmptyState
          icon={Filter}
          title="Select a Subject, Chapter, and Topic to view questions"
          description="Use the filters above to narrow down to a specific topic"
        />
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : currentQuestions.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No questions found for this topic"
          description={`There are no ${TABS.find(t => t.key === activeTab)?.label || ''} questions for the selected topic`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentQuestions.map((q: any) => (
            <QuestionCard
              key={q.id}
              question={q}
              type={activeTab}
              onView={() => setViewDialogQuestion({ id: q.id, code: q.code, type: activeTab })}
            />
          ))}
        </div>
      )}

      {/* ── Question View Dialog ── */}
      <QuestionViewDialog
        open={!!viewDialogQuestion}
        onClose={() => setViewDialogQuestion(null)}
        questionType={viewDialogQuestion?.type ?? 'mcq'}
        questionId={viewDialogQuestion?.id ?? null}
        questionCode={viewDialogQuestion?.code ?? ''}
      />
    </div>
  );
}

/* ─── Question Card ─── */
function QuestionCard({
  question,
  type,
  onView,
}: {
  question: any;
  type: QuestionTab;
  onView: () => void;
}) {
  const difficulty = question.difficulty_level;
  const questionText = question.question_text || question.slug || '';
  const displayText = questionText.length > 100
    ? questionText.substring(0, 100) + '...'
    : questionText;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
      {/* Top row: code + difficulty */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate">
          {question.code}
        </span>
        <div className="flex items-center gap-1.5">
          {difficulty && (
            <span className={cn(
              'inline-flex text-xs font-semibold px-2 py-0.5 rounded-full capitalize',
              DIFFICULTY_COLORS[difficulty] || 'bg-slate-50 text-slate-600'
            )}>
              {DIFFICULTY_LABELS[difficulty] || difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Question preview */}
      {displayText && (
        <p className="text-sm text-slate-700 leading-relaxed line-clamp-3 flex-1">
          {displayText}
        </p>
      )}
      {!displayText && (
        <p className="text-sm text-slate-400 italic leading-relaxed flex-1">
          No question text available
        </p>
      )}

      {/* Bottom row: meta + actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {question.points != null && (
            <span className="text-xs font-medium text-slate-500">
              {question.points} pt{question.points !== 1 ? 's' : ''}
            </span>
          )}
          <Badge variant={question.is_active ? 'success' : 'danger'}>
            {question.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <button
          onClick={onView}
          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
          title="View full question"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
