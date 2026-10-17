import { useCallback, useState } from 'react';
import { ArrowLeft, ClipboardCheck, FileSearch, RotateCw, ShieldCheck } from 'lucide-react';
import type { AttemptView, ClaimView, EventView, ReportView, RunView } from '@crashline/contracts';
import { formatDate, post, shortId } from '../lib/api';
import { useResource, useClaimEvents } from '../lib/hooks';
import { Badge, Empty, ErrorNotice, Loading } from '../components/common';
import { SecurityTimeline } from './Activity';

export function ClaimDetail({ id, navigate }: { id: string; navigate: (path: string) => void }) {
  const claim = useResource<ClaimView>(`/claims/${id}`);
  const security = useResource<AttemptView[]>(`/claims/${id}/security`);
  const events = useResource<EventView[]>(`/claims/${id}/events-snapshot`);
  const [tab, setTab] = useState('report');
  const [actionError, setActionError] = useState('');
  const refresh = useCallback(() => { void claim.refresh(); void security.refresh(); void events.refresh(); }, [claim.refresh, security.refresh, events.refresh]);
  useClaimEvents(id, refresh);
  async function retry() { try { await post(`/claims/${id}/investigate`); refresh(); } catch (error) { setActionError(error instanceof Error ? error.message : 'Retry failed.'); } }
  if (claim.error) return <ErrorNotice message={claim.error} retry={claim.refresh} />;
  if (!claim.data) return <Loading />;
  const data = claim.data;
  const report = data.reports?.[0];
  return <><button className="back-link" onClick={() => navigate('/claims')}><ArrowLeft size={15} />Back to claims</button><div className="page-heading"><div><p className="eyebrow">CLAIM DETAIL {data.seeded && '· SEEDED DEMO'}</p><h1>{shortId(data.id)}</h1><p>Reported {formatDate(data.createdAt, true)} · Policy {data.policyId}</p></div><div className="heading-actions"><Badge status={data.status} />{data.status === 'INVESTIGATION_FAILED' && <button className="button secondary" onClick={() => void retry()}><RotateCw size={15} />Retry investigation</button>}</div></div>
    {actionError && <ErrorNotice message={actionError} />}<div className="detail-layout"><section className="panel facts"><div className="panel-heading"><h2>Customer-reported facts</h2><FileSearch size={18} /></div><dl><dt>Incident date & time</dt><dd>{formatDate(data.incidentAt, true)}</dd><dt>Location</dt><dd>{data.location ?? 'Unknown'}</dd><dt>Incident narrative</dt><dd>{data.description ?? 'Unknown'}</dd><dt>Injuries</dt><dd>{data.injuryStatus.replaceAll('_', ' ')}</dd><dt>Other vehicles</dt><dd>{data.otherPartyInvolved == null ? 'Unknown' : data.otherPartyInvolved ? 'Reported' : 'None reported'}</dd><dt>Police report</dt><dd>{data.policeReportNumber ?? 'Unknown'}</dd></dl></section><section className="panel run-panel"><div className="panel-heading"><h2>Investigation</h2><ClipboardCheck size={18} /></div><AgentStatus run={data.runs?.[0]} /><p className="small-note">Separate specialist model calls. Findings remain preliminary.</p></section></div>
    <section className="panel"><div className="tabs"><button className={tab === 'report' ? 'selected' : ''} onClick={() => setTab('report')}>Preliminary report</button><button className={tab === 'security' ? 'selected' : ''} onClick={() => setTab('security')}>Security & activity <span className="count">{security.data?.length ?? 0}</span></button><button className={tab === 'timeline' ? 'selected' : ''} onClick={() => setTab('timeline')}>Timeline</button></div>
      {tab === 'report' ? report ? <Report report={report} /> : <Empty title={data.status === 'DRAFT' ? 'Your report starts with a draft.' : 'The review is taking shape.'}>{data.status === 'DRAFT' ? 'An investigation begins after customer confirmation and submission.' : data.runs?.[0]?.error ?? 'Specialist findings will appear here once the investigation has completed.'}</Empty> : tab === 'security' ? security.error ? <ErrorNotice message={security.error} /> : <SecurityTimeline attempts={security.data ?? []} /> : <div className="timeline">{events.error ? <ErrorNotice message={events.error} /> : events.data?.map((event) => <div key={event.id}><i /><strong>{event.eventType.replaceAll('.', ' · ')}</strong><time>{formatDate(event.createdAt, true)}</time></div>)}</div>}
    </section><div className="provisional"><ShieldCheck size={17} />Synthetic sandbox. Every report requires review by a human insurance professional.</div>
  </>;
}
function AgentStatus({ run }: { run?: RunView }) {
  const agents = [{ name: 'Policy Agent', status: run?.policyAgentStatus ?? 'NOT_STARTED', detail: 'Policy terms & potential coverage' }, { name: 'Claims Investigator', status: run?.investigatorStatus ?? 'NOT_STARTED', detail: 'Incident details & missing information' }];
  return <div className="agent-statuses">{agents.map((agent, index) => <div key={agent.name}><span className="agent-avatar">0{index + 1}</span><div><strong>{agent.name}</strong><small>{agent.detail}</small></div><Badge status={agent.status} /></div>)}</div>;
}
function Report({ report }: { report: ReportView }) {
  const policy = report.coverageReviewJson;
  const incident = report.incidentReviewJson;
  return <div className="report"><span className="subtle-tag">{report.partial ? 'PARTIAL REVIEW' : 'PRELIMINARY FINDINGS'}</span><h2>What we know so far</h2><p className="report-summary">{report.summary}</p><div className="finding-grid"><section><h3>Policy Agent</h3>{policy ? <><p>{policy.explanation}</p><dl><dt>Status at incident</dt><dd>{policy.policyStatusAtIncident}</dd><dt>Deductible</dt><dd>{policy.applicableDeductible == null ? 'Unknown' : policy.applicableDeductible}</dd></dl><h4>Potential coverages</h4><Items items={policy.possibleCoverages} /><h4>Exclusions to review</h4><Items items={policy.exclusionsToReview} /></> : <p>Policy review unavailable. Human follow-up required.</p>}</section><section><h3>Claims Investigator</h3>{incident ? <><p>{incident.incidentSummary}</p><h4>Apparent inconsistencies</h4><Items items={incident.apparentInconsistencies} /><h4>Follow-up questions</h4><Items items={incident.followUpQuestions} /></> : <p>Incident review unavailable. Human follow-up required.</p>}</section></div><h3>Missing information</h3><Items items={report.missingInformationJson} /><p className="recommendation"><ShieldCheck size={18} />{report.recommendation}</p></div>;
}
function Items({ items }: { items: string[] }) { return items.length ? <ul className="finding-items">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="muted">None identified in this review.</p>; }
