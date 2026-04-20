'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  GraduationCap, Briefcase, Wrench, Languages, FolderKanban, Share2,
  MapPin, Mail, Phone, Calendar, ExternalLink, Github, Globe, Award,
  ChevronDown, ChevronUp, Printer, Loader2, Heart, User
} from 'lucide-react';

/* ─── Types ─── */
interface ResumeData {
  profile: any;
  education: any[];
  experience: any[];
  skills: any[];
  languages: any[];
  socialMedia: any[];
  projects: any[];
}

/* ─── Helpers ─── */
function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function locationString(city: any, state: any, country: any) {
  return [city?.name, state?.name, country?.name].filter(Boolean).join(', ');
}

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: 'bg-slate-200 text-slate-700',
  elementary: 'bg-blue-100 text-blue-700',
  basic: 'bg-blue-100 text-blue-700',
  intermediate: 'bg-amber-100 text-amber-700',
  conversational: 'bg-amber-100 text-amber-700',
  professional: 'bg-emerald-100 text-emerald-700',
  advanced: 'bg-emerald-100 text-emerald-700',
  fluent: 'bg-violet-100 text-violet-700',
  expert: 'bg-violet-100 text-violet-700',
  native: 'bg-rose-100 text-rose-700',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract',
  internship: 'Internship', freelance: 'Freelance', self_employed: 'Self-employed',
  volunteer: 'Volunteer', apprenticeship: 'Apprenticeship', other: 'Other',
};

const PROFICIENCY_WIDTH: Record<string, string> = {
  beginner: 'w-1/5', elementary: 'w-2/5', basic: 'w-1/5',
  intermediate: 'w-3/5', conversational: 'w-2/5', professional: 'w-3/5',
  advanced: 'w-4/5', fluent: 'w-4/5', expert: 'w-full', native: 'w-full',
};

/* ─── Section wrapper ─── */
function Section({ icon: Icon, title, children, count }: { icon: any; title: string; children: React.ReactNode; count?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="print:break-inside-avoid">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 mb-4 group print:pointer-events-none"
      >
        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 print:bg-slate-100">
          <Icon className="w-[18px] h-[18px] text-brand-600 print:text-slate-700" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 flex-1 text-left">{title}</h2>
        {count !== undefined && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{count}</span>}
        <span className="print:hidden text-slate-400 group-hover:text-slate-600 transition-colors">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && children}
    </section>
  );
}

