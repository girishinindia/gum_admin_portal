"use client";
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePageSize } from '@/hooks/usePageSize';
import {
  GraduationCap, BookOpen, Video, ClipboardCheck, Users, TrendingUp,
  BarChart3, Clock, Award, Eye, ChevronLeft, Search, RefreshCw,
  CheckCircle2, XCircle, AlertCircle, FileText, ArrowUpDown,
} from 'lucide-react';

// ─── Types ───
interface OverviewData {
  period_days: number;
  enrollments: { total_active: number; total_completed: number; new_in_period: number; unique_students: number };
  completion: { total_enrollments: number; completed: number; completion_rate: number; avg_progress: number; progress_distribution: { range: string; count: number }[] };
  quizzes: { total_attempts: number; avg_score: number; pass_rate: number };
  videos: { total_watches: number; total_watch_hours: number; videos_completed: number; completion_rate: number };
  submissions: { status: string; count: number }[];
  recent_activity: { type: string; user_id: number; user_name: string; detail: string; timestamp: string }[];
}

interface StudentRow {
  user_id: number; full_name: string; email: string; avatar_url: string | null;
  total_enrollments: number; active_enrollments: number; completed_enrollments: number; avg_progress: number;
}

interface StudentDetail {
  user: { id: number; full_name: string; email: string; avatar_url: string | null };
  summary: {
    total_enrollments: number; active_enrollments: number; completed_enrollments: number;
    total_watch_hours: number; total_quiz_attempts: number; avg_quiz_score: number;
    total_submissions: number; videos_completed: number;
  };
  enrollments: any[];
  video_history: any[];
  quiz_attempts: any[];
  submissions: any[];
}

interface QuizAnalyticsData {
  period_days: number; total_attempts: number; unique_students: number; overall_avg_score: number;
  by_quiz_type: { quiz_type: string; total_attempts: number; avg_score: number; pass_rate: number }[];
  by_status: { status: string; count: number }[];
  score_distribution: { range: string; count: number }[];
  question_analysis: { question_type: string; total_answers: number; correct_answers: number; accuracy_rate: number }[];
}

type TabKey = 'overview' | 'students' | 'quiz-analytics' | 'submissions';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'quiz-analytics', label: 'Quiz Analytics', icon: ClipboardCheck },
  { key: 'submissions', label: 'Submissions', icon: FileText },
];

