"use client";
import { useState, useEffect, useCallback } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Code2, FileText, Briefcase, Rocket, Languages,
  BookOpen, Lightbulb, FileCode, Paperclip, ExternalLink,
  Loader2, ChevronLeft, ChevronRight, X, Download,
  Video, Github, Archive, File, Image as ImageIcon,
  Globe, ClipboardList
} from 'lucide-react';

/* ─── highlight.js (reuse same setup as QuestionViewDialog) ─── */
import hljs from 'highlight.js/lib/core';
import hljsJavascript from 'highlight.js/lib/languages/javascript';
import hljsTypescript from 'highlight.js/lib/languages/typescript';
import hljsPython from 'highlight.js/lib/languages/python';
import hljsJava from 'highlight.js/lib/languages/java';
import hljsXml from 'highlight.js/lib/languages/xml';
import hljsCss from 'highlight.js/lib/languages/css';
import hljsSql from 'highlight.js/lib/languages/sql';
import hljsBash from 'highlight.js/lib/languages/bash';
import hljsJson from 'highlight.js/lib/languages/json';
import hljsCpp from 'highlight.js/lib/languages/cpp';
import hljsC from 'highlight.js/lib/languages/c';
import hljsCsharp from 'highlight.js/lib/languages/csharp';
import hljsGo from 'highlight.js/lib/languages/go';
import hljsRust from 'highlight.js/lib/languages/rust';
import hljsKotlin from 'highlight.js/lib/languages/kotlin';
import hljsDart from 'highlight.js/lib/languages/dart';
import 'highlight.js/styles/atom-one-light.css';

// Register languages (idempotent — safe if already registered by QuestionViewDialog)
const langs: [string, any][] = [
  ['javascript', hljsJavascript], ['typescript', hljsTypescript], ['python', hljsPython],
  ['java', hljsJava], ['xml', hljsXml], ['css', hljsCss], ['sql', hljsSql],
  ['bash', hljsBash], ['json', hljsJson], ['cpp', hljsCpp], ['c', hljsC],
  ['csharp', hljsCsharp], ['go', hljsGo], ['rust', hljsRust], ['kotlin', hljsKotlin],
  ['dart', hljsDart],
];
langs.forEach(([name, mod]) => { if (!hljs.getLanguage(name)) hljs.registerLanguage(name, mod); });

/* ─── Types ─── */
export type AssessmentType = 'exercise' | 'assignment' | 'mini_project' | 'capstone_project';

interface AssessmentViewDialogProps {
  open: boolean;
  onClose: () => void;
  assessmentType: AssessmentType;
  assessmentId: number | null;
  assessmentCode?: string;
}

interface TranslationData {
  id: number;
  language_id: number;
  title: string;
  description?: string | null;
  instructions?: string | null;
  html_content?: string | null;
  tech_stack?: string[] | null;
  learning_outcomes?: string[] | null;
  image_1?: string | null;
  image_2?: string | null;
}

interface AttachmentData {
  id: number;
  attachment_type: string;
  file_url?: string | null;
  github_url?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  display_order: number;
  translations: { id: number; language_id: number; title: string; description?: string | null }[];
}

interface SolutionData {
  id: number;
  solution_type: string;
  file_url?: string | null;
  github_url?: string | null;
  video_url?: string | null;
  zip_url?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  video_duration_seconds?: number | null;
  display_order: number;
  translations: {
    id: number; language_id: number; title: string; description?: string | null;
    html_content?: string | null; video_title?: string | null;
    video_description?: string | null; video_thumbnail?: string | null;
  }[];
}

interface LangView {
  language_id: number;
  language_name: string;
  iso_code: string;
  translation?: TranslationData;
}

interface AssessmentMeta {
  id: number;
  code: string;
  slug: string;
  assessment_type: string;
  assessment_scope: string;
  content_type: string;
  difficulty_level: string;
  points: number;
  time_limit_minutes?: number | null;
  max_attempts?: number | null;
  is_active: boolean;
  sub_topics?: { name: string } | null;
  topics?: { name: string } | null;
  chapters?: { name: string } | null;
  courses?: { name: string } | null;
}

