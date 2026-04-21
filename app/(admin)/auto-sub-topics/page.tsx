"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Sparkles, Upload, CheckCircle2, XCircle, Loader2, FileText, AlertTriangle, ChevronRight, RotateCcw, Globe, Languages } from 'lucide-react';
import { AiProgressOverlay, type AiProgressStep } from '@/components/ui/AiProgressOverlay';
import { cn } from '@/lib/utils';
import type { Language } from '@/lib/types';

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

interface Subject { id: number; slug: string; is_active: boolean }
interface Chapter { id: number; slug: string; subject_id: number; is_active: boolean }
interface Topic { id: number; slug: string; chapter_id: number; is_active: boolean }

type Step = 'idle' | 'step1_english' | 'step2_translate' | 'step3_pages' | 'done' | 'error';

export default function AutoSubTopicsPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in p-8 text-center text-slate-400">Loading...</div>}>
      <AutoSubTopicsContent />
    </Suspense>
  );
}

function AutoSubTopicsContent() {
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [aiPrompt, setAiPrompt] = useState('Analyze the content and generate a sub-topic for an educational platform. Keep SEO fields relevant and concise.');

  // Per-language file uploads  { [languageId]: File }
  const [langFiles, setLangFiles] = useState<Record<number, File>>({});

  // Existing page files from DB { [languageId]: { url, fileName, subTopicName, subTopicSlug, translationId } }
  const [existingPages, setExistingPages] = useState<Record<number, { url: string; fileName: string; subTopicName: string; subTopicSlug: string; translationId: number }>>({});
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Existing sub-topics for "Upload Pages Only" mode
  const [existingSubTopics, setExistingSubTopics] = useState<{ id: number; slug: string; name?: string }[]>([]);
  const [selectedSubTopicId, setSelectedSubTopicId] = useState<string>('');

  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  // Results
  const [resultSubTopic, setResultSubTopic] = useState<{ sub_topic_id: number; slug: string; name: string; is_new: boolean } | null>(null);
  const [translationResults, setTranslationResults] = useState<{ language: string; iso_code: string; status: string }[]>([]);
  const [pagesUploaded, setPagesUploaded] = useState(0);

  // Load subjects and languages on mount; handle query param pre-selection
  useEffect(() => {
    const qTopic = searchParams.get('topic_id') || '';

    api.listLanguages('?for_material=true&limit=100').then(res => {
      if (res.success) {
        const active = (res.data || []).filter((l: Language) => l.is_active);
        setLanguages(active);
      }
    });

    api.listSubjects('?limit=500&is_active=true').then(async (subRes) => {
      if (subRes.success) setSubjects(subRes.data || []);

      // If topic_id in URL, reverse-lookup the chain: topic → chapter → subject
      if (qTopic) {
        try {
          const topicRes = await api.getTopic(Number(qTopic));
          if (topicRes.success && topicRes.data) {
            const topic = topicRes.data;
            const chapterId = topic.chapter_id || (topic as any).chapters?.id;
            if (chapterId) {
              const chapterRes = await api.getChapter(chapterId);
              if (chapterRes.success && chapterRes.data) {
                const subjectId = chapterRes.data.subject_id;
                if (subjectId) {
                  setSelectedSubject(String(subjectId));
                  const chListRes = await api.listChapters(`?limit=500&is_active=true&subject_id=${subjectId}`);
                  if (chListRes.success) setChapters(chListRes.data || []);
                }
                setSelectedChapter(String(chapterId));
                const tListRes = await api.listTopics(`?limit=500&is_active=true&chapter_id=${chapterId}`);
                if (tListRes.success) setTopics(tListRes.data || []);
              }
            }
            setSelectedTopic(qTopic);
          }
        } catch (e) {
          console.error('Failed to pre-select from topic_id:', e);
        }
      }
      setInitialized(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load chapters when subject changes (only after init)
  useEffect(() => {
    if (!initialized) return;
    setSelectedChapter(''); setSelectedTopic(''); setChapters([]); setTopics([]);
    if (selectedSubject) {
      api.listChapters(`?limit=500&is_active=true&subject_id=${selectedSubject}`).then(res => { if (res.success) setChapters(res.data || []); });
    }
  }, [selectedSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load topics when chapter changes (only after init)
  useEffect(() => {
    if (!initialized) return;
    setSelectedTopic(''); setTopics([]);
    if (selectedChapter) {
      api.listTopics(`?limit=500&is_active=true&chapter_id=${selectedChapter}`).then(res => { if (res.success) setTopics(res.data || []); });
    }
  }, [selectedChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset & load existing pages when topic changes
  useEffect(() => {
    resetResults();
    setExistingPages({});
    if (selectedTopic) loadExistingPages(selectedTopic);
  }, [selectedTopic]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadExistingPages(topicId: string) {
    setLoadingExisting(true);
    try {
      // Get all sub-topics for this topic
      const stRes = await api.listSubTopics(`?topic_id=${topicId}&limit=500`);
      if (!stRes.success || !stRes.data?.length) {
        setExistingSubTopics([]);
        setSelectedSubTopicId('');
        setLoadingExisting(false);
        return;
      }

      // Store existing sub-topics for "Upload Pages Only" mode
      const subTopicsList = stRes.data.map((st: any) => ({ id: st.id, slug: st.slug, name: st.name || st.slug }));
      setExistingSubTopics(subTopicsList);
      // Auto-select the most recent sub-topic
      if (subTopicsList.length > 0) setSelectedSubTopicId(String(subTopicsList[subTopicsList.length - 1].id));

      const pages: Record<number, { url: string; fileName: string; subTopicName: string; subTopicSlug: string; translationId: number }> = {};

      // For each sub-topic, get its translations that have page files
      for (const st of stRes.data) {
        const trRes = await api.listSubTopicTranslations(`?sub_topic_id=${st.id}&limit=100`);
        if (trRes.success && trRes.data) {
          for (const tr of trRes.data) {
            if (tr.page) {
              // Extract filename from URL
              const urlParts = (tr.page as string).split('/');
              const fileName = urlParts[urlParts.length - 1] || 'page.html';
              pages[tr.language_id] = {
                url: tr.page,
                fileName,
                subTopicName: st.slug || tr.name || '',
                subTopicSlug: st.slug || '',
                translationId: tr.id,
              };
            }
          }
        }
      }
      setExistingPages(pages);
    } catch (e) {
      console.error('Failed to load existing pages:', e);
    }
    setLoadingExisting(false);
  }

  function resetResults() {
    setStep('idle'); setErrorMsg(''); setLangFiles({});
    setResultSubTopic(null); setTranslationResults([]); setPagesUploaded(0); setProgressMsg('');
    if (selectedTopic) loadExistingPages(selectedTopic);
  }

  function handleFileSelect(langId: number, file: File | null) {
    if (file && !file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
      toast.error('Only .html or .htm files are allowed');
      return;
    }
    setLangFiles(prev => {
      const next = { ...prev };
      if (file) next[langId] = file;
      else delete next[langId];
      return next;
    });
    if (step === 'error' || step === 'done') { setStep('idle'); setErrorMsg(''); }
  }

  const englishLang = languages.find(l => l.iso_code === 'en');
  const otherLangs = languages.filter(l => l.iso_code !== 'en');
  const englishFile = englishLang ? langFiles[englishLang.id] : undefined;
  const uploadedCount = Object.keys(langFiles).length;

  async function handleProcess() {
    if (!englishFile || !selectedTopic || !englishLang) {
      toast.error('English HTML file is required');
      return;
    }

    setErrorMsg('');
    setResultSubTopic(null);
    setTranslationResults([]);
    setPagesUploaded(0);

    // ═══ Step 1: Process English HTML → create ONE sub-topic + English translation ═══
    setStep('step1_english');
    setProgressMsg('Analyzing English content and creating sub-topic...');

    const fd = new FormData();
    fd.append('topic_id', selectedTopic);
    fd.append('language_id', String(englishLang.id));
    fd.append('provider', aiProvider);
    fd.append('prompt', aiPrompt);
    fd.append('file', englishFile, englishFile.name);

    let subTopicId: number;
    try {
      const res = await api.autoSubTopics(fd);
      if (!res.success) { setStep('error'); setErrorMsg(res.error || 'Failed to process English file'); return; }
      const st = res.data?.sub_topics?.[0];
      if (!st) { setStep('error'); setErrorMsg('No sub-topic was generated'); return; }
      subTopicId = st.sub_topic_id;
      setResultSubTopic({ sub_topic_id: st.sub_topic_id, slug: st.slug, name: st.name, is_new: st.is_new });
      toast.success(`Step 1: Sub-topic "${st.name}" ${st.is_new ? 'created' : 'updated'} with English translation`);
    } catch (e: any) {
      setStep('error'); setErrorMsg(e.message || 'Failed to process English file'); return;
    }

    // ═══ Step 2: Translate English → all other active languages ═══
    if (otherLangs.length > 0) {
      setStep('step2_translate');
      setProgressMsg(`Translating to ${otherLangs.length} languages...`);

      try {
        const res = await api.bulkGenerateSubTopicTranslations({
          sub_topic_id: subTopicId,
          prompt: 'Translate exactly with the same meaning. Keep technical or brand words in English that sound strange or unnatural when translated.',
          provider: aiProvider,
        });
        if (res.success && res.data?.results) {
          const results = res.data.results.map((r: any) => ({ language: r.language, iso_code: r.iso_code, status: r.status }));
          setTranslationResults(results);
          const successCount = results.filter((r: any) => r.status === 'success').length;
          const errorCount = results.filter((r: any) => r.status === 'error').length;
          if (errorCount > 0) {
            toast.error(`Step 2: ${successCount} succeeded, ${errorCount} failed`);
          } else {
            toast.success(`Step 2: ${successCount} language translations created`);
          }
        } else {
          // API returned an error — mark all other languages as failed
          const errorResults = otherLangs.map(l => ({ language: l.name, iso_code: l.iso_code || '', status: 'error' }));
          setTranslationResults(errorResults);
          toast.error(`Step 2 failed: ${res.error || 'Translation generation failed'}. You can retry from the Sub-Topic Translations page.`);
        }
      } catch (e: any) {
        console.error('Bulk translation failed:', e);
        // Mark all other languages as failed on exception
        const errorResults = otherLangs.map(l => ({ language: l.name, iso_code: l.iso_code || '', status: 'error' }));
        setTranslationResults(errorResults);
        toast.error(`Translation step failed: ${e.message || 'Unknown error'}. You can retry from the Sub-Topic Translations page.`);
      }
    }

    // ═══ Step 3: Upload HTML page files for all languages that have them ═══
    const allPageFiles = Object.entries(langFiles);
    if (allPageFiles.length > 0) {
      setStep('step3_pages');
      setProgressMsg('Uploading HTML page files...');

      let uploaded = 0;
      for (const [langIdStr, file] of allPageFiles) {
        const langId = Number(langIdStr);
        // Find the translation record for this sub-topic + language
        const lookupRes = await api.listSubTopicTranslations(`?sub_topic_id=${subTopicId}&language_id=${langId}&limit=1`);
        if (lookupRes.success && lookupRes.data && lookupRes.data.length > 0) {
          const transId = lookupRes.data[0].id;
          const pageFd = new FormData();
          pageFd.append('page_file', file, file.name);
          const updRes = await api.updateSubTopicTranslation(transId, pageFd, true);
          if (updRes.success) uploaded++;
        }
      }
      setPagesUploaded(uploaded);
      if (uploaded > 0) toast.success(`Step 3: ${uploaded} page file${uploaded > 1 ? 's' : ''} uploaded`);
    }

    setStep('done');
    toast.success('All done!');
    // Reload existing pages to reflect newly uploaded files
    if (selectedTopic) loadExistingPages(selectedTopic);
  }

  // ═══ Upload Pages Only — for existing sub-topics (no English file needed) ═══
  async function handleUploadPagesOnly() {
    const nonEnglishFiles = Object.entries(langFiles).filter(([langIdStr]) => {
      const langId = Number(langIdStr);
      return !englishLang || langId !== englishLang.id;
    });

    if (nonEnglishFiles.length === 0) {
      toast.error('No language files to upload');
      return;
    }

    const targetSubTopicId = Number(selectedSubTopicId);
    if (!targetSubTopicId) {
      toast.error('Select a sub-topic to upload pages to');
      return;
    }

    setErrorMsg('');
    setResultSubTopic(null);
    setTranslationResults([]);
    setPagesUploaded(0);
    setStep('step3_pages');
    setProgressMsg('Uploading HTML page files...');

    let uploaded = 0;
    let failed = 0;
    for (const [langIdStr, file] of nonEnglishFiles) {
      const langId = Number(langIdStr);
      // Find the translation record for this sub-topic + language
      const lookupRes = await api.listSubTopicTranslations(`?sub_topic_id=${targetSubTopicId}&language_id=${langId}&limit=1`);
      if (lookupRes.success && lookupRes.data && lookupRes.data.length > 0) {
        const transId = lookupRes.data[0].id;
        const pageFd = new FormData();
        pageFd.append('page_file', file, file.name);
        const updRes = await api.updateSubTopicTranslation(transId, pageFd, true);
        if (updRes.success) uploaded++;
        else failed++;
      } else {
        // No translation record exists for this language — skip
        const lang = languages.find(l => l.id === langId);
        toast.error(`No translation found for ${lang?.name || 'language'} on this sub-topic`);
        failed++;
      }
    }
    setPagesUploaded(uploaded);
    if (uploaded > 0) toast.success(`${uploaded} page file${uploaded > 1 ? 's' : ''} uploaded successfully`);
    if (failed > 0) toast.error(`${failed} file${failed > 1 ? 's' : ''} failed to upload`);

    setStep('done');
    if (selectedTopic) loadExistingPages(selectedTopic);
  }

  const isProcessing = step === 'step1_english' || step === 'step2_translate' || step === 'step3_pages';
  const selectedSubjectObj = subjects.find(s => String(s.id) === selectedSubject);
  const selectedChapterObj = chapters.find(c => String(c.id) === selectedChapter);
  const selectedTopicObj = topics.find(t => String(t.id) === selectedTopic);
  const hasNonEnglishFiles = Object.keys(langFiles).some(k => !englishLang || Number(k) !== englishLang.id);
  const canUploadPagesOnly = !englishFile && hasNonEnglishFiles && existingSubTopics.length > 0 && !!selectedSubTopicId;

  // Sort languages: English first, then alphabetical
  const sortedLanguages = [...languages].sort((a, b) => {
    if (a.iso_code === 'en') return -1;
    if (b.iso_code === 'en') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Auto Sub-Topics" description="Upload HTML files to auto-generate a sub-topic and translate to all active languages" />

      {/* Selection Area */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Material Hierarchy</h3>
        {(selectedSubjectObj || selectedChapterObj || selectedTopicObj) && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            {selectedSubjectObj && <Badge variant="muted">{selectedSubjectObj.slug}</Badge>}
            {selectedChapterObj && <><ChevronRight className="w-3 h-3" /><Badge variant="muted">{selectedChapterObj.slug}</Badge></>}
            {selectedTopicObj && <><ChevronRight className="w-3 h-3" /><Badge variant="info">{selectedTopicObj.slug}</Badge></>}
          </div>
        )}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <select className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
              value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={isProcessing}>
              <option value="">Select a subject...</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.slug}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Chapter</label>
            <select className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              value={selectedChapter} onChange={e => setSelectedChapter(e.target.value)} disabled={!selectedSubject || isProcessing}>
              <option value="">{selectedSubject ? 'Select a chapter...' : 'Select subject first'}</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.slug}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Topic</label>
            <select className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} disabled={!selectedChapter || isProcessing}>
              <option value="">{selectedChapter ? 'Select a topic...' : 'Select chapter first'}</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedTopic && (
        <>
          {/* AI Settings */}
          <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5 mb-5">
            <h3 className="text-sm font-semibold text-indigo-700 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> AI Settings
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">AI Provider</label>
                <div className="grid grid-cols-3 gap-2">
                  {AI_PROVIDERS.map(p => (
                    <button key={p.value} type="button" disabled={isProcessing}
                      onClick={() => setAiProvider(p.value)}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left',
                        aiProvider === p.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}>
                      <div className="font-semibold text-xs">{p.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{p.model}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">AI Prompt</label>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} disabled={isProcessing}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[68px] resize-y disabled:opacity-50"
                  placeholder="Instructions for AI..." />
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="flex items-start gap-3 mb-5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
            <Globe className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-semibold">How it works (1 file = 1 sub-topic):</p>
              <p><strong>Step 1:</strong> English HTML file (required) → AI analyzes content → creates 1 sub-topic + English translation with full SEO</p>
              <p><strong>Step 2:</strong> AI translates English content to all {otherLangs.length} other active languages with exact meaning</p>
              <p><strong>Step 3:</strong> All uploaded HTML files are stored as page files on their respective language translations</p>
            </div>
          </div>

          {/* Sub-topic selector for "Upload Pages Only" mode */}
          {existingSubTopics.length > 0 && !englishFile && hasNonEnglishFiles && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Upload className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-amber-800 font-medium mb-1.5">Upload pages to existing sub-topic (no English file needed)</p>
                <select
                  className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={selectedSubTopicId}
                  onChange={e => setSelectedSubTopicId(e.target.value)}
                  disabled={isProcessing}
                >
                  <option value="">Select a sub-topic...</option>
                  {existingSubTopics.map(st => (
                    <option key={st.id} value={st.id}>{st.slug}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{languages.length} languages</span>
              {uploadedCount > 0 && <Badge variant="info">{uploadedCount} file{uploadedCount > 1 ? 's' : ''}</Badge>}
              {!englishFile && !hasNonEnglishFiles && <Badge variant="warning">English file required</Badge>}
              {!englishFile && hasNonEnglishFiles && existingSubTopics.length > 0 && <Badge variant="info">Upload pages mode</Badge>}
              {!englishFile && hasNonEnglishFiles && existingSubTopics.length === 0 && <Badge variant="warning">English file required for new sub-topic</Badge>}
              {englishFile && <Badge variant="success">English ready</Badge>}
            </div>
            <div className="flex items-center gap-2">
              {step === 'done' && (
                <Button variant="outline" onClick={resetResults}>
                  <RotateCcw className="w-4 h-4" /> Start Over
                </Button>
              )}
              {canUploadPagesOnly && !englishFile && (
                <Button onClick={handleUploadPagesOnly} disabled={isProcessing}>
                  {step === 'step3_pages' ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading Pages...</>
                    : <><Upload className="w-4 h-4" /> Upload Pages</>}
                </Button>
              )}
              <Button onClick={handleProcess} disabled={!englishFile || isProcessing}>
                {step === 'step1_english' ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Sub-Topic...</>
                  : step === 'step2_translate' ? <><Loader2 className="w-4 h-4 animate-spin" /> Translating...</>
                  : step === 'step3_pages' ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading Pages...</>
                  : <><Sparkles className="w-4 h-4" /> Process</>}
              </Button>
            </div>
          </div>

          {/* Progress */}
          {isProcessing && (
            <div className="mb-5">
              <AiProgressOverlay
                active={isProcessing}
                steps={[
                  { label: 'Analyzing English content & creating sub-topic', status: step === 'step1_english' ? 'active' : 'done' },
                  { label: `Translating to ${otherLangs.length} languages`, status: step === 'step2_translate' ? 'active' : step === 'step1_english' ? 'pending' : 'done' },
                  { label: 'Uploading HTML page files', status: step === 'step3_pages' ? 'active' : 'pending' },
                ] as AiProgressStep[]}
                title="Processing Sub-Topic"
                subtitle={progressMsg}
              />
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="mb-5 bg-red-50 rounded-xl border border-red-200 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Processing failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* Language cards grid */}
          {loadingExisting && (
            <div className="flex items-center gap-2 mb-3 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading existing page files...
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
            {sortedLanguages.map(lang => {
              const isEnglish = lang.iso_code === 'en';
              const file = langFiles[lang.id];
              const existing = existingPages[lang.id];
              const tr = translationResults.find(r => r.iso_code === lang.iso_code);
              const langDone = isEnglish ? !!resultSubTopic : (tr?.status === 'success');
              const hasAttachment = !!file || !!existing;

              return (
                <div key={lang.id} className={cn(
                  'bg-white rounded-xl border shadow-sm overflow-hidden transition-all',
                  langDone ? 'border-emerald-200' :
                  isEnglish && !hasAttachment ? 'border-amber-300 ring-1 ring-amber-200' :
                  hasAttachment ? 'border-brand-200' : 'border-slate-200'
                )}>
                  {/* Card header */}
                  <div className={cn(
                    'flex items-center justify-between px-4 py-2.5 border-b',
                    isEnglish ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{lang.name}</span>
                      {lang.native_name && lang.native_name !== lang.name && (
                        <span className="text-xs text-slate-400">({lang.native_name})</span>
                      )}
                      <Badge variant="muted">{lang.iso_code}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isEnglish && <Badge variant="success">Primary</Badge>}
                      {existing && !file && <Badge variant="info">Attached</Badge>}
                      {langDone && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {tr?.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-3">
                    {/* Show existing attached file if no new file is selected */}
                    {existing && !file && (
                      <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-2.5 mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <a href={existing.url} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-emerald-700 font-medium hover:underline truncate block max-w-[180px]">
                              {decodeURIComponent(existing.fileName)}
                            </a>
                            <span className="text-[10px] text-slate-400">Sub-topic: {existing.subTopicSlug}</span>
                          </div>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        </div>
                      </div>
                    )}

                    <div
                      className={cn(
                        'border-2 border-dashed rounded-lg p-3 text-center transition-colors',
                        file ? 'border-brand-200 bg-brand-50/30' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50',
                        isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                      )}
                      onClick={() => {
                        if (isProcessing) return;
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = '.html,.htm';
                        input.onchange = (e: any) => { const f = e.target?.files?.[0]; if (f) handleFileSelect(lang.id, f); };
                        input.click();
                      }}
                    >
                      {file ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-4 h-4 text-brand-600 flex-shrink-0" />
                          <span className="text-xs text-brand-700 font-medium truncate max-w-[150px]">{file.name}</span>
                          <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(0)}KB)</span>
                          {existing && <Badge variant="warning">Replace</Badge>}
                          {!isProcessing && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleFileSelect(lang.id, null); }} className="text-red-400 hover:text-red-600">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-4 h-4 text-slate-300 mx-auto mb-1" />
                          <p className="text-xs text-slate-500">
                            {existing
                              ? 'Upload new .html to replace'
                              : isEnglish ? <><strong>Upload .html</strong> (required)</> : 'Upload .html file'}
                          </p>
                        </div>
                      )}
                    </div>
                    {isEnglish && !hasAttachment && (
                      <p className="text-[10px] text-amber-600 mt-1.5 text-center font-medium">English file is required — AI generates sub-topic from this</p>
                    )}
                    {isEnglish && file && (
                      <p className="text-[10px] text-emerald-600 mt-1.5 text-center font-medium">
                        {existing ? 'New file will replace existing — AI will re-generate sub-topic' : 'AI will create sub-topic + translation from this file'}
                      </p>
                    )}
                    {!isEnglish && !existing && (
                      <p className="text-[10px] text-slate-400 mt-1.5 text-center">Translation auto-generated from English. File stored as page.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Results */}
          {(step === 'done' || resultSubTopic) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Sub-topic created */}
              {resultSubTopic && (
                <div className="px-5 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-bold text-slate-800">Sub-Topic: {resultSubTopic.name}</span>
                    <Badge variant="muted">{resultSubTopic.slug}</Badge>
                    <Badge variant={resultSubTopic.is_new ? 'success' : 'info'}>{resultSubTopic.is_new ? 'new' : 'existing'}</Badge>
                  </div>

                  {/* Translation badges */}
                  {translationResults.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 ml-7">
                      {translationResults.map((tr, j) => (
                        <span key={j} className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full font-medium',
                          tr.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        )}>
                          {tr.status === 'success' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                          {tr.iso_code} — {tr.language}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 'done' && (
                <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">
                    Complete! 1 sub-topic, {1 + translationResults.filter(r => r.status === 'success').length} translations{pagesUploaded > 0 ? `, ${pagesUploaded} page file${pagesUploaded > 1 ? 's' : ''}` : ''}.
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!selectedTopic && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a Topic to begin</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Choose a Subject, Chapter, and Topic above. Then upload HTML files to auto-generate a sub-topic and translate to all active languages.
          </p>
        </div>
      )}
    </div>
  );
}