const PERIOD_OPTIONS = [
  { value: 7, label: '7 Days' },
  { value: 30, label: '30 Days' },
  { value: 90, label: '90 Days' },
  { value: 365, label: '1 Year' },
];

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-amber-100 text-amber-700',
  revision_requested: 'bg-orange-100 text-orange-700',
  graded: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  in_progress: 'bg-sky-100 text-sky-700',
  abandoned: 'bg-gray-100 text-gray-500',
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ProgressBar({ value, max = 100, color = 'bg-blue-500' }: { value: number; max?: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function StudentProgressPage() {
  const [tab, setTab] = useState<TabKey>('overview');
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(false);

  // Overview
  const [overview, setOverview] = useState<OverviewData | null>(null);

  // Students
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [studentsTotal, setStudentsTotal] = useState(0);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsSearch, setStudentsSearch] = useState('');
  const [pageSize] = usePageSize();
  const [selectedStudent, setSelectedStudent] = useState<StudentDetail | null>(null);

  // Quiz Analytics
  const [quizAnalytics, setQuizAnalytics] = useState<QuizAnalyticsData | null>(null);

  // Submissions
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [submissionTypeFilter, setSubmissionTypeFilter] = useState('');

  // ── Fetch Overview ──
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getStudentProgressOverview(period);
      if (res.success) setOverview(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [period]);

  // ── Fetch Students ──
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getStudentProgressStudents({
        page: studentsPage, limit: pageSize, search: studentsSearch,
      });
      if (res.success) {
        setStudents(res.data.data);
        setStudentsTotal(res.data.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [studentsPage, pageSize, studentsSearch]);

  // ── Fetch Quiz Analytics ──
  const fetchQuizAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getQuizAnalytics(period);
      if (res.success) setQuizAnalytics(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [period]);

  // ── Fetch Submissions ──
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProjectSubmissions({
        page: submissionsPage, limit: pageSize,
        status: submissionFilter || undefined,
        project_type: submissionTypeFilter || undefined,
      });
      if (res.success) {
        setSubmissions(res.data.data);
        setSubmissionsTotal(res.data.total);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [submissionsPage, pageSize, submissionFilter, submissionTypeFilter]);

  // ── Fetch Student Detail ──
  const fetchStudentDetail = useCallback(async (userId: number) => {
    setLoading(true);
    try {
      const res = await api.getStudentProgressDetail(userId);
      if (res.success) setSelectedStudent(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  // ── Effects ──
  useEffect(() => { if (tab === 'overview') fetchOverview(); }, [tab, fetchOverview]);
  useEffect(() => { if (tab === 'students' && !selectedStudent) fetchStudents(); }, [tab, fetchStudents, selectedStudent]);
  useEffect(() => { if (tab === 'quiz-analytics') fetchQuizAnalytics(); }, [tab, fetchQuizAnalytics]);
  useEffect(() => { if (tab === 'submissions') fetchSubmissions(); }, [tab, fetchSubmissions]);

  // ─── Render ───
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Student Progress & Learning</h1>
            <p className="text-sm text-gray-500">Track enrollment progress, quiz performance, and learning activity</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={e => setPeriod(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => {
              if (tab === 'overview') fetchOverview();
              else if (tab === 'students') fetchStudents();
              else if (tab === 'quiz-analytics') fetchQuizAnalytics();
              else if (tab === 'submissions') fetchSubmissions();
            }}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedStudent(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading && !overview && !quizAnalytics && students.length === 0 && submissions.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading...</span>
        </div>
      )}

      {tab === 'overview' && overview && <OverviewTab data={overview} />}
      {tab === 'students' && !selectedStudent && (
        <StudentsTab
          students={students} total={studentsTotal} page={studentsPage} pageSize={pageSize}
          search={studentsSearch} onSearchChange={setStudentsSearch}
          onPageChange={setStudentsPage} onSelectStudent={fetchStudentDetail}
          loading={loading}
        />
      )}
      {tab === 'students' && selectedStudent && (
        <StudentDetailView data={selectedStudent} onBack={() => setSelectedStudent(null)} />
      )}
      {tab === 'quiz-analytics' && quizAnalytics && <QuizAnalyticsTab data={quizAnalytics} />}
      {tab === 'submissions' && (
        <SubmissionsTab
          submissions={submissions} total={submissionsTotal} page={submissionsPage} pageSize={pageSize}
          statusFilter={submissionFilter} typeFilter={submissionTypeFilter}
          onStatusChange={setSubmissionFilter} onTypeChange={setSubmissionTypeFilter}
          onPageChange={setSubmissionsPage} loading={loading}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════
function OverviewTab({ data }: { data: OverviewData }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Enrollments" value={data.enrollments.total_active} sub={`${data.enrollments.new_in_period} new`} color="bg-blue-50 text-blue-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={data.enrollments.total_completed} sub={`${data.completion.completion_rate}% rate`} color="bg-green-50 text-green-600" />
        <StatCard icon={ClipboardCheck} label="Quiz Attempts" value={data.quizzes.total_attempts} sub={`${data.quizzes.avg_score}% avg score`} color="bg-violet-50 text-violet-600" />
        <StatCard icon={Video} label="Video Hours" value={data.videos.total_watch_hours} sub={`${data.videos.videos_completed} completed`} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Progress Distribution</h3>
          <div className="space-y-3">
            {data.completion.progress_distribution.map(d => {
              const maxCount = Math.max(...data.completion.progress_distribution.map(x => x.count), 1);
              return (
                <div key={d.range} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16">{d.range}%</span>
                  <div className="flex-1">
                    <ProgressBar value={d.count} max={maxCount} color={
                      d.range === '75-100' ? 'bg-green-500' : d.range === '50-75' ? 'bg-blue-500' : d.range === '25-50' ? 'bg-amber-500' : 'bg-red-400'
                    } />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-10 text-right">{d.count}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">Average progress: {data.completion.avg_progress}%</p>
        </div>

        {/* Submission Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Project Submissions by Status</h3>
          {data.submissions.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No submissions yet</p>
          ) : (
            <div className="space-y-3">
              {data.submissions.map(s => {
                const maxCount = Math.max(...data.submissions.map(x => x.count), 1);
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-28 capitalize">{s.status.replace(/_/g, ' ')}</span>
                    <div className="flex-1">
                      <ProgressBar value={s.count} max={maxCount} color="bg-indigo-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-10 text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
        {data.recent_activity.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className={`p-1.5 rounded-full ${
                  a.type === 'video' ? 'bg-amber-50 text-amber-500' :
                  a.type === 'quiz' ? 'bg-violet-50 text-violet-500' : 'bg-blue-50 text-blue-500'
                }`}>
                  {a.type === 'video' ? <Video className="w-3.5 h-3.5" /> :
                   a.type === 'quiz' ? <ClipboardCheck className="w-3.5 h-3.5" /> :
                   <FileText className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700">{a.user_name || 'Unknown'}</span>
                  <span className="text-sm text-gray-400 ml-2">{a.detail}</span>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(a.timestamp).toLocaleDateString()} {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════════
function StudentsTab({ students, total, page, pageSize, search, onSearchChange, onPageChange, onSelectStudent, loading }: {
  students: StudentRow[]; total: number; page: number; pageSize: number;
  search: string; onSearchChange: (v: string) => void; onPageChange: (p: number) => void;
  onSelectStudent: (userId: number) => void; loading: boolean;
}) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search by name or email..."
            value={search} onChange={e => { onSearchChange(e.target.value); onPageChange(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <span className="text-sm text-gray-500">{total} students</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Enrollments</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Completed</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Avg Progress</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {students.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No students found</td></tr>
            ) : students.map(s => (
              <tr key={s.user_id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                        {s.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{s.full_name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="text-center px-4 py-3 text-gray-700">{s.total_enrollments}</td>
                <td className="text-center px-4 py-3"><span className="text-green-600 font-medium">{s.active_enrollments}</span></td>
                <td className="text-center px-4 py-3"><span className="text-blue-600 font-medium">{s.completed_enrollments}</span></td>
                <td className="text-center px-4 py-3">
                  <div className="flex items-center gap-2 justify-center">
                    <ProgressBar value={s.avg_progress} color="bg-indigo-500" />
                    <span className="text-xs text-gray-500 w-10">{s.avg_progress}%</span>
                  </div>
                </td>
                <td className="text-center px-4 py-3">
                  <button onClick={() => onSelectStudent(s.user_id)} className="text-indigo-600 hover:text-indigo-800">
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Prev</button>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// STUDENT DETAIL VIEW
// ═══════════════════════════════════════════════
function StudentDetailView({ data, onBack }: { data: StudentDetail; onBack: () => void }) {
  const [detailTab, setDetailTab] = useState<'enrollments' | 'videos' | 'quizzes' | 'submissions'>('enrollments');

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="w-4 h-4" /> Back to students list
      </button>

      {/* Student Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
        {data.user.avatar_url ? (
          <img src={data.user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold">
            {data.user.full_name?.charAt(0) || '?'}
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-gray-900">{data.user.full_name}</h2>
          <p className="text-sm text-gray-500">{data.user.email}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Enrollments" value={data.summary.total_enrollments} sub={`${data.summary.active_enrollments} active`} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Video} label="Watch Hours" value={data.summary.total_watch_hours} sub={`${data.summary.videos_completed} completed`} color="bg-amber-50 text-amber-600" />
        <StatCard icon={ClipboardCheck} label="Quiz Attempts" value={data.summary.total_quiz_attempts} sub={`${data.summary.avg_quiz_score}% avg`} color="bg-violet-50 text-violet-600" />
        <StatCard icon={FileText} label="Submissions" value={data.summary.total_submissions} color="bg-green-50 text-green-600" />
      </div>

      {/* Detail Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { key: 'enrollments' as const, label: 'Enrollments', icon: BookOpen },
          { key: 'videos' as const, label: 'Videos', icon: Video },
          { key: 'quizzes' as const, label: 'Quizzes', icon: ClipboardCheck },
          { key: 'submissions' as const, label: 'Submissions', icon: FileText },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setDetailTab(t.key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              detailTab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {detailTab === 'enrollments' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Item ID</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Progress</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Enrolled</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.enrollments.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No enrollments</td></tr>
              ) : data.enrollments.map((e: any) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 capitalize">{e.item_type}</td>
                  <td className="px-4 py-3 text-gray-500">#{e.item_id}</td>
                  <td className="text-center px-4 py-3"><StatusBadge status={e.enrollment_status} /></td>
                  <td className="text-center px-4 py-3">
                    <div className="flex items-center gap-2 justify-center">
                      <ProgressBar value={e.progress_pct || 0} color="bg-indigo-500" />
                      <span className="text-xs">{e.progress_pct || 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {detailTab === 'videos' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Content</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Duration</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Watched</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Completed</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.video_history.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No video history</td></tr>
              ) : data.video_history.map((v: any) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 capitalize">{v.content_type} #{v.content_id}</td>
                  <td className="text-center px-4 py-3">{Math.floor(v.total_duration_secs / 60)}m</td>
                  <td className="text-center px-4 py-3">{Math.floor(v.watch_duration_secs / 60)}m</td>
                  <td className="text-center px-4 py-3">{v.completed ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-gray-300 mx-auto" />}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(v.watched_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {detailTab === 'quizzes' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Quiz Type</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Attempt #</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.quiz_attempts.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No quiz attempts</td></tr>
              ) : data.quiz_attempts.map((q: any) => (
                <tr key={q.id}>
                  <td className="px-4 py-3 capitalize">{q.quiz_type.replace(/_/g, ' ')}</td>
                  <td className="text-center px-4 py-3 font-medium">{q.pct_score || 0}%</td>
                  <td className="text-center px-4 py-3"><StatusBadge status={q.status} /></td>
                  <td className="text-center px-4 py-3">{q.attempt_number}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(q.started_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {detailTab === 'submissions' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b"><tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Project Type</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.submissions.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No submissions</td></tr>
              ) : data.submissions.map((s: any) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 capitalize">{s.project_type.replace(/_/g, ' ')}</td>
                  <td className="text-center px-4 py-3">{s.score !== null ? `${s.score}/${s.max_score}` : '-'}</td>
                  <td className="text-center px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// QUIZ ANALYTICS TAB
// ═══════════════════════════════════════════════
function QuizAnalyticsTab({ data }: { data: QuizAnalyticsData }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ClipboardCheck} label="Total Attempts" value={data.total_attempts} color="bg-violet-50 text-violet-600" />
        <StatCard icon={Users} label="Unique Students" value={data.unique_students} color="bg-blue-50 text-blue-600" />
        <StatCard icon={Award} label="Avg Score" value={`${data.overall_avg_score}%`} color="bg-green-50 text-green-600" />
        <StatCard icon={TrendingUp} label="Period" value={`${data.period_days}d`} color="bg-gray-50 text-gray-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Quiz Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Performance by Quiz Type</h3>
          {data.by_quiz_type.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No quiz data</p>
          ) : (
            <div className="space-y-4">
              {data.by_quiz_type.map(qt => (
                <div key={qt.quiz_type} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 capitalize">{qt.quiz_type.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-500">{qt.total_attempts} attempts</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar value={qt.avg_score} color="bg-violet-500" />
                    <span className="text-xs text-gray-600 w-12 text-right">{qt.avg_score}%</span>
                  </div>
                  <p className="text-xs text-gray-400">Pass rate: {qt.pass_rate}%</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Score Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Score Distribution</h3>
          <div className="space-y-3">
            {data.score_distribution.map(d => {
              const maxCount = Math.max(...data.score_distribution.map(x => x.count), 1);
              const colors: Record<string, string> = {
                '0-20': 'bg-red-400', '20-40': 'bg-orange-400', '40-60': 'bg-amber-400', '60-80': 'bg-blue-500', '80-100': 'bg-green-500',
              };
              return (
                <div key={d.range} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16">{d.range}%</span>
                  <div className="flex-1">
                    <ProgressBar value={d.count} max={maxCount} color={colors[d.range] || 'bg-gray-400'} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-10 text-right">{d.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question Type Analysis */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Accuracy by Question Type</h3>
        {data.question_analysis.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No answer data yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {data.question_analysis.map(qa => (
              <div key={qa.question_type} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 capitalize mb-1">{qa.question_type.replace(/_/g, ' ')}</p>
                <p className="text-2xl font-bold text-gray-900">{qa.accuracy_rate}%</p>
                <p className="text-xs text-gray-400">{qa.correct_answers}/{qa.total_answers} correct</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Attempt Status Breakdown</h3>
        <div className="flex flex-wrap gap-3">
          {data.by_status.map(s => (
            <div key={s.status} className="flex items-center gap-2">
              <StatusBadge status={s.status} />
              <span className="text-sm font-medium text-gray-700">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════
// SUBMISSIONS TAB
// ═══════════════════════════════════════════════
function SubmissionsTab({ submissions, total, page, pageSize, statusFilter, typeFilter, onStatusChange, onTypeChange, onPageChange, loading }: {
  submissions: any[]; total: number; page: number; pageSize: number;
  statusFilter: string; typeFilter: string;
  onStatusChange: (v: string) => void; onTypeChange: (v: string) => void;
  onPageChange: (p: number) => void; loading: boolean;
}) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={e => { onStatusChange(e.target.value); onPageChange(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="revision_requested">Revision Requested</option>
          <option value="graded">Graded</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={typeFilter} onChange={e => { onTypeChange(e.target.value); onPageChange(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Types</option>
          <option value="mini_project">Mini Project</option>
          <option value="capstone_project">Capstone Project</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">{total} submissions</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Project Type</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Score</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reviewed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {submissions.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No submissions found</td></tr>
            ) : submissions.map((s: any) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {s.users?.avatar_url ? (
                      <img src={s.users.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                        {s.users?.full_name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 text-xs">{s.users?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{s.users?.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{s.project_type?.replace(/_/g, ' ')}</td>
                <td className="text-center px-4 py-3">{s.score !== null ? `${s.score}/${s.max_score}` : '-'}</td>
                <td className="text-center px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.submitted_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{s.reviewed_at ? new Date(s.reviewed_at).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Prev</button>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