/* ─── Config ─── */
const TYPE_CONFIG: Record<AssessmentType, { label: string; icon: any; color: string; scopeLabel: string }> = {
  exercise:         { label: 'Exercise',         icon: Code2,     color: 'bg-green-50 text-green-700 border-green-200',  scopeLabel: 'Sub-Topic' },
  assignment:       { label: 'Assignment',       icon: FileText,  color: 'bg-blue-50 text-blue-700 border-blue-200',     scopeLabel: 'Topic' },
  mini_project:     { label: 'Mini Project',     icon: Briefcase, color: 'bg-amber-50 text-amber-700 border-amber-200',  scopeLabel: 'Chapter' },
  capstone_project: { label: 'Capstone Project', icon: Rocket,    color: 'bg-purple-50 text-purple-700 border-purple-200', scopeLabel: 'Course' },
};

const DIFF_COLORS: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

const ATTACHMENT_TYPE_ICONS: Record<string, any> = {
  coding_file: FileCode,
  github_link: Github,
  pdf: File,
  image: ImageIcon,
  other: Paperclip,
};

const SOLUTION_TYPE_ICONS: Record<string, any> = {
  html: Globe,
  coding_file: FileCode,
  github_link: Github,
  pdf: File,
  image: ImageIcon,
  video: Video,
  zip: Archive,
  other: FileCode,
};

/* ─── Helpers ─── */
function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function highlightCode(code: string, lang: string): string {
  const key = lang.toLowerCase();
  if (hljs.getLanguage(key)) {
    return hljs.highlight(code, { language: key }).value;
  }
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const highlighted = highlightCode(code, lang);
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-slate-200">
      <div className="px-3 py-1 text-[10px] text-slate-500 bg-slate-50 border-b border-slate-200 uppercase tracking-wider flex items-center justify-between" style={{ fontFamily: "Fira Code, monospace" }}>
        <span>{lang}</span>
        <button type="button" className="text-slate-400 hover:text-slate-700 transition-colors text-[10px]" onClick={() => navigator.clipboard?.writeText(code)}>Copy</button>
      </div>
      <pre className="!m-0 !rounded-none !border-0 !p-3 !overflow-x-auto !text-sm !leading-relaxed" style={{ background: '#fafafa', fontFamily: "Fira Code, monospace", fontWeight: 500 }}>
        <code className={`language-${lang}`} dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, j) => {
        if (p.startsWith('`') && p.endsWith('`')) {
          return <code key={j} className="px-1.5 py-0.5 rounded bg-slate-100 text-pink-600 text-[0.9em] border border-slate-200" style={{ fontFamily: "Fira Code, monospace" }}>{p.slice(1, -1)}</code>;
        }
        return <span key={j}>{p}</span>;
      })}
    </>
  );
}

function MarkdownText({ text, className }: { text: string; className?: string }) {
  if (text.includes('```')) {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return (
      <div className={cn('whitespace-pre-wrap', className)}>
        {parts.map((part, i) => {
          const m = part.match(/^```(\w*)\n?([\s\S]*?)\n?```$/);
          if (m) return <CodeBlock key={i} code={m[2]} lang={m[1] || 'plaintext'} />;
          return <span key={i}><InlineText text={part} /></span>;
        })}
      </div>
    );
  }
  return <div className={cn('whitespace-pre-wrap', className)}><InlineText text={text} /></div>;
}

