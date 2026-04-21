"use client";
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { FolderOpen, File, ChevronRight, ChevronDown, RefreshCcw, Loader2, FolderTree, HardDrive, FileText, Image, FileCode, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastChanged: string;
  children?: TreeNode[];
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

// Depth-based color coding matching the material hierarchy
function getDepthColor(depth: number) {
  const colors = [
    { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: 'Subject' },
    { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Chapter' },
    { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Topic' },
    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Language' },
  ];
  return colors[Math.min(depth, colors.length - 1)];
}

function TreeNodeItem({ node, depth, cdnBaseUrl, onDelete }: { node: TreeNode; depth: number; cdnBaseUrl: string; onDelete: (path: string, name: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const color = getDepthColor(depth);
  const hasChildren = node.isDirectory && node.children && node.children.length > 0;
  const isEmpty = node.isDirectory && node.children && node.children.length === 0;

  if (node.isDirectory) {
    // Count direct children stats
    const folderCount = node.children?.filter(c => c.isDirectory).length || 0;
    const fileCount = node.children?.filter(c => !c.isDirectory).length || 0;

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
            {depth < 4 && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', color.bg, color.text, color.border, 'border')}>
                {color.label}
              </span>
            )}
            <span className="text-xs text-slate-400 ml-auto">
              {folderCount > 0 && `${folderCount} folder${folderCount !== 1 ? 's' : ''}`}
              {folderCount > 0 && fileCount > 0 && ', '}
              {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? 's' : ''}`}
              {isEmpty && <span className="text-amber-500 italic">empty</span>}
            </span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.path, node.name); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 mr-2 rounded hover:bg-red-50"
            title={`Delete folder "${node.name}"`}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
          </button>
        </div>
        {expanded && hasChildren && (
          <div>
            {node.children!.map((child, i) => (
              <TreeNodeItem key={i} node={child} depth={depth + 1} cdnBaseUrl={cdnBaseUrl} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  const fileUrl = `${cdnBaseUrl}/${node.path}`;
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg group"
      style={{ paddingLeft: `${depth * 20 + 12 + 18}px` }}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
      <span className="text-xs text-slate-400 ml-auto shrink-0">{formatBytes(node.size)}</span>
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity" title="Open in CDN">
        <ExternalLink className="w-3.5 h-3.5 text-blue-500 hover:text-blue-700" />
      </a>
    </div>
  );
}

export default function MaterialTreePage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [stats, setStats] = useState<{ totalFolders: number; totalFiles: number; totalSize: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cdnBaseUrl, setCdnBaseUrl] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadTree() {
    setLoading(true);
    try {
      const res = await api.getFullMaterialTree();
      if (res.success && res.data) {
        setTree(res.data.tree || []);
        setStats(res.data.stats || null);
      } else {
        toast.error(res.message || 'Failed to load material tree');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load');
    }
    setLoading(false);
  }

  async function handleDeleteFolder(path: string, name: string) {
    if (!confirm(`Are you sure you want to permanently delete the folder "${name}" and all its contents from Bunny CDN?\n\nThis cannot be undone.`)) return;
    setDeleting(path);
    try {
      const res = await api.deleteMaterialFolder(path);
      if (res.success) {
        toast.success(`Folder "${name}" deleted successfully`);
        loadTree();
      } else {
        toast.error(res.message || 'Failed to delete folder');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete folder');
    }
    setDeleting(null);
  }

  useEffect(() => {
    loadTree();
    // Get CDN base URL from env or derive from API
    setCdnBaseUrl(process.env.NEXT_PUBLIC_BUNNY_CDN_URL || '');
  }, []);

  return (
    <div>
      <PageHeader
        title="Material Tree"
        description="Bunny CDN folder structure for uploaded materials"
        actions={
          <Button variant="outline" onClick={loadTree} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh
          </Button>
        }
      />

      {/* Stats Cards */}
      {stats && !loading && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-lg">
              <FolderTree className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Folders</div>
              <div className="text-xl font-bold text-slate-800">{stats.totalFolders}</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Files</div>
              <div className="text-xl font-bold text-slate-800">{stats.totalFiles}</div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className="bg-purple-50 p-2.5 rounded-lg">
              <HardDrive className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Size</div>
              <div className="text-xl font-bold text-slate-800">{formatBytes(stats.totalSize)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tree View */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">materials/</span>
          <span className="text-xs text-slate-400 ml-1">Root storage folder</span>
          {!loading && stats && (
            <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400" /> Subject</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Chapter</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Topic</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Language</span>
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
              <p className="text-xs mt-1">Create subjects, chapters, and topics to see their folder structure here</p>
            </div>
          ) : (
            tree.map((node, i) => (
              <TreeNodeItem key={i} node={node} depth={0} cdnBaseUrl={cdnBaseUrl} onDelete={handleDeleteFolder} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
