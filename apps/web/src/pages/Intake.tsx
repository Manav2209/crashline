import { useEffect, useState } from 'react';
import { ArrowLeft, AudioLines, FileText, ShieldCheck } from 'lucide-react';
import type { ClaimView } from '@crashline/contracts';
import { api, post, shortId } from '../lib/api';
import { DraftForm } from '../components/DraftForm';
import { VoicePanel, type IntakeSession } from '../components/VoicePanel';
import { Badge, ErrorNotice, Loading } from '../components/common';

export function Intake({ navigate }: { navigate: (path: string) => void }) {
  const [session, setSession] = useState<IntakeSession>();
  const [claim, setClaim] = useState<ClaimView | null>(null);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const stored = sessionStorage.getItem('crashline-intake');
    async function start() {
      try {
        if (stored) {
          const saved = JSON.parse(stored) as IntakeSession;
          try { await api(`/intake/sessions/${saved.sessionId}`); if (!cancelled) setSession(saved); return; } catch { sessionStorage.removeItem('crashline-intake'); }
        }
        const created = await post<IntakeSession>('/intake/sessions');
        if (!cancelled) { sessionStorage.setItem('crashline-intake', JSON.stringify(created)); setSession(created); }
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Unable to start intake.'); }
    }
    void start();
    return () => { cancelled = true; };
  }, []);
  async function refresh() {
    if (!session) return;
    try { const result = await api<{ claim: ClaimView | null }>(`/intake/sessions/${session.sessionId}`); setClaim(result.claim); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Draft updates are unavailable.'); }
  }
  useEffect(() => {
    if (!session) return;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 2500);
    return () => clearInterval(timer);
  }, [session]);
  function submitted(id: string) { sessionStorage.removeItem('crashline-intake'); navigate(`/claims/${id}`); }
  const isSubmitted = claim && claim.status !== 'DRAFT';
  return <>
    <button className="back-link" onClick={() => navigate('/')}><ArrowLeft size={15} />Back to overview</button>
    <div className="page-heading"><div><p className="eyebrow">FIRST, TAKE A BREATH</p><h1>Let’s get the details down.</h1><p>A simple conversation today. A clearer next step tomorrow.</p></div></div>
    <div className="safety-notice"><ShieldCheck size={19} /><p><strong>Is anyone injured or in immediate danger?</strong> Contact local emergency services first. Do not delay urgent help to complete this report.</p></div>
    {error && <ErrorNotice message={error} />}
    {!session ? !error && <Loading /> : <div className="intake-layout"><section className="panel"><div className="tabs"><button className={mode === 'voice' ? 'selected' : ''} onClick={() => setMode('voice')}><AudioLines size={16} />Talk to CrashLine</button><button className={mode === 'text' ? 'selected' : ''} onClick={() => setMode('text')}><FileText size={16} />Write the details</button></div>
      {isSubmitted ? <div className="empty"><ShieldCheck size={30} /><h2>Your report is submitted.</h2><p>The investigation will appear in your claim detail.</p><button className="button primary" onClick={() => submitted(claim.id)}>Open {shortId(claim.id)}</button></div> : mode === 'voice' ? <VoicePanel session={session} /> : <div className="form-container"><h2>Accident details</h2><p>Only add what you know. This is a synthetic demo.</p><DraftForm sessionId={session.sessionId} claim={claim} onSaved={refresh} onSubmitted={submitted} /></div>}
    </section><aside className="intake-aside"><div className="panel preview-panel"><p className="eyebrow">YOUR REPORT</p><h2>{claim ? shortId(claim.id) : 'A fresh start.'}</h2>{claim ? <><Badge status={claim.status} /><dl><dt>Policy</dt><dd>{claim.policyId}</dd><dt>Location</dt><dd>{claim.location ?? 'Unknown'}</dd><dt>What happened</dt><dd>{claim.description ?? 'Unknown'}</dd><dt>Injuries</dt><dd>{claim.injuryStatus.replaceAll('_', ' ')}</dd></dl><button className="text-button" onClick={() => navigate(`/claims/${claim.id}`)}>View saved claim →</button></> : <p>A saved draft will appear here as your details are collected.</p>}</div><div className="intake-note"><ShieldCheck size={18} /><p>Your assistant can collect details and explain potential coverage. A human reviews every finding.</p></div></aside></div>}
  </>;
}
