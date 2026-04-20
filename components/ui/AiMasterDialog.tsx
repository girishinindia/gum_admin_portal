"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { api } from '@/lib/api';
import { toast } from './Toast';
import { Sparkles, Loader2, Check, RefreshCw, Pencil, Search, CheckSquare, Square, MinusSquare, HelpCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type AIProvider = 'anthropic' | 'openai' | 'gemini';
type Mode = 'generate' | 'update';

const PROVIDERS: { id: AIProvider; name: string; sub: string }[] = [
  { id: 'anthropic', name: 'Anthropic', sub: 'Claude Haiku 4.5' },
  { id: 'openai', name: 'OpenAI', sub: 'GPT-4o Mini' },
  { id: 'gemini', name: 'Google', sub: 'Gemini 2.5 Flash' },
];

const BATCH_SIZE = 25;

/* ─────────────────── Module-specific help tips ─────────────────── */

interface ModuleHelp {
  generate: string[];
  update: { label: string; prompt: string }[];
}

const MODULE_HELP: Record<string, ModuleHelp> = {
  countries: {
    generate: [
      '"Generate all Asian countries with ISO alpha-2 code, dial_code, and currency"',
      '"Generate 10 European countries with name, code, capital in description"',
    ],
    update: [
      { label: 'Add missing field', prompt: '"Add dial_code (e.g. +91, +1) to all selected countries that are missing it"' },
      { label: 'Translate', prompt: '"Add Hindi translation of country name in the description field"' },
      { label: 'Fix data', prompt: '"Fix any incorrect ISO codes and ensure all codes are uppercase"' },
      { label: 'Enrich', prompt: '"Add currency_code and continent to each country record"' },
    ],
  },
  states: {
    generate: [
      '"Generate all 28 Indian states with name, code as ISO 3166-2:IN code, and state_code"',
      '"Generate US states with abbreviation in code field and capital city in description"',
    ],
    update: [
      { label: 'Add field', prompt: '"Add state capital city in the description field for all selected states"' },
      { label: 'Fix codes', prompt: '"Ensure all state codes follow ISO 3166-2 format (e.g. IN-MH, IN-KA)"' },
      { label: 'Sort', prompt: '"Set sort_order alphabetically by name starting from 1"' },
      { label: 'Translate', prompt: '"Add state name in local language in the description field"' },
    ],
  },
  cities: {
    generate: [
      '"Generate top 50 cities in Maharashtra, India with name, code as city abbreviation"',
      '"Generate 20 metro cities of India with population info in description"',
    ],
    update: [
      { label: 'Add pin codes', prompt: '"Add the primary postal/PIN code to the description field for each selected city"' },
      { label: 'Fix names', prompt: '"Fix spelling errors in city names and capitalize properly"' },
      { label: 'Set state', prompt: '"Set state_id correctly based on the city name for all selected records"' },
      { label: 'Translate', prompt: '"Add city name in Hindi/Devanagari script to the description field"' },
    ],
  },
  categories: {
    generate: [
      '"Generate 10 course categories for an EdTech platform: Programming, Design, Business, etc. with code, slug"',
      '"Generate 5 technology categories with SEO-friendly slugs and display_order"',
    ],
    update: [
      { label: 'Add SEO', prompt: '"Add SEO meta_title and meta_description for each selected category"' },
      { label: 'Reorder', prompt: '"Set display_order based on popularity: Programming=1, Data Science=2, etc."' },
      { label: 'Add slugs', prompt: '"Generate URL-friendly slugs from the category code for all selected"' },
      { label: 'Fix codes', prompt: '"Standardize all category codes to lowercase-hyphenated format"' },
    ],
  },
  sub_categories: {
    generate: [
      '"Generate 10 sub-categories for Programming category: Web Dev, Mobile, DevOps, etc. with code, slug"',
      '"Generate sub-categories for Design with category_id, proper display_order"',
    ],
    update: [
      { label: 'Add descriptions', prompt: '"Add a one-line description for each selected sub-category"' },
      { label: 'Reorder', prompt: '"Set display_order sequentially within each parent category starting from 1"' },
      { label: 'Fix slugs', prompt: '"Regenerate slugs from name: lowercase, hyphen-separated, no special chars"' },
      { label: 'Set active', prompt: '"Set is_active=true for all selected sub-categories"' },
    ],
  },
  designations: {
    generate: [
      '"Generate 20 corporate designations with name, code, level (junior/mid/senior/lead)"',
      '"Generate teaching designations for an educational institution in India"',
    ],
    update: [
      { label: 'Add levels', prompt: '"Add a level field (L1-L10) based on seniority for each designation"' },
      { label: 'Fix codes', prompt: '"Standardize designation codes to UPPER_SNAKE_CASE format"' },
      { label: 'Add desc', prompt: '"Add a brief job responsibility description for each designation"' },
      { label: 'Reorder', prompt: '"Set sort_order by seniority: Intern=1, Junior=2, Senior=5, Director=8"' },
    ],
  },
  departments: {
    generate: [
      '"Generate 15 departments for an EdTech company: Engineering, Product, Marketing, etc."',
      '"Generate academic departments for a university in India"',
    ],
    update: [
      { label: 'Add codes', prompt: '"Add 3-letter department codes (e.g. ENG, MKT, FIN) for all selected"' },
      { label: 'Add head', prompt: '"Add department head designation in the description field"' },
      { label: 'Set parent', prompt: '"Set parent_id for sub-departments under their correct parent department"' },
      { label: 'Reorder', prompt: '"Set sort_order: core departments first (1-5), support (6-10), admin (11+)"' },
    ],
  },
  branches: {
    generate: [
      '"Generate 10 branch offices across major Indian cities with name, code, address"',
      '"Generate 5 regional training centers with branch_type and city information"',
    ],
    update: [
      { label: 'Add address', prompt: '"Add full street address with city and pin code for each branch"' },
      { label: 'Set type', prompt: '"Set branch_type: head_office for main, regional for state-level, local for city-level"' },
      { label: 'Add contact', prompt: '"Add a contact phone number and email in description for each branch"' },
      { label: 'Fix codes', prompt: '"Standardize branch codes to format: BR-CITY-001"' },
    ],
  },
  branch_departments: {
    generate: [
      '"Generate branch-department mappings for all active branches and departments"',
      '"Link Engineering, Product, and Design departments to all technology branches"',
    ],
    update: [
      { label: 'Activate', prompt: '"Set is_active=true for all selected branch-department links"' },
      { label: 'Reorder', prompt: '"Set sort_order based on department importance within each branch"' },
      { label: 'Fix links', prompt: '"Ensure every branch has at least the core departments (HR, Admin, Finance)"' },
      { label: 'Deactivate', prompt: '"Set is_active=false for deprecated department links"' },
    ],
  },
  skills: {
    generate: [
      '"Generate 25 web development skills: React, Node.js, TypeScript, etc. with proficiency levels"',
      '"Generate soft skills for corporate training with name, code, and category"',
    ],
    update: [
      { label: 'Categorize', prompt: '"Add a category field: frontend, backend, devops, database, soft_skill"' },
      { label: 'Add levels', prompt: '"Add difficulty_level: beginner, intermediate, advanced for each skill"' },
      { label: 'Add desc', prompt: '"Add a 1-2 sentence description explaining what this skill covers"' },
      { label: 'Fix names', prompt: '"Capitalize skill names properly (e.g. javascript → JavaScript, aws → AWS)"' },
    ],
  },
  specializations: {
    generate: [
      '"Generate 15 specializations for Computer Science: AI/ML, Cybersecurity, Cloud Computing, etc."',
      '"Generate medical specializations with proper codes and descriptions"',
    ],
    update: [
      { label: 'Add desc', prompt: '"Add a brief description of career opportunities for each specialization"' },
      { label: 'Set field', prompt: '"Add parent_field: engineering, science, arts, commerce for each specialization"' },
      { label: 'Reorder', prompt: '"Set sort_order by demand: AI/ML=1, Cloud=2, Cybersecurity=3, etc."' },
      { label: 'Fix codes', prompt: '"Standardize codes to format: SPEC-FIELD-NAME (e.g. SPEC-CS-AIML)"' },
    ],
  },
  languages: {
    generate: [
      '"Generate all 22 scheduled languages of India with ISO 639-1 code and native script name"',
      '"Generate top 10 world languages with code, native_name, and script direction"',
    ],
    update: [
      { label: 'Add native', prompt: '"Add native_name in the language\'s own script (e.g. हिन्दी for Hindi)"' },
      { label: 'Set flags', prompt: '"Set for_material=true for languages used in course content"' },
      { label: 'Fix codes', prompt: '"Ensure all ISO codes are correct lowercase 2-letter format"' },
      { label: 'Reorder', prompt: '"Set sort_order: English=1, Hindi=2, then regional languages alphabetically"' },
    ],
  },
  education_levels: {
    generate: [
      '"Generate Indian education levels: Pre-Primary to PhD with display_order and code"',
      '"Generate 12 education levels from High School to Post-Doctoral with proper hierarchy"',
    ],
    update: [
      { label: 'Add years', prompt: '"Add typical duration_years for each education level (e.g. Bachelors=3-4)"' },
      { label: 'Reorder', prompt: '"Set display_order by academic progression: Pre-Primary=1 up to PhD=10"' },
      { label: 'Add desc', prompt: '"Add description explaining what this level covers and age group"' },
      { label: 'Fix codes', prompt: '"Set code to standard format: EDU-LEVEL (e.g. EDU-BACHELORS, EDU-MASTERS)"' },
    ],
  },
  learning_goals: {
    generate: [
      '"Generate 10 learning goals for a career-focused EdTech platform: Upskilling, Career Switch, etc."',
      '"Generate learning goals for school students: Exam Prep, Olympiad, Supplementary Learning"',
    ],
    update: [
      { label: 'Add desc', prompt: '"Add a motivational 2-line description for each learning goal"' },
      { label: 'Reorder', prompt: '"Set display_order by popularity: Career Switch=1, Upskilling=2, etc."' },
      { label: 'Add icon', prompt: '"Suggest an appropriate emoji/icon name for each learning goal"' },
      { label: 'Translate', prompt: '"Add Hindi translation of the goal name in the description field"' },
    ],
  },
  document_types: {
    generate: [
      '"Generate document types for an EdTech: Certificate, ID Card, Transcript, Offer Letter, etc."',
      '"Generate HR document types: PAN, Aadhaar, Passport, Bank Statement, Resume"',
    ],
    update: [
      { label: 'Add format', prompt: '"Add accepted_formats (pdf, jpg, png) for each document type"' },
      { label: 'Set required', prompt: '"Set is_required=true for mandatory documents: Aadhaar, PAN, Photo"' },
      { label: 'Add desc', prompt: '"Add a description with file size limits and format requirements"' },
      { label: 'Categorize', prompt: '"Add category: identity, academic, financial, employment for each type"' },
    ],
  },
  documents: {
    generate: [
      '"Generate sample document records with proper document_type_id and descriptions"',
      '"Generate 5 template documents with title, code, and document type"',
    ],
    update: [
      { label: 'Fix titles', prompt: '"Standardize document titles to Title Case format"' },
      { label: 'Add desc', prompt: '"Add a meaningful description for documents that are missing one"' },
      { label: 'Set status', prompt: '"Set is_active=true for all valid documents, false for expired ones"' },
      { label: 'Fix codes', prompt: '"Generate unique document codes in format: DOC-TYPE-001"' },
    ],
  },
  social_medias: {
    generate: [
      '"Generate all major social media platforms: LinkedIn, Twitter/X, GitHub, Instagram, YouTube, etc."',
      '"Generate professional networking and portfolio platforms with proper URLs"',
    ],
    update: [
      { label: 'Add URLs', prompt: '"Add base_url for each platform (e.g. https://linkedin.com/in/ for LinkedIn)"' },
      { label: 'Add icons', prompt: '"Add icon_name matching Lucide React icons for each platform"' },
      { label: 'Reorder', prompt: '"Set sort_order: LinkedIn=1, GitHub=2, Twitter=3, Instagram=4, etc."' },
      { label: 'Fix names', prompt: '"Update Twitter to X, Facebook to Meta where appropriate"' },
    ],
  },
  employee_profiles: {
    generate: [
      '"Generate 5 sample employee profiles with realistic Indian names, designations, departments"',
      '"Generate employee profiles for the Engineering department with proper pay grades"',
    ],
    update: [
      { label: 'Set grades', prompt: '"Set pay_grade based on designation: Junior=L1, Senior=L3, Lead=L5"' },
      { label: 'Fix salary', prompt: '"Set basic_salary_monthly as ctc_annual/12 * 0.4 for all selected"' },
      { label: 'Set dates', prompt: '"Set joining_date to 2024-01-15 for employees missing a joining date"' },
      { label: 'Set mode', prompt: '"Set work_mode to hybrid for all selected employees"' },
    ],
  },
  student_profiles: {
    generate: [
      '"Generate 5 student profiles with Indian names, enrollment numbers, education levels"',
      '"Generate student profiles for B.Tech Computer Science students"',
    ],
    update: [
      { label: 'Set level', prompt: '"Set education_level_id based on the student enrollment year"' },
      { label: 'Add goals', prompt: '"Add learning_goal description based on each student\'s program"' },
      { label: 'Fix codes', prompt: '"Generate enrollment numbers in format: STU-2024-001"' },
      { label: 'Set active', prompt: '"Set is_active=true for all current-year students"' },
    ],
  },
  instructor_profiles: {
    generate: [
      '"Generate 5 instructor profiles with qualifications, specializations, Indian names"',
      '"Generate instructor profiles for Computer Science with expertise in AI/ML"',
    ],
    update: [
      { label: 'Add bio', prompt: '"Add a professional bio (3-4 lines) for each instructor"' },
      { label: 'Set spec', prompt: '"Set specialization_id based on the instructor\'s primary teaching area"' },
      { label: 'Add exp', prompt: '"Add years_of_experience based on the joining date"' },
      { label: 'Fix codes', prompt: '"Generate instructor codes in format: INS-DEPT-001"' },
    ],
  },
};

// Fallback help for modules not explicitly listed
const DEFAULT_HELP: ModuleHelp = {
  generate: [
    '"Generate records with meaningful names, codes, and descriptions"',
    '"Generate 10 records specific to an Indian educational institution"',
  ],
  update: [
    { label: 'Add descriptions', prompt: '"Add a meaningful description to all records that are missing one"' },
    { label: 'Fix data', prompt: '"Fix spelling errors and standardize naming format across all records"' },
    { label: 'Reorder', prompt: '"Set sort_order alphabetically by name, starting from 1"' },
    { label: 'Set status', prompt: '"Set is_active=true for all valid records"' },
  ],
};

function getModuleHelp(module: string): ModuleHelp {
  return MODULE_HELP[module] || DEFAULT_HELP;
}

/* ─────────────────── Component ─────────────────── */

interface AiMasterDialogProps {
  module: string;
  moduleLabel: string;
  open: boolean;
  onClose: () => void;
  createFn: (item: any) => Promise<any>;
  updateFn?: (id: number, item: any) => Promise<any>;
  listFn?: (qs?: string) => Promise<any>;
  onSaved: () => void;
  defaultCount?: number;
  defaultPrompt?: string;
}

function getRecordLabel(r: any): string {
  return r.full_name || r.name || r.display_name || r.code || r.employee_code || r.instructor_code || r.enrollment_number || r.slug || `#${r.id}`;
}

function getRecordSub(r: any): string {
  const parts: string[] = [];
  if (r.code && r.name) parts.push(r.code);
  if (r.email) parts.push(r.email);
  if (r.description) parts.push(r.description.slice(0, 60) + (r.description.length > 60 ? '...' : ''));
  return parts.join(' · ');
}

export function AiMasterDialog({ module, moduleLabel, open, onClose, createFn, updateFn, listFn, onSaved, defaultCount = 10, defaultPrompt = '' }: AiMasterDialogProps) {
  const [mode, setMode] = useState<Mode>('generate');
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [count, setCount] = useState(defaultCount);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState('');
  // Progress tracking
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });
  const [saveProgress, setSaveProgress] = useState({ saved: 0, failed: 0, total: 0 });
  // Record selection for update mode
  const [existingRecords, setExistingRecords] = useState<any[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordSearch, setRecordSearch] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  // Server-side search & total count
  const [totalRecordCount, setTotalRecordCount] = useState(0);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [helpExpanded, setHelpExpanded] = useState(true);

  const help = getModuleHelp(module);

  // Load existing records when switching to update mode
  useEffect(() => {
    if (mode === 'update' && open && listFn) {
      loadExistingRecords();
    }
  }, [mode, open]);

  // Debounced server-side search
  const doServerSearch = useCallback(async (query: string) => {
    if (!listFn || !query.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await listFn(`?limit=50&search=${encodeURIComponent(query.trim())}`);
      if (res.success) {
        const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setSearchResults(items);
      }
    } catch { /* ignore */ }
    setSearching(false);
  }, [listFn]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!recordSearch.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      doServerSearch(recordSearch);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [recordSearch, doServerSearch]);

  async function loadExistingRecords() {
    if (!listFn) return;
    setLoadingRecords(true);
    try {
      const res = await listFn('?limit=500');
      if (res.success) {
        const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        // Extract total count from pagination
        const pagination = res.data?.pagination || res.pagination;
        const total = pagination?.total || items.length;
        setTotalRecordCount(total);
        setExistingRecords(items);
        // Select all loaded by default
        setSelectedRecordIds(new Set(items.map((r: any) => r.id)));
      }
    } catch { /* ignore */ }
    setLoadingRecords(false);
  }

  function handleClose() {
    setGenerated(null);
    setPrompt('');
    setGenProgress({ current: 0, total: 0 });
    setSaveProgress({ saved: 0, failed: 0, total: 0 });
    setExistingRecords([]);
    setSelectedRecordIds(new Set());
    setRecordSearch('');
    setSearchResults(null);
    setShowHelp(false);
    setTotalRecordCount(0);
    onClose();
  }

  function switchMode(m: Mode) {
    setMode(m);
    setGenerated(null);
    setGenProgress({ current: 0, total: 0 });
    setSaveProgress({ saved: 0, failed: 0, total: 0 });
    setRecordSearch('');
    setSearchResults(null);
  }

  function toggleRecord(id: number) {
    setSelectedRecordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const displayed = displayedRecords;
    const allSelected = displayed.length > 0 && displayed.every(r => selectedRecordIds.has(r.id));
    if (allSelected) {
      setSelectedRecordIds(prev => {
        const next = new Set(prev);
        displayed.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRecordIds(prev => {
        const next = new Set(prev);
        displayed.forEach(r => next.add(r.id));
        return next;
      });
    }
  }

  // Client-side filter of loaded records
  const clientFiltered = existingRecords.filter(r => {
    if (!recordSearch.trim()) return true;
    const q = recordSearch.toLowerCase();
    const label = getRecordLabel(r).toLowerCase();
    const sub = getRecordSub(r).toLowerCase();
    return label.includes(q) || sub.includes(q) || String(r.id).includes(q);
  });

  // Merge server search results with client-filtered, deduplicate by id
  const displayedRecords = (() => {
    if (!recordSearch.trim()) return existingRecords;
    const seen = new Set<number>();
    const merged: any[] = [];
    // Client-filtered first (already loaded)
    for (const r of clientFiltered) {
      if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
    }
    // Then server results (may contain records not in the initial 500 load)
    if (searchResults) {
      for (const r of searchResults) {
        if (!seen.has(r.id)) { seen.add(r.id); merged.push(r); }
      }
    }
    return merged;
  })();

  async function generate() {
    if (mode === 'update' && !prompt.trim()) {
      toast.error('Prompt is required for updating existing data');
      return;
    }
    if (mode === 'update' && listFn && selectedRecordIds.size === 0) {
      toast.error('Select at least one record to update');
      return;
    }
    setGenerating(true);
    setGenerated(null);
    setSaveProgress({ saved: 0, failed: 0, total: 0 });

    try {
      const effectivePrompt = prompt.trim() || defaultPrompt || '';

      if (mode === 'update') {
        // Update mode — pass selected record_ids
        setGenProgress({ current: 1, total: 1 });
        const payload: any = { module, provider, prompt: effectivePrompt };
        if (listFn && selectedRecordIds.size < existingRecords.length) {
          payload.record_ids = Array.from(selectedRecordIds);
        }
        const res = await api.updateMasterData(payload);
        if (res.success) { setGenerated(res.data); } else { toast.error(res.error || 'Failed'); }
      } else {
        // Generate mode — enforce count by prepending instruction so AI doesn't follow hardcoded numbers in prompt
        const countEnforcedPrompt = effectivePrompt
          ? `IMPORTANT: Generate exactly ${count} record(s), no more and no less. Ignore any other count mentioned below.\n\n${effectivePrompt}`
          : undefined;

        // Batch if count > BATCH_SIZE
        if (count <= BATCH_SIZE) {
          setGenProgress({ current: 1, total: 1 });
          const res = await api.generateMasterData({ module, provider, count, prompt: countEnforcedPrompt });
          if (res.success) { setGenerated(res.data); } else { toast.error(res.error || 'Failed'); }
        } else {
          // Batch generation
          const totalBatches = Math.ceil(count / BATCH_SIZE);
          setGenProgress({ current: 0, total: totalBatches });
          let allGenerated: any[] = [];
          let totalTokens = 0;
          let lastUsage = null;

          for (let batch = 0; batch < totalBatches; batch++) {
            const batchCount = Math.min(BATCH_SIZE, count - batch * BATCH_SIZE);
            setGenProgress({ current: batch + 1, total: totalBatches });

            const batchPrompt = effectivePrompt
              ? `IMPORTANT: Generate exactly ${batchCount} record(s) in this batch, no more and no less. Ignore any other count mentioned below.\n\n${effectivePrompt}\n\nThis is batch ${batch + 1} of ${totalBatches}. ${allGenerated.length > 0 ? `You have already generated these in previous batches — do NOT duplicate any: ${allGenerated.map((r: any) => r.name || r.code || r.slug || JSON.stringify(r).slice(0, 50)).join(', ')}` : ''}`
              : (allGenerated.length > 0
                ? `IMPORTANT: Generate exactly ${batchCount} record(s). This is batch ${batch + 1} of ${totalBatches}. Do NOT duplicate these already-generated items: ${allGenerated.map((r: any) => r.name || r.code || r.slug || JSON.stringify(r).slice(0, 50)).join(', ')}`
                : undefined);

            const res = await api.generateMasterData({ module, provider, count: batchCount, prompt: batchPrompt });
            if (res.success && res.data?.generated) {
              const items = Array.isArray(res.data.generated) ? res.data.generated : [res.data.generated];
              allGenerated = [...allGenerated, ...items];
              totalTokens += res.data.usage?.total_tokens || 0;
              lastUsage = res.data.usage;
            } else {
              toast.error(`Batch ${batch + 1} failed: ${res.error || 'Unknown error'}`);
              break;
            }
          }

          if (allGenerated.length > 0) {
            setGenerated({
              generated: allGenerated,
              provider,
              module,
              usage: { ...lastUsage, total_tokens: totalTokens },
            });
          }
        }
      }
    } catch { toast.error('Failed'); }
    setGenerating(false);
  }

  async function saveAll() {
    if (!generated?.generated) return;
    setSaving(true);
    const items = Array.isArray(generated.generated) ? generated.generated : [generated.generated];
    const total = items.length;
    setSaveProgress({ saved: 0, failed: 0, total });

    try {
      let saved = 0;
      let failed = 0;
      let firstError = '';
      const AUTO_FIELDS = ['id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'deleted_by'];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          let res;
          // Strip auto-generated fields the AI may have included
          const cleaned: any = {};
          for (const [k, v] of Object.entries(item)) {
            if (!AUTO_FIELDS.includes(k)) cleaned[k] = v;
          }
          if (mode === 'update' && item.id && updateFn) {
            res = await updateFn(item.id, cleaned);
          } else {
            res = await createFn(cleaned);
          }
          if (res?.success) saved++;
          else {
            const errMsg = res?.error || res?.message || 'Unknown error';
            if (!firstError) firstError = errMsg;
            console.error(`[AI Save] Record ${i + 1} failed:`, errMsg, 'Data:', cleaned);
            failed++;
          }
        } catch (e: any) {
          const errMsg = e?.message || String(e);
          if (!firstError) firstError = errMsg;
          console.error(`[AI Save] Record ${i + 1} exception:`, e, 'Item:', item);
          failed++;
        }
        setSaveProgress({ saved, failed, total });
      }
      const msg = `${mode === 'update' ? 'Updated' : 'Saved'} ${saved}/${total} ${moduleLabel.toLowerCase()}${failed > 0 ? ` (${failed} failed)` : ''}`;
      if (saved === 0) toast.error(firstError ? `${msg} — ${firstError}` : msg);
      else if (failed > 0) toast.success(msg);
      else toast.success(msg);
      handleClose();
      onSaved();
    } catch { toast.error('Failed to save records'); }
    setSaving(false);
  }

  const totalGenerated = generated?.generated ? (Array.isArray(generated.generated) ? generated.generated.length : 1) : 0;

  // Helper to insert a help example into the prompt textarea
  function insertPrompt(text: string) {
    // Strip surrounding quotes from the example
    const clean = text.replace(/^"(.*)"$/, '$1');
    setPrompt(clean);
    setShowHelp(false);
  }

  return (
    <Dialog open={open} onClose={handleClose} title={`AI ${mode === 'generate' ? 'Generate' : 'Update'} ${moduleLabel}`} size="lg">
      <div className="p-6 space-y-5">
        {/* Mode Toggle */}
        {updateFn && (
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => switchMode('generate')}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                mode === 'generate'
                  ? 'bg-brand-50 text-brand-700 border-r border-brand-200'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-r border-slate-200'
              )}
            >
              <Sparkles className="w-4 h-4" /> Generate New
            </button>
            <button
              type="button"
              onClick={() => switchMode('update')}
              className={cn(
                'flex-1 px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors',
                mode === 'update'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              )}
            >
              <Pencil className="w-4 h-4" /> Update Existing
            </button>
          </div>
        )}

        {/* Provider Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
          <div className="grid grid-cols-3 gap-3">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProvider(p.id)}
                className={cn(
                  'p-3 rounded-lg border-2 text-left transition-all',
                  provider === p.id
                    ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                )}
              >
                <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Count — only in generate mode */}
        {mode === 'generate' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of records</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={100}
                value={count}
                onChange={e => setCount(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={e => setCount(Math.min(100, Math.max(1, Number(e.target.value))))}
                className="w-20 h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none text-center"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-slate-400">max 100</span>
              {count > BATCH_SIZE && (
                <span className="text-xs text-amber-600 font-medium">
                  Will generate in {Math.ceil(count / BATCH_SIZE)} batches of {BATCH_SIZE}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Record Selection — only in update mode */}
        {mode === 'update' && !generated && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                Select Records to Update
              </label>
              <span className="text-xs text-slate-500">
                {selectedRecordIds.size} of {totalRecordCount > existingRecords.length ? totalRecordCount.toLocaleString() : existingRecords.length} selected
                {totalRecordCount > existingRecords.length && (
                  <span className="text-amber-600 ml-1">(showing {existingRecords.length})</span>
                )}
              </span>
            </div>

            {loadingRecords ? (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading records...
              </div>
            ) : existingRecords.length === 0 ? (
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-6 text-sm text-slate-500 text-center">
                No active records found to update.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {/* Search + Select All */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <button type="button" onClick={toggleAll} className="flex-shrink-0 text-slate-500 hover:text-brand-600 transition-colors" title={displayedRecords.every(r => selectedRecordIds.has(r.id)) ? 'Deselect all' : 'Select all'}>
                    {displayedRecords.length > 0 && displayedRecords.every(r => selectedRecordIds.has(r.id))
                      ? <CheckSquare className="w-4.5 h-4.5 text-brand-600" />
                      : displayedRecords.some(r => selectedRecordIds.has(r.id))
                        ? <MinusSquare className="w-4.5 h-4.5 text-brand-400" />
                        : <Square className="w-4.5 h-4.5" />
                    }
                  </button>
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={recordSearch}
                      onChange={e => setRecordSearch(e.target.value)}
                      placeholder={totalRecordCount > 500 ? `Search all ${totalRecordCount.toLocaleString()} records...` : 'Search records...'}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                    />
                    {searching && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-400 animate-spin" />
                    )}
                  </div>
                </div>

                {/* Info banner when total exceeds loaded */}
                {totalRecordCount > existingRecords.length && !recordSearch.trim() && (
                  <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                    Showing first {existingRecords.length} of {totalRecordCount.toLocaleString()} records. Use search to find specific records.
                  </div>
                )}

                {/* Record List */}
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {displayedRecords.map(r => {
                    const isSelected = selectedRecordIds.has(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => toggleRecord(r.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                          isSelected ? 'bg-brand-50/50 hover:bg-brand-50' : 'hover:bg-slate-50'
                        )}
                      >
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-brand-600 flex-shrink-0" />
                          : <Square className="w-4 h-4 text-slate-300 flex-shrink-0" />
                        }
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">#{r.id}</span>
                            <span className={cn('text-sm font-medium truncate', isSelected ? 'text-slate-900' : 'text-slate-600')}>
                              {getRecordLabel(r)}
                            </span>
                          </div>
                          {getRecordSub(r) && (
                            <div className="text-xs text-slate-400 truncate mt-0.5">{getRecordSub(r)}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {displayedRecords.length === 0 && !searching && (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">No records match your search.</div>
                  )}
                  {searching && displayedRecords.length === 0 && (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching server...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prompt / Instructions */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="block text-sm font-medium text-slate-700">
              {mode === 'update' ? 'Update Instructions' : 'Custom Instructions'}{' '}
              <span className="text-slate-400 font-normal">{mode === 'update' ? '(required)' : '(optional)'}</span>
            </label>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className={cn(
                'p-0.5 rounded-full transition-colors',
                showHelp ? 'text-brand-600 bg-brand-50' : 'text-slate-400 hover:text-brand-500 hover:bg-slate-100'
              )}
              title="Prompt tips"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {/* Help Panel — module-specific */}
          {showHelp && (
            <div className="mb-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-100">
                <span className="text-sm font-semibold text-slate-800">
                  {mode === 'update' ? `Update Tips — ${moduleLabel}` : `Generate Tips — ${moduleLabel}`}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setHelpExpanded(!helpExpanded)} className="p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    {helpExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" onClick={() => setShowHelp(false)} className="p-0.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {helpExpanded && mode === 'generate' && (
                <div className="px-4 py-3 space-y-2.5 text-xs max-h-64 overflow-y-auto">
                  <div className="text-slate-500 font-medium">Click an example to use it as your prompt:</div>
                  {help.generate.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => insertPrompt(ex)}
                      className="w-full text-left bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg font-mono hover:bg-emerald-100 hover:ring-1 hover:ring-emerald-300 transition-all"
                    >
                      {ex}
                    </button>
                  ))}
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-blue-700 text-xs">
                    <span className="font-semibold">Tip:</span> The slider controls how many records to generate. Leave instructions blank for AI defaults.
                  </div>
                </div>
              )}

              {helpExpanded && mode === 'update' && (
                <div className="px-4 py-3 space-y-2.5 text-xs max-h-64 overflow-y-auto">
                  <div className="text-slate-500 font-medium">Click an example to use it as your prompt:</div>
                  {help.update.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => insertPrompt(ex.prompt)}
                      className="w-full text-left flex items-start gap-2.5 bg-slate-50 hover:bg-amber-50 px-3 py-2 rounded-lg hover:ring-1 hover:ring-amber-300 transition-all group"
                    >
                      <span className="flex-shrink-0 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                        {ex.label}
                      </span>
                      <span className="font-mono text-slate-600 group-hover:text-amber-700">{ex.prompt}</span>
                    </button>
                  ))}
                  <div className="bg-amber-50 rounded-lg px-3 py-2 text-amber-700 text-xs space-y-1">
                    <div><span className="font-semibold">Update all:</span> Select all records + write your instruction</div>
                    <div><span className="font-semibold">Update selected:</span> Pick specific records from the list above, then write instruction</div>
                    <div><span className="font-semibold">Update one:</span> Select just one record and describe the change</div>
                    <div><span className="font-semibold">Conditional:</span> Select all, then use &quot;For records where X, do Y&quot; in your prompt</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={mode === 'update'
              ? `e.g. ${help.update[0]?.prompt || '"Describe what to update..."'}`
              : defaultPrompt || `Describe what kind of ${moduleLabel.toLowerCase()} you want to generate...`
            }
            rows={3}
            className={cn(
              'w-full px-3 py-2 text-sm rounded-lg border bg-white focus:ring-2 focus:outline-none resize-none',
              mode === 'update' && !prompt.trim()
                ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500/20'
                : 'border-slate-200 focus:border-brand-500 focus:ring-brand-500/20'
            )}
          />
        </div>

        {/* Generate / Update Button + Progress */}
        {!generated && (
          <div className="space-y-2">
            <Button type="button" onClick={generate} disabled={generating || (mode === 'update' && loadingRecords)} className="w-full">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'update' ? <Pencil className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {generating
                ? (genProgress.total > 1
                  ? `Generating batch ${genProgress.current}/${genProgress.total}...`
                  : (mode === 'update' ? 'Updating...' : 'Generating...'))
                : (mode === 'update'
                  ? `Update ${selectedRecordIds.size} Record${selectedRecordIds.size !== 1 ? 's' : ''}`
                  : 'Generate Sample Data')}
            </Button>
            {/* Generation progress bar */}
            {generating && genProgress.total > 1 && (
              <div className="space-y-1">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(genProgress.current / genProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Batch {genProgress.current} of {genProgress.total} ({Math.min(genProgress.current * BATCH_SIZE, count)}/{count} records)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Results Preview */}
        {generated?.generated && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className={cn('text-sm font-medium flex items-center gap-1.5', mode === 'update' ? 'text-amber-700' : 'text-emerald-700')}>
                <Check className="w-4 h-4" /> {mode === 'update' ? 'Updated' : 'Generated'} {totalGenerated} record(s)
              </span>
              <span className="text-xs text-slate-400">
                {generated.usage?.total_tokens?.toLocaleString()} tokens
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                {JSON.stringify(generated.generated, null, 2)}
              </pre>
            </div>

            {/* Save progress */}
            {saving && saveProgress.total > 0 && (
              <div className="space-y-1.5">
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${((saveProgress.saved + saveProgress.failed) / saveProgress.total) * 100}%`,
                      background: saveProgress.failed > 0
                        ? `linear-gradient(90deg, #22c55e ${(saveProgress.saved / (saveProgress.saved + saveProgress.failed)) * 100}%, #ef4444 ${(saveProgress.saved / (saveProgress.saved + saveProgress.failed)) * 100}%)`
                        : '#22c55e',
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Saving {saveProgress.saved + saveProgress.failed}/{saveProgress.total}
                  {saveProgress.failed > 0 && <span className="text-red-500 ml-1">({saveProgress.failed} failed)</span>}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" onClick={saveAll} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving
                  ? `Saving ${saveProgress.saved + saveProgress.failed}/${saveProgress.total}...`
                  : `${mode === 'update' ? 'Save Updates' : `Save All ${totalGenerated} to ${moduleLabel}`}`}
              </Button>
              <Button type="button" variant="outline" onClick={generate} disabled={generating || saving}>
                <RefreshCw className="w-4 h-4" /> {mode === 'update' ? 'Re-update' : 'Regenerate'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
