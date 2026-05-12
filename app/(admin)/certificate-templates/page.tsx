'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Loader2, MoreVertical, GraduationCap, FileText, Image,
} from 'lucide-react';
import { fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'name' | 'created_at' | 'template_type';

const TEMPLATE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'completion', label: 'Completion' },
  { value: 'merit', label: 'Merit' },
  { value: 'excellence', label: 'Excellence' },
];

const TYPE_COLORS: Record<string, string> = {
  completion: 'bg-blue-50 text-blue-700',
  merit: 'bg-amber-50 text-amber-700',
  excellence: 'bg-emerald-50 text-emerald-700',
};

const ORIENTATION_OPTS = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
];

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CertificateTemplatesPage() {
  // ─── State ───
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [courses, setCourses] = useState<any[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('completion');
  const [formCourseId, setFormCourseId] = useState('');
  const [formOrientation, setFormOrientation] = useState('landscape');
  const [formMinScore, setFormMinScore] = useState('');
  const [formMinProgress, setFormMinProgress] = useState('');
  const [formTemplateHtml, setFormTemplateHtml] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);

  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ─── Fetch ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page, limit: pageSize, search,
        sort: sortField, order: sortOrder,
        show_deleted: showTrash ? 'true' : undefined,
        template_type: filterType || undefined,
        is_active: filterActive || undefined,
      };
      const res = await api.listCertificateTemplates(params);
      if (res.success) {
        setRows(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch { toast.error('Failed to load templates'); }
    setLoading(false);
  }, [page, pageSize, search, sortField, sortOrder, showTrash, filterType, filterActive]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    api.listCertificateTemplates({ limit: 200 }).catch(() => ({}));
    // Fetch courses for dropdown
    api.listCertificateTemplates({ limit: 1 }).then(() => {
      // We need a courses endpoint - use a simple fetch
      fetch('/api/v1/courses?limit=200').catch(() => {});
    });
  }, []);

  // ─── Sorting ───
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  };

  // ─── CRUD ───
  const openCreate = () => {
    setDialogMode('create'); setSelected(null);
    setFormName(''); setFormDesc(''); setFormType('completion');
    setFormCourseId(''); setFormOrientation('landscape');
    setFormMinScore(''); setFormMinProgress(''); setFormTemplateHtml('');
    setFormActive(true);
    setBgFile(null); setLogoFile(null); setSigFile(null); setHtmlFile(null);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setDialogMode('edit'); setSelected(row);
    setFormName(row.name || ''); setFormDesc(row.description || '');
    setFormType(row.template_type || 'completion');
    setFormCourseId(row.course_id ? String(row.course_id) : '');
    setFormOrientation(row.orientation || 'landscape');
    setFormMinScore(row.min_score != null ? String(row.min_score) : '');
    setFormMinProgress(row.min_progress_pct != null ? String(row.min_progress_pct) : '');
    setFormTemplateHtml(row.template_html || '');
    setFormActive(row.is_active !== false);
    setBgFile(null); setLogoFile(null); setSigFile(null); setHtmlFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', formName);
      fd.append('description', formDesc);
      fd.append('template_type', formType);
      fd.append('orientation', formOrientation);
      fd.append('is_active', String(formActive));
      if (formCourseId) fd.append('course_id', formCourseId);
      if (formMinScore) fd.append('min_score', formMinScore);
      if (formMinProgress) fd.append('min_progress_pct', formMinProgress);
      if (formTemplateHtml && !htmlFile) fd.append('template_html', formTemplateHtml);
      if (bgFile) fd.append('background_image', bgFile);
      if (logoFile) fd.append('logo', logoFile);
      if (sigFile) fd.append('signature', sigFile);
      if (htmlFile) fd.append('template_html_file', htmlFile);

      const res = dialogMode === 'create'
        ? await api.createCertificateTemplate(fd)
        : await api.updateCertificateTemplate(selected.id, fd);
      if (res.success) {
        toast.success(dialogMode === 'create' ? 'Template created' : 'Template updated');
        setDialogOpen(false); fetchData();
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = showTrash
        ? await api.deleteCertificateTemplate(deleteId)
        : await api.softDeleteCertificateTemplate(deleteId);
      if (res.success) { toast.success(showTrash ? 'Permanently deleted' : 'Moved to trash'); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Delete failed'); }
    setDeleting(false); setDeleteId(null);
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await api.restoreCertificateTemplate(id);
      if (res.success) { toast.success('Restored'); fetchData(); }
      else toast.error(res.error || 'Restore failed');
    } catch { toast.error('Restore failed'); }
  };

  // ─── Render ───
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Certificate Templates" description="Manage certificate designs for course completion" actions={
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> New Template</Button>
      } />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <DataToolbar
            ref={toolbarRef}
            search={search}
            onSearchChange={v => { setSearch(v); setPage(1); }}
            searchPlaceholder="Search templates..."
          />
        </div>
        <select className={selectClass} value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
          {TEMPLATE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={selectClass} value={filterActive} onChange={e => { setFilterActive(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <Button size="sm" variant={showTrash ? 'danger' : 'outline'} onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
          {showTrash ? <RotateCcw className="w-4 h-4 mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
          {showTrash ? 'View Active' : 'View Trash'}
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH className="w-16">ID</TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('name')}>
                <span className="inline-flex items-center gap-1">NAME <SortIcon field="name" /></span>
              </TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('template_type')}>
                <span className="inline-flex items-center gap-1">TYPE <SortIcon field="template_type" /></span>
              </TH>
              <TH>COURSE</TH>
              <TH>ORIENTATION</TH>
              <TH>STATUS</TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}>
                <span className="inline-flex items-center gap-1">CREATED <SortIcon field="created_at" /></span>
              </TH>
              <TH className="w-20 text-right">ACTIONS</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TR key={i}>{Array.from({ length: 8 }).map((_, j) => <TD key={j}><Skeleton className="h-4 w-full" /></TD>)}</TR>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={8}><EmptyState icon={GraduationCap} title={showTrash ? 'Trash is empty' : 'No certificate templates'} description={showTrash ? '' : 'Create your first certificate template'} /></td></tr>
            ) : rows.map(row => (
              <TR key={row.id} className={row.deleted_at ? 'opacity-60' : ''}>
                <TD className="text-slate-400 text-xs">{row.id}</TD>
                <TD>
                  <div className="font-medium text-slate-800">{row.name}</div>
                  {row.slug && <div className="text-xs text-slate-400">{row.slug}</div>}
                </TD>
                <TD><Badge className={TYPE_COLORS[row.template_type] || 'bg-slate-100 text-slate-600'}>{row.template_type}</Badge></TD>
                <TD className="text-sm text-slate-600">{row.course_name || '--'}</TD>
                <TD className="text-sm text-slate-600 capitalize">{row.orientation || '--'}</TD>
                <TD>
                  {row.deleted_at ? (
                    <Badge className="bg-red-50 text-red-600">Trashed</Badge>
                  ) : row.is_active ? (
                    <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>
                  )}
                </TD>
                <TD className="text-xs text-slate-400">{fromNow(row.created_at)}</TD>
                <TD className="text-right">
                  <Dropdown trigger={<button className="p-1 rounded hover:bg-slate-100"><MoreVertical className="w-4 h-4 text-slate-400" /></button>}>
                    <DropdownItem icon={Eye} onClick={() => { setSelected(row); setViewDialogOpen(true); }}>View</DropdownItem>
                    {!row.deleted_at && (
                      <DropdownItem icon={Edit2} onClick={() => openEdit(row)}>Edit</DropdownItem>
                    )}
                    <DropdownDivider />
                    {row.deleted_at ? (
                      <>
                        <DropdownItem icon={RotateCcw} onClick={() => handleRestore(row.id)}>Restore</DropdownItem>
                        <DropdownItem icon={Trash2} danger onClick={() => setDeleteId(row.id)}>Delete Forever</DropdownItem>
                      </>
                    ) : (
                      <DropdownItem icon={Trash2} danger onClick={() => setDeleteId(row.id)}>Move to Trash</DropdownItem>
                    )}
                  </Dropdown>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {total > pageSize && <Pagination page={page} totalPages={Math.ceil(total / pageSize)} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={v => { setPageSize(v); setPage(1); }} total={total} />}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={dialogMode === 'create' ? 'New Certificate Template' : 'Edit Certificate Template'} size="lg">
        <div className="p-6 space-y-5">
          <Input label="Template Name *" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Course Completion Certificate" />
          <Input label="Description" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Template Type</label>
              <select className={`${selectClass} w-full`} value={formType} onChange={e => setFormType(e.target.value)}>
                <option value="completion">Completion</option>
                <option value="merit">Merit</option>
                <option value="excellence">Excellence</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Orientation</label>
              <select className={`${selectClass} w-full`} value={formOrientation} onChange={e => setFormOrientation(e.target.value)}>
                {ORIENTATION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Min Score (%)" type="number" value={formMinScore} onChange={e => setFormMinScore(e.target.value)} placeholder="e.g. 70" />
            <Input label="Min Progress (%)" type="number" value={formMinProgress} onChange={e => setFormMinProgress(e.target.value)} placeholder="e.g. 100" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Background Image</label>
              <input type="file" accept="image/*" className="text-sm" onChange={e => setBgFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Logo</label>
              <input type="file" accept="image/*" className="text-sm" onChange={e => setLogoFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Signature</label>
              <input type="file" accept="image/*" className="text-sm" onChange={e => setSigFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">HTML Template File</label>
            <input type="file" accept=".html,text/html" className="text-sm" onChange={e => setHtmlFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-slate-400 mt-1">Or paste HTML below:</p>
            <textarea className="w-full mt-1 p-2 text-sm border rounded-lg font-mono h-32 resize-y" value={formTemplateHtml} onChange={e => setFormTemplateHtml(e.target.value)} placeholder="<html>...</html>" />
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} />
            <span className="text-sm text-slate-700">Active</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{dialogMode === 'create' ? 'Create' : 'Update'}</Button>
          </div>
        </div>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} title="Certificate Template Details" size="lg">
        {selected && (
          <div className="p-6 grid grid-cols-2 gap-4">
            <DetailRow label="Name" value={selected.name} />
            <DetailRow label="Slug" value={selected.slug} />
            <DetailRow label="Type" value={selected.template_type} />
            <DetailRow label="Orientation" value={selected.orientation} />
            <DetailRow label="Course" value={selected.course_name} />
            <DetailRow label="Min Score" value={selected.min_score != null ? `${selected.min_score}%` : null} />
            <DetailRow label="Min Progress" value={selected.min_progress_pct != null ? `${selected.min_progress_pct}%` : null} />
            <DetailRow label="Status" value={selected.is_active ? 'Active' : 'Inactive'} />
            <DetailRow label="Created" value={formatDate(selected.created_at)} />
            <DetailRow label="Updated" value={formatDate(selected.updated_at)} />
            {selected.background_image_url && (
              <div className="col-span-2">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Background</dt>
                <img src={selected.background_image_url} alt="Background" className="mt-1 h-24 rounded border" />
              </div>
            )}
            {selected.logo_url && (
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Logo</dt>
                <img src={selected.logo_url} alt="Logo" className="mt-1 h-16 rounded border" />
              </div>
            )}
            {selected.signature_url && (
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Signature</dt>
                <img src={selected.signature_url} alt="Signature" className="mt-1 h-12 rounded border" />
              </div>
            )}
            {selected.description && (
              <div className="col-span-2"><DetailRow label="Description" value={selected.description} /></div>
            )}
          </div>
        )}
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">{showTrash ? 'Permanently delete this template? This cannot be undone.' : 'Move this template to trash?'}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{showTrash ? 'Delete Forever' : 'Move to Trash'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
