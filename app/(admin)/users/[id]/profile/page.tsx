"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatDate, initials, cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import {
  ArrowLeft, Save, Loader2, User, MapPin, Phone, Heart, CreditCard,
  Shield, Bell, CheckCircle2, AlertCircle, Camera, Image, GraduationCap,
  Plus, Edit2, Trash2, RotateCcw, Eye, X, Award, BookOpen,
  Briefcase, Share2, Wrench, Languages, FileText, FolderKanban, Globe2, Sparkles,
  Pencil, RefreshCw, Check,
} from 'lucide-react';

// ── Tab definitions ──
const TABS = [
  { id: 'personal', label: 'Personal Info', icon: User },
  { id: 'address', label: 'Address', icon: MapPin },
  { id: 'contact', label: 'Contact & Emergency', icon: Phone },
  { id: 'identity', label: 'Identity & KYC', icon: Shield },
  { id: 'bank', label: 'Bank Details', icon: CreditCard },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'experience', label: 'Experience', icon: Briefcase },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'languages', label: 'Languages', icon: Languages },
  { id: 'social', label: 'Social Media', icon: Share2 },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'resume', label: 'Resume', icon: Globe2 },
  { id: 'preferences', label: 'Preferences', icon: Bell },
] as const;

type TabId = typeof TABS[number]['id'];

const GRADE_TYPES = [
  { value: '', label: 'Select...' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'cgpa', label: 'CGPA' },
  { value: 'gpa', label: 'GPA' },
  { value: 'grade', label: 'Grade' },
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'other', label: 'Other' },
];