function HtmlPreview({ html }: { html: string }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
        <Globe className="w-3 h-3 text-slate-400" />
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">HTML Preview</span>
      </div>
      <div
        className="p-4 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/* ─── Component ─── */
export function AssessmentViewDialog({ open, onClose, assessmentType, assessmentId, assessmentCode }: AssessmentViewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<AssessmentMeta | null>(null);
  const [langViews, setLangViews] = useState<LangView[]>([]);
  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const [solutions, setSolutions] = useState<SolutionData[]>([]);
  const [activeLang, setActiveLang] = useState(0);

  const fetchData = useCallback(async () => {
    if (!assessmentId) return;
    setLoading(true);
    setLangViews([]);
    setAttachments([]);
    setSolutions([]);
    setActiveLang(0);

    try {
      const res = await api.getAssessmentFull(assessmentId);
      if (!res.success || !res.data) return;

      const d = res.data;
      setMeta({
        id: d.id,
        code: d.code,
        slug: d.slug,
        assessment_type: d.assessment_type,
        assessment_scope: d.assessment_scope,
        content_type: d.content_type,
        difficulty_level: d.difficulty_level,
        points: d.points,
        time_limit_minutes: d.time_limit_minutes,
        max_attempts: d.max_attempts,
        is_active: d.is_active,
        sub_topics: d.sub_topics,
        topics: d.topics,
        chapters: d.chapters,
        courses: d.courses,
      });

      // Build language views from translation_coverage + translations
      const translations: TranslationData[] = d.translations || [];
      const coverage: { language_id: number; language_name: string; language_code: string; has_translation: boolean }[] = d.translation_coverage || [];

      const views: LangView[] = coverage
        .filter((c: any) => c.has_translation)
        .map((c: any) => ({
          language_id: c.language_id,
          language_name: c.language_name,
          iso_code: c.language_code,
          translation: translations.find((t: any) => t.language_id === c.language_id),
        }))
        .sort((a, b) => {
          if (a.iso_code === 'en') return -1;
          if (b.iso_code === 'en') return 1;
          return a.language_name.localeCompare(b.language_name);
        });

      // If no translations yet, still show untranslated languages
      if (views.length === 0) {
        coverage.sort((a: any, b: any) => {
          if (a.language_code === 'en') return -1;
          if (b.language_code === 'en') return 1;
          return a.language_name.localeCompare(b.language_name);
        }).forEach((c: any) => {
          views.push({
            language_id: c.language_id,
            language_name: c.language_name,
            iso_code: c.language_code,
          });
        });
      }

      setLangViews(views);
      setAttachments(d.attachments || []);
      setSolutions(d.solutions || []);
    } catch (e) {
      console.error('Failed to load assessment view:', e);
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    if (open && assessmentId) fetchData();
  }, [open, assessmentId, fetchData]);

  const config = TYPE_CONFIG[assessmentType];
  const Icon = config.icon;
  const current = langViews[activeLang];
  const trans = current?.translation;

  // Get scope name from meta
  const scopeName = meta?.sub_topics?.name || meta?.topics?.name || meta?.chapters?.name || meta?.courses?.name;

  return (
    <Dialog open={open} onClose={onClose} size="full">
      <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', config.color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                {assessmentCode || meta?.code || `Assessment #${assessmentId}`}
              </h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="default" className={cn('text-xs', config.color)}>{config.label}</Badge>
                {meta?.difficulty_level && (
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', DIFF_COLORS[meta.difficulty_level] || 'bg-slate-50 text-slate-600')}>
                    {meta.difficulty_level.charAt(0).toUpperCase() + meta.difficulty_level.slice(1)}
                  </span>
                )}
                {meta?.points != null && (
                  <span className="text-xs text-slate-500">{meta.points} pts</span>
                )}
                {meta?.content_type && (
                  <span className="text-xs text-slate-400 capitalize">{meta.content_type}</span>
                )}
                {meta?.time_limit_minutes && (
                  <span className="text-xs text-slate-400">{meta.time_limit_minutes} min</span>
                )}
                {meta?.max_attempts && (
                  <span className="text-xs text-slate-400">{meta.max_attempts} attempts</span>
                )}
                {scopeName && (
                  <span className="text-xs text-slate-400">
                    {config.scopeLabel}: <span className="text-slate-500 font-medium">{scopeName}</span>
                  </span>
                )}
                {meta && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded', meta.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                    {meta.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-1/2" />
          </div>
        ) : langViews.length === 0 ? (
          <div className="p-12 text-center">
            <Languages className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No translations found for this assessment.</p>
            <p className="text-slate-400 text-xs mt-1">Generate translations first using Auto Translate.</p>
          </div>
        ) : (
          <>
            {/* Language Tabs */}
            <div className="px-6 pt-3 pb-0 border-b border-slate-100 shrink-0 overflow-x-auto">
              <div className="flex gap-1">
                {langViews.map((lv, idx) => (
                  <button
                    key={lv.language_id}
                    onClick={() => setActiveLang(idx)}
                    className={cn(
                      'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap border-b-2 -mb-px',
                      idx === activeLang
                        ? 'text-brand-700 border-brand-500 bg-brand-50/50'
                        : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {lv.language_name}
                      {lv.iso_code && <span className="text-xs text-slate-400">({lv.iso_code})</span>}
                      {!lv.translation && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="No translation" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {current && (
                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <ClipboardList className="w-3.5 h-3.5" /> Title
                    </label>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      {trans?.title
                        ? <span className="text-base text-slate-900 font-medium">{trans.title}</span>
                        : <p className="text-slate-300 italic">No translation available</p>
                      }
                    </div>
                  </div>

                  {/* Description */}
                  {trans?.description && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <BookOpen className="w-3.5 h-3.5" /> Description
                      </label>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <MarkdownText text={trans.description} className="text-sm text-slate-700 leading-relaxed" />
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  {trans?.instructions && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Lightbulb className="w-3.5 h-3.5" /> Instructions
                      </label>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <MarkdownText text={trans.instructions} className="text-sm text-amber-800 leading-relaxed" />
                      </div>
                    </div>
                  )}

                  {/* HTML Content */}
                  {trans?.html_content && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Globe className="w-3.5 h-3.5" /> Content
                      </label>
                      <HtmlPreview html={trans.html_content} />
                    </div>
                  )}

                  {/* Tech Stack */}
                  {trans?.tech_stack && Array.isArray(trans.tech_stack) && trans.tech_stack.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Code2 className="w-3.5 h-3.5" /> Tech Stack
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {trans.tech_stack.map((t: string, i: number) => (
                          <span key={i} className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Learning Outcomes */}
                  {trans?.learning_outcomes && Array.isArray(trans.learning_outcomes) && trans.learning_outcomes.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <BookOpen className="w-3.5 h-3.5" /> Learning Outcomes
                      </label>
                      <div className="space-y-1.5">
                        {trans.learning_outcomes.map((lo: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                            <span>{lo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Images */}
                  {(trans?.image_1 || trans?.image_2) && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Images</label>
                      <div className="flex gap-4">
                        {trans.image_1 && (
                          <a href={trans.image_1} target="_blank" rel="noopener noreferrer">
                            <img src={trans.image_1} alt="Image 1" className="w-48 h-48 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                          </a>
                        )}
                        {trans.image_2 && (
                          <a href={trans.image_2} target="_blank" rel="noopener noreferrer">
                            <img src={trans.image_2} alt="Image 2" className="w-48 h-48 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ─── Attachments ─── */}
                  {attachments.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})
                      </label>
                      <div className="space-y-2">
                        {attachments.map((att) => {
                          const AttIcon = ATTACHMENT_TYPE_ICONS[att.attachment_type] || Paperclip;
                          // Find translation for current language
                          const attTrans = att.translations.find(t => t.language_id === current.language_id);
                          const attTitle = attTrans?.title || att.file_name || `Attachment #${att.id}`;
                          const attDesc = attTrans?.description;
                          const url = att.file_url || att.github_url;
                          const isGithub = att.attachment_type === 'github_link';

                          return (
                            <div key={att.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                <AttIcon className="w-4 h-4 text-slate-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-800 truncate">{attTitle}</span>
                                  <Badge variant="default" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">{att.attachment_type.replace(/_/g, ' ')}</Badge>
                                </div>
                                {attDesc && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{attDesc}</p>}
                                {att.file_size_bytes && <span className="text-[10px] text-slate-400">{formatBytes(att.file_size_bytes)}</span>}
                              </div>
                              {url && (
                                <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors shrink-0" title={isGithub ? 'Open on GitHub' : 'Download'}>
                                  {isGithub ? <Github className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ─── Solutions ─── */}
                  {solutions.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <FileCode className="w-3.5 h-3.5" /> Solutions ({solutions.length})
                      </label>
                      <div className="space-y-2">
                        {solutions.map((sol) => {
                          const SolIcon = SOLUTION_TYPE_ICONS[sol.solution_type] || FileCode;
                          // Find translation for current language
                          const solTrans = sol.translations.find(t => t.language_id === current.language_id);
                          const solTitle = solTrans?.title || sol.file_name || `Solution #${sol.id}`;
                          const solDesc = solTrans?.description;
                          const solHtml = solTrans?.html_content;
                          const url = sol.file_url || sol.github_url || sol.video_url || sol.zip_url;
                          const isGithub = sol.solution_type === 'github_link';
                          const isVideo = sol.solution_type === 'video';

                          return (
                            <div key={sol.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                              <div className="flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors">
                                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                                  isVideo ? 'bg-red-50' : isGithub ? 'bg-gray-100' : 'bg-emerald-50'
                                )}>
                                  <SolIcon className={cn('w-4 h-4',
                                    isVideo ? 'text-red-500' : isGithub ? 'text-gray-600' : 'text-emerald-600'
                                  )} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-800 truncate">{solTitle}</span>
                                    <Badge variant="default" className="text-[10px] bg-slate-100 text-slate-500 border-slate-200">{sol.solution_type.replace(/_/g, ' ')}</Badge>
                                  </div>
                                  {solDesc && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{solDesc}</p>}
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {sol.file_size_bytes && <span className="text-[10px] text-slate-400">{formatBytes(sol.file_size_bytes)}</span>}
                                    {sol.video_duration_seconds && <span className="text-[10px] text-slate-400">{formatDuration(sol.video_duration_seconds)}</span>}
                                    {sol.mime_type && <span className="text-[10px] text-slate-400">{sol.mime_type}</span>}
                                  </div>
                                </div>
                                {url && (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors shrink-0" title={isGithub ? 'Open on GitHub' : isVideo ? 'Watch Video' : 'Download'}>
                                    {isGithub ? <Github className="w-4 h-4" /> : isVideo ? <Video className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                                  </a>
                                )}
                              </div>
                              {/* Inline HTML content preview for solution */}
                              {solHtml && (
                                <div className="border-t border-slate-100 p-3">
                                  <HtmlPreview html={solHtml} />
                                </div>
                              )}
                              {/* Video thumbnail */}
                              {solTrans?.video_thumbnail && (
                                <div className="border-t border-slate-100 p-3">
                                  <a href={sol.video_url || '#'} target="_blank" rel="noopener noreferrer">
                                    <img src={solTrans.video_thumbnail} alt={solTrans.video_title || 'Video'} className="w-full max-w-sm rounded-lg border border-slate-200" />
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer with language nav */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveLang(Math.max(0, activeLang - 1))}
                  disabled={activeLang === 0}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500">
                  {activeLang + 1} / {langViews.length} languages
                </span>
                <button
                  onClick={() => setActiveLang(Math.min(langViews.length - 1, activeLang + 1))}
                  disabled={activeLang === langViews.length - 1}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {attachments.length > 0 && (
                  <span className="text-xs text-slate-400"><Paperclip className="w-3 h-3 inline mr-0.5" />{attachments.length} attachment{attachments.length > 1 ? 's' : ''}</span>
                )}
                {solutions.length > 0 && (
                  <span className="text-xs text-slate-400"><FileCode className="w-3 h-3 inline mr-0.5" />{solutions.length} solution{solutions.length > 1 ? 's' : ''}</span>
                )}
                <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
