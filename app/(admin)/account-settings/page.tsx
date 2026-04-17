"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { Lock, Mail, Phone, KeyRound, CheckCircle2, ArrowRight, ShieldAlert } from 'lucide-react';

type Flow = null | 'change_password' | 'update_email' | 'update_mobile';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeFlow, setActiveFlow] = useState<Flow>(null);

  if (!user) return null;

  function handleLoggedOut(message: string) {
    toast.success(message);
    logout();
    setTimeout(() => router.push('/login'), 500);
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader title="Account Settings" description="Manage your password, email, and mobile number" />

      {/* Current info summary */}
      <Card className="mb-6">
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block mb-0.5">Full Name</span>
              <span className="font-medium text-slate-900">{user.full_name}</span>
              <Badge variant="muted" className="ml-2 text-[10px]">Cannot change</Badge>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Email</span>
              <span className="font-medium text-slate-900">{user.email}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-0.5">Mobile</span>
              <span className="font-medium text-slate-900">{user.mobile}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning banner */}
      <div className="mb-6 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-sm text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <span>Changing your password, email, or mobile will <strong>log you out</strong> from all devices. You will need to sign in again.</span>
      </div>

      <div className="space-y-4">
        {/* Change Password */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setActiveFlow(activeFlow === 'change_password' ? null : 'change_password')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Change Password</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Verify with OTP on both email and mobile</p>
                </div>
              </div>
              <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform ${activeFlow === 'change_password' ? 'rotate-90' : ''}`} />
            </div>
          </CardHeader>
          {activeFlow === 'change_password' && (
            <CardContent className="border-t border-slate-100 pt-4">
              <ChangePasswordFlow onDone={handleLoggedOut} />
            </CardContent>
          )}
        </Card>

        {/* Update Email */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setActiveFlow(activeFlow === 'update_email' ? null : 'update_email')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Update Email</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">OTP will be sent to your new email address</p>
                </div>
              </div>
              <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform ${activeFlow === 'update_email' ? 'rotate-90' : ''}`} />
            </div>
          </CardHeader>
          {activeFlow === 'update_email' && (
            <CardContent className="border-t border-slate-100 pt-4">
              <UpdateEmailFlow onDone={handleLoggedOut} />
            </CardContent>
          )}
        </Card>

        {/* Update Mobile */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setActiveFlow(activeFlow === 'update_mobile' ? null : 'update_mobile')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Update Mobile</CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">OTP will be sent to your new mobile number</p>
                </div>
              </div>
              <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform ${activeFlow === 'update_mobile' ? 'rotate-90' : ''}`} />
            </div>
          </CardHeader>
          {activeFlow === 'update_mobile' && (
            <CardContent className="border-t border-slate-100 pt-4">
              <UpdateMobileFlow onDone={handleLoggedOut} />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}


// ══════════════════════════════════════
// CHANGE PASSWORD FLOW
// ══════════════════════════════════════

function ChangePasswordFlow({ onDone }: { onDone: (msg: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pendingId, setPendingId] = useState('');
  const [masked, setMasked] = useState({ email: '', mobile: '' });
  const [channel, setChannel] = useState<'email' | 'mobile'>('email');
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1: verify old password
  const [oldPassword, setOldPassword] = useState('');

  // Step 2: OTP
  const [otp, setOtp] = useState('');

  // Step 3: new password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function initiateChange() {
    if (!oldPassword) return toast.error('Enter current password');
    setLoading(true);
    const res = await api.changePasswordInitiate({ old_password: oldPassword });
    setLoading(false);
    if (res.success) {
      setPendingId(res.data.pending_id);
      setMasked({ email: res.data.email, mobile: res.data.mobile });
      setStep(2);
      toast.success('OTP sent to email and mobile');
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return toast.error('Enter 6-digit OTP');
    setLoading(true);
    const res = await api.changePasswordVerifyOtp({ pending_id: pendingId, channel, otp });
    setLoading(false);
    if (res.success) {
      setOtp('');
      if (res.data.email_verified) setEmailVerified(true);
      if (res.data.mobile_verified) setMobileVerified(true);
      if (res.data.can_set_password) {
        setStep(3);
        toast.success('Both verified! Set your new password.');
      } else {
        setChannel(channel === 'email' ? 'mobile' : 'email');
        toast.success(`${channel} verified. Now verify ${channel === 'email' ? 'mobile' : 'email'}.`);
      }
    } else {
      toast.error(res.error || 'Invalid OTP');
    }
  }

  async function confirmChange() {
    if (newPassword.length < 8) return toast.error('Min 8 characters');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    setLoading(true);
    const res = await api.changePasswordConfirm({ pending_id: pendingId, new_password: newPassword });
    setLoading(false);
    if (res.success) onDone('Password changed! Please sign in.');
    else toast.error(res.error || 'Failed');
  }

  async function resend() {
    const res = await api.changePasswordResendOtp({ pending_id: pendingId, channel });
    if (res.success) toast.success(`OTP resent to ${channel}`);
    else toast.error(res.error || 'Resend failed');
  }

  if (step === 1) return (
    <div className="space-y-4 max-w-md">
      <PasswordInput
        label="Current Password"
        placeholder="Enter your current password"
        leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
        value={oldPassword}
        onChange={e => setOldPassword(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && initiateChange()}
      />
      <Button onClick={initiateChange} loading={loading}>Verify &amp; Send OTP</Button>
    </div>
  );

  if (step === 2) return (
    <div className="space-y-4 max-w-md">
      <div className="flex gap-2">
        <ChannelBtn label="Email" desc={masked.email} active={channel === 'email'} verified={emailVerified} onClick={() => !emailVerified && setChannel('email')} />
        <ChannelBtn label="Mobile" desc={masked.mobile} active={channel === 'mobile'} verified={mobileVerified} onClick={() => !mobileVerified && setChannel('mobile')} />
      </div>
      <Input
        label={`OTP sent to your ${channel}`}
        placeholder="123456"
        maxLength={6}
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
        onKeyDown={e => e.key === 'Enter' && verifyOtp()}
        className="text-center text-xl tracking-widest font-mono"
      />
      <div className="flex gap-2">
        <Button onClick={verifyOtp} loading={loading} className="flex-1">Verify</Button>
        <Button variant="outline" onClick={resend}>Resend</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-md">
      <PasswordInput label="New Password" placeholder="Min 8 characters" leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      <PasswordInput label="Confirm Password" placeholder="Re-enter new password" leftIcon={<KeyRound className="w-4 h-4 text-slate-400" />} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmChange()} />
      <Button onClick={confirmChange} loading={loading}>Change Password</Button>
    </div>
  );
}


// ══════════════════════════════════════
// UPDATE EMAIL FLOW
// ══════════════════════════════════════

function UpdateEmailFlow({ onDone }: { onDone: (msg: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingId, setPendingId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  async function initiate() {
    if (!newEmail || !newEmail.includes('@')) return toast.error('Enter a valid email');
    setLoading(true);
    const res = await api.updateEmailInitiate({ new_email: newEmail });
    setLoading(false);
    if (res.success) {
      setPendingId(res.data.pending_id);
      setMaskedEmail(res.data.new_email);
      setStep(2);
      toast.success('OTP sent to new email');
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function verify() {
    if (otp.length !== 6) return toast.error('Enter 6-digit OTP');
    setLoading(true);
    const res = await api.updateEmailVerifyOtp({ pending_id: pendingId, otp });
    setLoading(false);
    if (res.success) onDone('Email updated! Please sign in with your new email.');
    else toast.error(res.error || 'Invalid OTP');
  }

  async function resend() {
    const res = await api.updateEmailResendOtp({ pending_id: pendingId });
    if (res.success) toast.success('OTP resent to new email');
    else toast.error(res.error || 'Resend failed');
  }

  if (step === 1) return (
    <div className="space-y-4 max-w-md">
      <div className="relative">
        <Mail className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
        <Input
          label="New Email Address"
          type="email"
          placeholder="newemail@example.com"
          className="pl-10"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && initiate()}
        />
      </div>
      <Button onClick={initiate} loading={loading}>Send OTP to New Email</Button>
    </div>
  );

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-slate-600">OTP sent to <strong>{maskedEmail}</strong></p>
      <Input
        label="Enter OTP"
        placeholder="123456"
        maxLength={6}
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
        onKeyDown={e => e.key === 'Enter' && verify()}
        className="text-center text-xl tracking-widest font-mono"
      />
      <div className="flex gap-2">
        <Button onClick={verify} loading={loading} className="flex-1">Verify &amp; Update Email</Button>
        <Button variant="outline" onClick={resend}>Resend</Button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════
// UPDATE MOBILE FLOW
// ══════════════════════════════════════

function UpdateMobileFlow({ onDone }: { onDone: (msg: string) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingId, setPendingId] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  async function initiate() {
    if (!newMobile || newMobile.length < 10) return toast.error('Enter a valid 10-digit mobile');
    setLoading(true);
    const res = await api.updateMobileInitiate({ new_mobile: newMobile });
    setLoading(false);
    if (res.success) {
      setPendingId(res.data.pending_id);
      setMaskedMobile(res.data.new_mobile);
      setStep(2);
      toast.success('OTP sent to new mobile');
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function verify() {
    if (otp.length !== 6) return toast.error('Enter 6-digit OTP');
    setLoading(true);
    const res = await api.updateMobileVerifyOtp({ pending_id: pendingId, otp });
    setLoading(false);
    if (res.success) onDone('Mobile updated! Please sign in with your new mobile.');
    else toast.error(res.error || 'Invalid OTP');
  }

  async function resend() {
    const res = await api.updateMobileResendOtp({ pending_id: pendingId });
    if (res.success) toast.success('OTP resent to new mobile');
    else toast.error(res.error || 'Resend failed');
  }

  if (step === 1) return (
    <div className="space-y-4 max-w-md">
      <div className="relative">
        <Phone className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
        <Input
          label="New Mobile Number"
          placeholder="9876543210"
          className="pl-10"
          value={newMobile}
          onChange={e => setNewMobile(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && initiate()}
          hint="10-digit Indian number (auto-prefixed with +91)"
        />
      </div>
      <Button onClick={initiate} loading={loading}>Send OTP to New Mobile</Button>
    </div>
  );

  return (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-slate-600">OTP sent to <strong>{maskedMobile}</strong></p>
      <Input
        label="Enter OTP"
        placeholder="123456"
        maxLength={6}
        value={otp}
        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
        onKeyDown={e => e.key === 'Enter' && verify()}
        className="text-center text-xl tracking-widest font-mono"
      />
      <div className="flex gap-2">
        <Button onClick={verify} loading={loading} className="flex-1">Verify &amp; Update Mobile</Button>
        <Button variant="outline" onClick={resend}>Resend</Button>
      </div>
    </div>
  );
}


// ══════════════════════════════════════
// SHARED COMPONENT: Channel toggle button
// ══════════════════════════════════════

function ChannelBtn({ label, desc, active, verified, onClick }: { label: string; desc: string; active: boolean; verified: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={verified}
      className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
        active ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
      } ${verified ? 'opacity-75' : ''}`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {label === 'Email' ? <Mail className="w-4 h-4 text-slate-600" /> : <Phone className="w-4 h-4 text-slate-600" />}
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {verified && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
      </div>
      <div className="text-sm font-medium text-slate-900">{desc}</div>
    </button>
  );
}
