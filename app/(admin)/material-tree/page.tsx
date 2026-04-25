"use client";
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCcw, Loader2, FolderTree, HardDrive, FileText, Image, FileCode, ExternalLink, Trash2, BookOpen, Layers, Hash, Languages, FolderArchive, CloudDownload, Sparkles, CheckCircle, AlertCircle, X, Upload, Video, FolderPlus, Search, Minus, Check, Square, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastChanged: string;
  children?: TreeNode[];
  dbId?: number;
  type?: 'subject' | 'chapter' | 'topic' | 'sub_topic' | 'language' | 'resources' | 'file';
}

interface TreeStats {
  totalFolders: number;
  totalFiles: number;
  totalSize: number;
  totalTranslations: number;
  subjects: number;
  chapters: number;
  topics: number;
  subTopics: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['html', 'htm'].includes(ext || '')) return <FileCode className="w-4 h-4 text-orange-500" />;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext || '')) return <Image className="w-4 h-4 text-green-500" />;
  if (['txt', 'md', 'csv'].includes(ext || '')) return <FileText className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-slate-400" />;
}

// Depth/type-based color coding
function getTypeColor(type?: string, depth?: number) {
  const colors: Record<string, { bg: string; text: string; border: string; label: string }> = {
    subject:   { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Subject' },
    chapter:   { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Chapter' },
    topic:     { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Topic' },
    language:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Language' },
    resources: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Resources' },
  };
  if (type && colors[type]) return colors[type];
  // Fallback by depth
  const depthColors = [
    colors.subject, colors.chapter, colors.topic, colors.language,
  ];
  return depthColors[Math.min(depth || 0, depthColors.length - 1)];
}

// Count all descendants recursively
function countDescendants(node: TreeNode): { folders: number; files: number } {
  let folders = 0, files = 0;
  if (node.children) {
    for (const child of node.children) {
      if (child.isDirectory) {
        folders++;
        const sub = countDescendants(child);
        folders += sub.folders;
        files += sub.files;
      } else {
        files++;
      }
    }
  }
  return { folders, files };
}

function TreeNodeItem({ node, depth, onDelete }: { node: TreeNode; depth: number; onDelete: (path: string, name: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const color = getTypeColor(node.type, depth);
  const hasChildren = node.isDirectory && node.children && node.children.length > 0;
  const isEmpty = node.isDirectory && node.children && node.children.length === 0;

  if (node.isDirectory) {
    const directFolders = node.children?.filter(c => c.isDirectory).length || 0;
    const directFiles = node.children?.filter(c => !c.isDirectory).length || 0;
    const desc = countDescendants(node);

    return (
      <div>
        <div className="flex items-center group">
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-slate-50',
              expanded && hasChildren && 'bg-slate-50/50'
            )}
            style={{ paddingLeft: `${depth * 20 + 12}px` }}
          >
            {hasChildren ? (
              expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            {node.type === 'language' ? <Languages className={cn('w-4 h-4 shrink-0', color.text)} /> :
             node.type === 'resources' ? <FolderArchive className={cn('w-4 h-4 shrink-0', color.text)} /> :
             <FolderOpen className={cn('w-4 h-4 shrink-0', color.text)} />}
            <span className={cn('font-medium', color.text)}>{node.name}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', color.bg, color.text, color.border, 'border')}>
              {color.label}
            </span>
            <span className="text-xs text-slate-400 ml-auto flex items-center gap-2">
              {directFolders > 0 && <span>{directFolders} {node.type === 'subject' ? 'ch' : node.type === 'chapter' ? 'tp' : node.type === 'topic' ? 'folder' : node.type === 'language' ? 'file' : 'item'}{directFolders !== 1 ? 's' : ''}</span>}
              {directFiles > 0 && <span>{directFiles} file{directFiles !== 1 ? 's' : ''}</span>}
              {desc.files > 0 && depth < 2 && <span className="text-slate-300">({desc.files} total files)</span>}
              {isEmpty && <span className="text-amber-500 italic">empty</span>}
            </span>
          </button>
          {node.type === 'subject' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(node.path, node.name); }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 mr-2 rounded hover:bg-red-50"
              title={`Delete CDN folder "${node.name}"`}
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
            </button>
          )}
        </div>
        {expanded && hasChildren && (
          <div>
            {node.children!.map((child, i) => (
              <TreeNodeItem key={child.dbId || i} node={child} depth={depth + 1} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node — path is the full CDN URL for page files
  const isFullUrl = node.path.startsWith('http');
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg group"
      style={{ paddingLeft: `${depth * 20 + 12 + 18}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
      {node.size > 0 && <span className="text-xs text-slate-400 ml-auto shrink-0">{formatBytes(node.size)}</span>}
      {isFullUrl && (
        <a href={node.path} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto" title="Open file">
          <ExternalLink className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700" />
        </a>
      )}
    </div>
  );
}

interface ImportReport {
  sync_mode?: string;
  subjects: { found: number; created: number; existing: number; updated?: number };
  chapters: { found: number; created: number; existing: number; updated?: number; deleted?: number; unchanged?: number };
  topics: { found: number; created: number; existing: number; updated?: number; deleted?: number; unchanged?: number };
  sub_topics: { found: number; created: number; existing: number; updated?: number; deleted?: number; unchanged?: number };
  translations: { found: number; created: number; existing: number; updated: number; deactivated?: number };
  videos: { found: number; matched: number; uploaded: number; replaced?: number; status_checked?: number; now_ready?: number; errors: number };
  errors: string[];
}

// CDN scan tree types
interface CdnSubTopic { order: number; name: string }
interface CdnTopic { order: number; name: string; subTopics: CdnSubTopic[] }
interface CdnChapter { order: number; name: string; topics: CdnTopic[] }
interface CdnCourse { folderName: string; name: string; chapters: CdnChapter[]; totalChapters: number; totalTopics: number; totalSubTopics: number }

interface ScaffoldResult {
  course: string;
  folders_created: number;
  txt_uploaded: string;
  folder_paths: string[];
}

export default function MaterialTreePage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loadTime, setLoadTime] = useState<number>(0);

  // Import from CDN state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importTab, setImportTab] = useState<'scaffold' | 'import'>('import');
  const [importing, setImporting] = useState(false);
  const [importProvider, setImportProvider] = useState<string>('gemini');
  const [importGenerateSeo, setImportGenerateSeo] = useState(false);
  const [importUploadVideos, setImportUploadVideos] = useState(true);
  const [importSyncMode, setImportSyncMode] = useState<string>('create_only');
  const [importAutoDelete, setImportAutoDelete] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

  // CDN scan / course selection state
  const [scanning, setScanning] = useState(false);
  const [cdnCourses, setCdnCourses] = useState<CdnCourse[]>([]);
  const [cdnScanErrors, setCdnScanErrors] = useState<string[]>([]);
  const [cdnSelection, setCdnSelection] = useState<Record<string, boolean>>({});
  const [cdnExpanded, setCdnExpanded] = useState<Record<string, boolean>>({});

  // Video status check
  const [checkingVideos, setCheckingVideos] = useState(false);

  // Clean orphaned videos state
  const [cleaning, setCleaning] = useState(false);
  const [cleanReport, setCleanReport] = useState<any>(null);

  // Scaffold CDN state
  const [scaffolding, setScaffolding] = useState(false);
  const [scaffoldTxt, setScaffoldTxt] = useState('');
  const [scaffoldResult, setScaffoldResult] = useState<ScaffoldResult | null>(null);

  const router = useRouter();

  useKeyboardShortcuts([
    { key: 'r', action: () => loadTree() },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/categories') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  async function loadTree() {
    setLoading(true);
    const start = Date.now();
    try {
      const res = await api.getFullMaterialTree();
      if (res.success && res.data) {
        setTree(res.data.tree || []);
        setStats(res.data.stats || null);
        setLoadTime(Date.now() - start);
      } else {
        toast.error(res.message || 'Failed to load material tree');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load');
    }
    setLoading(false);
  }

  async function handleDeleteFolder(path: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete the CDN folder "${name}" and all its contents?\n\nThis only removes files from Bunny CDN — database records are not affected.`)) return;
    setDeleting(path);
    try {
      const res = await api.deleteMaterialFolder(path);
      if (res.success) {
        toast.success(`CDN folder "${name}" deleted`);
        loadTree();
      } else {
        toast.error(res.message || 'Failed to delete folder');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete folder');
    }
    setDeleting(null);
  }

  async function handleImportFromCdn(mode?: string) {
    const syncMode = mode || importSyncMode;
    setImporting(true);
    setImportReport(null);
    try {
      const selectedItems = getSelectedItems();
      const res = await api.importFromCdn({
        provider: importProvider,
        generate_seo: importGenerateSeo,
        upload_videos: importUploadVideos,
        sync_mode: syncMode,
        auto_delete: importAutoDelete,
        selected_items: selectedItems.length > 0 ? selectedItems : undefined,
      });
      if (res.success && res.data?.report) {
        setImportReport(res.data.report);
        toast.success(syncMode === 'dry_run' ? 'Dry run completed — no changes made' : 'CDN import completed');
        if (syncMode !== 'dry_run') loadTree();
      } else {
        toast.error(res.message || 'CDN import failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'CDN import failed');
    }
    setImporting(false);
  }

  async function handleCheckVideoStatus() {
    setCheckingVideos(true);
    try {
      const res = await api.checkVideoStatus();
      if (res.success && res.data?.report) {
        const r = res.data.report;
        toast.success(`Checked ${r.checked} videos: ${r.ready} ready, ${r.still_pending} pending, ${r.failed} failed`);
      } else {
        toast.error(res.message || 'Video status check failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Video status check failed');
    }
    setCheckingVideos(false);
  }

  async function handleCleanOrphanedVideos(dryRun: boolean) {
    setCleaning(true);
    setCleanReport(null);
    try {
      const res = await api.cleanOrphanedVideos({ dry_run: dryRun });
      if (res.success && res.data?.report) {
        setCleanReport(res.data.report);
        toast.success(res.message || (dryRun ? 'Scan completed' : 'Cleanup completed'));
      } else {
        toast.error(res.message || 'Cleanup failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Cleanup failed');
    }
    setCleaning(false);
  }

  async function handleScaffoldCdn() {
    if (!scaffoldTxt.trim()) { toast.error('Paste or upload the .txt course content'); return; }
    setScaffolding(true);
    setScaffoldResult(null);
    try {
      const res = await api.scaffoldCdn({ txt_content: scaffoldTxt });
      if (res.success && res.data) {
        setScaffoldResult(res.data);
        toast.success(`CDN structure created for "${res.data.course}"`);
        loadTree();
      } else {
        toast.error(res.message || 'Scaffold failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Scaffold failed');
    }
    setScaffolding(false);
  }

  // ─── CDN Scan + Selection Helpers ───
  async function handleScanCdn() {
    setScanning(true);
    setCdnCourses([]);
    setCdnScanErrors([]);
    setCdnSelection({});
    setCdnExpanded({});
    try {
      const res = await api.scanCdn();
      if (res.success && res.data) {
        const courses: CdnCourse[] = res.data.courses || [];
        setCdnCourses(courses);
        setCdnScanErrors(res.data.errors || []);
        // Default: all courses selected, all expanded
        const sel: Record<string, boolean> = {};
        const exp: Record<string, boolean> = {};
        for (const course of courses) {
          const ck = course.folderName;
          sel[ck] = true;
          exp[ck] = false; // collapsed by default
          for (const ch of course.chapters) {
            const chk = `${ck}/${ch.name}`;
            sel[chk] = true;
            for (const tp of ch.topics) {
              const tpk = `${chk}/${tp.name}`;
              sel[tpk] = true;
              for (const st of tp.subTopics) {
                sel[`${tpk}/${st.name}`] = true;
              }
            }
          }
        }
        setCdnSelection(sel);
        setCdnExpanded(exp);
        if (courses.length === 0) toast.error('No course folders found on CDN');
      } else {
        toast.error(res.message || 'CDN scan failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'CDN scan failed');
    }
    setScanning(false);
  }

  function toggleCdnExpand(key: string) {
    setCdnExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Toggle selection of an item and cascade to all descendants
  function toggleCdnSelect(key: string) {
    setCdnSelection(prev => {
      const next = { ...prev };
      const newVal = !prev[key];
      // Toggle this item and all children whose key starts with this key + "/"
      for (const k of Object.keys(next)) {
        if (k === key || k.startsWith(key + '/')) {
          next[k] = newVal;
        }
      }
      return next;
    });
  }

  // Select all / deselect all
  function selectAllCdn(val: boolean) {
    setCdnSelection(prev => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = val;
      return next;
    });
  }

  // Check state for a parent: true = all children checked, false = none, 'indeterminate' = some
  function getCdnCheckState(key: string): boolean | 'indeterminate' {
    const childKeys = Object.keys(cdnSelection).filter(k => k.startsWith(key + '/'));
    if (childKeys.length === 0) return cdnSelection[key] ?? false;
    const checkedCount = childKeys.filter(k => cdnSelection[k]).length;
    if (checkedCount === 0) return false;
    if (checkedCount === childKeys.length) return true;
    return 'indeterminate';
  }

  // Get selected items with granular chapter + topic selection
  function getSelectedItems(): { course: string; chapters?: { name: string; topics?: string[] }[] }[] {
    return cdnCourses
      .filter(c => {
        const ck = c.folderName;
        return Object.keys(cdnSelection).some(k => (k === ck || k.startsWith(ck + '/')) && cdnSelection[k]);
      })
      .map(c => {
        const ck = c.folderName;
        // Check if ALL chapters are fully selected (= import all)
        const allChaptersSelected = c.chapters.length > 0 && c.chapters.every(ch => {
          const chk = `${ck}/${ch.name}`;
          return getCdnCheckState(chk) === true;
        });
        if (allChaptersSelected) return { course: c.folderName };
        // Otherwise, find which chapters have any selection
        const selectedChapters = c.chapters
          .filter(ch => {
            const chk = `${ck}/${ch.name}`;
            return Object.keys(cdnSelection).some(k => (k === chk || k.startsWith(chk + '/')) && cdnSelection[k]);
          })
          .map(ch => {
            const chk = `${ck}/${ch.name}`;
            // Check if ALL topics in this chapter are selected (= import all)
            const allTopicsSelected = ch.topics.length > 0 && ch.topics.every(tp => {
              const tpk = `${chk}/${tp.name}`;
              return getCdnCheckState(tpk) === true;
            });
            if (allTopicsSelected) return { name: ch.name };
            // Otherwise, find which topics are selected (partial selection)
            const selectedTopics = ch.topics
              .filter(tp => {
                const tpk = `${chk}/${tp.name}`;
                return Object.keys(cdnSelection).some(k => (k === tpk || k.startsWith(tpk + '/')) && cdnSelection[k]);
              })
              .map(tp => tp.name);
            return { name: ch.name, topics: selectedTopics };
          });
        return { course: c.folderName, chapters: selectedChapters };
      });
  }

  // Backward compat helper for button count
  function getSelectedCourseCount(): number {
    return getSelectedItems().length;
  }

  // Get selection summary counts
  function getSelectionSummary() {
    let courses = 0, chapters = 0, topics = 0, subTopics = 0;
    for (const course of cdnCourses) {
      const ck = course.folderName;
      let courseHasAny = false;
      for (const ch of course.chapters) {
        const chk = `${ck}/${ch.name}`;
        let chapterHasAny = false;
        for (const tp of ch.topics) {
          const tpk = `${chk}/${tp.name}`;
          let topicHasAny = false;
          for (const st of tp.subTopics) {
            if (cdnSelection[`${tpk}/${st.name}`]) { subTopics++; topicHasAny = true; }
          }
          // A topic counts if it's selected OR has selected sub-topics
          if (cdnSelection[tpk] || topicHasAny) { topics++; chapterHasAny = true; }
        }
        if (cdnSelection[chk] || chapterHasAny) { chapters++; courseHasAny = true; }
      }
      if (cdnSelection[ck] || courseHasAny) courses++;
    }
    return { courses, chapters, topics, subTopics };
  }

  // Checkbox icon helper
  function CheckboxIcon({ state }: { state: boolean | 'indeterminate' }) {
    if (state === 'indeterminate') return <div className="w-4 h-4 rounded border-2 border-indigo-400 bg-indigo-100 flex items-center justify-center"><Minus className="w-3 h-3 text-indigo-600" /></div>;
    if (state) return <div className="w-4 h-4 rounded border-2 border-indigo-600 bg-indigo-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>;
    return <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white" />;
  }

  function handleTxtFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setScaffoldTxt(ev.target?.result as string || '');
    };
    reader.readAsText(file);
  }

  useEffect(() => { loadTree(); }, []);

  return (
    <div>
      <PageHeader
        title="Material Tree"
        description="Material hierarchy from database — subjects, chapters, topics, sub-topics, and uploaded pages"
        actions={
          <div className="flex items-center gap-2">
            {loadTime > 0 && !loading && (
              <span className="text-xs text-slate-400">{loadTime}ms</span>
            )}
            <Button variant="outline" onClick={handleCheckVideoStatus} disabled={loading || checkingVideos}>
              {checkingVideos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              Check Videos
            </Button>
            <Button variant="outline" onClick={() => { setShowImportDialog(true); setImportReport(null); setScaffoldResult(null); }} disabled={loading || importing}>
              <CloudDownload className="w-4 h-4" />
              Import / Sync
            </Button>
            <Button variant="outline" onClick={loadTree} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Refresh
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      {stats && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-lg">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Subjects</div>
              <div className="text-xl font-bold text-slate-800">{stats.subjects}</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-lg">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Chapters</div>
              <div className="text-xl font-bold text-slate-800">{stats.chapters}</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-purple-50 p-2.5 rounded-lg">
              <Hash className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Topics</div>
              <div className="text-xl font-bold text-slate-800">{stats.topics}</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-lg">
              <Languages className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Translations / Pages</div>
              <div className="text-xl font-bold text-slate-800">{stats.totalTranslations} / {stats.totalFiles}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tree View */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">materials/</span>
          <span className="text-xs text-slate-400 ml-1">Material hierarchy</span>
          {!loading && stats && (
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Subject</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Chapter</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Topic</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Language</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Resources</span>
            </div>
          )}
        </div>

        <div className="p-2 min-h-[300px]">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className={cn('h-8 rounded-lg', i % 4 === 0 ? 'w-full' : i % 4 === 1 ? 'w-11/12 ml-5' : i % 4 === 2 ? 'w-10/12 ml-10' : 'w-9/12 ml-10')} />
              ))}
            </div>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FolderOpen className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No materials found</p>
              <p className="text-xs mt-1">Create subjects, chapters, and topics to see their hierarchy here</p>
            </div>
          ) : (
            tree.map((node, i) => (
              <TreeNodeItem key={node.dbId || i} node={node} depth={0} onDelete={handleDeleteFolder} />
            ))
          )}
        </div>
      </div>

      {/* Import / Scaffold CDN Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CloudDownload className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-800">CDN Tools</h2>
              </div>
              <button onClick={() => setShowImportDialog(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setImportTab('import')}
                className={cn('flex-1 py-3 text-sm font-medium text-center transition-colors', importTab === 'import' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700')}
              >
                <CloudDownload className="w-4 h-4 inline mr-1.5" />Import from CDN
              </button>
              <button
                onClick={() => setImportTab('scaffold')}
                className={cn('flex-1 py-3 text-sm font-medium text-center transition-colors', importTab === 'scaffold' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700')}
              >
                <FolderPlus className="w-4 h-4 inline mr-1.5" />Scaffold CDN
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* ─── Import Tab ─── */}
              {importTab === 'import' && !importReport && (
                <>
                  {/* Step 1: Scan CDN or show course picker */}
                  {cdnCourses.length === 0 && !scanning ? (
                    <>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
                        <p className="font-medium mb-1">How it works</p>
                        <p>First, scan the CDN to discover course folders. Then select which courses to import. Only selected courses will be processed.</p>
                        <p className="mt-2 text-xs text-indigo-600">Expected: <code>CourseName/CourseName.txt</code> + <code>01_Chapter/01_Topic/en/01_SubTopic.html</code></p>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
                        <Button onClick={handleScanCdn}>
                          <Search className="w-4 h-4" />
                          Scan CDN
                        </Button>
                      </div>
                    </>
                  ) : scanning ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      <p className="text-sm text-slate-600">Scanning CDN for course folders...</p>
                    </div>
                  ) : (
                    <>
                      {/* Step 2: Course picker tree with checkboxes */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-700">
                          {cdnCourses.length} course{cdnCourses.length !== 1 ? 's' : ''} found on CDN
                        </p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => selectAllCdn(true)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Select All</button>
                          <span className="text-slate-300">|</span>
                          <button onClick={() => selectAllCdn(false)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Deselect All</button>
                          <span className="text-slate-300">|</span>
                          <button onClick={handleScanCdn} className="text-xs text-slate-500 hover:text-slate-700 font-medium flex items-center gap-1">
                            <RefreshCcw className="w-3 h-3" /> Rescan
                          </button>
                        </div>
                      </div>

                      {/* Selection summary */}
                      {(() => {
                        const s = getSelectionSummary();
                        return (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center gap-3">
                            <span className="font-medium text-slate-700">Selected:</span>
                            <span className="text-indigo-600 font-medium">{s.courses} courses</span>
                            <span>{s.chapters} chapters</span>
                            <span>{s.topics} topics</span>
                            <span>{s.subTopics} sub-topics</span>
                          </div>
                        );
                      })()}

                      {/* Course tree with checkboxes */}
                      <div className="border border-slate-200 rounded-xl max-h-[320px] overflow-y-auto divide-y divide-slate-100">
                        {cdnCourses.map(course => {
                          const ck = course.folderName;
                          const courseState = getCdnCheckState(ck);
                          const isExpanded = cdnExpanded[ck];
                          return (
                            <div key={ck}>
                              {/* Course row */}
                              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 cursor-pointer" onClick={() => toggleCdnExpand(ck)}>
                                <button onClick={(e) => { e.stopPropagation(); toggleCdnSelect(ck); }} className="shrink-0">
                                  <CheckboxIcon state={courseState} />
                                </button>
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                                <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span className="text-sm font-medium text-slate-800 truncate">{course.name}</span>
                                <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                                  {course.totalChapters} ch · {course.totalTopics} tp · {course.totalSubTopics} st
                                </span>
                              </div>

                              {/* Chapters */}
                              {isExpanded && course.chapters.map(ch => {
                                const chk = `${ck}/${ch.name}`;
                                const chState = getCdnCheckState(chk);
                                const chExpanded = cdnExpanded[chk];
                                return (
                                  <div key={chk}>
                                    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer" style={{ paddingLeft: 36 }} onClick={() => toggleCdnExpand(chk)}>
                                      <button onClick={(e) => { e.stopPropagation(); toggleCdnSelect(chk); }} className="shrink-0">
                                        <CheckboxIcon state={chState} />
                                      </button>
                                      {ch.topics.length > 0 ? (cdnExpanded[chk] ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />) : <span className="w-3.5" />}
                                      <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                      <span className="text-sm text-slate-700 truncate">{ch.order}. {ch.name}</span>
                                      <span className="ml-auto text-[10px] text-slate-400 shrink-0">{ch.topics.length} tp</span>
                                    </div>

                                    {/* Topics */}
                                    {chExpanded && ch.topics.map(tp => {
                                      const tpk = `${chk}/${tp.name}`;
                                      const tpState = getCdnCheckState(tpk);
                                      const tpExpanded = cdnExpanded[tpk];
                                      return (
                                        <div key={tpk}>
                                          <div className="flex items-center gap-2 px-3 py-1 hover:bg-slate-50 cursor-pointer" style={{ paddingLeft: 60 }} onClick={() => tp.subTopics.length > 0 && toggleCdnExpand(tpk)}>
                                            <button onClick={(e) => { e.stopPropagation(); toggleCdnSelect(tpk); }} className="shrink-0">
                                              <CheckboxIcon state={tpState} />
                                            </button>
                                            {tp.subTopics.length > 0 ? (tpExpanded ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />) : <span className="w-3" />}
                                            <Hash className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                            <span className="text-xs text-slate-600 truncate">{tp.order}. {tp.name}</span>
                                            {tp.subTopics.length > 0 && <span className="ml-auto text-[10px] text-slate-400 shrink-0">{tp.subTopics.length} st</span>}
                                          </div>

                                          {/* Sub-Topics */}
                                          {tpExpanded && tp.subTopics.map(st => {
                                            const stk = `${tpk}/${st.name}`;
                                            return (
                                              <div key={stk} className="flex items-center gap-2 px-3 py-0.5 hover:bg-slate-50" style={{ paddingLeft: 84 }}>
                                                <button onClick={() => toggleCdnSelect(stk)} className="shrink-0">
                                                  <CheckboxIcon state={cdnSelection[stk] ?? false} />
                                                </button>
                                                <span className="w-3" />
                                                <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="text-xs text-slate-500 truncate">{st.order}. {st.name}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>

                      {cdnScanErrors.length > 0 && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                          <p className="text-xs font-medium text-amber-800 mb-1">Scan Warnings ({cdnScanErrors.length})</p>
                          <div className="max-h-20 overflow-y-auto space-y-0.5">
                            {cdnScanErrors.map((e, i) => <p key={i} className="text-[10px] text-amber-600">{e}</p>)}
                          </div>
                        </div>
                      )}

                      {/* Import options */}
                      <div className="border-t border-slate-100 pt-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Import Mode</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { value: 'create_only', label: 'Create Only', desc: 'Only add new records' },
                              { value: 'sync', label: 'Full Sync', desc: 'Create + update + delete' },
                              { value: 'dry_run', label: 'Dry Run', desc: 'Preview, no changes' },
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => setImportSyncMode(opt.value)}
                                className={cn(
                                  'p-2.5 rounded-lg border text-left transition-colors',
                                  importSyncMode === opt.value
                                    ? 'border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200'
                                    : 'border-slate-200 hover:bg-slate-50'
                                )}
                              >
                                <div className="text-xs font-medium text-slate-700">{opt.label}</div>
                                <div className="text-[10px] text-slate-500 mt-0.5">{opt.desc}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {(importSyncMode === 'sync' || importSyncMode === 'dry_run') && (
                          <label className="flex items-center gap-3 p-3 border border-red-100 bg-red-50/50 rounded-lg cursor-pointer hover:bg-red-50">
                            <input type="checkbox" checked={importAutoDelete} onChange={e => setImportAutoDelete(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                            <div>
                              <div className="text-sm font-medium text-slate-700 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5 text-red-500" />Auto-delete removed items</div>
                              <div className="text-xs text-slate-500">Soft-delete items not found in the .txt file.</div>
                            </div>
                          </label>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                            <input type="checkbox" checked={importUploadVideos} onChange={e => setImportUploadVideos(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <div>
                              <div className="text-xs font-medium text-slate-700 flex items-center gap-1"><Video className="w-3.5 h-3.5 text-purple-500" />Upload videos</div>
                            </div>
                          </label>
                          <label className="flex items-center gap-2 p-2.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                            <input type="checkbox" checked={importGenerateSeo} onChange={e => setImportGenerateSeo(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                            <div>
                              <div className="text-xs font-medium text-slate-700 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500" />AI SEO</div>
                            </div>
                          </label>
                        </div>

                        {importGenerateSeo && (
                          <select value={importProvider} onChange={e => setImportProvider(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <option value="gemini">Google Gemini</option>
                            <option value="anthropic">Anthropic Claude</option>
                            <option value="openai">OpenAI GPT</option>
                          </select>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => { setShowImportDialog(false); setCdnCourses([]); }} disabled={importing}>Cancel</Button>
                        {importSyncMode !== 'dry_run' && (
                          <Button variant="outline" onClick={() => handleImportFromCdn('dry_run')} disabled={importing || getSelectedCourseCount() === 0}>
                            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            Dry Run
                          </Button>
                        )}
                        <Button onClick={() => handleImportFromCdn()} disabled={importing || getSelectedCourseCount() === 0}>
                          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                          {importing ? 'Processing...' : `Import ${getSelectedCourseCount()} Course${getSelectedCourseCount() !== 1 ? 's' : ''}`}
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Import Results */}
              {importTab === 'import' && importReport && (
                <>
                  <div className={cn(
                    'border rounded-xl p-4 flex items-center gap-3',
                    importReport.sync_mode === 'dry_run' ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
                  )}>
                    <CheckCircle className={cn('w-6 h-6 shrink-0', importReport.sync_mode === 'dry_run' ? 'text-amber-600' : 'text-green-600')} />
                    <div>
                      <p className={cn('font-medium', importReport.sync_mode === 'dry_run' ? 'text-amber-800' : 'text-green-800')}>
                        {importReport.sync_mode === 'dry_run' ? 'Dry Run Complete — No Changes Made' : importReport.sync_mode === 'sync' ? 'Sync Complete' : 'Import Complete'}
                      </p>
                      <p className={cn('text-sm', importReport.sync_mode === 'dry_run' ? 'text-amber-600' : 'text-green-600')}>
                        {importReport.sync_mode === 'dry_run' ? 'Preview of what would happen. Run again to apply.' : 'CDN scan finished. See results below.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(['subjects', 'chapters', 'topics', 'sub_topics', 'translations'] as const).map(key => {
                      const r = importReport[key] as any;
                      const label = key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                          <span className="font-medium text-slate-700">{label}</span>
                          <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                            {r.found > 0 && <span className="text-slate-500">Found: {r.found}</span>}
                            {r.created > 0 && <span className="text-green-600 font-medium">+{r.created}</span>}
                            {r.updated > 0 && <span className="text-blue-600 font-medium">~{r.updated}</span>}
                            {r.deleted > 0 && <span className="text-red-600 font-medium">-{r.deleted}</span>}
                            {r.deactivated > 0 && <span className="text-orange-600">Deactivated: {r.deactivated}</span>}
                            {r.existing > 0 && <span className="text-slate-400">Existing: {r.existing}</span>}
                            {r.unchanged > 0 && <span className="text-slate-300">Unchanged: {r.unchanged}</span>}
                          </div>
                        </div>
                      );
                    })}

                    {/* Videos row */}
                    {importReport.videos && (importReport.videos.found > 0 || importReport.videos.uploaded > 0) && (
                      <div className="flex items-center justify-between px-3 py-2 bg-purple-50 rounded-lg text-sm">
                        <span className="font-medium text-purple-700 flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Videos</span>
                        <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                          <span className="text-slate-500">Found: {importReport.videos.found}</span>
                          <span className="text-purple-600">Matched: {importReport.videos.matched}</span>
                          {importReport.videos.uploaded > 0 && <span className="text-green-600 font-medium">+{importReport.videos.uploaded}</span>}
                          {(importReport.videos.now_ready || 0) > 0 && <span className="text-emerald-600">Ready: {importReport.videos.now_ready}</span>}
                          {importReport.videos.errors > 0 && <span className="text-red-600">Errors: {importReport.videos.errors}</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {importReport.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-800">{importReport.errors.length} Error{importReport.errors.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importReport.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-600">{e}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    {importReport.sync_mode === 'dry_run' && (
                      <Button onClick={() => { setImportReport(null); setImportSyncMode('sync'); }}>
                        Apply as Full Sync
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setImportReport(null)}>
                      {importReport.sync_mode === 'dry_run' ? 'Back to Options' : 'Import Again'}
                    </Button>
                    <Button onClick={() => setShowImportDialog(false)}>Done</Button>
                  </div>
                </>
              )}

              {/* ─── Scaffold Tab ─── */}
              {importTab === 'scaffold' && !scaffoldResult && (
                <>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                    <p className="font-medium mb-1">Create CDN folder structure</p>
                    <p>Paste or upload your course <code className="bg-amber-100 px-1 rounded">.txt</code> file content. This will create the complete folder structure on Bunny CDN following the naming convention (course folder, chapters, topics, language folders, videos/).</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-slate-700">Course structure (.txt)</label>
                      <label className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3" /> Upload file
                        <input type="file" accept=".txt" onChange={handleTxtFileUpload} className="hidden" />
                      </label>
                    </div>
                    <textarea
                      value={scaffoldTxt}
                      onChange={e => setScaffoldTxt(e.target.value)}
                      placeholder={"HTML4 & HTML5\n\t1. Getting Started with HTML\n\t\t1. Introduction to HTML\n\t\t\t1. What is HTML and Why Learn It\n\t\t\t2. Understanding HTML Versions"}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[200px] resize-y"
                    />
                    <p className="text-xs text-slate-400 mt-1">Format: Course name (no tabs), then tab-indented chapters (1 tab), topics (2 tabs), sub-topics (3 tabs) with order numbers.</p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={scaffolding}>Cancel</Button>
                    <Button onClick={handleScaffoldCdn} disabled={scaffolding || !scaffoldTxt.trim()}>
                      {scaffolding ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                      {scaffolding ? 'Creating folders...' : 'Create CDN Structure'}
                    </Button>
                  </div>
                </>
              )}

              {/* Scaffold Results */}
              {importTab === 'scaffold' && scaffoldResult && (
                <>
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <p className="font-medium text-green-800">CDN Structure Created</p>
                      <p className="text-sm text-green-600">Course: <strong>{scaffoldResult.course}</strong></p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                      <span className="font-medium text-slate-700">Folders created</span>
                      <span className="text-green-600 font-medium">{scaffoldResult.folders_created}</span>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                      <span className="font-medium text-slate-700">.txt file uploaded</span>
                      <span className="text-xs text-slate-500 font-mono truncate ml-2">{scaffoldResult.txt_uploaded}</span>
                    </div>
                  </div>

                  <details className="text-xs">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700">View all folder paths ({scaffoldResult.folder_paths.length})</summary>
                    <div className="mt-2 max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3 font-mono space-y-0.5">
                      {scaffoldResult.folder_paths.map((p, i) => (
                        <div key={i} className="text-slate-600">{p}/</div>
                      ))}
                    </div>
                  </details>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm text-indigo-700">
                    Now upload your HTML and video files to the created folders, then use <strong>Import from CDN</strong> to create database records.
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setScaffoldResult(null); setScaffoldTxt(''); }}>Scaffold Another</Button>
                    <Button onClick={() => { setImportTab('import'); setScaffoldResult(null); }}>Go to Import</Button>
                  </div>
                </>
              )}

              {/* ─── Clean Orphaned Videos (always visible) ─── */}
              <div className="border-t border-slate-200 pt-4 mt-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><Trash2 className="w-4 h-4 text-red-500" /> Clean Orphaned Videos</div>
                    <p className="text-xs text-slate-500 mt-0.5">Remove Bunny Stream videos not linked to any sub-topic.</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleCleanOrphanedVideos(true)} disabled={cleaning}>
                      {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span className="whitespace-nowrap">Scan</span>
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => handleCleanOrphanedVideos(false)} disabled={cleaning}>
                      {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span className="whitespace-nowrap">Clean Now</span>
                    </Button>
                  </div>
                </div>

                {cleanReport && (
                  <div className="mt-3 space-y-2">
                    <div className={cn(
                      'border rounded-lg p-3 text-sm',
                      cleanReport.dry_run ? 'bg-amber-50 border-amber-100' : 'bg-green-50 border-green-100'
                    )}>
                      <p className={cn('font-medium', cleanReport.dry_run ? 'text-amber-800' : 'text-green-800')}>
                        {cleanReport.dry_run ? 'Scan Results (no changes made)' : 'Cleanup Complete'}
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                        <span className="text-slate-600">Total Stream videos:</span><span className="font-medium">{cleanReport.total_stream_videos}</span>
                        <span className="text-slate-600">Linked in DB:</span><span className="font-medium">{cleanReport.db_video_ids}</span>
                        <span className="text-red-600">Orphaned videos:</span><span className="font-medium text-red-600">{cleanReport.orphaned_found}</span>
                        <span className="text-slate-600">Empty collections:</span><span className="font-medium">{cleanReport.empty_collections_found}</span>
                        {!cleanReport.dry_run && <>
                          <span className="text-green-600">Videos deleted:</span><span className="font-medium text-green-600">{cleanReport.videos_deleted}</span>
                          <span className="text-green-600">Collections deleted:</span><span className="font-medium text-green-600">{cleanReport.collections_deleted}</span>
                        </>}
                      </div>
                    </div>

                    {cleanReport.orphaned_videos.length > 0 && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Orphaned videos ({cleanReport.orphaned_videos.length})</summary>
                        <div className="mt-1 max-h-32 overflow-y-auto bg-slate-50 rounded-lg p-2 space-y-0.5 font-mono">
                          {cleanReport.orphaned_videos.map((v: any, i: number) => (
                            <div key={i} className="text-slate-600">{v.title} <span className="text-slate-400">({v.sizeMB} MB)</span></div>
                          ))}
                        </div>
                      </details>
                    )}

                    {cleanReport.dry_run && cleanReport.orphaned_found > 0 && (
                      <div className="flex justify-end">
                        <Button size="sm" variant="danger" onClick={() => handleCleanOrphanedVideos(false)} disabled={cleaning}>
                          <Trash2 className="w-3.5 h-3.5" /> Delete {cleanReport.orphaned_found} Orphaned Videos
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
