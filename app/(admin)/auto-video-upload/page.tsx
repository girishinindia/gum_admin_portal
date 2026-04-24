"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Video, Youtube, Upload, CheckCircle2, XCircle, Loader2, AlertTriangle, ChevronRight, Trash2, ExternalLink, Play, Film } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubTopic } from '@/lib/types';

interface Subject { id: number; slug: string; code?: string; is_active: boolean; english_name?: string | null }
interface Chapter { id: number; slug: string; subject_id: number; is_active: boolean }
interface Topic { id: number; slug: string; chapter_id: number; is_active: boolean }

type VideoInputType = 'upload' | 'youtube';

interface SubTopicVideoRow {
  subTopic: SubTopic;
  videoType: VideoInputType;
  videoFile: File | null;
  youtubeUrl: string;
  uploading: boolean;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  errorMsg: string;
}

export default function AutoVideoUploadPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in p-8 text-center text-slate-400">Loading...</div>}>
      <AutoVideoUploadContent />
    </Suspense>
  );
}

function AutoVideoUploadContent() {
  const searchParams = useSearchParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [initialized, setInitialized] = useState(false);

  const [rows, setRows] = useState<SubTopicVideoRow[]>([]);
  const [loadingSubTopics, setLoadingSubTopics] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);

  const router = useRouter();

  useKeyboardShortcuts([
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/categories') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  // Load subjects on mount; handle query param pre-selection
  useEffect(() => {
    const qTopic = searchParams.get('topic_id') || '';

    api.listSubjects('?limit=500&is_active=true').then(async (subRes) => {
      if (subRes.success) setSubjects(subRes.data || []);

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

  // Load chapters when subject changes
  useEffect(() => {
    if (!initialized) return;
    setSelectedChapter(''); setSelectedTopic(''); setChapters([]); setTopics([]);
    if (selectedSubject) {
      api.listChapters(`?limit=500&is_active=true&subject_id=${selectedSubject}`).then(res => { if (res.success) setChapters(res.data || []); });
    }
  }, [selectedSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load topics when chapter changes
  useEffect(() => {
    if (!initialized) return;
    setSelectedTopic(''); setTopics([]);
    if (selectedChapter) {
      api.listTopics(`?limit=500&is_active=true&chapter_id=${selectedChapter}`).then(res => { if (res.success) setTopics(res.data || []); });
    }
  }, [selectedChapter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load sub-topics when topic changes
  useEffect(() => {
    setRows([]);
    if (selectedTopic) loadSubTopics(selectedTopic);
  }, [selectedTopic]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSubTopics(topicId: string) {
    setLoadingSubTopics(true);
    try {
      const res = await api.listSubTopics(`?topic_id=${topicId}&limit=500&sort=display_order&order=asc`);
      if (res.success && res.data?.length) {
        setRows(res.data.map((st: SubTopic) => ({
          subTopic: st,
          videoType: (st.video_source === 'youtube' || (!st.video_source && !st.video_url)) ? 'youtube' : 'upload',
          videoFile: null,
          youtubeUrl: st.youtube_url || '',
          uploading: false,
          progress: 0,
          status: 'idle' as const,
          errorMsg: '',
        })));
      }
    } catch (e) {
      console.error('Failed to load sub-topics:', e);
      toast.error('Failed to load sub-topics');
    }
    setLoadingSubTopics(false);
  }

  function updateRow(index: number, updates: Partial<SubTopicVideoRow>) {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  }

  function handleFileSelect(index: number, file: File | null) {
    if (file) {
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
        toast.error('Only MP4, WebM, MOV, AVI, MKV files are allowed');
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        toast.error('File size must be under 500MB');
        return;
      }
    }
    updateRow(index, { videoFile: file, status: 'idle', errorMsg: '' });
  }

  async function handleSingleUpload(index: number) {
    const row = rows[index];
    if (!row) return;

    if (row.videoType === 'upload' && !row.videoFile) {
      toast.error('Please select a video file');
      return;
    }
    if (row.videoType === 'youtube' && !row.youtubeUrl.trim()) {
      toast.error('Please enter a YouTube URL');
      return;
    }

    updateRow(index, { uploading: true, progress: 0, status: 'uploading', errorMsg: '' });

    try {
      if (row.videoType === 'youtube') {
        const res = await api.updateSubTopic(row.subTopic.id, {
          youtube_url: row.youtubeUrl.trim(),
          video_source: 'youtube',
        });
        if (res.success) {
          updateRow(index, { uploading: false, status: 'success', subTopic: { ...row.subTopic, youtube_url: row.youtubeUrl.trim(), video_source: 'youtube' } });
          toast.success(`YouTube URL saved for "${row.subTopic.slug}"`);
        } else {
          updateRow(index, { uploading: false, status: 'error', errorMsg: res.error || 'Failed to save' });
        }
      } else {
        // Upload video file
        await api.uploadSubTopicVideo(row.subTopic.id, row.videoFile!, (percent: number) => {
          updateRow(index, { progress: percent });
        });
        updateRow(index, { uploading: false, status: 'success', videoFile: null, subTopic: { ...row.subTopic, video_source: 'bunny', video_status: 'processing' } });
        toast.success(`Video uploaded for "${row.subTopic.slug}"`);
      }
    } catch (e: any) {
      updateRow(index, { uploading: false, status: 'error', errorMsg: e.message || 'Upload failed' });
      toast.error(`Failed for "${row.subTopic.slug}": ${e.message || 'Unknown error'}`);
    }
  }

  async function handleRemoveVideo(index: number) {
    const row = rows[index];
    if (!row) return;
    if (!confirm(`Remove video from "${row.subTopic.slug}"?`)) return;

    try {
      await api.deleteSubTopicVideo(row.subTopic.id);
      updateRow(index, {
        subTopic: { ...row.subTopic, video_source: null, video_url: null, video_thumbnail_url: null, video_status: null, youtube_url: null, video_id: null },
        youtubeUrl: '',
        videoFile: null,
        status: 'idle',
      });
      toast.success('Video removed');
    } catch (e: any) {
      toast.error(e.message || 'Failed to remove video');
    }
  }

  async function handleBulkUpload() {
    const pendingRows = rows.filter((r, i) =>
      (r.videoType === 'upload' && r.videoFile) ||
      (r.videoType === 'youtube' && r.youtubeUrl.trim() && !r.subTopic.youtube_url)
    );
    if (pendingRows.length === 0) {
      toast.error('No new videos to upload');
      return;
    }
    if (!confirm(`Upload/save videos for ${pendingRows.length} sub-topic(s)?`)) return;

    setBulkUploading(true);
    let successCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hasPending = (row.videoType === 'upload' && row.videoFile) ||
        (row.videoType === 'youtube' && row.youtubeUrl.trim() && row.youtubeUrl.trim() !== (row.subTopic.youtube_url || ''));
      if (hasPending) {
        await handleSingleUpload(i);
        if (rows[i]?.status !== 'error') successCount++;
      }
    }
    setBulkUploading(false);
    if (successCount > 0) toast.success(`${successCount} video(s) uploaded/saved successfully`);
  }

  const selectedSubjectObj = subjects.find(s => String(s.id) === selectedSubject);
  const selectedChapterObj = chapters.find(c => String(c.id) === selectedChapter);
  const selectedTopicObj = topics.find(t => String(t.id) === selectedTopic);

  const totalWithVideo = rows.filter(r => r.subTopic.video_source).length;
  const totalPending = rows.filter(r =>
    (r.videoType === 'upload' && r.videoFile) ||
    (r.videoType === 'youtube' && r.youtubeUrl.trim() && r.youtubeUrl.trim() !== (r.subTopic.youtube_url || ''))
  ).length;
  const totalSuccess = rows.filter(r => r.status === 'success').length;
  const anyUploading = rows.some(r => r.uploading);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Auto Video Upload" description="Bulk upload videos or add YouTube URLs for all sub-topics under a topic" />

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
          <SearchableSelect
            label="Subject"
            options={subjects.map(s => ({ value: String(s.id), label: s.english_name || s.code || s.slug }))}
            value={selectedSubject}
            onChange={setSelectedSubject}
            placeholder="Select a subject..."
            searchPlaceholder="Search subjects..."
            disabled={anyUploading}
          />
          <SearchableSelect
            label="Chapter"
            options={chapters.map(c => ({ value: String(c.id), label: (c as any).english_name || c.slug }))}
            value={selectedChapter}
            onChange={setSelectedChapter}
            placeholder={selectedSubject ? 'Select a chapter...' : 'Select subject first'}
            searchPlaceholder="Search chapters..."
            disabled={!selectedSubject || anyUploading}
          />
          <SearchableSelect
            label="Topic"
            options={topics.map(t => ({ value: String(t.id), label: (t as any).english_name || t.slug }))}
            value={selectedTopic}
            onChange={setSelectedTopic}
            placeholder={selectedChapter ? 'Select a topic...' : 'Select chapter first'}
            searchPlaceholder="Search topics..."
            disabled={!selectedChapter || anyUploading}
          />
        </div>
      </div>

      {selectedTopic && rows.length > 0 && (
        <>
          {/* Stats bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{rows.length} sub-topic{rows.length !== 1 ? 's' : ''}</span>
              <Badge variant="info">{totalWithVideo} with video</Badge>
              <Badge variant="muted">{rows.length - totalWithVideo} without</Badge>
              {totalPending > 0 && <Badge variant="warning">{totalPending} pending</Badge>}
              {totalSuccess > 0 && <Badge variant="success">{totalSuccess} saved</Badge>}
            </div>
            <Button onClick={handleBulkUpload} disabled={totalPending === 0 || anyUploading || bulkUploading}>
              {bulkUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading All...</> : <><Upload className="w-4 h-4" /> Upload All ({totalPending})</>}
            </Button>
          </div>

          {/* Sub-topic rows */}
          <div className="space-y-3 mb-5">
            {rows.map((row, index) => {
              const st = row.subTopic;
              const hasExistingVideo = !!st.video_source;
              const isBunny = st.video_source === 'bunny';
              const isYoutube = st.video_source === 'youtube';

              return (
                <div key={st.id} className={cn(
                  'bg-white rounded-xl border shadow-sm overflow-hidden transition-all',
                  row.status === 'success' ? 'border-emerald-200' :
                  row.status === 'error' ? 'border-red-200' :
                  row.uploading ? 'border-brand-200' : 'border-slate-200'
                )}>
                  <div className="flex items-stretch">
                    {/* Left: Sub-topic info */}
                    <div className="w-64 flex-shrink-0 bg-slate-50 border-r border-slate-200 p-4 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-400">#{st.id}</span>
                        {st.difficulty_level && <Badge variant="muted">{st.difficulty_level.replace('_', ' ')}</Badge>}
                      </div>
                      <div className="font-semibold text-sm text-slate-800 truncate" title={st.slug || ''}>{st.slug}</div>
                      {hasExistingVideo && (
                        <div className="flex items-center gap-1.5 mt-2">
                          {isBunny && (
                            <>
                              <Video className="w-3.5 h-3.5 text-brand-500" />
                              <Badge variant="info">Bunny</Badge>
                              {st.video_status && (
                                <Badge variant={st.video_status === 'ready' ? 'success' : st.video_status === 'failed' ? 'danger' : 'warning'}>
                                  {st.video_status}
                                </Badge>
                              )}
                            </>
                          )}
                          {isYoutube && (
                            <>
                              <Youtube className="w-3.5 h-3.5 text-red-500" />
                              <Badge variant="warning">YouTube</Badge>
                            </>
                          )}
                          <button onClick={() => handleRemoveVideo(index)} className="ml-auto p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove video">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {!hasExistingVideo && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                          <Film className="w-3.5 h-3.5" /> No video
                        </div>
                      )}
                    </div>

                    {/* Right: Video input */}
                    <div className="flex-1 p-4">
                      {/* Toggle: Upload vs YouTube */}
                      <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5 mb-3 max-w-xs">
                        <button type="button" onClick={() => updateRow(index, { videoType: 'upload', youtubeUrl: row.youtubeUrl })}
                          disabled={row.uploading}
                          className={cn('flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1',
                            row.videoType === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                          <Upload className="w-3 h-3" /> Upload Video
                        </button>
                        <button type="button" onClick={() => updateRow(index, { videoType: 'youtube' })}
                          disabled={row.uploading}
                          className={cn('flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1',
                            row.videoType === 'youtube' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                          <Youtube className="w-3 h-3" /> YouTube URL
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        {row.videoType === 'upload' ? (
                          <div className="flex-1">
                            <div
                              className={cn(
                                'border-2 border-dashed rounded-lg p-3 text-center transition-colors',
                                row.videoFile ? 'border-brand-200 bg-brand-50/30' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50',
                                row.uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                              )}
                              onClick={() => {
                                if (row.uploading) return;
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.avi,.mkv';
                                input.onchange = (e: any) => { const f = e.target?.files?.[0]; if (f) handleFileSelect(index, f); };
                                input.click();
                              }}
                            >
                              {row.videoFile ? (
                                <div className="flex items-center justify-center gap-2">
                                  <Video className="w-4 h-4 text-brand-600 flex-shrink-0" />
                                  <span className="text-xs text-brand-700 font-medium truncate max-w-[200px]">{row.videoFile.name}</span>
                                  <span className="text-[10px] text-slate-400">({(row.videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                                  {!row.uploading && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleFileSelect(index, null); }} className="text-red-400 hover:text-red-600">
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-2">
                                  <Upload className="w-4 h-4 text-slate-300" />
                                  <span className="text-xs text-slate-500">Click to select video file</span>
                                  <span className="text-[10px] text-slate-400">(MP4, WebM, MOV — max 500MB)</span>
                                </div>
                              )}
                            </div>
                            {row.uploading && row.videoType === 'upload' && (
                              <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                  <span>Uploading...</span>
                                  <span>{row.progress}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-1.5">
                                  <div className="bg-brand-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${row.progress}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={row.youtubeUrl}
                                onChange={e => updateRow(index, { youtubeUrl: e.target.value, status: 'idle', errorMsg: '' })}
                                placeholder="https://www.youtube.com/watch?v=..."
                                disabled={row.uploading}
                                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                              />
                              {row.youtubeUrl && (
                                <a href={row.youtubeUrl} target="_blank" rel="noopener noreferrer"
                                  className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Upload/Save button per row */}
                        <Button
                          size="sm"
                          onClick={() => handleSingleUpload(index)}
                          disabled={row.uploading || (row.videoType === 'upload' ? !row.videoFile : !row.youtubeUrl.trim())}
                        >
                          {row.uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : row.videoType === 'upload' ? <Upload className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          {row.uploading ? 'Saving...' : 'Save'}
                        </Button>
                      </div>

                      {/* Status messages */}
                      {row.status === 'success' && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Saved successfully
                        </div>
                      )}
                      {row.status === 'error' && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600">
                          <AlertTriangle className="w-3.5 h-3.5" /> {row.errorMsg}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Loading state */}
      {loadingSubTopics && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Loader2 className="w-8 h-8 text-slate-300 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-slate-500">Loading sub-topics...</p>
        </div>
      )}

      {/* Empty states */}
      {selectedTopic && !loadingSubTopics && rows.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">No sub-topics found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            This topic has no sub-topics yet. Create sub-topics first, then come back to upload videos.
          </p>
        </div>
      )}

      {!selectedTopic && !loadingSubTopics && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Film className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a Topic to begin</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Choose a Subject, Chapter, and Topic above. All sub-topics under the selected topic will appear as rows where you can upload videos or add YouTube URLs.
          </p>
        </div>
      )}
    </div>
  );
}
