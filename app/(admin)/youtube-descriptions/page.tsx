"use client";
import { useEffect, useState, useCallback, Fragment, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Sparkles, Loader2, CheckCircle2, XCircle, Copy, Eye, Trash2, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import { AiProgressOverlay, type AiProgressStep } from '@/components/ui/AiProgressOverlay';
import { cn } from '@/lib/utils';

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

interface Subject { id: number; slug: string; code: string; is_active: boolean; english_name?: string }
interface Chapter { id: number; slug: string; subject_id: number; is_active: boolean; english_name?: string }
interface Topic { id: number; slug: string; chapter_id: number; is_active: boolean; english_name?: string }
interface SubTopicRow {
  id: number;
  slug: string;
  display_order: number;
  english_name?: string;
  youtube_description?: {
    id: number;
    video_title: string | null;
    description: string | null;
    updated_at: string;
  } | null;
}

/* ─── Multi-select Checkbox Dropdown ─── */
function MultiCheckboxDropdown<T extends { id: number }>({
  label,
  placeholder,
  items,
  selected,
  onChange,
  renderLabel,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  items: T[];
  selected: number[];
  onChange: (ids: number[]) => void;
  renderLabel: (item: T) => string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleItem = (id: number) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id));
    else onChange([...selected, id]);
  };

  const toggleAll = () => {
    if (selected.length === items.length) onChange([]);
    else onChange(items.map(i => i.id));
  };

  const selectedLabels = items.filter(i => selected.includes(i.id)).map(renderLabel);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between gap-2',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white',
          disabled && 'opacity-50 cursor-not-allowed bg-slate-50'
        )}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-slate-400')}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
              ? selectedLabels[0]
              : `${selected.length} selected`}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selected.length > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="p-0.5 hover:bg-slate-100 rounded"
            >
              <X className="w-3 h-3 text-slate-400" />
            </span>
          )}
          <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && items.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Select All */}
          <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 sticky top-0 bg-white">
            <input
              type="checkbox"
              checked={selected.length === items.length}
              onChange={toggleAll}
              className="rounded border-slate-300"
            />
            <span className="text-xs font-semibold text-slate-500 uppercase">
              Select All ({items.length})
            </span>
          </label>
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggleItem(item.id)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-700 truncate">{renderLabel(item)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page ─── */
export default function YoutubeDescriptionsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subTopics, setSubTopics] = useState<SubTopicRow[]>([]);

  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [aiProvider, setAiProvider] = useState<AIProvider>('openai');

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [autoSelectDone, setAutoSelectDone] = useState(false);
  const skipCascadeRef = useRef(false);

  // Progress
  const [progressSteps, setProgressSteps] = useState<AiProgressStep[]>([]);

  const searchParams = useSearchParams();

  // Load subjects
  useEffect(() => {
    api.listSubjects('?limit=200&is_active=true').then((r: any) => {
      if (r.success) setSubjects(r.data || []);
    });
  }, []);

  // Auto-select filters when sub_topic_id is in URL
  useEffect(() => {
    if (autoSelectDone) return;
    const subTopicIdParam = searchParams.get('sub_topic_id');
    if (!subTopicIdParam || subjects.length === 0) return;

    const subTopicId = Number(subTopicIdParam);
    if (!subTopicId) return;

    setAutoSelectDone(true);

    // Look up the sub-topic to get topic_id, then resolve the full hierarchy
    (async () => {
      try {
        const stRes = await api.getSubTopic(subTopicId);
        if (!stRes.success || !stRes.data) return;
        const topicId = stRes.data.topic_id;

        // Get the topic to find chapter_id
        const tRes = await api.listTopics(`?limit=200&is_active=true`);
        const allTopics = (tRes as any).success ? (tRes as any).data || [] : [];
        const topic = allTopics.find((t: any) => t.id === topicId);
        if (!topic) return;
        const chapterId = topic.chapter_id;

        // Get the chapter to find subject_id
        const cRes = await api.listChapters(`?limit=200&is_active=true`);
        const allChapters = (cRes as any).success ? (cRes as any).data || [] : [];
        const chapter = allChapters.find((c: any) => c.id === chapterId);
        if (!chapter) return;
        const subjectId = chapter.subject_id;

        // Now set filters in cascade order — chapters for this subject, topics for this chapter
        const subjectChapters = allChapters.filter((c: any) => c.subject_id === subjectId);
        const chapterTopics = allTopics.filter((t: any) => t.chapter_id === chapterId);

        skipCascadeRef.current = true;
        setSelectedSubjects([subjectId]);
        setChapters(subjectChapters);
        setSelectedChapters([chapterId]);
        setTopics(chapterTopics);
        setSelectedTopics([topicId]);
        // Reset skipCascade after React processes the state updates
        setTimeout(() => { skipCascadeRef.current = false; }, 500);
      } catch {
        // Silently fail — user can still select manually
      }
    })();
  }, [searchParams, subjects, autoSelectDone]);

  // Load chapters when subjects change
  useEffect(() => {
    if (skipCascadeRef.current) return;
    setChapters([]);
    setTopics([]);
    setSubTopics([]);
    setSelectedChapters([]);
    setSelectedTopics([]);
    setSelectedIds(new Set());
    if (selectedSubjects.length === 0) return;

    // Load chapters for all selected subjects
    const promises = selectedSubjects.map(sid =>
      api.listChapters(`?limit=200&subject_id=${sid}&is_active=true`)
    );
    Promise.all(promises).then(results => {
      const all: Chapter[] = [];
      for (const r of results) {
        if ((r as any).success) all.push(...((r as any).data || []));
      }
      setChapters(all);
    });
  }, [selectedSubjects]);

  // Load topics when chapters change
  useEffect(() => {
    if (skipCascadeRef.current) return;
    setTopics([]);
    setSubTopics([]);
    setSelectedTopics([]);
    setSelectedIds(new Set());
    if (selectedChapters.length === 0) return;

    const promises = selectedChapters.map(cid =>
      api.listTopics(`?limit=200&chapter_id=${cid}&is_active=true`)
    );
    Promise.all(promises).then(results => {
      const all: Topic[] = [];
      for (const r of results) {
        if ((r as any).success) all.push(...((r as any).data || []));
      }
      setTopics(all);
    });
  }, [selectedChapters]);

  // Load sub-topics with their youtube descriptions when topics change
  const loadSubTopics = useCallback(async () => {
    if (selectedTopics.length === 0) {
      setSubTopics([]);
      return;
    }
    setLoading(true);
    try {
      // Load sub-topics and youtube descriptions for all selected topics
      const stPromises = selectedTopics.map(tid =>
        api.listSubTopics(`?limit=200&topic_id=${tid}&is_active=true`)
      );
      const ydPromises = selectedTopics.map(tid =>
        api.listYoutubeDescriptions(`?limit=200&topic_id=${tid}`)
      );

      const [stResults, ydResults] = await Promise.all([
        Promise.all(stPromises),
        Promise.all(ydPromises),
      ]);

      const stData: any[] = [];
      for (const r of stResults) {
        if ((r as any).success) stData.push(...((r as any).data || []));
      }
      const ydData: any[] = [];
      for (const r of ydResults) {
        if ((r as any).success) ydData.push(...((r as any).data || []));
      }

      const ydMap = new Map<number, any>();
      for (const yd of ydData) {
        ydMap.set(yd.sub_topic_id, yd);
      }

      const merged: SubTopicRow[] = stData.map((st: any) => ({
        id: st.id,
        slug: st.slug,
        display_order: st.display_order || 0,
        english_name: st.english_name || null,
        youtube_description: ydMap.get(st.id) ? {
          id: ydMap.get(st.id).id,
          video_title: ydMap.get(st.id).video_title,
          description: ydMap.get(st.id).description,
          updated_at: ydMap.get(st.id).updated_at,
        } : null,
      }));
      merged.sort((a, b) => a.display_order - b.display_order);
      setSubTopics(merged);
    } catch {
      toast.error('Failed to load sub-topics');
    } finally {
      setLoading(false);
    }
  }, [selectedTopics]);

  useEffect(() => {
    setSelectedIds(new Set());
    loadSubTopics();
  }, [selectedTopics, loadSubTopics]);

  // Toggle selection
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === subTopics.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subTopics.map(st => st.id)));
    }
  };

  // Generate for selected sub-topic IDs
  const handleGenerate = async (ids?: number[]) => {
    const targetIds = ids || Array.from(selectedIds);
    if (targetIds.length === 0) {
      toast.error('Select at least one sub-topic');
      return;
    }

    setGenerating(true);
    setProgressSteps([
      { label: `Generating YouTube descriptions for ${targetIds.length} sub-topic(s)...`, status: 'active' },
    ]);

    try {
      const res = await api.generateYoutubeDescription({
        sub_topic_ids: targetIds,
        provider: aiProvider,
      });

      if (res.success) {
        const summary = res.data?.summary;
        setProgressSteps([
          {
            label: `Generated ${summary?.success || 0} of ${summary?.total || 0} descriptions`,
            status: summary?.errors > 0 ? 'error' : 'done',
          },
        ]);
        toast.success(`Generated ${summary?.success || 0} YouTube description(s)`);
        await loadSubTopics();
      } else {
        setProgressSteps([{ label: res.error || 'Generation failed', status: 'error' }]);
        toast.error(res.error || 'Generation failed');
      }
    } catch (e: any) {
      setProgressSteps([{ label: e.message || 'Generation failed', status: 'error' }]);
      toast.error(e.message || 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  // Bulk generate for selected topics/chapters/subjects (multi-select)
  const handleBulkGenerate = async (level: 'topics' | 'chapters' | 'subjects') => {
    const payload: any = { provider: aiProvider };
    if (level === 'topics' && selectedTopics.length > 0) {
      payload.topic_ids = selectedTopics;
    } else if (level === 'chapters' && selectedChapters.length > 0) {
      payload.chapter_ids = selectedChapters;
    } else if (level === 'subjects' && selectedSubjects.length > 0) {
      payload.subject_ids = selectedSubjects;
    } else {
      toast.error('Select a filter first');
      return;
    }

    setGenerating(true);
    setProgressSteps([{ label: `Generating for all sub-topics under selected ${level}...`, status: 'active' }]);

    try {
      const res = await api.generateYoutubeDescription(payload);
      if (res.success) {
        const summary = res.data?.summary;
        setProgressSteps([{
          label: `Generated ${summary?.success || 0} of ${summary?.total || 0} descriptions`,
          status: summary?.errors > 0 ? 'error' : 'done',
        }]);
        toast.success(`Generated ${summary?.success || 0} YouTube description(s)`);
        await loadSubTopics();
      } else {
        setProgressSteps([{ label: res.error || 'Failed', status: 'error' }]);
        toast.error(res.error || 'Failed');
      }
    } catch (e: any) {
      setProgressSteps([{ label: e.message, status: 'error' }]);
    } finally {
      setGenerating(false);
    }
  };

  // Delete single
  const handleDelete = async (ydId: number) => {
    if (!confirm('Delete this YouTube description?')) return;
    const res = await api.deleteYoutubeDescription(ydId);
    if (res.success) {
      toast.success('Deleted');
      await loadSubTopics();
    } else {
      toast.error(res.error || 'Delete failed');
    }
  };

  // Bulk delete selected descriptions
  const handleBulkDelete = async () => {
    // Gather youtube_description IDs for selected sub-topics that have a description
    const ydIds = subTopics
      .filter(st => selectedIds.has(st.id) && st.youtube_description)
      .map(st => st.youtube_description!.id);

    if (ydIds.length === 0) {
      toast.error('No generated descriptions in selection to delete');
      return;
    }
    if (!confirm(`Permanently delete ${ydIds.length} YouTube description(s)?`)) return;

    try {
      const res = await api.bulkDeleteYoutubeDescriptions(ydIds);
      if (res.success) {
        toast.success(`Deleted ${res.data?.deleted || ydIds.length} description(s)`);
        setSelectedIds(new Set());
        await loadSubTopics();
      } else {
        toast.error(res.error || 'Bulk delete failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Bulk delete failed');
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const generatedCount = subTopics.filter(st => st.youtube_description).length;
  const pendingCount = subTopics.length - generatedCount;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="YouTube Descriptions" description="Generate YouTube video titles and descriptions from English CDN content" />

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Subject — Multi-select */}
          <MultiCheckboxDropdown
            label="Subjects"
            placeholder="Select Subjects"
            items={subjects}
            selected={selectedSubjects}
            onChange={setSelectedSubjects}
            renderLabel={(s) => s.english_name || s.code || s.slug}
          />
          {/* Chapter — Multi-select */}
          <MultiCheckboxDropdown
            label="Chapters"
            placeholder="Select Chapters"
            items={chapters}
            selected={selectedChapters}
            onChange={setSelectedChapters}
            renderLabel={(c) => c.english_name || c.slug}
            disabled={selectedSubjects.length === 0}
          />
          {/* Topic — Multi-select */}
          <MultiCheckboxDropdown
            label="Topics"
            placeholder="Select Topics"
            items={topics}
            selected={selectedTopics}
            onChange={setSelectedTopics}
            renderLabel={(t) => t.english_name || t.slug}
            disabled={selectedChapters.length === 0}
          />
          {/* AI Provider */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">AI Model</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={aiProvider}
              onChange={e => setAiProvider(e.target.value as AIProvider)}
            >
              {AI_PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label} — {p.model}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleGenerate()}
            disabled={generating || selectedIds.size === 0}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Generate Selected ({selectedIds.size})
          </Button>
          {selectedIds.size > 0 && subTopics.some(st => selectedIds.has(st.id) && st.youtube_description) && (
            <Button
              size="sm"
              variant="danger"
              onClick={handleBulkDelete}
              disabled={generating}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete Selected
            </Button>
          )}
          {selectedTopics.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => handleBulkGenerate('topics')} disabled={generating}>
              <Sparkles className="w-4 h-4 mr-1" />
              All in {selectedTopics.length === 1 ? 'Topic' : `${selectedTopics.length} Topics`}
            </Button>
          )}
          {selectedChapters.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => handleBulkGenerate('chapters')} disabled={generating}>
              <Sparkles className="w-4 h-4 mr-1" />
              All in {selectedChapters.length === 1 ? 'Chapter' : `${selectedChapters.length} Chapters`}
            </Button>
          )}
          {selectedSubjects.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => handleBulkGenerate('subjects')} disabled={generating}>
              <Sparkles className="w-4 h-4 mr-1" />
              All in {selectedSubjects.length === 1 ? 'Subject' : `${selectedSubjects.length} Subjects`}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            {subTopics.length > 0 && (
              <>
                <Badge variant="default">{subTopics.length} sub-topics</Badge>
                <Badge variant="success">{generatedCount} generated</Badge>
                {pendingCount > 0 && <Badge variant="warning">{pendingCount} pending</Badge>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      {progressSteps.length > 0 && (
        <AiProgressOverlay active={generating || progressSteps.some(s => s.status === 'done' || s.status === 'error')} steps={progressSteps} />
      )}

      {/* Table */}
      {selectedTopics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
          Select Subject(s), Chapter(s), and Topic(s) to see sub-topics
        </div>
      ) : loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
          <p className="mt-2 text-sm text-slate-500">Loading sub-topics...</p>
        </div>
      ) : subTopics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
          No sub-topics found for selected topics
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === subTopics.length && subTopics.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sub-Topic</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Video Title</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subTopics.map((st) => {
                const yd = st.youtube_description;
                const isExpanded = expandedRow === st.id;
                return (
                  <Fragment key={st.id}>
                    <tr className={cn('border-b border-slate-100 hover:bg-slate-50/50 transition-colors', selectedIds.has(st.id) && 'bg-blue-50/30')}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(st.id)}
                          onChange={() => toggleSelect(st.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-3 text-slate-400">{st.display_order}</td>
                      <td className="px-3 py-3 font-medium text-slate-700">
                        {st.english_name || st.slug}
                      </td>
                      <td className="px-3 py-3 text-slate-600 max-w-xs truncate">
                        {yd?.video_title || <span className="text-slate-300 italic">Not generated</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {yd ? (
                          <Badge variant="success" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Generated
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-xs">
                            <XCircle className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {yd && (
                            <>
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : st.id)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => {
                                  const text = `${yd.video_title || ''}\n\n${yd.description || ''}`;
                                  copyToClipboard(text, 'Title + Description');
                                }}
                                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Copy All"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(yd.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleGenerate([st.id])}
                            disabled={generating}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                            title={yd ? 'Regenerate' : 'Generate'}
                          >
                            {yd ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && yd && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="space-y-4 max-w-4xl">
                            {/* Video Title */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-500 uppercase">Video Title</label>
                                <button
                                  onClick={() => copyToClipboard(yd.video_title || '', 'Video Title')}
                                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm font-medium text-slate-800">
                                {yd.video_title || 'N/A'}
                              </div>
                            </div>
                            {/* Description */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-slate-500 uppercase">
                                  Description ({(yd.description || '').length} / 5000 chars)
                                </label>
                                <button
                                  onClick={() => copyToClipboard(yd.description || '', 'Description')}
                                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                              </div>
                              <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                                {yd.description || 'N/A'}
                              </div>
                            </div>
                            <div className="text-xs text-slate-400">
                              Last updated: {new Date(yd.updated_at).toLocaleString()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