export default function UserProfilePage() {
  const { id } = useParams();
  const userId = Number(id);
  const { user: me } = useAuth();
  const isSuperAdmin = (me?.max_role_level || 0) >= 100;
  const isSelf = me?.id === userId;
  const canEdit = isSuperAdmin || isSelf;

  const [activeTab, setActiveTab] = useState<TabId>('personal');
  const [userData, setUserData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Avatar quick-edit
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarRawFile, setAvatarRawFile] = useState<File | null>(null);

  // Dropdown data
  const [countries, setCountries] = useState<any[]>([]);
  const [permStates, setPermStates] = useState<any[]>([]);
  const [permCities, setPermCities] = useState<any[]>([]);
  const [currStates, setCurrStates] = useState<any[]>([]);
  const [currCities, setCurrCities] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  // Education tab state
  const [eduRecords, setEduRecords] = useState<any[]>([]);
  const [eduTotal, setEduTotal] = useState(0);
  const [eduPage, setEduPage] = useState(1);
  const [eduPageSize, setEduPageSize] = useState(10);
  const [eduSearch, setEduSearch] = useState('');
  const [eduShowTrash, setEduShowTrash] = useState(false);
  const [eduLoading, setEduLoading] = useState(false);
  const [eduDialogOpen, setEduDialogOpen] = useState(false);
  const [eduEditing, setEduEditing] = useState<any>(null);
  const [eduSaving, setEduSaving] = useState(false);
  const [eduLevels, setEduLevels] = useState<any[]>([]);
  const [eduSelectedIds, setEduSelectedIds] = useState<Set<number>>(new Set());
  const [eduBulkLoading, setEduBulkLoading] = useState(false);
  const [eduViewOpen, setEduViewOpen] = useState(false);
  const [eduViewItem, setEduViewItem] = useState<any>(null);

  // ── Generic CRUD state factory ──
  function useCrudState() {
    return {
      records: useState<any[]>([]),
      total: useState(0),
      page: useState(1),
      pageSize: useState(10),
      search: useState(''),
      showTrash: useState(false),
      loading: useState(false),
      dialogOpen: useState(false),
      editing: useState<any>(null),
      saving: useState(false),
      selectedIds: useState<Set<number>>(new Set()),
      bulkLoading: useState(false),
      viewOpen: useState(false),
      viewItem: useState<any>(null),
    };
  }

  // Experience state
  const [expRecords, setExpRecords] = useState<any[]>([]);
  const [expTotal, setExpTotal] = useState(0);
  const [expPage, setExpPage] = useState(1);
  const [expPageSize, setExpPageSize] = useState(10);
  const [expSearch, setExpSearch] = useState('');
  const [expShowTrash, setExpShowTrash] = useState(false);
  const [expLoading, setExpLoading] = useState(false);
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [expEditing, setExpEditing] = useState<any>(null);
  const [expSaving, setExpSaving] = useState(false);
  const [expSelectedIds, setExpSelectedIds] = useState<Set<number>>(new Set());
  const [expBulkLoading, setExpBulkLoading] = useState(false);
  const [expViewOpen, setExpViewOpen] = useState(false);
  const [expViewItem, setExpViewItem] = useState<any>(null);
  const [designations, setDesignations] = useState<any[]>([]);

  // Skills state
  const [sklRecords, setSklRecords] = useState<any[]>([]);
  const [sklTotal, setSklTotal] = useState(0);
  const [sklPage, setSklPage] = useState(1);
  const [sklPageSize, setSklPageSize] = useState(10);
  const [sklSearch, setSklSearch] = useState('');
  const [sklShowTrash, setSklShowTrash] = useState(false);
  const [sklLoading, setSklLoading] = useState(false);
  const [sklDialogOpen, setSklDialogOpen] = useState(false);
  const [sklEditing, setSklEditing] = useState<any>(null);
  const [sklSaving, setSklSaving] = useState(false);
  const [sklSelectedIds, setSklSelectedIds] = useState<Set<number>>(new Set());
  const [sklBulkLoading, setSklBulkLoading] = useState(false);
  const [sklViewOpen, setSklViewOpen] = useState(false);
  const [sklViewItem, setSklViewItem] = useState<any>(null);
  const [skillsList, setSkillsList] = useState<any[]>([]);

  // Languages state
  const [lngRecords, setLngRecords] = useState<any[]>([]);
  const [lngTotal, setLngTotal] = useState(0);
  const [lngPage, setLngPage] = useState(1);
  const [lngPageSize, setLngPageSize] = useState(10);
  const [lngShowTrash, setLngShowTrash] = useState(false);
  const [lngLoading, setLngLoading] = useState(false);
  const [lngDialogOpen, setLngDialogOpen] = useState(false);
  const [lngEditing, setLngEditing] = useState<any>(null);
  const [lngSaving, setLngSaving] = useState(false);
  const [lngSelectedIds, setLngSelectedIds] = useState<Set<number>>(new Set());
  const [lngSearch, setLngSearch] = useState('');
  const [lngBulkLoading, setLngBulkLoading] = useState(false);
  const [lngViewOpen, setLngViewOpen] = useState(false);
  const [lngViewItem, setLngViewItem] = useState<any>(null);
  const [languagesList, setLanguagesList] = useState<any[]>([]);

  // Social Media state
  const [smRecords, setSmRecords] = useState<any[]>([]);
  const [smTotal, setSmTotal] = useState(0);
  const [smPage, setSmPage] = useState(1);
  const [smPageSize, setSmPageSize] = useState(10);
  const [smSearch, setSmSearch] = useState('');
  const [smShowTrash, setSmShowTrash] = useState(false);
  const [smLoading, setSmLoading] = useState(false);
  const [smDialogOpen, setSmDialogOpen] = useState(false);
  const [smEditing, setSmEditing] = useState<any>(null);
  const [smSaving, setSmSaving] = useState(false);
  const [smSelectedIds, setSmSelectedIds] = useState<Set<number>>(new Set());
  const [smBulkLoading, setSmBulkLoading] = useState(false);
  const [smViewOpen, setSmViewOpen] = useState(false);
  const [smViewItem, setSmViewItem] = useState<any>(null);
  const [socialMedias, setSocialMedias] = useState<any[]>([]);

  // Documents state
  const [docRecords, setDocRecords] = useState<any[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [docPage, setDocPage] = useState(1);
  const [docPageSize, setDocPageSize] = useState(10);
  const [docSearch, setDocSearch] = useState('');
  const [docShowTrash, setDocShowTrash] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [docEditing, setDocEditing] = useState<any>(null);
  const [docSaving, setDocSaving] = useState(false);
  const [docSelectedIds, setDocSelectedIds] = useState<Set<number>>(new Set());
  const [docBulkLoading, setDocBulkLoading] = useState(false);
  const [docViewOpen, setDocViewOpen] = useState(false);
  const [docViewItem, setDocViewItem] = useState<any>(null);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [documentsList, setDocumentsList] = useState<any[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);

  // Projects state
  const [prjRecords, setPrjRecords] = useState<any[]>([]);
  const [prjTotal, setPrjTotal] = useState(0);
  const [prjPage, setPrjPage] = useState(1);
  const [prjPageSize, setPrjPageSize] = useState(10);
  const [prjSearch, setPrjSearch] = useState('');
  const [prjShowTrash, setPrjShowTrash] = useState(false);
  const [prjLoading, setPrjLoading] = useState(false);
  const [prjDialogOpen, setPrjDialogOpen] = useState(false);
  const [prjEditing, setPrjEditing] = useState<any>(null);
  const [prjSaving, setPrjSaving] = useState(false);
  const [prjSelectedIds, setPrjSelectedIds] = useState<Set<number>>(new Set());
  const [prjBulkLoading, setPrjBulkLoading] = useState(false);
  const [prjViewOpen, setPrjViewOpen] = useState(false);
  const [prjViewItem, setPrjViewItem] = useState<any>(null);

  // AI Sample Data Generation
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiModule, setAiModule] = useState<string>('');
  const [aiProvider, setAiProvider] = useState<string>('gemini');
  const [aiCount, setAiCount] = useState(3);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState<any>(null);
  const [aiSaving, setAiSaving] = useState(false);

  // Resume AI state
  const [resumeAiOpen, setResumeAiOpen] = useState(false);
  const [resumeAiProvider, setResumeAiProvider] = useState<string>('gemini');
  const [resumeAiPrompt, setResumeAiPrompt] = useState('');
  const [resumeAiMode, setResumeAiMode] = useState<'generate' | 'update'>('generate');
  const [resumeAiGenerating, setResumeAiGenerating] = useState(false);
  const [resumeAiResult, setResumeAiResult] = useState<any>(null);

  // Image files
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [removeProfileImage, setRemoveProfileImage] = useState(false);
  const [removeCoverImage, setRemoveCoverImage] = useState(false);

  const { register, handleSubmit, reset, watch, setValue } = useForm();
  const { register: eduRegister, handleSubmit: eduHandleSubmit, reset: eduReset, setValue: eduSetValue } = useForm();
  const { register: expRegister, handleSubmit: expHandleSubmit, reset: expReset } = useForm();
  const { register: sklRegister, handleSubmit: sklHandleSubmit, reset: sklReset } = useForm();
  const { register: lngRegister, handleSubmit: lngHandleSubmit, reset: lngReset } = useForm();
  const { register: smRegister, handleSubmit: smHandleSubmit, reset: smReset } = useForm();
  const { register: docRegister, handleSubmit: docHandleSubmit, reset: docReset, watch: docWatch } = useForm();
  const { register: prjRegister, handleSubmit: prjHandleSubmit, reset: prjReset } = useForm();

  const permCountryId = watch('permanent_country_id');
  const permStateId = watch('permanent_state_id');
  const currCountryId = watch('current_country_id');
  const currStateId = watch('current_state_id');

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    const [userRes, profileRes, countriesRes, langRes] = await Promise.all([
      api.getUser(userId),
      api.getUserProfile(userId),
      api.listCountries('?limit=300&sort=name&order=asc'),
      api.listLanguages('?limit=200&sort=name&order=asc'),
    ]);

    if (userRes.success) setUserData(userRes.data);
    if (countriesRes.success) setCountries(countriesRes.data || []);
    if (langRes.success) setLanguages(langRes.data || []);

    if (profileRes.success && profileRes.data) {
      setProfile(profileRes.data);
      const p = profileRes.data;
      reset({
        date_of_birth: p.date_of_birth || '',
        gender: p.gender || '',
        blood_group: p.blood_group || '',
        marital_status: p.marital_status || '',
        permanent_address_line1: p.permanent_address_line1 || '',
        permanent_address_line2: p.permanent_address_line2 || '',
        permanent_country_id: p.permanent_country_id || '',
        permanent_state_id: p.permanent_state_id || '',
        permanent_city_id: p.permanent_city_id || '',
        permanent_postal_code: p.permanent_postal_code || '',
        current_address_line1: p.current_address_line1 || '',
        current_address_line2: p.current_address_line2 || '',
        current_country_id: p.current_country_id || '',
        current_state_id: p.current_state_id || '',
        current_city_id: p.current_city_id || '',
        current_postal_code: p.current_postal_code || '',
        alternate_email: p.alternate_email || '',
        alternate_phone: p.alternate_phone || '',
        emergency_contact_name: p.emergency_contact_name || '',
        emergency_contact_relationship: p.emergency_contact_relationship || '',
        emergency_contact_phone: p.emergency_contact_phone || '',
        emergency_contact_email: p.emergency_contact_email || '',
        aadhar_number: p.aadhar_number || '',
        pan_number: p.pan_number || '',
        passport_number: p.passport_number || '',
        driving_license_number: p.driving_license_number || '',
        voter_id: p.voter_id || '',
        bank_account_name: p.bank_account_name || '',
        bank_account_number: p.bank_account_number || '',
        bank_ifsc_code: p.bank_ifsc_code || '',
        bank_name: p.bank_name || '',
        bank_branch: p.bank_branch || '',
        upi_id: p.upi_id || '',
        upi_number: p.upi_number || '',
        preferred_language_id: p.preferred_language_id || '',
        notification_email: p.notification_email ?? true,
        notification_sms: p.notification_sms ?? true,
        notification_push: p.notification_push ?? true,
        bio: p.bio || '',
        headline: p.headline || '',
        profile_slug: p.profile_slug || '',
        is_profile_public: p.is_profile_public ?? false,
      });
      if (p.permanent_country_id) loadStates(p.permanent_country_id, 'perm');
      if (p.permanent_state_id) loadCities(p.permanent_state_id, 'perm');
      if (p.current_country_id) loadStates(p.current_country_id, 'curr');
      if (p.current_state_id) loadCities(p.current_state_id, 'curr');
    } else {
      setProfile(null);
      reset({});
    }
    setLoading(false);
  }, [userId, reset]);

  useEffect(() => { load(); }, [load]);

  // ── Cascading dropdowns ──
  async function loadStates(countryId: number | string, type: 'perm' | 'curr') {
    if (!countryId) { type === 'perm' ? setPermStates([]) : setCurrStates([]); return; }
    const res = await api.listStates(`?country_id=${countryId}&limit=300&sort=name&order=asc`);
    if (res.success) type === 'perm' ? setPermStates(res.data || []) : setCurrStates(res.data || []);
  }
  async function loadCities(stateId: number | string, type: 'perm' | 'curr') {
    if (!stateId) { type === 'perm' ? setPermCities([]) : setCurrCities([]); return; }
    const res = await api.listCities(`?state_id=${stateId}&limit=500&sort=name&order=asc`);
    if (res.success) type === 'perm' ? setPermCities(res.data || []) : setCurrCities(res.data || []);
  }

  useEffect(() => { if (permCountryId) loadStates(permCountryId, 'perm'); }, [permCountryId]);
  useEffect(() => { if (permStateId) loadCities(permStateId, 'perm'); }, [permStateId]);
  useEffect(() => { if (currCountryId) loadStates(currCountryId, 'curr'); }, [currCountryId]);
  useEffect(() => { if (currStateId) loadCities(currStateId, 'curr'); }, [currStateId]);

  function copyAddress() {
    const fields = ['address_line1', 'address_line2', 'country_id', 'state_id', 'city_id', 'postal_code'];
    for (const f of fields) setValue(`current_${f}`, watch(`permanent_${f}`) || '');
    setCurrStates([...permStates]);
    setCurrCities([...permCities]);
  }

  // ── Avatar quick upload ──
  async function handleAvatarQuickUpload(file: File) {
    const fd = new FormData();
    fd.append('profile_image', file);
    const res = isSelf && !isSuperAdmin
      ? await api.updateMyProfile(fd, true)
      : await api.upsertUserProfile(userId, fd, true);
    if (res.success) { toast.success('Profile photo updated'); load(); }
    else toast.error(res.error || 'Failed to update photo');
  }

  // ── Education CRUD ──
  // Use self-service endpoints for own profile, admin endpoints for others
  const useSelfEdu = isSelf && !isSuperAdmin;

  const loadEducation = useCallback(async () => {
    setEduLoading(true);
    const qs = `?page=${eduPage}&limit=${eduPageSize}${eduSearch ? `&search=${encodeURIComponent(eduSearch)}` : ''}${eduShowTrash ? '&show_deleted=true' : ''}&sort=start_date&order=desc`;
    const res = useSelfEdu
      ? await api.listMyEducation(qs)
      : await api.listUserEducation(`?user_id=${userId}&${qs.slice(1)}`);
    if (res.success) {
      setEduRecords(res.data || []);
      setEduTotal(res.pagination?.total || 0);
    }
    // Load education levels for the dropdown
    if (eduLevels.length === 0) {
      const lvl = await api.listEducationLevels('?limit=100&sort=display_order&order=asc');
      if (lvl.success) setEduLevels(lvl.data || []);
    }
    setEduLoading(false);
  }, [userId, eduPage, eduPageSize, eduSearch, eduShowTrash, useSelfEdu]);

  useEffect(() => {
    if (activeTab === 'education') loadEducation();
  }, [activeTab, loadEducation]);

  function openEduCreate() {
    setEduEditing(null);
    eduReset({ user_id: userId, education_level_id: '', institution_name: '', board_or_university: '', field_of_study: '', specialization: '', grade_or_percentage: '', grade_type: '', start_date: '', end_date: '', is_currently_studying: false, is_highest_qualification: false, description: '' });
    setEduDialogOpen(true);
  }

  function openEduEdit(item: any) {
    setEduEditing(item);
    eduReset({
      education_level_id: item.education_level_id || '',
      institution_name: item.institution_name || '',
      board_or_university: item.board_or_university || '',
      field_of_study: item.field_of_study || '',
      specialization: item.specialization || '',
      grade_or_percentage: item.grade_or_percentage || '',
      grade_type: item.grade_type || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      is_currently_studying: item.is_currently_studying || false,
      is_highest_qualification: item.is_highest_qualification || false,
      description: item.description || '',
    });
    setEduDialogOpen(true);
  }

  async function onEduSubmit(data: any) {
    setEduSaving(true);
    const payload: any = { ...data };
    // Clean empties
    for (const k of Object.keys(payload)) {
      if (payload[k] === '' || payload[k] === undefined) payload[k] = null;
    }
    if (payload.education_level_id) payload.education_level_id = Number(payload.education_level_id);
    payload.user_id = userId;

    let res: any;
    if (eduEditing) {
      res = useSelfEdu
        ? await api.updateMyEducation(eduEditing.id, payload)
        : await api.updateUserEducation(eduEditing.id, payload);
    } else {
      res = useSelfEdu
        ? await api.createMyEducation(payload)
        : await api.createUserEducation(payload);
    }
    if (res.success) {
      toast.success(eduEditing ? 'Education updated' : 'Education added');
      setEduDialogOpen(false);
      loadEducation();
    } else {
      toast.error(res.error || 'Failed to save');
    }
    setEduSaving(false);
  }

  async function eduSoftDelete(item: any) {
    if (!confirm(`Move "${item.institution_name}" to trash?`)) return;
    const res = useSelfEdu ? await api.deleteMyEducation(item.id) : await api.deleteUserEducation(item.id);
    if (res.success) { toast.success('Moved to trash'); loadEducation(); }
    else toast.error(res.error || 'Failed');
  }

  async function eduRestore(item: any) {
    const res = useSelfEdu ? await api.restoreMyEducation(item.id) : await api.restoreUserEducation(item.id);
    if (res.success) { toast.success('Restored'); loadEducation(); }
    else toast.error(res.error || 'Failed');
  }

  async function eduPermanentDelete(item: any) {
    if (!confirm(`Permanently delete "${item.institution_name}"? This cannot be undone.`)) return;
    const res = useSelfEdu ? await api.permanentDeleteMyEducation(item.id) : await api.permanentDeleteUserEducation(item.id);
    if (res.success) { toast.success('Permanently deleted'); loadEducation(); }
    else toast.error(res.error || 'Failed');
  }

  function eduToggleSelect(id: number) {
    setEduSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function eduToggleSelectAll() {
    setEduSelectedIds(eduSelectedIds.size === eduRecords.length ? new Set() : new Set(eduRecords.map(r => r.id)));
  }

  async function eduBulkSoftDelete() {
    if (!confirm(`Move ${eduSelectedIds.size} records to trash?`)) return;
    setEduBulkLoading(true);
    const deleteFn = useSelfEdu ? api.deleteMyEducation : api.deleteUserEducation;
    for (const id of eduSelectedIds) await deleteFn(id);
    toast.success(`${eduSelectedIds.size} records moved to trash`);
    setEduSelectedIds(new Set()); setEduBulkLoading(false); loadEducation();
  }

  async function eduBulkRestore() {
    if (!confirm(`Restore ${eduSelectedIds.size} records?`)) return;
    setEduBulkLoading(true);
    const restoreFn = useSelfEdu ? api.restoreMyEducation : api.restoreUserEducation;
    for (const id of eduSelectedIds) await restoreFn(id);
    toast.success(`${eduSelectedIds.size} records restored`);
    setEduSelectedIds(new Set()); setEduBulkLoading(false); loadEducation();
  }

  async function eduBulkPermanentDelete() {
    if (!confirm(`Permanently delete ${eduSelectedIds.size} records? This cannot be undone.`)) return;
    setEduBulkLoading(true);
    const permDeleteFn = useSelfEdu ? api.permanentDeleteMyEducation : api.permanentDeleteUserEducation;
    for (const id of eduSelectedIds) await permDeleteFn(id);
    toast.success(`${eduSelectedIds.size} records permanently deleted`);
    setEduSelectedIds(new Set()); setEduBulkLoading(false); loadEducation();
  }

  const eduTotalPages = Math.ceil(eduTotal / eduPageSize);

  // ══════════════ Experience CRUD ══════════════
  const useSelfExp = isSelf && !isSuperAdmin;
  const loadExperience = useCallback(async () => {
    setExpLoading(true);
    const qs = `?page=${expPage}&limit=${expPageSize}${expSearch ? `&search=${encodeURIComponent(expSearch)}` : ''}${expShowTrash ? '&show_deleted=true' : ''}&sort=start_date&order=desc`;
    const res = useSelfExp ? await api.listMyExperience(qs) : await api.listUserExperience(`?user_id=${userId}&${qs.slice(1)}`);
    if (res.success) { setExpRecords(res.data || []); setExpTotal(res.pagination?.total || 0); }
    if (designations.length === 0) { const d = await api.listDesignations('?limit=200&sort=name&order=asc'); if (d.success) setDesignations(d.data || []); }
    setExpLoading(false);
  }, [userId, expPage, expPageSize, expSearch, expShowTrash, useSelfExp]);
  useEffect(() => { if (activeTab === 'experience') loadExperience(); }, [activeTab, loadExperience]);

  function openExpCreate() { setExpEditing(null); expReset({ user_id: userId, company_name: '', job_title: '', employment_type: 'full_time', department: '', location: '', work_mode: 'on_site', start_date: '', end_date: '', is_current_job: false, description: '', key_achievements: '', skills_used: '', designation_id: '' }); setExpDialogOpen(true); }
  function openExpEdit(item: any) { setExpEditing(item); expReset({ company_name: item.company_name||'', job_title: item.job_title||'', employment_type: item.employment_type||'full_time', department: item.department||'', location: item.location||'', work_mode: item.work_mode||'on_site', start_date: item.start_date||'', end_date: item.end_date||'', is_current_job: item.is_current_job||false, description: item.description||'', key_achievements: item.key_achievements||'', skills_used: item.skills_used||'', designation_id: item.designation_id||'' }); setExpDialogOpen(true); }

  async function onExpSubmit(data: any) {
    setExpSaving(true);
    const payload: any = { ...data }; for (const k of Object.keys(payload)) { if (payload[k] === '' || payload[k] === undefined) payload[k] = null; }
    if (payload.designation_id) payload.designation_id = Number(payload.designation_id); payload.user_id = userId;
    let res: any;
    if (expEditing) { res = useSelfExp ? await api.updateMyExperience(expEditing.id, payload) : await api.updateUserExperience(expEditing.id, payload); }
    else { res = useSelfExp ? await api.createMyExperience(payload) : await api.createUserExperience(payload); }
    if (res.success) { toast.success(expEditing ? 'Updated' : 'Added'); setExpDialogOpen(false); loadExperience(); } else toast.error(res.error || 'Failed');
    setExpSaving(false);
  }

  async function expSoftDelete(item: any) { if (!confirm(`Move "${item.company_name}" to trash?`)) return; const res = useSelfExp ? await api.deleteMyExperience(item.id) : await api.deleteUserExperience(item.id); if (res.success) { toast.success('Moved to trash'); loadExperience(); } else toast.error(res.error || 'Failed'); }
  async function expRestore(item: any) { const res = useSelfExp ? await api.restoreMyExperience(item.id) : await api.restoreUserExperience(item.id); if (res.success) { toast.success('Restored'); loadExperience(); } else toast.error(res.error || 'Failed'); }
  async function expPermanentDelete(item: any) { if (!confirm(`Permanently delete?`)) return; const res = useSelfExp ? await api.permanentDeleteMyExperience(item.id) : await api.permanentDeleteUserExperience(item.id); if (res.success) { toast.success('Deleted'); loadExperience(); } else toast.error(res.error || 'Failed'); }
  function expToggleSelect(id: number) { setExpSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function expToggleSelectAll() { setExpSelectedIds(expSelectedIds.size === expRecords.length ? new Set() : new Set(expRecords.map(r => r.id))); }
  async function expBulkSoftDelete() { if (!confirm(`Move ${expSelectedIds.size} to trash?`)) return; setExpBulkLoading(true); const fn = useSelfExp ? api.deleteMyExperience : api.deleteUserExperience; for (const id of expSelectedIds) await fn(id); toast.success('Moved to trash'); setExpSelectedIds(new Set()); setExpBulkLoading(false); loadExperience(); }
  async function expBulkRestore() { if (!confirm(`Restore ${expSelectedIds.size}?`)) return; setExpBulkLoading(true); const fn = useSelfExp ? api.restoreMyExperience : api.restoreUserExperience; for (const id of expSelectedIds) await fn(id); toast.success('Restored'); setExpSelectedIds(new Set()); setExpBulkLoading(false); loadExperience(); }
  async function expBulkPermanentDelete() { if (!confirm(`Permanently delete ${expSelectedIds.size}?`)) return; setExpBulkLoading(true); const fn = useSelfExp ? api.permanentDeleteMyExperience : api.permanentDeleteUserExperience; for (const id of expSelectedIds) await fn(id); toast.success('Deleted'); setExpSelectedIds(new Set()); setExpBulkLoading(false); loadExperience(); }
  const expTotalPages = Math.ceil(expTotal / expPageSize);

  // ══════════════ Skills CRUD ══════════════
  const useSelfSkl = isSelf && !isSuperAdmin;
  const loadSkills = useCallback(async () => {
    setSklLoading(true);
    const qs = `?page=${sklPage}&limit=${sklPageSize}${sklSearch ? `&search=${encodeURIComponent(sklSearch)}` : ''}${sklShowTrash ? '&show_deleted=true' : ''}&sort=id&order=desc`;
    const res = useSelfSkl ? await api.listMySkills(qs) : await api.listUserSkills(`?user_id=${userId}&${qs.slice(1)}`);
    if (res.success) { setSklRecords(res.data || []); setSklTotal(res.pagination?.total || 0); }
    if (skillsList.length === 0) { const s = await api.listSkills('?limit=500&sort=name&order=asc'); if (s.success) setSkillsList(s.data || []); }
    setSklLoading(false);
  }, [userId, sklPage, sklPageSize, sklSearch, sklShowTrash, useSelfSkl]);
  useEffect(() => { if (activeTab === 'skills') loadSkills(); }, [activeTab, loadSkills]);

  function openSklCreate() { setSklEditing(null); sklReset({ user_id: userId, skill_id: '', proficiency_level: 'beginner', years_of_experience: '', is_primary: false }); setSklDialogOpen(true); }
  function openSklEdit(item: any) { setSklEditing(item); sklReset({ skill_id: item.skill_id||'', proficiency_level: item.proficiency_level||'beginner', years_of_experience: item.years_of_experience||'', is_primary: item.is_primary||false }); setSklDialogOpen(true); }
  async function onSklSubmit(data: any) {
    setSklSaving(true);
    const payload: any = { ...data }; for (const k of Object.keys(payload)) { if (payload[k] === '' || payload[k] === undefined) payload[k] = null; }
    if (payload.skill_id) payload.skill_id = Number(payload.skill_id); if (payload.years_of_experience) payload.years_of_experience = Number(payload.years_of_experience); payload.user_id = userId;
    let res: any;
    if (sklEditing) { res = useSelfSkl ? await api.updateMySkill(sklEditing.id, payload) : await api.updateUserSkill(sklEditing.id, payload); }
    else { res = useSelfSkl ? await api.createMySkill(payload) : await api.createUserSkill(payload); }
    if (res.success) { toast.success(sklEditing ? 'Updated' : 'Added'); setSklDialogOpen(false); loadSkills(); } else toast.error(res.error || 'Failed');
    setSklSaving(false);
  }
  async function sklSoftDelete(item: any) { if (!confirm(`Delete this skill?`)) return; const res = useSelfSkl ? await api.deleteMySkill(item.id) : await api.deleteUserSkill(item.id); if (res.success) { toast.success('Moved to trash'); loadSkills(); } else toast.error(res.error || 'Failed'); }
  async function sklRestore(item: any) { const res = useSelfSkl ? await api.restoreMySkill(item.id) : await api.restoreUserSkill(item.id); if (res.success) { toast.success('Restored'); loadSkills(); } else toast.error(res.error || 'Failed'); }
  async function sklPermanentDelete(item: any) { if (!confirm('Permanently delete?')) return; const res = useSelfSkl ? await api.permanentDeleteMySkill(item.id) : await api.permanentDeleteUserSkill(item.id); if (res.success) { toast.success('Deleted'); loadSkills(); } else toast.error(res.error || 'Failed'); }
  function sklToggleSelect(id: number) { setSklSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function sklToggleSelectAll() { setSklSelectedIds(sklSelectedIds.size === sklRecords.length ? new Set() : new Set(sklRecords.map(r => r.id))); }
  async function sklBulkSoftDelete() { if (!confirm(`Move ${sklSelectedIds.size} to trash?`)) return; setSklBulkLoading(true); const fn = useSelfSkl ? api.deleteMySkill : api.deleteUserSkill; for (const id of sklSelectedIds) await fn(id); toast.success('Done'); setSklSelectedIds(new Set()); setSklBulkLoading(false); loadSkills(); }
  async function sklBulkRestore() { if (!confirm(`Restore ${sklSelectedIds.size}?`)) return; setSklBulkLoading(true); const fn = useSelfSkl ? api.restoreMySkill : api.restoreUserSkill; for (const id of sklSelectedIds) await fn(id); toast.success('Done'); setSklSelectedIds(new Set()); setSklBulkLoading(false); loadSkills(); }
  async function sklBulkPermanentDelete() { if (!confirm(`Permanently delete ${sklSelectedIds.size}?`)) return; setSklBulkLoading(true); const fn = useSelfSkl ? api.permanentDeleteMySkill : api.permanentDeleteUserSkill; for (const id of sklSelectedIds) await fn(id); toast.success('Done'); setSklSelectedIds(new Set()); setSklBulkLoading(false); loadSkills(); }
  const sklTotalPages = Math.ceil(sklTotal / sklPageSize);

  // ══════════════ Languages CRUD ══════════════
  const useSelfLng = isSelf && !isSuperAdmin;
  const loadLanguages = useCallback(async () => {
    setLngLoading(true);
    const qs = `?page=${lngPage}&limit=${lngPageSize}${lngShowTrash ? '&show_deleted=true' : ''}&sort=id&order=desc`;
    const res = useSelfLng ? await api.listMyLanguages(qs) : await api.listUserLanguages(`?user_id=${userId}&${qs.slice(1)}`);
    if (res.success) { setLngRecords(res.data || []); setLngTotal(res.pagination?.total || 0); }
    if (languagesList.length === 0) { const l = await api.listLanguages('?limit=300&sort=name&order=asc'); if (l.success) setLanguagesList(l.data || []); }
    setLngLoading(false);
  }, [userId, lngPage, lngPageSize, lngShowTrash, useSelfLng]);
  useEffect(() => { if (activeTab === 'languages') loadLanguages(); }, [activeTab, loadLanguages]);

  function openLngCreate() { setLngEditing(null); lngReset({ user_id: userId, language_id: '', proficiency_level: 'basic', can_read: false, can_write: false, can_speak: false, is_primary: false, is_native: false }); setLngDialogOpen(true); }
  function openLngEdit(item: any) { setLngEditing(item); lngReset({ language_id: item.language_id||'', proficiency_level: item.proficiency_level||'basic', can_read: item.can_read||false, can_write: item.can_write||false, can_speak: item.can_speak||false, is_primary: item.is_primary||false, is_native: item.is_native||false }); setLngDialogOpen(true); }
  async function onLngSubmit(data: any) {
    setLngSaving(true);
    const payload: any = { ...data }; for (const k of Object.keys(payload)) { if (payload[k] === '' || payload[k] === undefined) payload[k] = null; }
    if (payload.language_id) payload.language_id = Number(payload.language_id); payload.user_id = userId;
    let res: any;
    if (lngEditing) { res = useSelfLng ? await api.updateMyLanguage(lngEditing.id, payload) : await api.updateUserLanguage(lngEditing.id, payload); }
    else { res = useSelfLng ? await api.createMyLanguage(payload) : await api.createUserLanguage(payload); }
    if (res.success) { toast.success(lngEditing ? 'Updated' : 'Added'); setLngDialogOpen(false); loadLanguages(); } else toast.error(res.error || 'Failed');
    setLngSaving(false);
  }
  async function lngSoftDelete(item: any) { if (!confirm('Delete?')) return; const res = useSelfLng ? await api.deleteMyLanguage(item.id) : await api.deleteUserLanguage(item.id); if (res.success) { toast.success('Moved to trash'); loadLanguages(); } else toast.error(res.error || 'Failed'); }
  async function lngRestore(item: any) { const res = useSelfLng ? await api.restoreMyLanguage(item.id) : await api.restoreUserLanguage(item.id); if (res.success) { toast.success('Restored'); loadLanguages(); } else toast.error(res.error || 'Failed'); }
  async function lngPermanentDelete(item: any) { if (!confirm('Permanently delete?')) return; const res = useSelfLng ? await api.permanentDeleteMyLanguage(item.id) : await api.permanentDeleteUserLanguage(item.id); if (res.success) { toast.success('Deleted'); loadLanguages(); } else toast.error(res.error || 'Failed'); }
  function lngToggleSelect(id: number) { setLngSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function lngToggleSelectAll() { setLngSelectedIds(lngSelectedIds.size === lngRecords.length ? new Set() : new Set(lngRecords.map(r => r.id))); }
  async function lngBulkSoftDelete() { if (!confirm(`Move ${lngSelectedIds.size} to trash?`)) return; setLngBulkLoading(true); const fn = useSelfLng ? api.deleteMyLanguage : api.deleteUserLanguage; for (const id of lngSelectedIds) await fn(id); toast.success('Done'); setLngSelectedIds(new Set()); setLngBulkLoading(false); loadLanguages(); }
  async function lngBulkRestore() { if (!confirm(`Restore ${lngSelectedIds.size}?`)) return; setLngBulkLoading(true); const fn = useSelfLng ? api.restoreMyLanguage : api.restoreUserLanguage; for (const id of lngSelectedIds) await fn(id); toast.success('Done'); setLngSelectedIds(new Set()); setLngBulkLoading(false); loadLanguages(); }
  async function lngBulkPermanentDelete() { if (!confirm(`Permanently delete ${lngSelectedIds.size}?`)) return; setLngBulkLoading(true); const fn = useSelfLng ? api.permanentDeleteMyLanguage : api.permanentDeleteUserLanguage; for (const id of lngSelectedIds) await fn(id); toast.success('Done'); setLngSelectedIds(new Set()); setLngBulkLoading(false); loadLanguages(); }
  const lngTotalPages = Math.ceil(lngTotal / lngPageSize);

  // ══════════════ Social Media CRUD ══════════════
  const useSelfSm = isSelf && !isSuperAdmin;
  const loadSocialMedia = useCallback(async () => {
    setSmLoading(true);
    const qs = `?page=${smPage}&limit=${smPageSize}${smSearch ? `&search=${encodeURIComponent(smSearch)}` : ''}${smShowTrash ? '&show_deleted=true' : ''}&sort=id&order=desc`;
    const res = useSelfSm ? await api.listMySocialMedia(qs) : await api.listUserSocialMedia(`?user_id=${userId}&${qs.slice(1)}`);
    if (res.success) { setSmRecords(res.data || []); setSmTotal(res.pagination?.total || 0); }
    if (socialMedias.length === 0) { const s = await api.listSocialMedias('?limit=100&sort=name&order=asc'); if (s.success) setSocialMedias(s.data || []); }
    setSmLoading(false);
  }, [userId, smPage, smPageSize, smSearch, smShowTrash, useSelfSm]);
  useEffect(() => { if (activeTab === 'social') loadSocialMedia(); }, [activeTab, loadSocialMedia]);

  function openSmCreate() { setSmEditing(null); smReset({ user_id: userId, social_media_id: '', profile_url: '', username: '', is_primary: false }); setSmDialogOpen(true); }
  function openSmEdit(item: any) { setSmEditing(item); smReset({ social_media_id: item.social_media_id||'', profile_url: item.profile_url||'', username: item.username||'', is_primary: item.is_primary||false }); setSmDialogOpen(true); }
  async function onSmSubmit(data: any) {
    setSmSaving(true);
    const payload: any = { ...data }; for (const k of Object.keys(payload)) { if (payload[k] === '' || payload[k] === undefined) payload[k] = null; }
    if (payload.social_media_id) payload.social_media_id = Number(payload.social_media_id); payload.user_id = userId;
    let res: any;
    if (smEditing) { res = useSelfSm ? await api.updateMySocialMedia(smEditing.id, payload) : await api.updateUserSocialMedia(smEditing.id, payload); }
    else { res = useSelfSm ? await api.createMySocialMedia(payload) : await api.createUserSocialMedia(payload); }
    if (res.success) { toast.success(smEditing ? 'Updated' : 'Added'); setSmDialogOpen(false); loadSocialMedia(); } else toast.error(res.error || 'Failed');
    setSmSaving(false);
  }
  async function smSoftDelete(item: any) { if (!confirm('Delete?')) return; const res = useSelfSm ? await api.deleteMySocialMedia(item.id) : await api.deleteUserSocialMedia(item.id); if (res.success) { toast.success('Deleted'); loadSocialMedia(); } else toast.error(res.error || 'Failed'); }
  async function smRestore(item: any) { const res = useSelfSm ? await api.restoreMySocialMedia(item.id) : await api.restoreUserSocialMedia(item.id); if (res.success) { toast.success('Restored'); loadSocialMedia(); } else toast.error(res.error || 'Failed'); }
  async function smPermanentDelete(item: any) { if (!confirm('Permanently delete?')) return; const res = useSelfSm ? await api.permanentDeleteMySocialMedia(item.id) : await api.permanentDeleteUserSocialMedia(item.id); if (res.success) { toast.success('Deleted'); loadSocialMedia(); } else toast.error(res.error || 'Failed'); }
  function smToggleSelect(id: number) { setSmSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function smToggleSelectAll() { setSmSelectedIds(smSelectedIds.size === smRecords.length ? new Set() : new Set(smRecords.map(r => r.id))); }
  async function smBulkSoftDelete() { if (!confirm(`Move ${smSelectedIds.size} to trash?`)) return; setSmBulkLoading(true); const fn = useSelfSm ? api.deleteMySocialMedia : api.deleteUserSocialMedia; for (const id of smSelectedIds) await fn(id); toast.success('Done'); setSmSelectedIds(new Set()); setSmBulkLoading(false); loadSocialMedia(); }
  async function smBulkRestore() { if (!confirm(`Restore ${smSelectedIds.size}?`)) return; setSmBulkLoading(true); const fn = useSelfSm ? api.restoreMySocialMedia : api.restoreUserSocialMedia; for (const id of smSelectedIds) await fn(id); toast.success('Done'); setSmSelectedIds(new Set()); setSmBulkLoading(false); loadSocialMedia(); }
  async function smBulkPermanentDelete() { if (!confirm(`Permanently delete ${smSelectedIds.size}?`)) return; setSmBulkLoading(true); const fn = useSelfSm ? api.permanentDeleteMySocialMedia : api.permanentDeleteUserSocialMedia; for (const id of smSelectedIds) await fn(id); toast.success('Done'); setSmSelectedIds(new Set()); setSmBulkLoading(false); loadSocialMedia(); }
  const smTotalPages = Math.ceil(smTotal / smPageSize);

  // ══════════════ Documents CRUD ══════════════
  const useSelfDoc = isSelf && !isSuperAdmin;
  const loadDocuments = useCallback(async () => {
    setDocLoading(true);
    const qs = `?page=${docPage}&limit=${docPageSize}${docSearch ? `&search=${encodeURIComponent(docSearch)}` : ''}${docShowTrash ? '&show_deleted=true' : ''}&sort=id&order=desc`;
    const res = useSelfDoc ? await api.listMyDocuments(qs) : await api.listUserDocuments(`?user_id=${userId}&${qs.slice(1)}`);
    if (res.success) { setDocRecords(res.data || []); setDocTotal(res.pagination?.total || 0); }
    if (documentTypes.length === 0) { const d = await api.listDocumentTypes('?limit=100&sort=name&order=asc'); if (d.success) setDocumentTypes(d.data || []); }
    if (documentsList.length === 0) { const d = await api.listDocuments('?limit=200&sort=name&order=asc'); if (d.success) setDocumentsList(d.data || []); }
    setDocLoading(false);
  }, [userId, docPage, docPageSize, docSearch, docShowTrash, useSelfDoc]);
  useEffect(() => { if (activeTab === 'identity') loadDocuments(); }, [activeTab, loadDocuments]);

  function openDocCreate() { setDocEditing(null); docReset({ user_id: userId, document_type_id: '', document_id: '', document_number: '', issue_date: '', expiry_date: '' }); setDocFile(null); setDocPreview(null); setDocDialogOpen(true); }
  function openDocEdit(item: any) { setDocEditing(item); docReset({ document_type_id: item.document_type_id||'', document_id: item.document_id||'', document_number: item.document_number||'', issue_date: item.issue_date||'', expiry_date: item.expiry_date||'' }); setDocFile(null); setDocPreview(item.file || null); setDocDialogOpen(true); }
  async function onDocSubmit(data: any) {
    setDocSaving(true);
    const fd = new FormData();
    if (docFile) fd.append('file', docFile);
    fd.append('user_id', String(userId));
    if (data.document_type_id) fd.append('document_type_id', String(data.document_type_id));
    if (data.document_id) fd.append('document_id', String(data.document_id));
    if (data.document_number) fd.append('document_number', data.document_number);
    if (data.issue_date) fd.append('issue_date', data.issue_date);
    if (data.expiry_date) fd.append('expiry_date', data.expiry_date);
    let res: any;
    if (docEditing) { res = useSelfDoc ? await api.updateMyDocument(docEditing.id, fd, true) : await api.updateUserDocument(docEditing.id, fd, true); }
    else { res = useSelfDoc ? await api.createMyDocument(fd, true) : await api.createUserDocument(fd, true); }
    if (res.success) { toast.success(docEditing ? 'Updated' : 'Added'); setDocDialogOpen(false); setDocFile(null); setDocPreview(null); loadDocuments(); } else toast.error(res.error || 'Failed');
    setDocSaving(false);
  }
  async function docSoftDelete(item: any) { if (!confirm('Delete?')) return; const res = useSelfDoc ? await api.deleteMyDocument(item.id) : await api.deleteUserDocument(item.id); if (res.success) { toast.success('Deleted'); loadDocuments(); } else toast.error(res.error || 'Failed'); }
  async function docRestore(item: any) { const res = useSelfDoc ? await api.restoreMyDocument(item.id) : await api.restoreUserDocument(item.id); if (res.success) { toast.success('Restored'); loadDocuments(); } else toast.error(res.error || 'Failed'); }
  async function docPermanentDelete(item: any) { if (!confirm('Permanently delete?')) return; const res = useSelfDoc ? await api.permanentDeleteMyDocument(item.id) : await api.permanentDeleteUserDocument(item.id); if (res.success) { toast.success('Deleted'); loadDocuments(); } else toast.error(res.error || 'Failed'); }
  function docToggleSelect(id: number) { setDocSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function docToggleSelectAll() { setDocSelectedIds(docSelectedIds.size === docRecords.length ? new Set() : new Set(docRecords.map(r => r.id))); }
  async function docBulkSoftDelete() { if (!confirm(`Move ${docSelectedIds.size} to trash?`)) return; setDocBulkLoading(true); const fn = useSelfDoc ? api.deleteMyDocument : api.deleteUserDocument; for (const id of docSelectedIds) await fn(id); toast.success('Done'); setDocSelectedIds(new Set()); setDocBulkLoading(false); loadDocuments(); }
  async function docBulkRestore() { if (!confirm(`Restore ${docSelectedIds.size}?`)) return; setDocBulkLoading(true); const fn = useSelfDoc ? api.restoreMyDocument : api.restoreUserDocument; for (const id of docSelectedIds) await fn(id); toast.success('Done'); setDocSelectedIds(new Set()); setDocBulkLoading(false); loadDocuments(); }
  async function docBulkPermanentDelete() { if (!confirm(`Permanently delete ${docSelectedIds.size}?`)) return; setDocBulkLoading(true); const fn = useSelfDoc ? api.permanentDeleteMyDocument : api.permanentDeleteUserDocument; for (const id of docSelectedIds) await fn(id); toast.success('Done'); setDocSelectedIds(new Set()); setDocBulkLoading(false); loadDocuments(); }
  const docTotalPages = Math.ceil(docTotal / docPageSize);

  // ══════════════ Projects CRUD ══════════════
  const useSelfPrj = isSelf && !isSuperAdmin;
  const loadProjects = useCallback(async () => {
    setPrjLoading(true);
    const qs = `?page=${prjPage}&limit=${prjPageSize}${prjSearch ? `&search=${encodeURIComponent(prjSearch)}` : ''}${prjShowTrash ? '&show_deleted=true' : ''}&sort=display_order&order=asc`;
    const res = useSelfPrj ? await api.listMyProjects(qs) : await api.listUserProjects(`?user_id=${userId}&${qs.slice(1)}`);
    if (res.success) { setPrjRecords(res.data || []); setPrjTotal(res.pagination?.total || 0); }
    setPrjLoading(false);
  }, [userId, prjPage, prjPageSize, prjSearch, prjShowTrash, useSelfPrj]);
  useEffect(() => { if (activeTab === 'projects') loadProjects(); }, [activeTab, loadProjects]);

  function openPrjCreate() { setPrjEditing(null); prjReset({ user_id: userId, project_title: '', project_type: 'personal', project_status: 'completed', description: '', role_in_project: '', technologies_used: '', start_date: '', end_date: '', is_ongoing: false, project_url: '', repository_url: '', organization_name: '' }); setPrjDialogOpen(true); }
  function openPrjEdit(item: any) { setPrjEditing(item); prjReset({ project_title: item.project_title||'', project_type: item.project_type||'personal', project_status: item.project_status||'completed', description: item.description||'', role_in_project: item.role_in_project||'', technologies_used: item.technologies_used||'', start_date: item.start_date||'', end_date: item.end_date||'', is_ongoing: item.is_ongoing||false, project_url: item.project_url||'', repository_url: item.repository_url||'', organization_name: item.organization_name||'', is_featured: item.is_featured||false }); setPrjDialogOpen(true); }
  async function onPrjSubmit(data: any) {
    setPrjSaving(true);
    const payload: any = { ...data }; for (const k of Object.keys(payload)) { if (payload[k] === '' || payload[k] === undefined) payload[k] = null; }
    payload.user_id = userId;
    let res: any;
    if (prjEditing) { res = useSelfPrj ? await api.updateMyProject(prjEditing.id, payload) : await api.updateUserProject(prjEditing.id, payload); }
    else { res = useSelfPrj ? await api.createMyProject(payload) : await api.createUserProject(payload); }
    if (res.success) { toast.success(prjEditing ? 'Updated' : 'Added'); setPrjDialogOpen(false); loadProjects(); } else toast.error(res.error || 'Failed');
    setPrjSaving(false);
  }
  async function prjSoftDelete(item: any) { if (!confirm(`Delete "${item.project_title}"?`)) return; const res = useSelfPrj ? await api.deleteMyProject(item.id) : await api.deleteUserProject(item.id); if (res.success) { toast.success('Deleted'); loadProjects(); } else toast.error(res.error || 'Failed'); }
  async function prjRestore(item: any) { const res = useSelfPrj ? await api.restoreMyProject(item.id) : await api.restoreUserProject(item.id); if (res.success) { toast.success('Restored'); loadProjects(); } else toast.error(res.error || 'Failed'); }
  async function prjPermanentDelete(item: any) { if (!confirm('Permanently delete?')) return; const res = useSelfPrj ? await api.permanentDeleteMyProject(item.id) : await api.permanentDeleteUserProject(item.id); if (res.success) { toast.success('Deleted'); loadProjects(); } else toast.error(res.error || 'Failed'); }
  function prjToggleSelect(id: number) { setPrjSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function prjToggleSelectAll() { setPrjSelectedIds(prjSelectedIds.size === prjRecords.length ? new Set() : new Set(prjRecords.map(r => r.id))); }
  async function prjBulkSoftDelete() { if (!confirm(`Move ${prjSelectedIds.size} to trash?`)) return; setPrjBulkLoading(true); const fn = useSelfPrj ? api.deleteMyProject : api.deleteUserProject; for (const id of prjSelectedIds) await fn(id); toast.success('Done'); setPrjSelectedIds(new Set()); setPrjBulkLoading(false); loadProjects(); }
  async function prjBulkRestore() { if (!confirm(`Restore ${prjSelectedIds.size}?`)) return; setPrjBulkLoading(true); const fn = useSelfPrj ? api.restoreMyProject : api.restoreUserProject; for (const id of prjSelectedIds) await fn(id); toast.success('Done'); setPrjSelectedIds(new Set()); setPrjBulkLoading(false); loadProjects(); }
  async function prjBulkPermanentDelete() { if (!confirm(`Permanently delete ${prjSelectedIds.size}?`)) return; setPrjBulkLoading(true); const fn = useSelfPrj ? api.permanentDeleteMyProject : api.permanentDeleteUserProject; for (const id of prjSelectedIds) await fn(id); toast.success('Done'); setPrjSelectedIds(new Set()); setPrjBulkLoading(false); loadProjects(); }
  const prjTotalPages = Math.ceil(prjTotal / prjPageSize);

  // ══════════════ AI Sample Data ══════════════
  function openAiDialog(module: string) {
    setAiModule(module);
    setAiProvider('gemini');
    setAiCount(['profile', 'address', 'contact', 'identity', 'bank'].includes(module) ? 1 : 3);
    setAiGenerated(null);
    setAiDialogOpen(true);
  }

  async function aiGenerate() {
    setAiGenerating(true);
    setAiGenerated(null);
    try {
      const res = await api.generateSampleData({ module: aiModule, provider: aiProvider, target_user_id: userId, count: aiCount });
      if (res.success) { setAiGenerated(res.data); } else { toast.error(res.error || 'Generation failed'); }
    } catch { toast.error('Generation failed'); }
    setAiGenerating(false);
  }

  async function aiSaveAll() {
    if (!aiGenerated?.generated) return;
    setAiSaving(true);
    try {
      const items = Array.isArray(aiGenerated.generated) ? aiGenerated.generated : [aiGenerated.generated];
      const useSelf = isSelf && !isSuperAdmin;
      let saved = 0;
      let lastError = '';

      for (const item of items) {
        let res: any;
        const payload = { ...item, user_id: userId };
        try {
          switch (aiModule) {
            case 'profile':
            case 'address':
            case 'contact':
            case 'identity':
            case 'bank':
              res = await api.upsertUserProfile(userId, item);
              break;
            case 'education':
              res = useSelf ? await api.createMyEducation(payload) : await api.createUserEducation(payload);
              break;
            case 'experience':
              res = useSelf ? await api.createMyExperience(payload) : await api.createUserExperience(payload);
              break;
            case 'social_medias':
              res = useSelf ? await api.createMySocialMedia(payload) : await api.createUserSocialMedia(payload);
              break;
            case 'skills':
              res = useSelf ? await api.createMySkill(payload) : await api.createUserSkill(payload);
              break;
            case 'languages':
              res = useSelf ? await api.createMyLanguage(payload) : await api.createUserLanguage(payload);
              break;
            case 'documents':
              res = useSelf ? await api.createMyDocument(payload) : await api.createUserDocument(payload);
              break;
            case 'projects':
              res = useSelf ? await api.createMyProject(payload) : await api.createUserProject(payload);
              break;
          }
          if (res?.success) saved++;
          else if (res?.error) lastError = res.error;
        } catch (e: any) {
          lastError = e.message || 'Unknown error';
        }
      }

      if (saved === 0) {
        toast.error(lastError || 'Failed to save — AI-generated data may not match the expected format. Try regenerating.');
      } else {
        toast.success(`Saved ${saved}/${items.length} records`);
        setAiDialogOpen(false);
        setAiGenerated(null);
        // Refresh the active tab
        if (['profile', 'address', 'contact', 'identity', 'bank'].includes(aiModule)) load();
        else if (aiModule === 'education') loadEducation();
        else if (aiModule === 'experience') loadExperience();
        else if (aiModule === 'skills') loadSkills();
        else if (aiModule === 'languages') loadLanguages();
        else if (aiModule === 'social_medias') loadSocialMedia();
        else if (aiModule === 'documents') loadDocuments();
        else if (aiModule === 'projects') loadProjects();
      }
    } catch { toast.error('Failed to save records'); }
    setAiSaving(false);
  }

  const AI_MODULE_LABELS: Record<string, string> = {
    profile: 'Profile', address: 'Address', contact: 'Contact & Emergency',
    identity: 'Identity & KYC', bank: 'Bank Details', education: 'Education', experience: 'Experience',
    social_medias: 'Social Media', skills: 'Skills', languages: 'Languages',
    documents: 'Documents', projects: 'Projects',
  };

  // ── Resume AI ──
  function openResumeAi(mode: 'generate' | 'update') {
    setResumeAiMode(mode);
    setResumeAiProvider('gemini');
    setResumeAiPrompt('');
    setResumeAiResult(null);
    setResumeAiOpen(true);
  }

  async function resumeAiGenerate() {
    if (!resumeAiPrompt.trim()) { toast.error('Please enter instructions'); return; }
    setResumeAiGenerating(true);
    setResumeAiResult(null);
    try {
      const res = await api.generateResumeContent({
        provider: resumeAiProvider,
        prompt: resumeAiPrompt.trim(),
        target_user_id: userId,
        mode: resumeAiMode,
      });
      if (res.success) setResumeAiResult(res.data);
      else toast.error(res.error || 'Generation failed');
    } catch { toast.error('Generation failed'); }
    setResumeAiGenerating(false);
  }

  function resumeAiApply() {
    if (!resumeAiResult?.generated) return;
    const { headline, bio } = resumeAiResult.generated;
    if (headline) setValue('headline', headline);
    if (bio) setValue('bio', bio);
    setResumeAiOpen(false);
    setResumeAiResult(null);
    toast.success('Headline & Bio applied — click "Save Profile" to persist');
  }

  // ── Save ──
  async function onSubmit(formData: any) {
    if (!canEdit) return;
    setSaving(true);

    const cleaned: any = {};
    for (const [k, v] of Object.entries(formData)) {
      if (v === '' || v === undefined) cleaned[k] = null;
      else cleaned[k] = v;
    }
    for (const k of ['permanent_country_id', 'permanent_state_id', 'permanent_city_id', 'current_country_id', 'current_state_id', 'current_city_id', 'preferred_language_id']) {
      if (cleaned[k]) cleaned[k] = Number(cleaned[k]);
      else cleaned[k] = null;
    }

    const hasFiles = profileImageFile || coverImageFile;
    let res: any;
    if (hasFiles || removeProfileImage || removeCoverImage) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(cleaned)) {
        if (v !== null && v !== undefined) fd.append(k, String(v));
      }
      if (profileImageFile) fd.append('profile_image', profileImageFile);
      if (coverImageFile) fd.append('cover_image', coverImageFile);
      if (removeProfileImage) fd.append('profile_image_url', 'null');
      if (removeCoverImage) fd.append('cover_image_url', 'null');
      res = isSelf && !isSuperAdmin ? await api.updateMyProfile(fd, true) : await api.upsertUserProfile(userId, fd, true);
    } else {
      res = isSelf && !isSuperAdmin ? await api.updateMyProfile(cleaned) : await api.upsertUserProfile(userId, cleaned);
    }

    if (res.success) {
      toast.success(res.message || 'Profile saved');
      setProfileImageFile(null); setCoverImageFile(null);
      setRemoveProfileImage(false); setRemoveCoverImage(false);
      load();
    } else {
      toast.error(res.error || 'Failed to save');
    }
    setSaving(false);
  }

  // ── Loading ──
  if (loading) return (
    <div className="animate-fade-in">
      <Skeleton className="h-8 w-48 mb-4" />
      <Skeleton className="h-36 mb-6" />
      <div className="flex gap-6">
        <Skeleton className="h-[400px] w-56 flex-shrink-0" />
        <Skeleton className="h-[400px] flex-1" />
      </div>
    </div>
  );

  if (!userData) return <div className="text-slate-500">User not found</div>;

  const completion = profile?.profile_completion_percentage || 0;
  const avatarUrl = profile?.profile_image_url || userData.avatar_url;

  return (
    <div className="animate-fade-in">
      <Link href={`/users/${userId}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to user details
      </Link>

      {/* ── Header Card ── */}
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-brand-500 via-brand-600 to-brand-700 px-6 py-6 relative">
          {/* Cover image as background if exists */}
          {profile?.cover_image_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={profile.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="relative flex items-center gap-5">
            {/* Avatar with camera overlay */}
            <div className="relative group flex-shrink-0">
              <div className="w-[72px] h-[72px] rounded-full border-[3px] border-white/30 shadow-lg overflow-hidden flex items-center justify-center bg-white/20 text-white text-2xl font-bold backdrop-blur-sm">
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initials(userData.full_name)
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Change profile photo"
                >
                  <Camera className="w-5 h-5 text-white drop-shadow" />
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarQuickUpload(f);
                  if (avatarInputRef.current) avatarInputRef.current.value = '';
                }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl font-bold text-white drop-shadow-sm">{userData.full_name}</h1>
              <p className="text-sm text-white mt-0.5 drop-shadow-sm">{userData.email} &middot; {userData.mobile}</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              {profile?.is_profile_public && profile?.profile_slug && (
                <a
                  href={`/resume/${profile.profile_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="View public resume"
                >
                  <Globe2 className="w-4 h-4 text-white" />
                </a>
              )}
              <Badge variant={userData.status === 'active' ? 'success' : 'muted'}>{userData.status}</Badge>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all',
                      completion >= 80 ? 'bg-emerald-400' : completion >= 50 ? 'bg-amber-400' : 'bg-red-400'
                    )}
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-white">{completion}%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Sidebar Tabs + Content ── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="flex gap-6">
          {/* Sidebar */}
          <nav className="w-56 flex-shrink-0">
            <Card className="sticky top-4">
              <div className="py-2">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all text-left',
                        isActive
                          ? 'bg-brand-50 text-brand-700 border-r-2 border-brand-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-brand-600' : 'text-slate-400')} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              {/* Save button in sidebar */}
              {canEdit && (
                <div className="px-3 pb-3 border-t border-slate-100 pt-3">
                  <Button type="submit" disabled={saving} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              )}
            </Card>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Card>
              <div className="px-6 py-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">
                  {TABS.find(t => t.id === activeTab)?.label}
                </h2>
              </div>
              <CardContent className="py-6">
                {/* ── Personal Info Tab ── */}
                {activeTab === 'personal' && (
                  <div className="space-y-6">
                    {canEdit && (
                      <div className="flex justify-end -mb-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('profile')}>
                          <Sparkles className="w-3.5 h-3.5" /> AI Fill Profile
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="Date of Birth" type="date" {...register('date_of_birth')} />
                      <Select
                        label="Gender"
                        {...register('gender')}
                        options={[
                          { value: '', label: 'Select...' },
                          { value: 'male', label: 'Male' },
                          { value: 'female', label: 'Female' },
                          { value: 'other', label: 'Other' },
                          { value: 'prefer_not_to_say', label: 'Prefer not to say' },
                        ]}
                      />
                      <Select
                        label="Blood Group"
                        {...register('blood_group')}
                        options={[
                          { value: '', label: 'Select...' },
                          { value: 'A+', label: 'A+' }, { value: 'A-', label: 'A-' },
                          { value: 'B+', label: 'B+' }, { value: 'B-', label: 'B-' },
                          { value: 'AB+', label: 'AB+' }, { value: 'AB-', label: 'AB-' },
                          { value: 'O+', label: 'O+' }, { value: 'O-', label: 'O-' },
                        ]}
                      />
                      <Select
                        label="Marital Status"
                        {...register('marital_status')}
                        options={[
                          { value: '', label: 'Select...' },
                          { value: 'single', label: 'Single' },
                          { value: 'married', label: 'Married' },
                          { value: 'divorced', label: 'Divorced' },
                          { value: 'widowed', label: 'Widowed' },
                          { value: 'separated', label: 'Separated' },
                        ]}
                      />
                    </div>

                    {/* Profile & Cover Images */}
                    <div className="pt-2">
                      <h3 className="text-sm font-semibold text-slate-700 mb-3">Profile Images</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImageUpload
                          label="Profile Photo"
                          hint="Square image, 500x500px recommended"
                          value={removeProfileImage ? null : profile?.profile_image_url}
                          shape="circle"
                          aspectRatio={1}
                          maxWidth={500}
                          maxHeight={500}
                          onChange={(file) => {
                            if (file) { setProfileImageFile(file); setRemoveProfileImage(false); }
                            else { setProfileImageFile(null); setRemoveProfileImage(true); }
                          }}
                        />
                        <ImageUpload
                          label="Cover Image"
                          hint="Wide image, 1200x400px recommended"
                          value={removeCoverImage ? null : profile?.cover_image_url}
                          shape="rounded"
                          aspectRatio={3}
                          maxWidth={1200}
                          maxHeight={400}
                          onChange={(file) => {
                            if (file) { setCoverImageFile(file); setRemoveCoverImage(false); }
                            else { setCoverImageFile(null); setRemoveCoverImage(true); }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Address Tab ── */}
                {activeTab === 'address' && (
                  <div className="space-y-8">
                    {canEdit && (
                      <div className="flex justify-end -mb-4">
                        <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('address')}>
                          <Sparkles className="w-3.5 h-3.5" /> AI Fill Address
                        </Button>
                      </div>
                    )}
                    {/* Permanent */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" /> Permanent Address
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Address Line 1" {...register('permanent_address_line1')} placeholder="Street, House No." />
                        <Input label="Address Line 2" {...register('permanent_address_line2')} placeholder="Landmark, Area" />
                        <Select label="Country" {...register('permanent_country_id')} options={[{ value: '', label: 'Select country...' }, ...countries.map(c => ({ value: c.id, label: c.name }))]} />
                        <Select label="State" {...register('permanent_state_id')} options={[{ value: '', label: 'Select state...' }, ...permStates.map(s => ({ value: s.id, label: s.name }))]} />
                        <Select label="City" {...register('permanent_city_id')} options={[{ value: '', label: 'Select city...' }, ...permCities.map(c => ({ value: c.id, label: c.name }))]} />
                        <Input label="Postal Code" {...register('permanent_postal_code')} placeholder="e.g. 560001" />
                      </div>
                    </div>

                    <div className="border-t border-slate-100" />

                    {/* Current */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" /> Current Address
                        </h3>
                        <Button type="button" size="sm" variant="outline" onClick={copyAddress}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Same as Permanent
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Address Line 1" {...register('current_address_line1')} placeholder="Street, House No." />
                        <Input label="Address Line 2" {...register('current_address_line2')} placeholder="Landmark, Area" />
                        <Select label="Country" {...register('current_country_id')} options={[{ value: '', label: 'Select country...' }, ...countries.map(c => ({ value: c.id, label: c.name }))]} />
                        <Select label="State" {...register('current_state_id')} options={[{ value: '', label: 'Select state...' }, ...currStates.map(s => ({ value: s.id, label: s.name }))]} />
                        <Select label="City" {...register('current_city_id')} options={[{ value: '', label: 'Select city...' }, ...currCities.map(c => ({ value: c.id, label: c.name }))]} />
                        <Input label="Postal Code" {...register('current_postal_code')} placeholder="e.g. 560001" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Contact & Emergency Tab ── */}
                {activeTab === 'contact' && (
                  <div className="space-y-8">
                    {canEdit && (
                      <div className="flex justify-end -mb-4">
                        <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('contact')}>
                          <Sparkles className="w-3.5 h-3.5" /> AI Fill Contacts
                        </Button>
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400" /> Alternate Contact
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Alternate Email" type="email" {...register('alternate_email')} placeholder="alt@example.com" />
                        <Input label="Alternate Phone" {...register('alternate_phone')} placeholder="+91 9876543210" />
                      </div>
                    </div>

                    <div className="border-t border-slate-100" />

                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <Heart className="w-4 h-4 text-slate-400" /> Emergency Contact
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Contact Name" {...register('emergency_contact_name')} placeholder="Full name" />
                        <Input label="Relationship" {...register('emergency_contact_relationship')} placeholder="e.g. Father, Spouse" />
                        <Input label="Phone" {...register('emergency_contact_phone')} placeholder="+91 9876543210" />
                        <Input label="Email" type="email" {...register('emergency_contact_email')} placeholder="email@example.com" />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Identity & KYC Tab ── */}
                {activeTab === 'identity' && (
                  <div className="space-y-5">
                    {canEdit && (
                      <div className="flex justify-end -mb-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('identity')}>
                          <Sparkles className="w-3.5 h-3.5" /> AI Fill KYC
                        </Button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input label="Aadhar Number" {...register('aadhar_number')} placeholder="12 digit Aadhar" maxLength={12} />
                      <Input label="PAN Number" {...register('pan_number')} placeholder="e.g. ABCDE1234F" maxLength={10} />
                      <Input label="Passport Number" {...register('passport_number')} placeholder="Passport No." maxLength={20} />
                      <Input label="Driving License" {...register('driving_license_number')} placeholder="DL No." maxLength={20} />
                      <Input label="Voter ID" {...register('voter_id')} placeholder="Voter ID" maxLength={20} />
                    </div>
                    {profile?.is_profile_verified && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                        <CheckCircle2 className="w-4 h-4" />
                        Profile verified on {formatDate(profile.profile_verified_at, 'MMM D, YYYY')}
                      </div>
                    )}
                    {!profile?.is_profile_verified && profile && (
                      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                        <AlertCircle className="w-4 h-4" />
                        Profile not yet verified
                      </div>
                    )}

                    {/* ── Document Uploads (merged into Identity & KYC) ── */}
                    <div className="relative pt-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                      <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Document Uploads</span></div>
                    </div>

                    <div className="space-y-4 -mx-6 -mb-6">
                      {/* Toolbar */}
                      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Search identity documents..."
                            value={docSearch}
                            onChange={e => { setDocSearch(e.target.value); setDocPage(1); setDocSelectedIds(new Set()); }}
                            className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-56"
                          />
                          <button
                            type="button"
                            onClick={() => { setDocShowTrash(!docShowTrash); setDocPage(1); setDocSelectedIds(new Set()); }}
                            className={cn('h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5', docShowTrash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> {docShowTrash ? 'Showing Trash' : 'Trash'}
                          </button>
                        </div>
                        {canEdit && !docShowTrash && (
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('documents')}>
                              <Sparkles className="w-3.5 h-3.5" /> AI Generate
                            </Button>
                            <Button type="button" size="sm" onClick={openDocCreate}>
                              <Plus className="w-3.5 h-3.5" /> Upload Document
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Bulk actions */}
                      {docSelectedIds.size > 0 && (
                        <div className="flex items-center justify-between px-5 py-2 bg-brand-50 border-b border-brand-200">
                          <span className="text-sm font-medium text-brand-700">{docSelectedIds.size} selected</span>
                          <div className="flex items-center gap-2">
                            {docShowTrash ? (
                              <>
                                <Button type="button" size="sm" variant="outline" onClick={docBulkRestore} disabled={docBulkLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                                <Button type="button" size="sm" variant="danger" onClick={docBulkPermanentDelete} disabled={docBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                              </>
                            ) : (
                              <Button type="button" size="sm" variant="danger" onClick={docBulkSoftDelete} disabled={docBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                            )}
                            <Button type="button" size="sm" variant="ghost" onClick={() => setDocSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      )}

                      {/* Table */}
                      {docLoading ? (
                        <div className="px-5 py-8 space-y-3">
                          <Skeleton className="h-10" />
                          <Skeleton className="h-10" />
                          <Skeleton className="h-10" />
                        </div>
                      ) : docRecords.length === 0 ? (
                        <div className="px-5 py-12 text-center">
                          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm text-slate-500">{docShowTrash ? 'No records in trash' : 'No identity documents uploaded yet'}</p>
                          {canEdit && !docShowTrash && (
                            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openDocCreate}>
                              <Plus className="w-3.5 h-3.5" /> Upload First Document
                            </Button>
                          )}
                        </div>
                      ) : (
                        <>
                          <Table>
                            <THead>
                              <TR>
                                <TH className="w-10">
                                  <input type="checkbox" checked={docRecords.length > 0 && docSelectedIds.size === docRecords.length} onChange={docToggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                </TH>
                                <TH>Type</TH>
                                <TH>Document</TH>
                                <TH>Number</TH>
                                <TH>File</TH>
                                <TH>Status</TH>
                                <TH className="w-24">Actions</TH>
                              </TR>
                            </THead>
                            <TBody>
                              {docRecords.map((rec: any) => (
                                <TR key={rec.id} className={cn(docShowTrash && 'bg-amber-50/30', docSelectedIds.has(rec.id) && 'bg-brand-50/40')}>
                                  <TD>
                                    <input type="checkbox" checked={docSelectedIds.has(rec.id)} onChange={() => docToggleSelect(rec.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                  </TD>
                                  <TD>
                                    <div className="font-medium text-slate-900 text-sm">{rec.document_type?.name || '—'}</div>
                                  </TD>
                                  <TD>
                                    <div className="text-sm text-slate-700">{rec.document?.name || '—'}</div>
                                  </TD>
                                  <TD>
                                    <div className="text-sm text-slate-700">{rec.document_number || '—'}</div>
                                  </TD>
                                  <TD>
                                    {rec.file ? (
                                      <a href={rec.file} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
                                        View
                                      </a>
                                    ) : '—'}
                                  </TD>
                                  <TD>
                                    {rec.verification_status && (
                                      <Badge variant={rec.verification_status === 'verified' ? 'success' : rec.verification_status === 'pending' ? 'muted' : rec.verification_status === 'rejected' ? 'danger' : 'default'} className="text-[10px] px-1.5 py-0.5">
                                        {rec.verification_status}
                                      </Badge>
                                    )}
                                  </TD>
                                  <TD>
                                    <div className="flex items-center gap-0.5">
                                      {docShowTrash ? (
                                        <>
                                          <button type="button" onClick={() => docRestore(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                                          <button type="button" onClick={() => docPermanentDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </>
                                      ) : (
                                        <>
                                          <button type="button" onClick={() => { setDocViewItem(rec); setDocViewOpen(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                          {canEdit && <button type="button" onClick={() => openDocEdit(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
                                          {canEdit && <button type="button" onClick={() => docSoftDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                        </>
                                      )}
                                    </div>
                                  </TD>
                                </TR>
                              ))}
                            </TBody>
                          </Table>
                          <div className="px-1">
                            <Pagination page={docPage} totalPages={docTotalPages} onPageChange={setDocPage} pageSize={docPageSize} onPageSizeChange={setDocPageSize} total={docTotal} showingCount={docRecords.length} />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Bank Details Tab ── */}
                {activeTab === 'bank' && (
                  <div className="space-y-8">
                    {canEdit && (
                      <div className="flex justify-end -mb-4">
                        <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('bank')}>
                          <Sparkles className="w-3.5 h-3.5" /> AI Fill Bank Details
                        </Button>
                      </div>
                    )}
                    {/* Bank Account */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-400" /> Bank Account
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Account Holder Name" {...register('bank_account_name')} placeholder="Name as per bank" />
                        <Input label="Account Number" {...register('bank_account_number')} placeholder="Account number" />
                        <Input label="IFSC Code" {...register('bank_ifsc_code')} placeholder="e.g. SBIN0001234" maxLength={11} />
                        <Input label="Bank Name" {...register('bank_name')} placeholder="e.g. State Bank of India" />
                        <Input label="Branch" {...register('bank_branch')} placeholder="Branch name" />
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                      <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">OR</span></div>
                    </div>

                    {/* UPI */}
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20" /><path d="m7 7 10 10M17 7 7 17" /></svg>
                        UPI Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="UPI ID" {...register('upi_id')} placeholder="e.g. name@upi or name@paytm" />
                        <Input label="UPI Number" {...register('upi_number')} placeholder="e.g. 9876543210" maxLength={20} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Education Tab ── */}
                {activeTab === 'education' && (
                  <div className="space-y-4 -mx-6 -mt-6 -mb-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search education..."
                          value={eduSearch}
                          onChange={e => { setEduSearch(e.target.value); setEduPage(1); setEduSelectedIds(new Set()); }}
                          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-56"
                        />
                        <button
                          type="button"
                          onClick={() => { setEduShowTrash(!eduShowTrash); setEduPage(1); setEduSelectedIds(new Set()); }}
                          className={cn('h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5', eduShowTrash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {eduShowTrash ? 'Showing Trash' : 'Trash'}
                        </button>
                      </div>
                      {canEdit && !eduShowTrash && (
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('education')}>
                            <Sparkles className="w-3.5 h-3.5" /> AI Generate
                          </Button>
                          <Button type="button" size="sm" onClick={openEduCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Education
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bulk actions */}
                    {eduSelectedIds.size > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 bg-brand-50 border-b border-brand-200">
                        <span className="text-sm font-medium text-brand-700">{eduSelectedIds.size} selected</span>
                        <div className="flex items-center gap-2">
                          {eduShowTrash ? (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={eduBulkRestore} disabled={eduBulkLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                              <Button type="button" size="sm" variant="danger" onClick={eduBulkPermanentDelete} disabled={eduBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" variant="danger" onClick={eduBulkSoftDelete} disabled={eduBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEduSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    )}

                    {/* Table */}
                    {eduLoading ? (
                      <div className="px-5 py-8 space-y-3">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : eduRecords.length === 0 ? (
                      <div className="px-5 py-12 text-center">
                        <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">{eduShowTrash ? 'No records in trash' : 'No education records yet'}</p>
                        {canEdit && !eduShowTrash && (
                          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openEduCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add First Record
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <THead>
                            <TR>
                              <TH className="w-10">
                                <input type="checkbox" checked={eduRecords.length > 0 && eduSelectedIds.size === eduRecords.length} onChange={eduToggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                              </TH>
                              <TH>Level</TH>
                              <TH>Institution</TH>
                              <TH>Field of Study</TH>
                              <TH>Grade</TH>
                              <TH>Duration</TH>
                              <TH className="w-24">Actions</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {eduRecords.map((rec: any) => (
                              <TR key={rec.id} className={cn(eduShowTrash && 'bg-amber-50/30', eduSelectedIds.has(rec.id) && 'bg-brand-50/40')}>
                                <TD>
                                  <input type="checkbox" checked={eduSelectedIds.has(rec.id)} onChange={() => eduToggleSelect(rec.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                </TD>
                                <TD>
                                  <span className="text-xs font-medium text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">
                                    {rec.education_level?.name || '—'}
                                  </span>
                                </TD>
                                <TD>
                                  <div className="font-medium text-slate-900 text-sm">{rec.institution_name}</div>
                                  {rec.board_or_university && <div className="text-xs text-slate-500">{rec.board_or_university}</div>}
                                  <div className="flex gap-1 mt-0.5">
                                    {rec.is_highest_qualification && <Badge variant="success" className="text-[10px] px-1 py-0"><Award className="w-2.5 h-2.5" /> Highest</Badge>}
                                    {rec.is_currently_studying && <Badge variant="default" className="text-[10px] px-1 py-0"><BookOpen className="w-2.5 h-2.5" /> Studying</Badge>}
                                  </div>
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">{rec.field_of_study || '—'}</div>
                                  {rec.specialization && <div className="text-xs text-slate-500">{rec.specialization}</div>}
                                </TD>
                                <TD>
                                  {rec.grade_or_percentage ? (
                                    <span className="text-sm text-slate-700">{rec.grade_or_percentage} {rec.grade_type ? `(${rec.grade_type})` : ''}</span>
                                  ) : '—'}
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">
                                    {rec.start_date ? formatDate(rec.start_date, 'MMM YYYY') : '—'}
                                    {' — '}
                                    {rec.is_currently_studying ? 'Present' : rec.end_date ? formatDate(rec.end_date, 'MMM YYYY') : '—'}
                                  </div>
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-0.5">
                                    {eduShowTrash ? (
                                      <>
                                        <button type="button" onClick={() => eduRestore(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => eduPermanentDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => { setEduViewItem(rec); setEduViewOpen(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                        {canEdit && <button type="button" onClick={() => openEduEdit(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
                                        {canEdit && <button type="button" onClick={() => eduSoftDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                      </>
                                    )}
                                  </div>
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                        <div className="px-1">
                          <Pagination page={eduPage} totalPages={eduTotalPages} onPageChange={setEduPage} pageSize={eduPageSize} onPageSizeChange={setEduPageSize} total={eduTotal} showingCount={eduRecords.length} />
                        </div>
                      </>
                    )}

                  </div>
                )}

                {/* ── Experience Tab ── */}
                {activeTab === 'experience' && (
                  <div className="space-y-4 -mx-6 -mt-6 -mb-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search experience..."
                          value={expSearch}
                          onChange={e => { setExpSearch(e.target.value); setExpPage(1); setExpSelectedIds(new Set()); }}
                          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-56"
                        />
                        <button
                          type="button"
                          onClick={() => { setExpShowTrash(!expShowTrash); setExpPage(1); setExpSelectedIds(new Set()); }}
                          className={cn('h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5', expShowTrash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {expShowTrash ? 'Showing Trash' : 'Trash'}
                        </button>
                      </div>
                      {canEdit && !expShowTrash && (
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('experience')}>
                            <Sparkles className="w-3.5 h-3.5" /> AI Generate
                          </Button>
                          <Button type="button" size="sm" onClick={openExpCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Experience
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bulk actions */}
                    {expSelectedIds.size > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 bg-brand-50 border-b border-brand-200">
                        <span className="text-sm font-medium text-brand-700">{expSelectedIds.size} selected</span>
                        <div className="flex items-center gap-2">
                          {expShowTrash ? (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={expBulkRestore} disabled={expBulkLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                              <Button type="button" size="sm" variant="danger" onClick={expBulkPermanentDelete} disabled={expBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" variant="danger" onClick={expBulkSoftDelete} disabled={expBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => setExpSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    )}

                    {/* Table */}
                    {expLoading ? (
                      <div className="px-5 py-8 space-y-3">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : expRecords.length === 0 ? (
                      <div className="px-5 py-12 text-center">
                        <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">{expShowTrash ? 'No records in trash' : 'No experience records yet'}</p>
                        {canEdit && !expShowTrash && (
                          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openExpCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add First Record
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <THead>
                            <TR>
                              <TH className="w-10">
                                <input type="checkbox" checked={expRecords.length > 0 && expSelectedIds.size === expRecords.length} onChange={expToggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                              </TH>
                              <TH>Job Title</TH>
                              <TH>Employment Type</TH>
                              <TH>Location</TH>
                              <TH>Duration</TH>
                              <TH className="w-24">Actions</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {expRecords.map((rec: any) => (
                              <TR key={rec.id} className={cn(expShowTrash && 'bg-amber-50/30', expSelectedIds.has(rec.id) && 'bg-brand-50/40')}>
                                <TD>
                                  <input type="checkbox" checked={expSelectedIds.has(rec.id)} onChange={() => expToggleSelect(rec.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                </TD>
                                <TD>
                                  <div className="font-medium text-slate-900 text-sm">{rec.job_title}</div>
                                  {rec.company_name && <div className="text-xs text-slate-500">{rec.company_name}</div>}
                                  <div className="flex gap-1 mt-0.5">
                                    {rec.is_current_job && <Badge variant="default" className="text-[10px] px-1 py-0">Current</Badge>}
                                  </div>
                                </TD>
                                <TD>
                                  {rec.employment_type && (
                                    <Badge variant="muted" className="text-[10px] px-1.5 py-0.5">
                                      {rec.employment_type}
                                    </Badge>
                                  )}
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">{rec.location || '—'}</div>
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">
                                    {rec.start_date ? formatDate(rec.start_date, 'MMM YYYY') : '—'}
                                    {' — '}
                                    {rec.is_current_job ? 'Present' : rec.end_date ? formatDate(rec.end_date, 'MMM YYYY') : '—'}
                                  </div>
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-0.5">
                                    {expShowTrash ? (
                                      <>
                                        <button type="button" onClick={() => expRestore(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => expPermanentDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => { setExpViewItem(rec); setExpViewOpen(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                        {canEdit && <button type="button" onClick={() => openExpEdit(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
                                        {canEdit && <button type="button" onClick={() => expSoftDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                      </>
                                    )}
                                  </div>
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                        <div className="px-1">
                          <Pagination page={expPage} totalPages={expTotalPages} onPageChange={setExpPage} pageSize={expPageSize} onPageSizeChange={setExpPageSize} total={expTotal} showingCount={expRecords.length} />
                        </div>
                      </>
                    )}

                  </div>
                )}

                {/* ── Skills Tab ── */}
                {activeTab === 'skills' && (
                  <div className="space-y-4 -mx-6 -mt-6 -mb-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search skills..."
                          value={sklSearch}
                          onChange={e => { setSklSearch(e.target.value); setSklPage(1); setSklSelectedIds(new Set()); }}
                          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-56"
                        />
                        <button
                          type="button"
                          onClick={() => { setSklShowTrash(!sklShowTrash); setSklPage(1); setSklSelectedIds(new Set()); }}
                          className={cn('h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5', sklShowTrash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {sklShowTrash ? 'Showing Trash' : 'Trash'}
                        </button>
                      </div>
                      {canEdit && !sklShowTrash && (
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('skills')}>
                            <Sparkles className="w-3.5 h-3.5" /> AI Generate
                          </Button>
                          <Button type="button" size="sm" onClick={openSklCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Skill
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bulk actions */}
                    {sklSelectedIds.size > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 bg-brand-50 border-b border-brand-200">
                        <span className="text-sm font-medium text-brand-700">{sklSelectedIds.size} selected</span>
                        <div className="flex items-center gap-2">
                          {sklShowTrash ? (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={sklBulkRestore} disabled={sklBulkLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                              <Button type="button" size="sm" variant="danger" onClick={sklBulkPermanentDelete} disabled={sklBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" variant="danger" onClick={sklBulkSoftDelete} disabled={sklBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => setSklSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    )}

                    {/* Table */}
                    {sklLoading ? (
                      <div className="px-5 py-8 space-y-3">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : sklRecords.length === 0 ? (
                      <div className="px-5 py-12 text-center">
                        <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">{sklShowTrash ? 'No records in trash' : 'No skills yet'}</p>
                        {canEdit && !sklShowTrash && (
                          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openSklCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add First Record
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <THead>
                            <TR>
                              <TH className="w-10">
                                <input type="checkbox" checked={sklRecords.length > 0 && sklSelectedIds.size === sklRecords.length} onChange={sklToggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                              </TH>
                              <TH>Skill</TH>
                              <TH>Proficiency</TH>
                              <TH>Years</TH>
                              <TH>Primary</TH>
                              <TH className="w-24">Actions</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {sklRecords.map((rec: any) => (
                              <TR key={rec.id} className={cn(sklShowTrash && 'bg-amber-50/30', sklSelectedIds.has(rec.id) && 'bg-brand-50/40')}>
                                <TD>
                                  <input type="checkbox" checked={sklSelectedIds.has(rec.id)} onChange={() => sklToggleSelect(rec.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                </TD>
                                <TD>
                                  <div className="font-medium text-slate-900 text-sm">{rec.skill?.name || '—'}</div>
                                </TD>
                                <TD>
                                  {rec.proficiency_level && (
                                    <Badge variant="muted" className="text-[10px] px-1.5 py-0.5">
                                      {rec.proficiency_level}
                                    </Badge>
                                  )}
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">{rec.years_of_experience || '—'}</div>
                                </TD>
                                <TD>
                                  {rec.is_primary_skill && <Badge variant="default" className="text-[10px] px-1 py-0">Primary</Badge>}
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-0.5">
                                    {sklShowTrash ? (
                                      <>
                                        <button type="button" onClick={() => sklRestore(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => sklPermanentDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => { setSklViewItem(rec); setSklViewOpen(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                        {canEdit && <button type="button" onClick={() => openSklEdit(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
                                        {canEdit && <button type="button" onClick={() => sklSoftDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                      </>
                                    )}
                                  </div>
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                        <div className="px-1">
                          <Pagination page={sklPage} totalPages={sklTotalPages} onPageChange={setSklPage} pageSize={sklPageSize} onPageSizeChange={setSklPageSize} total={sklTotal} showingCount={sklRecords.length} />
                        </div>
                      </>
                    )}

                  </div>
                )}

                {/* ── Languages Tab ── */}
                {activeTab === 'languages' && (
                  <div className="space-y-4 -mx-6 -mt-6 -mb-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search languages..."
                          value={lngSearch}
                          onChange={e => { setLngSearch(e.target.value); setLngPage(1); setLngSelectedIds(new Set()); }}
                          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-56"
                        />
                        <button
                          type="button"
                          onClick={() => { setLngShowTrash(!lngShowTrash); setLngPage(1); setLngSelectedIds(new Set()); }}
                          className={cn('h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5', lngShowTrash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {lngShowTrash ? 'Showing Trash' : 'Trash'}
                        </button>
                      </div>
                      {canEdit && !lngShowTrash && (
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('languages')}>
                            <Sparkles className="w-3.5 h-3.5" /> AI Generate
                          </Button>
                          <Button type="button" size="sm" onClick={openLngCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Language
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bulk actions */}
                    {lngSelectedIds.size > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 bg-brand-50 border-b border-brand-200">
                        <span className="text-sm font-medium text-brand-700">{lngSelectedIds.size} selected</span>
                        <div className="flex items-center gap-2">
                          {lngShowTrash ? (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={lngBulkRestore} disabled={lngBulkLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                              <Button type="button" size="sm" variant="danger" onClick={lngBulkPermanentDelete} disabled={lngBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" variant="danger" onClick={lngBulkSoftDelete} disabled={lngBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => setLngSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    )}

                    {/* Table */}
                    {lngLoading ? (
                      <div className="px-5 py-8 space-y-3">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : lngRecords.length === 0 ? (
                      <div className="px-5 py-12 text-center">
                        <Languages className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">{lngShowTrash ? 'No records in trash' : 'No languages yet'}</p>
                        {canEdit && !lngShowTrash && (
                          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openLngCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add First Record
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <THead>
                            <TR>
                              <TH className="w-10">
                                <input type="checkbox" checked={lngRecords.length > 0 && lngSelectedIds.size === lngRecords.length} onChange={lngToggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                              </TH>
                              <TH>Language</TH>
                              <TH>Proficiency</TH>
                              <TH>Read/Write/Speak</TH>
                              <TH>Primary/Native</TH>
                              <TH className="w-24">Actions</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {lngRecords.map((rec: any) => (
                              <TR key={rec.id} className={cn(lngShowTrash && 'bg-amber-50/30', lngSelectedIds.has(rec.id) && 'bg-brand-50/40')}>
                                <TD>
                                  <input type="checkbox" checked={lngSelectedIds.has(rec.id)} onChange={() => lngToggleSelect(rec.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                </TD>
                                <TD>
                                  <div className="font-medium text-slate-900 text-sm">{rec.language?.name || '—'}</div>
                                </TD>
                                <TD>
                                  {rec.proficiency_level && (
                                    <Badge variant="muted" className="text-[10px] px-1.5 py-0.5">
                                      {rec.proficiency_level}
                                    </Badge>
                                  )}
                                </TD>
                                <TD>
                                  <div className="flex gap-2 text-xs text-slate-600">
                                    {rec.can_read && <span title="Can read"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></span>}
                                    {rec.can_write && <span title="Can write"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></span>}
                                    {rec.can_speak && <span title="Can speak"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></span>}
                                    {!rec.can_read && !rec.can_write && !rec.can_speak && '—'}
                                  </div>
                                </TD>
                                <TD>
                                  <div className="flex gap-1">
                                    {rec.is_primary_language && <Badge variant="default" className="text-[10px] px-1 py-0">Primary</Badge>}
                                    {rec.is_native_language && <Badge variant="default" className="text-[10px] px-1 py-0">Native</Badge>}
                                  </div>
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-0.5">
                                    {lngShowTrash ? (
                                      <>
                                        <button type="button" onClick={() => lngRestore(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => lngPermanentDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => { setLngViewItem(rec); setLngViewOpen(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                        {canEdit && <button type="button" onClick={() => openLngEdit(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
                                        {canEdit && <button type="button" onClick={() => lngSoftDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                      </>
                                    )}
                                  </div>
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                        <div className="px-1">
                          <Pagination page={lngPage} totalPages={lngTotalPages} onPageChange={setLngPage} pageSize={lngPageSize} onPageSizeChange={setLngPageSize} total={lngTotal} showingCount={lngRecords.length} />
                        </div>
                      </>
                    )}

                  </div>
                )}

                {/* ── Social Media Tab ── */}
                {activeTab === 'social' && (
                  <div className="space-y-4 -mx-6 -mt-6 -mb-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search social media..."
                          value={smSearch}
                          onChange={e => { setSmSearch(e.target.value); setSmPage(1); setSmSelectedIds(new Set()); }}
                          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-56"
                        />
                        <button
                          type="button"
                          onClick={() => { setSmShowTrash(!smShowTrash); setSmPage(1); setSmSelectedIds(new Set()); }}
                          className={cn('h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5', smShowTrash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {smShowTrash ? 'Showing Trash' : 'Trash'}
                        </button>
                      </div>
                      {canEdit && !smShowTrash && (
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('social_medias')}>
                            <Sparkles className="w-3.5 h-3.5" /> AI Generate
                          </Button>
                          <Button type="button" size="sm" onClick={openSmCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Social Media
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bulk actions */}
                    {smSelectedIds.size > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 bg-brand-50 border-b border-brand-200">
                        <span className="text-sm font-medium text-brand-700">{smSelectedIds.size} selected</span>
                        <div className="flex items-center gap-2">
                          {smShowTrash ? (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={smBulkRestore} disabled={smBulkLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                              <Button type="button" size="sm" variant="danger" onClick={smBulkPermanentDelete} disabled={smBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" variant="danger" onClick={smBulkSoftDelete} disabled={smBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => setSmSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    )}

                    {/* Table */}
                    {smLoading ? (
                      <div className="px-5 py-8 space-y-3">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : smRecords.length === 0 ? (
                      <div className="px-5 py-12 text-center">
                        <Share2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">{smShowTrash ? 'No records in trash' : 'No social media accounts yet'}</p>
                        {canEdit && !smShowTrash && (
                          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openSmCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add First Record
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <THead>
                            <TR>
                              <TH className="w-10">
                                <input type="checkbox" checked={smRecords.length > 0 && smSelectedIds.size === smRecords.length} onChange={smToggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                              </TH>
                              <TH>Platform</TH>
                              <TH>Username</TH>
                              <TH>Profile URL</TH>
                              <TH>Primary</TH>
                              <TH className="w-24">Actions</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {smRecords.map((rec: any) => (
                              <TR key={rec.id} className={cn(smShowTrash && 'bg-amber-50/30', smSelectedIds.has(rec.id) && 'bg-brand-50/40')}>
                                <TD>
                                  <input type="checkbox" checked={smSelectedIds.has(rec.id)} onChange={() => smToggleSelect(rec.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                </TD>
                                <TD>
                                  <div className="font-medium text-slate-900 text-sm">{rec.social_media?.name || '—'}</div>
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">{rec.username || '—'}</div>
                                </TD>
                                <TD>
                                  {rec.profile_url ? (
                                    <a href={rec.profile_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">
                                      Visit Profile
                                    </a>
                                  ) : '—'}
                                </TD>
                                <TD>
                                  {rec.is_primary && <Badge variant="default" className="text-[10px] px-1 py-0">Primary</Badge>}
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-0.5">
                                    {smShowTrash ? (
                                      <>
                                        <button type="button" onClick={() => smRestore(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => smPermanentDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => { setSmViewItem(rec); setSmViewOpen(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                        {canEdit && <button type="button" onClick={() => openSmEdit(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
                                        {canEdit && <button type="button" onClick={() => smSoftDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                      </>
                                    )}
                                  </div>
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                        <div className="px-1">
                          <Pagination page={smPage} totalPages={smTotalPages} onPageChange={setSmPage} pageSize={smPageSize} onPageSizeChange={setSmPageSize} total={smTotal} showingCount={smRecords.length} />
                        </div>
                      </>
                    )}

                  </div>
                )}

                {/* ── Projects Tab ── */}
                {activeTab === 'projects' && (
                  <div className="space-y-4 -mx-6 -mt-6 -mb-6">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Search projects..."
                          value={prjSearch}
                          onChange={e => { setPrjSearch(e.target.value); setPrjPage(1); setPrjSelectedIds(new Set()); }}
                          className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-56"
                        />
                        <button
                          type="button"
                          onClick={() => { setPrjShowTrash(!prjShowTrash); setPrjPage(1); setPrjSelectedIds(new Set()); }}
                          className={cn('h-9 px-3 text-sm rounded-lg border transition-colors flex items-center gap-1.5', prjShowTrash ? 'bg-amber-50 border-amber-200 text-amber-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {prjShowTrash ? 'Showing Trash' : 'Trash'}
                        </button>
                      </div>
                      {canEdit && !prjShowTrash && (
                        <div className="flex items-center gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openAiDialog('projects')}>
                            <Sparkles className="w-3.5 h-3.5" /> AI Generate
                          </Button>
                          <Button type="button" size="sm" onClick={openPrjCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add Project
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Bulk actions */}
                    {prjSelectedIds.size > 0 && (
                      <div className="flex items-center justify-between px-5 py-2 bg-brand-50 border-b border-brand-200">
                        <span className="text-sm font-medium text-brand-700">{prjSelectedIds.size} selected</span>
                        <div className="flex items-center gap-2">
                          {prjShowTrash ? (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={prjBulkRestore} disabled={prjBulkLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                              <Button type="button" size="sm" variant="danger" onClick={prjBulkPermanentDelete} disabled={prjBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                            </>
                          ) : (
                            <Button type="button" size="sm" variant="danger" onClick={prjBulkSoftDelete} disabled={prjBulkLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => setPrjSelectedIds(new Set())}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    )}

                    {/* Table */}
                    {prjLoading ? (
                      <div className="px-5 py-8 space-y-3">
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                        <Skeleton className="h-10" />
                      </div>
                    ) : prjRecords.length === 0 ? (
                      <div className="px-5 py-12 text-center">
                        <FolderKanban className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-500">{prjShowTrash ? 'No records in trash' : 'No projects yet'}</p>
                        {canEdit && !prjShowTrash && (
                          <Button type="button" size="sm" variant="outline" className="mt-3" onClick={openPrjCreate}>
                            <Plus className="w-3.5 h-3.5" /> Add First Record
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <Table>
                          <THead>
                            <TR>
                              <TH className="w-10">
                                <input type="checkbox" checked={prjRecords.length > 0 && prjSelectedIds.size === prjRecords.length} onChange={prjToggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                              </TH>
                              <TH>Project</TH>
                              <TH>Type</TH>
                              <TH>Status</TH>
                              <TH>Technologies</TH>
                              <TH>Duration</TH>
                              <TH className="w-24">Actions</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {prjRecords.map((rec: any) => (
                              <TR key={rec.id} className={cn(prjShowTrash && 'bg-amber-50/30', prjSelectedIds.has(rec.id) && 'bg-brand-50/40')}>
                                <TD>
                                  <input type="checkbox" checked={prjSelectedIds.has(rec.id)} onChange={() => prjToggleSelect(rec.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" />
                                </TD>
                                <TD>
                                  <div className="font-medium text-slate-900 text-sm">{rec.title}</div>
                                  {rec.organization && <div className="text-xs text-slate-500">{rec.organization}</div>}
                                  <div className="flex gap-1 mt-0.5">
                                    {rec.is_featured && <Badge variant="default" className="text-[10px] px-1 py-0">Featured</Badge>}
                                  </div>
                                </TD>
                                <TD>
                                  {rec.project_type && (
                                    <Badge variant="muted" className="text-[10px] px-1.5 py-0.5">
                                      {rec.project_type}
                                    </Badge>
                                  )}
                                </TD>
                                <TD>
                                  {rec.status && (
                                    <Badge variant="muted" className="text-[10px] px-1.5 py-0.5">
                                      {rec.status}
                                    </Badge>
                                  )}
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">{rec.technologies || '—'}</div>
                                </TD>
                                <TD>
                                  <div className="text-sm text-slate-700">
                                    {rec.start_date ? formatDate(rec.start_date, 'MMM YYYY') : '—'}
                                    {' — '}
                                    {rec.end_date ? formatDate(rec.end_date, 'MMM YYYY') : 'Present'}
                                  </div>
                                </TD>
                                <TD>
                                  <div className="flex items-center gap-0.5">
                                    {prjShowTrash ? (
                                      <>
                                        <button type="button" onClick={() => prjRestore(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => prjPermanentDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </>
                                    ) : (
                                      <>
                                        <button type="button" onClick={() => { setPrjViewItem(rec); setPrjViewOpen(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                                        {canEdit && <button type="button" onClick={() => openPrjEdit(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>}
                                        {canEdit && <button type="button" onClick={() => prjSoftDelete(rec)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                      </>
                                    )}
                                  </div>
                                </TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                        <div className="px-1">
                          <Pagination page={prjPage} totalPages={prjTotalPages} onPageChange={setPrjPage} pageSize={prjPageSize} onPageSizeChange={setPrjPageSize} total={prjTotal} showingCount={prjRecords.length} />
                        </div>
                      </>
                    )}

                  </div>
                )}

                {/* ── Resume Tab ── */}
                {activeTab === 'resume' && (
                  <CardContent className="p-6">
                    <div className="space-y-6">
                      {/* Public Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">Public Resume</div>
                          <div className="text-xs text-slate-500 mt-0.5">Allow anyone to view your resume via a public link</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" {...register('is_profile_public')} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                        </label>
                      </div>

                      {/* Resume URL Slug */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Resume URL Slug</label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">/resume/</span>
                          <Input {...register('profile_slug')} placeholder="e.g. girish-kumar" className="flex-1" />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, hyphens, dots, underscores only</p>
                        {profile?.is_profile_public && profile?.profile_slug && (
                          <a
                            href={`/resume/${profile.profile_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 mt-2"
                          >
                            <Globe2 className="w-3.5 h-3.5" /> View live resume
                          </a>
                        )}
                      </div>

                      {/* Headline + Bio with AI */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-semibold text-slate-800">Headline & Bio</label>
                          {canEdit && (
                            <div className="flex gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => openResumeAi('generate')}>
                                <Sparkles className="w-3.5 h-3.5" /> AI Generate
                              </Button>
                              {(watch('headline') || watch('bio')) && (
                                <Button type="button" size="sm" variant="outline" onClick={() => openResumeAi('update')}>
                                  <Pencil className="w-3.5 h-3.5" /> AI Update
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Headline</label>
                          <Input {...register('headline')} placeholder="e.g. Full Stack Developer · React & Node.js Expert" maxLength={200} />
                          <p className="text-xs text-slate-500 mt-1">A short tagline displayed below your name on the resume</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">Bio</label>
                          <textarea
                            {...register('bio')}
                            rows={5}
                            maxLength={2000}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition-all resize-none"
                            placeholder="Write a short bio about yourself..."
                          />
                          <p className="text-xs text-slate-500 mt-1">Displayed at the top of your public resume (max 2000 characters)</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}

                {/* ── Resume AI Dialog ── */}
                <Dialog open={resumeAiOpen} onClose={() => { setResumeAiOpen(false); setResumeAiResult(null); }} title={`AI ${resumeAiMode === 'generate' ? 'Generate' : 'Update'} Headline & Bio`} size="lg">
                  <div className="p-6 space-y-5">
                    {/* Mode Toggle */}
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      <button type="button" onClick={() => { setResumeAiMode('generate'); setResumeAiResult(null); }} className={cn('flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors', resumeAiMode === 'generate' ? 'bg-brand-50 text-brand-700 border-r border-brand-200' : 'bg-white text-slate-600 hover:bg-slate-50 border-r border-slate-200')}>
                        <Sparkles className="w-4 h-4" /> Generate New
                      </button>
                      <button type="button" onClick={() => { setResumeAiMode('update'); setResumeAiResult(null); }} className={cn('flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors', resumeAiMode === 'update' ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-600 hover:bg-slate-50')}>
                        <Pencil className="w-4 h-4" /> Update Existing
                      </button>
                    </div>

                    {/* Provider */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'anthropic', name: 'Anthropic', sub: 'Claude Haiku 4.5' },
                          { id: 'openai', name: 'OpenAI', sub: 'GPT-4o Mini' },
                          { id: 'gemini', name: 'Google', sub: 'Gemini 2.5 Flash' },
                        ].map(p => (
                          <button key={p.id} type="button" onClick={() => setResumeAiProvider(p.id)} className={cn('p-3 rounded-lg border-2 text-left transition-all', resumeAiProvider === p.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300 bg-white')}>
                            <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{p.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Update info */}
                    {resumeAiMode === 'update' && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                        AI will read your current headline & bio and update them based on your instructions.
                      </div>
                    )}

                    {/* Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {resumeAiMode === 'update' ? 'Update Instructions' : 'Instructions'}{' '}
                        <span className="text-red-400 font-normal">(required)</span>
                      </label>
                      <textarea
                        value={resumeAiPrompt}
                        onChange={e => setResumeAiPrompt(e.target.value)}
                        placeholder={resumeAiMode === 'update'
                          ? 'e.g. "Make the headline more technical", "Shorten the bio", "Add cloud computing focus"...'
                          : 'e.g. "Write a headline and bio for a senior full-stack developer focused on React and Node.js", "Make it sound professional and confident"...'
                        }
                        rows={3}
                        className={cn(
                          'w-full px-3 py-2 text-sm rounded-lg border bg-white focus:ring-2 focus:outline-none resize-none',
                          !resumeAiPrompt.trim()
                            ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20'
                            : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/20'
                        )}
                      />
                    </div>

                    {/* Generate Button */}
                    {!resumeAiResult && (
                      <Button type="button" onClick={resumeAiGenerate} disabled={resumeAiGenerating || !resumeAiPrompt.trim()} className="w-full">
                        {resumeAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : resumeAiMode === 'update' ? <Pencil className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        {resumeAiGenerating ? 'Generating...' : resumeAiMode === 'update' ? 'Update with AI' : 'Generate with AI'}
                      </Button>
                    )}

                    {/* Results Preview */}
                    {resumeAiResult?.generated && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={cn('text-sm font-medium flex items-center gap-1.5', resumeAiMode === 'update' ? 'text-amber-700' : 'text-emerald-700')}>
                            <Check className="w-4 h-4" /> {resumeAiMode === 'update' ? 'Updated' : 'Generated'} successfully
                          </span>
                          <span className="text-xs text-slate-400">
                            {resumeAiResult.usage?.total_tokens?.toLocaleString()} tokens
                          </span>
                        </div>

                        {resumeAiResult.generated.headline && (
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Headline</label>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{resumeAiResult.generated.headline}</div>
                          </div>
                        )}
                        {resumeAiResult.generated.bio && (
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Bio</label>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap">{resumeAiResult.generated.bio}</div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button type="button" onClick={resumeAiApply} className="flex-1">
                            <Check className="w-4 h-4" /> Apply to Form
                          </Button>
                          <Button type="button" variant="outline" onClick={resumeAiGenerate} disabled={resumeAiGenerating}>
                            <RefreshCw className="w-4 h-4" /> Regenerate
                          </Button>
                        </div>
                        <p className="text-xs text-slate-400 text-center">Applying will fill the form fields — click &quot;Save Profile&quot; to persist changes.</p>
                      </div>
                    )}
                  </div>
                </Dialog>

                {/* ── Preferences Tab ── */}
                {activeTab === 'preferences' && (
                  <div className="space-y-6">
                    <Select
                      label="Preferred Language"
                      {...register('preferred_language_id')}
                      options={[{ value: '', label: 'Select language...' }, ...languages.map(l => ({ value: l.id, label: l.name }))]}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">Notification Preferences</label>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input type="checkbox" {...register('notification_email')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">Email Notifications</div>
                            <div className="text-xs text-slate-500">Receive updates and alerts via email</div>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input type="checkbox" {...register('notification_sms')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">SMS Notifications</div>
                            <div className="text-xs text-slate-500">Receive important alerts via SMS</div>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                          <input type="checkbox" {...register('notification_push')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">Push Notifications</div>
                            <div className="text-xs text-slate-500">Receive real-time push notifications</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* Education Dialogs — rendered outside the main form to avoid nested <form> error */}
      <Dialog open={eduDialogOpen} onClose={() => setEduDialogOpen(false)} title={eduEditing ? 'Edit Education' : 'Add Education'} size="lg">
        <form onSubmit={eduHandleSubmit(onEduSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Education Level *" {...eduRegister('education_level_id')} options={[{ value: '', label: 'Select level...' }, ...eduLevels.map(l => ({ value: l.id, label: l.name }))]} />
            <Input label="Institution Name *" {...eduRegister('institution_name')} placeholder="e.g. IIT Bombay" />
            <Input label="Board / University" {...eduRegister('board_or_university')} placeholder="e.g. CBSE, Mumbai University" />
            <Input label="Field of Study" {...eduRegister('field_of_study')} placeholder="e.g. Computer Science" />
            <Input label="Specialization" {...eduRegister('specialization')} placeholder="e.g. Machine Learning" />
            <Select label="Grade Type" {...eduRegister('grade_type')} options={GRADE_TYPES} />
            <Input label="Grade / Percentage" {...eduRegister('grade_or_percentage')} placeholder="e.g. 85% or 8.5 CGPA" />
            <Input label="Start Date" type="date" {...eduRegister('start_date')} />
            <Input label="End Date" type="date" {...eduRegister('end_date')} />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...eduRegister('is_currently_studying')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-slate-700">Currently Studying</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...eduRegister('is_highest_qualification')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-slate-700">Highest Qualification</span>
            </label>
          </div>
          <Input label="Description / Notes" {...eduRegister('description')} placeholder="Achievements, extra details..." />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEduDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={eduSaving}>
              {eduSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {eduSaving ? 'Saving...' : eduEditing ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={eduViewOpen} onClose={() => setEduViewOpen(false)} title="Education Details" size="lg">
        {eduViewItem && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div><div className="text-xs text-slate-500 mb-0.5">Education Level</div><div className="text-sm font-medium text-slate-900">{eduViewItem.education_level?.name || '—'}</div></div>
              <div><div className="text-xs text-slate-500 mb-0.5">Institution</div><div className="text-sm font-medium text-slate-900">{eduViewItem.institution_name}</div></div>
              <div><div className="text-xs text-slate-500 mb-0.5">Board / University</div><div className="text-sm font-medium text-slate-900">{eduViewItem.board_or_university || '—'}</div></div>
              <div><div className="text-xs text-slate-500 mb-0.5">Field of Study</div><div className="text-sm font-medium text-slate-900">{eduViewItem.field_of_study || '—'}</div></div>
              <div><div className="text-xs text-slate-500 mb-0.5">Specialization</div><div className="text-sm font-medium text-slate-900">{eduViewItem.specialization || '—'}</div></div>
              <div><div className="text-xs text-slate-500 mb-0.5">Grade</div><div className="text-sm font-medium text-slate-900">{eduViewItem.grade_or_percentage || '—'} {eduViewItem.grade_type ? `(${eduViewItem.grade_type})` : ''}</div></div>
              <div><div className="text-xs text-slate-500 mb-0.5">Start Date</div><div className="text-sm font-medium text-slate-900">{eduViewItem.start_date ? formatDate(eduViewItem.start_date, 'MMM D, YYYY') : '—'}</div></div>
              <div><div className="text-xs text-slate-500 mb-0.5">End Date</div><div className="text-sm font-medium text-slate-900">{eduViewItem.is_currently_studying ? 'Present' : eduViewItem.end_date ? formatDate(eduViewItem.end_date, 'MMM D, YYYY') : '—'}</div></div>
            </div>
            {eduViewItem.description && (
              <div><div className="text-xs text-slate-500 mb-0.5">Description</div><div className="text-sm text-slate-700">{eduViewItem.description}</div></div>
            )}
            <div className="flex gap-2">
              {eduViewItem.is_highest_qualification && <Badge variant="success"><Award className="w-3 h-3" /> Highest Qualification</Badge>}
              {eduViewItem.is_currently_studying && <Badge variant="default"><BookOpen className="w-3 h-3" /> Currently Studying</Badge>}
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Experience Dialogs ── */}
      <Dialog open={expDialogOpen} onClose={() => setExpDialogOpen(false)} title={expEditing ? 'Edit Experience' : 'Add Experience'} size="lg">
        <form onSubmit={expHandleSubmit(onExpSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Company Name *" {...expRegister('company_name')} placeholder="e.g. TCS, Google" />
            <Input label="Job Title *" {...expRegister('job_title')} placeholder="e.g. Senior Developer" />
            <Select label="Employment Type" {...expRegister('employment_type')} options={[{value:'full_time',label:'Full Time'},{value:'part_time',label:'Part Time'},{value:'contract',label:'Contract'},{value:'internship',label:'Internship'},{value:'freelance',label:'Freelance'},{value:'self_employed',label:'Self Employed'},{value:'volunteer',label:'Volunteer'},{value:'apprenticeship',label:'Apprenticeship'},{value:'other',label:'Other'}]} />
            <Select label="Work Mode" {...expRegister('work_mode')} options={[{value:'on_site',label:'On-site'},{value:'remote',label:'Remote'},{value:'hybrid',label:'Hybrid'}]} />
            <Select label="Designation" {...expRegister('designation_id')} options={[{value:'',label:'Select...'}, ...designations.map(d => ({value:d.id,label:d.name}))]} />
            <Input label="Department" {...expRegister('department')} placeholder="e.g. Engineering" />
            <Input label="Location" {...expRegister('location')} placeholder="e.g. Mumbai, India" />
            <Input label="Start Date *" type="date" {...expRegister('start_date')} />
            <Input label="End Date" type="date" {...expRegister('end_date')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...expRegister('is_current_job')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Currently Working Here</span></label>
          <Input label="Description" {...expRegister('description')} placeholder="Role description, responsibilities..." />
          <Input label="Key Achievements" {...expRegister('key_achievements')} placeholder="Notable results..." />
          <Input label="Skills Used" {...expRegister('skills_used')} placeholder="React, Node.js, etc." />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setExpDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={expSaving}>{expSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{expSaving ? 'Saving...' : expEditing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={expViewOpen} onClose={() => setExpViewOpen(false)} title="Experience Details" size="lg">
        {expViewItem && (<div className="p-5 space-y-4"><div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div><div className="text-xs text-slate-500 mb-0.5">Company</div><div className="text-sm font-medium text-slate-900">{expViewItem.company_name}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Job Title</div><div className="text-sm font-medium text-slate-900">{expViewItem.job_title}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Employment Type</div><div className="text-sm font-medium text-slate-900">{expViewItem.employment_type?.replace(/_/g,' ')}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Work Mode</div><div className="text-sm font-medium text-slate-900">{expViewItem.work_mode?.replace(/_/g,' ')}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Department</div><div className="text-sm font-medium text-slate-900">{expViewItem.department || '—'}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Location</div><div className="text-sm font-medium text-slate-900">{expViewItem.location || '—'}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Duration</div><div className="text-sm font-medium text-slate-900">{expViewItem.start_date ? formatDate(expViewItem.start_date, 'MMM YYYY') : '—'} — {expViewItem.is_current_job ? 'Present' : expViewItem.end_date ? formatDate(expViewItem.end_date, 'MMM YYYY') : '—'}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Designation</div><div className="text-sm font-medium text-slate-900">{expViewItem.designation?.name || '—'}</div></div>
        </div>
        {expViewItem.description && <div><div className="text-xs text-slate-500 mb-0.5">Description</div><div className="text-sm text-slate-700">{expViewItem.description}</div></div>}
        {expViewItem.key_achievements && <div><div className="text-xs text-slate-500 mb-0.5">Key Achievements</div><div className="text-sm text-slate-700">{expViewItem.key_achievements}</div></div>}
        {expViewItem.skills_used && <div><div className="text-xs text-slate-500 mb-0.5">Skills Used</div><div className="text-sm text-slate-700">{expViewItem.skills_used}</div></div>}
        </div>)}
      </Dialog>

      {/* ── Skills Dialogs ── */}
      <Dialog open={sklDialogOpen} onClose={() => setSklDialogOpen(false)} title={sklEditing ? 'Edit Skill' : 'Add Skill'} size="md">
        <form onSubmit={sklHandleSubmit(onSklSubmit)} className="p-5 space-y-4">
          <Select label="Skill *" {...sklRegister('skill_id')} options={[{value:'',label:'Select skill...'}, ...skillsList.map(s => ({value:s.id,label:s.name}))]} />
          <Select label="Proficiency" {...sklRegister('proficiency_level')} options={[{value:'beginner',label:'Beginner'},{value:'elementary',label:'Elementary'},{value:'intermediate',label:'Intermediate'},{value:'advanced',label:'Advanced'},{value:'expert',label:'Expert'}]} />
          <Input label="Years of Experience" type="number" step="0.5" {...sklRegister('years_of_experience')} placeholder="e.g. 3.5" />
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...sklRegister('is_primary')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Primary Skill</span></label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setSklDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={sklSaving}>{sklSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{sklSaving ? 'Saving...' : sklEditing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Languages Dialogs ── */}
      <Dialog open={lngDialogOpen} onClose={() => setLngDialogOpen(false)} title={lngEditing ? 'Edit Language' : 'Add Language'} size="md">
        <form onSubmit={lngHandleSubmit(onLngSubmit)} className="p-5 space-y-4">
          <Select label="Language *" {...lngRegister('language_id')} options={[{value:'',label:'Select language...'}, ...languagesList.map(l => ({value:l.id,label:l.name}))]} />
          <Select label="Proficiency" {...lngRegister('proficiency_level')} options={[{value:'basic',label:'Basic'},{value:'conversational',label:'Conversational'},{value:'professional',label:'Professional'},{value:'fluent',label:'Fluent'},{value:'native',label:'Native'}]} />
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...lngRegister('can_read')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Can Read</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...lngRegister('can_write')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Can Write</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...lngRegister('can_speak')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Can Speak</span></label>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...lngRegister('is_primary')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Primary Language</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...lngRegister('is_native')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Native Language</span></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setLngDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={lngSaving}>{lngSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{lngSaving ? 'Saving...' : lngEditing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Social Media Dialogs ── */}
      <Dialog open={smDialogOpen} onClose={() => setSmDialogOpen(false)} title={smEditing ? 'Edit Social Link' : 'Add Social Link'} size="md">
        <form onSubmit={smHandleSubmit(onSmSubmit)} className="p-5 space-y-4">
          <Select label="Platform *" {...smRegister('social_media_id')} options={[{value:'',label:'Select platform...'}, ...socialMedias.map(s => ({value:s.id,label:s.name}))]} />
          <Input label="Profile URL *" {...smRegister('profile_url')} placeholder="https://..." />
          <Input label="Username" {...smRegister('username')} placeholder="@handle" />
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...smRegister('is_primary')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Primary Link</span></label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setSmDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={smSaving}>{smSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{smSaving ? 'Saving...' : smEditing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Documents Dialogs ── */}
      <Dialog open={docDialogOpen} onClose={() => { setDocDialogOpen(false); setDocFile(null); setDocPreview(null); }} title={docEditing ? 'Edit Document' : 'Upload Document'} size="lg">
        <form onSubmit={docHandleSubmit(onDocSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Document Type *" {...docRegister('document_type_id')} options={[{value:'',label:'Select type...'}, ...documentTypes.map(d => ({value:d.id,label:d.name}))]} />
            <Select label="Document *" {...docRegister('document_id')} options={[{value:'',label:'Select document...'}, ...documentsList.filter(d => !docWatch('document_type_id') || String(d.document_type_id) === String(docWatch('document_type_id'))).map(d => ({value:d.id,label:d.name}))]} />
            <Input label="Document Number" {...docRegister('document_number')} placeholder="e.g. XXXX-1234" />
            <Input label="Issue Date" type="date" {...docRegister('issue_date')} />
            <Input label="Expiry Date" type="date" {...docRegister('expiry_date')} />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Upload Document *</label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-brand-400 transition-colors">
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                id="doc-file-input"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setDocFile(f);
                    if (f.type.startsWith('image/')) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setDocPreview(ev.target?.result as string);
                      reader.readAsDataURL(f);
                    } else {
                      setDocPreview(null);
                    }
                  }
                }}
              />
              {docFile ? (
                <div className="space-y-2">
                  {docFile.type.startsWith('image/') && docPreview ? (
                    <img src={docPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg border border-slate-200" />
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <FileText className="w-8 h-8 text-red-500" />
                      <span className="text-sm font-medium text-slate-700">{docFile.name}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xs text-slate-500">{(docFile.size / 1024).toFixed(1)} KB</span>
                    <button type="button" onClick={() => { setDocFile(null); setDocPreview(null); }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  </div>
                </div>
              ) : docPreview ? (
                <div className="space-y-2">
                  {docPreview.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) ? (
                    <img src={docPreview} alt="Current file" className="max-h-48 mx-auto rounded-lg border border-slate-200" />
                  ) : (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <FileText className="w-8 h-8 text-red-500" />
                      <a href={docPreview} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">View current file</a>
                    </div>
                  )}
                  <label htmlFor="doc-file-input" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 cursor-pointer">
                    <Edit2 className="w-3 h-3" /> Replace file
                  </label>
                </div>
              ) : (
                <label htmlFor="doc-file-input" className="cursor-pointer block py-6">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <div className="text-sm font-medium text-slate-600">Click to upload image or PDF</div>
                  <div className="text-xs text-slate-400 mt-1">JPG, PNG, PDF up to 10MB</div>
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setDocDialogOpen(false); setDocFile(null); setDocPreview(null); }}>Cancel</Button>
            <Button type="submit" disabled={docSaving}>{docSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{docSaving ? 'Saving...' : docEditing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={docViewOpen} onClose={() => setDocViewOpen(false)} title="Document Details" size="lg">
        {docViewItem && (<div className="p-5 space-y-4">
          {/* File Preview */}
          {docViewItem.file && (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
              {docViewItem.file.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/i) ? (
                <img src={docViewItem.file} alt="Document" className="max-h-80 w-auto mx-auto" />
              ) : docViewItem.file.match(/\.pdf($|\?)/i) ? (
                <iframe src={docViewItem.file} className="w-full h-96" title="PDF Preview" />
              ) : (
                <div className="flex items-center justify-center gap-3 py-8">
                  <FileText className="w-10 h-10 text-slate-400" />
                  <a href={docViewItem.file} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline font-medium">Download File</a>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <div><div className="text-xs text-slate-500 mb-0.5">Document Type</div><div className="text-sm font-medium text-slate-900">{docViewItem.document_type?.name || '—'}</div></div>
            <div><div className="text-xs text-slate-500 mb-0.5">Document</div><div className="text-sm font-medium text-slate-900">{docViewItem.document?.name || '—'}</div></div>
            <div><div className="text-xs text-slate-500 mb-0.5">Document No</div><div className="text-sm font-medium text-slate-900">{docViewItem.document_number || '—'}</div></div>
            <div><div className="text-xs text-slate-500 mb-0.5">Status</div><Badge variant={docViewItem.verification_status === 'verified' ? 'success' : docViewItem.verification_status === 'rejected' ? 'danger' : 'muted'}>{docViewItem.verification_status}</Badge></div>
            <div><div className="text-xs text-slate-500 mb-0.5">Issue Date</div><div className="text-sm font-medium text-slate-900">{docViewItem.issue_date ? formatDate(docViewItem.issue_date, 'MMM D, YYYY') : '—'}</div></div>
            <div><div className="text-xs text-slate-500 mb-0.5">Expiry Date</div><div className="text-sm font-medium text-slate-900">{docViewItem.expiry_date ? formatDate(docViewItem.expiry_date, 'MMM D, YYYY') : '—'}</div></div>
          </div>
          {docViewItem.rejection_reason && <div><div className="text-xs text-slate-500 mb-0.5">Rejection Reason</div><div className="text-sm text-red-600">{docViewItem.rejection_reason}</div></div>}
        </div>)}
      </Dialog>

      {/* ── Projects Dialogs ── */}
      <Dialog open={prjDialogOpen} onClose={() => setPrjDialogOpen(false)} title={prjEditing ? 'Edit Project' : 'Add Project'} size="lg">
        <form onSubmit={prjHandleSubmit(onPrjSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Project Title *" {...prjRegister('project_title')} placeholder="e.g. E-Commerce Platform" />
            <Select label="Project Type" {...prjRegister('project_type')} options={[{value:'personal',label:'Personal'},{value:'academic',label:'Academic'},{value:'professional',label:'Professional'},{value:'freelance',label:'Freelance'},{value:'open_source',label:'Open Source'},{value:'research',label:'Research'},{value:'hackathon',label:'Hackathon'},{value:'other',label:'Other'}]} />
            <Select label="Status" {...prjRegister('project_status')} options={[{value:'planning',label:'Planning'},{value:'in_progress',label:'In Progress'},{value:'completed',label:'Completed'},{value:'on_hold',label:'On Hold'},{value:'cancelled',label:'Cancelled'}]} />
            <Input label="Organization" {...prjRegister('organization_name')} placeholder="Company or university" />
            <Input label="Role" {...prjRegister('role_in_project')} placeholder="e.g. Lead Developer" />
            <Input label="Technologies" {...prjRegister('technologies_used')} placeholder="React, Node.js, etc." />
            <Input label="Start Date" type="date" {...prjRegister('start_date')} />
            <Input label="End Date" type="date" {...prjRegister('end_date')} />
            <Input label="Project URL" {...prjRegister('project_url')} placeholder="https://..." />
            <Input label="Repository URL" {...prjRegister('repository_url')} placeholder="https://github.com/..." />
          </div>
          <Input label="Description" {...prjRegister('description')} placeholder="What the project is about..." />
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...prjRegister('is_ongoing')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Ongoing</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" {...prjRegister('is_featured')} className="w-4 h-4 rounded border-slate-300 text-brand-600" /><span className="text-sm text-slate-700">Featured</span></label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setPrjDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={prjSaving}>{prjSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{prjSaving ? 'Saving...' : prjEditing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={prjViewOpen} onClose={() => setPrjViewOpen(false)} title="Project Details" size="lg">
        {prjViewItem && (<div className="p-5 space-y-4"><div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div><div className="text-xs text-slate-500 mb-0.5">Title</div><div className="text-sm font-medium text-slate-900">{prjViewItem.project_title}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Type</div><div className="text-sm font-medium text-slate-900">{prjViewItem.project_type?.replace(/_/g,' ')}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Status</div><Badge variant={prjViewItem.project_status === 'completed' ? 'success' : prjViewItem.project_status === 'in_progress' ? 'default' : 'muted'}>{prjViewItem.project_status?.replace(/_/g,' ')}</Badge></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Organization</div><div className="text-sm font-medium text-slate-900">{prjViewItem.organization_name || '—'}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Role</div><div className="text-sm font-medium text-slate-900">{prjViewItem.role_in_project || '—'}</div></div>
          <div><div className="text-xs text-slate-500 mb-0.5">Duration</div><div className="text-sm font-medium text-slate-900">{prjViewItem.start_date ? formatDate(prjViewItem.start_date, 'MMM YYYY') : '—'} — {prjViewItem.is_ongoing ? 'Ongoing' : prjViewItem.end_date ? formatDate(prjViewItem.end_date, 'MMM YYYY') : '—'}</div></div>
        </div>
        {prjViewItem.description && <div><div className="text-xs text-slate-500 mb-0.5">Description</div><div className="text-sm text-slate-700">{prjViewItem.description}</div></div>}
        {prjViewItem.technologies_used && <div><div className="text-xs text-slate-500 mb-0.5">Technologies</div><div className="text-sm text-slate-700">{prjViewItem.technologies_used}</div></div>}
        <div className="flex gap-2">
          {prjViewItem.project_url && <a href={prjViewItem.project_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">Live URL</a>}
          {prjViewItem.repository_url && <a href={prjViewItem.repository_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">Repository</a>}
        </div>
        </div>)}
      </Dialog>

      {/* ── AI Sample Data Dialog ── */}
      <Dialog open={aiDialogOpen} onClose={() => { setAiDialogOpen(false); setAiGenerated(null); }} title={`AI Generate ${AI_MODULE_LABELS[aiModule] || aiModule} Data`} size="lg">
        <div className="p-5 space-y-5">
          {/* Provider selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'anthropic', label: 'Anthropic', sub: 'Claude Haiku 4.5' },
                { id: 'openai', label: 'OpenAI', sub: 'GPT-4o Mini' },
                { id: 'gemini', label: 'Google', sub: 'Gemini 2.5 Flash' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAiProvider(p.id)}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    aiProvider === p.id
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  )}
                >
                  <div className="text-sm font-semibold text-slate-900">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Count (hidden for profile) */}
          {aiModule !== 'profile' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of records</label>
              <input
                type="number"
                min={1}
                max={10}
                value={aiCount}
                onChange={e => setAiCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none w-24"
              />
              <span className="text-xs text-slate-500 ml-2">max 10</span>
            </div>
          )}

          {/* Generate button */}
          <Button type="button" onClick={aiGenerate} disabled={aiGenerating} className="w-full">
            {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Sample Data</>}
          </Button>

          {/* Preview generated data */}
          {aiGenerated?.generated && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700">Preview</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{aiGenerated.usage?.total_tokens || 0} tokens</span>
                  <Badge variant="muted">{aiGenerated.provider}</Badge>
                </div>
              </div>
              <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                  {JSON.stringify(aiGenerated.generated, null, 2)}
                </pre>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={aiSaveAll} disabled={aiSaving} className="flex-1">
                  {aiSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save {Array.isArray(aiGenerated.generated) ? `All ${aiGenerated.generated.length} Records` : 'Profile Data'}</>}
                </Button>
                <Button type="button" variant="outline" onClick={aiGenerate} disabled={aiGenerating}>
                  <RotateCcw className="w-4 h-4" /> Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