/* ─── Skill bar ─── */
function SkillBar({ name, level, years }: { name: string; level: string; years?: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-slate-700">{name}</span>
        <span className="text-slate-400 capitalize text-xs">{level?.replace('_', ' ')}{years ? ` · ${years}y` : ''}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full bg-brand-500 rounded-full transition-all duration-700 ${PROFICIENCY_WIDTH[level] || 'w-1/5'}`} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════ PAGE ═══════════════════════════════════════ */
export default function ResumePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<ResumeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await api.getResume(slug);
      if (res.success) setData(res.data);
      else setError(res.error || 'Resume not found');
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading resume...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">Resume Not Found</h1>
          <p className="text-slate-500 text-sm">This resume is private or doesn&apos;t exist. Check the URL and try again.</p>
        </div>
      </div>
    );
  }

  const { profile, education, experience, skills, languages, socialMedia, projects } = data;
  const user = profile.user;
  const loc = locationString(profile.current_city, profile.current_state, profile.current_country)
    || locationString(profile.permanent_city, profile.permanent_state, profile.permanent_country);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      {/* ── Print button ── */}
      <div className="fixed bottom-6 right-6 z-50 print:hidden">
        <button
          onClick={() => window.print()}
          className="w-12 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          title="Print / Save as PDF"
        >
          <Printer className="w-5 h-5" />
        </button>
      </div>

      {/* ── Cover & Header Card ── */}
      <header className="relative">
        {/* Cover gradient */}
        <div className="h-40 sm:h-48 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 print:h-28 print:from-slate-700 print:via-slate-800 print:to-slate-900">
          {profile.cover_image_url && (
            <img src={profile.cover_image_url} alt="" className="w-full h-full object-cover opacity-40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>

        {/* Profile card overlapping cover */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5 sm:p-6 print:shadow-none print:border print:rounded-lg">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden bg-white flex-shrink-0 print:w-20 print:h-20 print:rounded-xl">
                {(profile.profile_image_url || user?.avatar_url) ? (
                  <img src={profile.profile_image_url || user?.avatar_url} alt={user?.full_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
                    <span className="text-3xl font-bold text-brand-600">{user?.full_name?.charAt(0)?.toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Name, headline & contact */}
              <div className="flex-1 min-w-0 text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight print:text-2xl">{user?.full_name}</h1>
                {profile.headline && <p className="text-base text-slate-500 mt-1">{profile.headline}</p>}
                {/* Primary contact */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-1.5 mt-3 text-sm text-slate-500">
                  {loc && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {loc}
                    </span>
                  )}
                  {user?.email && (
                    <a href={`mailto:${user.email}`} className="flex items-center gap-1.5 hover:text-brand-600 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {user.email}
                    </a>
                  )}
                  {user?.mobile && (
                    <a href={`tel:${user.mobile}`} className="flex items-center gap-1.5 hover:text-brand-600 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {user.mobile}
                    </a>
                  )}
                  {profile.alternate_email && (
                    <a href={`mailto:${profile.alternate_email}`} className="flex items-center gap-1.5 hover:text-brand-600 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> {profile.alternate_email}
                    </a>
                  )}
                  {profile.alternate_phone && (
                    <a href={`tel:${profile.alternate_phone}`} className="flex items-center gap-1.5 hover:text-brand-600 transition-colors">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> {profile.alternate_phone}
                    </a>
                  )}
                </div>
                {/* Social links inline */}
                {socialMedia.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                    {socialMedia.map((sm: any) => (
                      <a
                        key={sm.id}
                        href={sm.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={sm.social_media?.name || 'Link'}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-brand-50 flex items-center justify-center transition-colors group"
                      >
                        {sm.social_media?.icon ? (
                          <img src={sm.social_media.icon} alt={sm.social_media.name} className="w-4 h-4 rounded-sm" />
                        ) : (
                          <Globe className="w-4 h-4 text-slate-400 group-hover:text-brand-600" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 print:py-4">
        {/* Bio */}
        {profile.bio && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 mb-6 print:shadow-none print:border print:rounded-lg">
            <p className="text-slate-600 leading-relaxed whitespace-pre-line">{profile.bio}</p>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 print:grid-cols-3 print:gap-4">

          {/* ── Left column ── */}
          <div className="md:col-span-2 xl:col-span-3 space-y-6 print:space-y-4">

            {/* Experience */}
            {experience.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 print:shadow-none print:border print:rounded-lg print:p-4">
                <Section icon={Briefcase} title="Experience" count={experience.length}>
                  <div className="space-y-5 print:space-y-3">
                    {experience.map((exp: any) => (
                      <div key={exp.id} className="relative pl-6 border-l-2 border-slate-200 print:border-slate-300">
                        <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-brand-500 border-2 border-white print:bg-slate-600" />
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                          <div>
                            <h3 className="font-semibold text-slate-800">{exp.job_title}</h3>
                            <p className="text-sm text-brand-600 font-medium">{exp.company_name}</p>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                            <Calendar className="w-3 h-3" />
                            {formatDate(exp.start_date)} — {exp.is_current_job ? 'Present' : formatDate(exp.end_date)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {exp.employment_type && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                              {EMPLOYMENT_LABELS[exp.employment_type] || exp.employment_type}
                            </span>
                          )}
                          {exp.location && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" /> {exp.location}
                            </span>
                          )}
                          {exp.work_mode && exp.work_mode !== 'on_site' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium capitalize">
                              {exp.work_mode.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        {exp.description && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{exp.description}</p>}
                        {exp.key_achievements && (
                          <p className="text-sm text-slate-500 mt-1.5 italic">
                            <Award className="w-3 h-3 inline mr-1 text-amber-500" />
                            {exp.key_achievements}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {/* Education */}
            {education.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 print:shadow-none print:border print:rounded-lg print:p-4">
                <Section icon={GraduationCap} title="Education" count={education.length}>
                  <div className="space-y-5 print:space-y-3">
                    {education.map((edu: any) => (
                      <div key={edu.id} className="relative pl-6 border-l-2 border-slate-200 print:border-slate-300">
                        <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white print:bg-slate-600" />
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                          <div>
                            <h3 className="font-semibold text-slate-800">{edu.degree_title || edu.education_level?.name}</h3>
                            <p className="text-sm text-brand-600 font-medium">{edu.institution_name}</p>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                            <Calendar className="w-3 h-3" />
                            {formatDate(edu.start_date)} — {edu.is_current ? 'Present' : formatDate(edu.end_date)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {edu.field_of_study && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">{edu.field_of_study}</span>
                          )}
                          {edu.specialization && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{edu.specialization}</span>
                          )}
                          {edu.grade_or_percentage && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">Grade: {edu.grade_or_percentage}</span>
                          )}
                        </div>
                        {edu.description && <p className="text-sm text-slate-600 mt-2">{edu.description}</p>}
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {/* Projects */}
            {projects.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 print:shadow-none print:border print:rounded-lg print:p-4">
                <Section icon={FolderKanban} title="Projects" count={projects.length}>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-3">
                    {projects.map((prj: any) => (
                      <div key={prj.id} className="border border-slate-200 rounded-xl p-4 hover:border-brand-200 hover:shadow-sm transition-all print:hover:border-slate-200 print:hover:shadow-none">
                        {prj.thumbnail_url && (
                          <img src={prj.thumbnail_url} alt={prj.project_title} className="w-full h-32 object-cover rounded-lg mb-3" />
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-slate-800 text-sm leading-snug">{prj.project_title}</h3>
                          {prj.is_featured && (
                            <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        {prj.organization_name && <p className="text-xs text-slate-500 mt-0.5">{prj.organization_name}</p>}
                        {prj.role_in_project && <p className="text-xs text-brand-600 font-medium mt-1">{prj.role_in_project}</p>}
                        {prj.description && <p className="text-xs text-slate-500 mt-2 line-clamp-3">{prj.description}</p>}
                        {prj.technologies_used && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {prj.technologies_used.split(',').slice(0, 5).map((t: string, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{t.trim()}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          {prj.project_url && (
                            <a href={prj.project_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-600 flex items-center gap-0.5 hover:underline">
                              <Globe className="w-3 h-3" /> Live
                            </a>
                          )}
                          {prj.repository_url && (
                            <a href={prj.repository_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-500 flex items-center gap-0.5 hover:underline">
                              <Github className="w-3 h-3" /> Code
                            </a>
                          )}
                          {prj.demo_url && (
                            <a href={prj.demo_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-500 flex items-center gap-0.5 hover:underline">
                              <ExternalLink className="w-3 h-3" /> Demo
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}
          </div>

          {/* ── Right column (sidebar) ── */}
          <div className="space-y-6 print:space-y-4 md:sticky md:top-6 md:self-start">

            {/* Contact & Address */}
            {(profile.alternate_email || profile.alternate_phone || profile.current_address_line1 || profile.permanent_address_line1 || profile.emergency_contact_name) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 print:shadow-none print:border print:rounded-lg print:p-4">
                <Section icon={User} title="Contact">
                  <div className="space-y-4 text-sm">
                    {/* Address */}
                    {(profile.current_address_line1 || profile.permanent_address_line1) && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{profile.current_address_line1 ? 'Current Address' : 'Address'}</div>
                        <p className="text-slate-700 leading-relaxed">
                          {profile.current_address_line1 || profile.permanent_address_line1}
                          {(profile.current_address_line2 || profile.permanent_address_line2) && <><br />{profile.current_address_line2 || profile.permanent_address_line2}</>}
                          <br />
                          {locationString(profile.current_city || profile.permanent_city, profile.current_state || profile.permanent_state, profile.current_country || profile.permanent_country)}
                          {(profile.current_postal_code || profile.permanent_postal_code) && ` - ${profile.current_postal_code || profile.permanent_postal_code}`}
                        </p>
                      </div>
                    )}

                    {/* Alternate contact */}
                    {(profile.alternate_email || profile.alternate_phone) && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Alternate Contact</div>
                        {profile.alternate_email && (
                          <a href={`mailto:${profile.alternate_email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-brand-600 mb-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" /> {profile.alternate_email}
                          </a>
                        )}
                        {profile.alternate_phone && (
                          <a href={`tel:${profile.alternate_phone}`} className="flex items-center gap-1.5 text-slate-600 hover:text-brand-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {profile.alternate_phone}
                          </a>
                        )}
                      </div>
                    )}

                    {/* Emergency contact */}
                    {profile.emergency_contact_name && (
                      <div>
                        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Emergency Contact</div>
                        <p className="text-slate-700 font-medium">{profile.emergency_contact_name}</p>
                        {profile.emergency_contact_relationship && <p className="text-slate-500 text-xs">{profile.emergency_contact_relationship}</p>}
                        {profile.emergency_contact_phone && (
                          <a href={`tel:${profile.emergency_contact_phone}`} className="flex items-center gap-1.5 text-slate-600 hover:text-brand-600 mt-0.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" /> {profile.emergency_contact_phone}
                          </a>
                        )}
                        {profile.emergency_contact_email && (
                          <a href={`mailto:${profile.emergency_contact_email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-brand-600 mt-0.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" /> {profile.emergency_contact_email}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </Section>
              </div>
            )}

            {/* Skills */}
            {skills.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 print:shadow-none print:border print:rounded-lg print:p-4">
                <Section icon={Wrench} title="Skills" count={skills.length}>
                  <div className="space-y-3 print:space-y-2">
                    {skills.map((s: any) => (
                      <SkillBar
                        key={s.id}
                        name={s.skill?.name || '—'}
                        level={s.proficiency_level}
                        years={s.years_of_experience}
                      />
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {/* Languages */}
            {languages.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 print:shadow-none print:border print:rounded-lg print:p-4">
                <Section icon={Languages} title="Languages" count={languages.length}>
                  <div className="space-y-3">
                    {languages.map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-slate-700">{l.language?.name || '—'}</span>
                          {(l.is_native || l.is_primary) && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">
                              {l.is_native ? 'Native' : 'Primary'}
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${PROFICIENCY_COLORS[l.proficiency_level] || 'bg-slate-100 text-slate-600'}`}>
                          {l.proficiency_level?.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}

            {/* Social Links (detailed) */}
            {socialMedia.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60 print:shadow-none print:border print:rounded-lg print:p-4">
                <Section icon={Share2} title="Connect">
                  <div className="space-y-2">
                    {socialMedia.map((sm: any) => (
                      <a
                        key={sm.id}
                        href={sm.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors group"
                      >
                        {sm.social_media?.icon ? (
                          <img src={sm.social_media.icon} alt={sm.social_media.name} className="w-5 h-5 rounded" />
                        ) : (
                          <Globe className="w-5 h-5 text-slate-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-700 group-hover:text-brand-600 transition-colors truncate">
                            {sm.social_media?.name || 'Link'}
                          </div>
                          {sm.username && <div className="text-[11px] text-slate-400 truncate">@{sm.username}</div>}
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </Section>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-6 text-xs text-slate-400 print:py-2 print:text-[10px]">
        <p>Powered by <span className="font-semibold text-slate-500">Grow Up More</span></p>
      </footer>
    </div>
  );
}
