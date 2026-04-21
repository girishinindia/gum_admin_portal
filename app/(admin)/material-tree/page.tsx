"use client";
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCcw, Loader2, FolderTree, HardDrive, FileText, Image, FileCode, ExternalLink, Trash2, BookOpen, Layers, Hash, Languages, FolderArchive, CloudDownload, Sparkles, CheckCircle, AlertCircle, X } from 'lucide-react';
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
  subjects: { found: number; created: number; existing: number };
  chapters: { found: number; created: number; existing: number };
  topics: { found: number; created: number; existing: number };
  sub_topics: { found: number; created: number; existing: number };
  translations: { found: number; created: number; existing: number; updated: number };
  errors: string[];
}

export default function MaterialTreePage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loadTime, setLoadTime] = useState<number>(0);

  // Import from CDN state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProvider, setImportProvider] = useState<string>('gemini');
  const [importGenerateSeo, setImportGenerateSeo] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);

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

  async function handleImportFromCdn() {
    setImporting(true);
    setImportReport(null);
    try {
      const res = await api.importFromCdn({ provider: importProvider, generate_seo: importGenerateSeo });
      if (res.success && res.data?.report) {
        setImportReport(res.data.report);
        toast.success('CDN import completed');
        loadTree(); // Refresh the tree
      } else {
        toast.error(res.message || 'CDN import failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'CDN import failed');
    }
    setImporting(false);
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
            <Button variant="outline" onClick={() => { setShowImportDialog(true); setImportReport(null); }} disabled={loading || importing}>
              <CloudDownload className="w-4 h-4" />
              Import from CDN
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

      {/* Import from CDN Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CloudDownload className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-800">Import from CDN</h2>
              </div>
              <button onClick={() => setShowImportDialog(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {!importReport ? (
                <>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
                    <p className="font-medium mb-1">How it works</p>
                    <p>Scans the Bunny CDN <code className="bg-indigo-100 px-1 rounded">materials/</code> folder and creates missing database records for any subjects, chapters, topics, sub-topics, and translations found.</p>
                    <p className="mt-2 text-xs text-indigo-600">Expected structure: <code>materials/subject/chapter/topic/lang-iso/file.html</code></p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
                    <select
                      value={importProvider}
                      onChange={e => setImportProvider(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="openai">OpenAI GPT</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Used only if SEO generation is enabled below</p>
                  </div>

                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={importGenerateSeo}
                      onChange={e => setImportGenerateSeo(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        AI-generate SEO metadata
                      </div>
                      <div className="text-xs text-slate-500">Downloads English HTML files and uses AI to generate titles, descriptions, and keywords for new sub-topics. Slower but produces better data.</div>
                    </div>
                  </label>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={importing}>
                      Cancel
                    </Button>
                    <Button onClick={handleImportFromCdn} disabled={importing}>
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudDownload className="w-4 h-4" />}
                      {importing ? 'Scanning CDN...' : 'Start Import'}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Import Results */}
                  <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <p className="font-medium text-green-800">Import Complete</p>
                      <p className="text-sm text-green-600">CDN scan finished. See results below.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(['subjects', 'chapters', 'topics', 'sub_topics', 'translations'] as const).map(key => {
                      const r = importReport[key];
                      const label = key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <div key={key} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-sm">
                          <span className="font-medium text-slate-700">{label}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-slate-500">Found: {r.found}</span>
                            <span className="text-green-600 font-medium">Created: {r.created}</span>
                            <span className="text-slate-400">Existing: {r.existing}</span>
                            {'updated' in r && (r as any).updated > 0 && (
                              <span className="text-blue-600">Updated: {(r as any).updated}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
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

                  <div className="flex justify-end pt-2">
                    <Button onClick={() => setShowImportDialog(false)}>
                      Done
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
