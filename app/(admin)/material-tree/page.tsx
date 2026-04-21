"use client";
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCcw, Loader2, FolderTree, HardDrive, FileText, Image, FileCode, ExternalLink, Trash2, BookOpen, Layers, Hash, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastChanged: string;
  children?: TreeNode[];
  dbId?: number;
  type?: 'subject' | 'chapter' | 'topic' | 'sub_topic' | 'language' | 'file';
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
    sub_topic: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Sub-Topic' },
  };
  if (type && colors[type]) return colors[type];
  // Fallback by depth
  const depthColors = [
    colors.subject, colors.chapter, colors.topic, colors.sub_topic,
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Language' },
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
            <FolderOpen className={cn('w-4 h-4 shrink-0', color.text)} />
            <span className={cn('font-medium', color.text)}>{node.name}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', color.bg, color.text, color.border, 'border')}>
              {color.label}
            </span>
            <span className="text-xs text-slate-400 ml-auto flex items-center gap-2">
              {directFolders > 0 && <span>{directFolders} {node.type === 'subject' ? 'ch' : node.type === 'chapter' ? 'tp' : node.type === 'topic' ? 'st' : 'item'}{directFolders !== 1 ? 's' : ''}</span>}
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

export default function MaterialTreePage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [stats, setStats] = useState<TreeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loadTime, setLoadTime] = useState<number>(0);

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
              <div className="text-xs text-slate-500">Topics / Sub-Topics</div>
              <div className="text-xl font-bold text-slate-800">{stats.topics} / {stats.subTopics}</div>
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
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400" /> Sub-Topic</span>
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
    </div>
  );
}
