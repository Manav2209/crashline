import { useRef, useState } from 'react';
import { Check, Save, Send } from 'lucide-react';
import type { ClaimView, DraftInput } from '@crashline/contracts';
import { post } from '../lib/api';
import { ErrorNotice } from './common';

export function DraftForm({ sessionId, claim, onSaved, onSubmitted }: { sessionId: string; claim: ClaimView | null; onSaved: () => Promise<void>; onSubmitted: (id: string) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [dirty, setDirty] = useState(!claim);
  const operation = useRef(crypto.randomUUID());
  const submitOperation = useRef(crypto.randomUUID());
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
    const form = new FormData(event.currentTarget);
    const incidentAt = String(form.get('incidentAt') ?? '');
    const input: DraftInput = {
      incidentAt: incidentAt ? new Date(incidentAt).toISOString() : null,
      location: String(form.get('location') ?? '').trim() || null,
      description: String(form.get('description') ?? '').trim() || null,
      injuryStatus: String(form.get('injuryStatus')) as DraftInput['injuryStatus'],
      otherPartyInvolved: form.get('otherParty') === 'unknown' ? null : form.get('otherParty') === 'yes',
      policeReportNumber: String(form.get('policeReportNumber') ?? '').trim() || null,
    };
    await post(`/intake/sessions/${sessionId}/draft`, input, operation.current); setDirty(false); setConfirmed(false); await onSaved(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save the draft.'); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!claim || dirty || !confirmed) return;
    setBusy(true); setError('');
    try {
      await post(`/intake/sessions/${sessionId}/confirm`, { version: claim.version, confirmed: true, confirmationText: 'I reviewed this draft and confirm submission of the accident report.' });
      await post(`/intake/sessions/${sessionId}/submit`, {}, submitOperation.current);
      onSubmitted(claim.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Submission could not be completed.'); }
    finally { setBusy(false); }
  }
  function changed() { setDirty(true); setConfirmed(false); operation.current = crypto.randomUUID(); }
  const localDate = claim?.incidentAt ? new Date(new Date(claim.incidentAt).getTime() - new Date(claim.incidentAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  return <form className="draft-form" onSubmit={(event) => void save(event)} onChange={changed}>
    <div className="form-grid"><label>Incident date & time<input name="incidentAt" disabled={busy} type="datetime-local" defaultValue={localDate} /><small>Local timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</small></label><label>Location<input name="location" disabled={busy} maxLength={500} minLength={2} placeholder="Street, intersection, or landmark" defaultValue={claim?.location ?? ''} /></label></div>
    <label>What happened?<textarea name="description" disabled={busy} rows={4} minLength={5} maxLength={5000} placeholder="Describe the accident in your own words. Leave anything you’re unsure of unknown." defaultValue={claim?.description ?? ''} /></label>
    <div className="form-grid"><label>Any injuries reported?<select name="injuryStatus" disabled={busy} defaultValue={claim?.injuryStatus ?? 'unknown'}><option value="unknown">Unknown</option><option value="none_reported">None reported</option><option value="reported">Injuries reported</option></select></label><label>Other vehicles involved?<select name="otherParty" disabled={busy} defaultValue={claim?.otherPartyInvolved == null ? 'unknown' : claim.otherPartyInvolved ? 'yes' : 'no'}><option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select></label></div>
    <label>Police report number <span className="muted">(if available)</span><input name="policeReportNumber" disabled={busy} maxLength={100} placeholder="Leave blank if unknown" defaultValue={claim?.policeReportNumber ?? ''} /></label>
    {error && <ErrorNotice message={error} />}
    <div className="save-row"><span className="muted">{claim && !dirty ? <><Check size={15} /> Draft saved · version {claim.version}</> : 'Your report stays a draft until you confirm.'}</span><button className="button secondary" type="submit" disabled={busy}><Save size={16} />{busy ? 'Working…' : 'Save draft'}</button></div>
    {claim && <div className="confirmation"><label className="checkbox"><input type="checkbox" checked={confirmed} disabled={dirty || busy} onChange={(event) => { event.stopPropagation(); setConfirmed(event.target.checked); }} />I’ve reviewed these details and confirm I want to submit this accident report.</label><button className="button primary" type="button" disabled={!confirmed || dirty || busy} onClick={() => void submit()}><Send size={16} />Submit report</button></div>}
  </form>;
}
