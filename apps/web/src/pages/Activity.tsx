import { useState } from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { AttemptView } from '@crashline/contracts';
import { api, formatDate, shortId } from '../lib/api';
import { useResource } from '../lib/hooks';
import { Badge, Empty, ErrorNotice, Loading } from '../components/common';

export function SecurityTimeline({ attempts }: { attempts: AttemptView[] }) {
  if (!attempts.length) return <Empty title="No tool activity yet">Real enforcement decisions will appear here when an agent requests a tool. No security evidence is preseeded.</Empty>;
  return <div className="security-list">{attempts.map((attempt) => <details className="security-entry" key={attempt.id}><summary><span className={`decision-icon ${attempt.decision.toLowerCase()}`}><ShieldCheck size={17} /></span><div><strong>{attempt.mcpTool}</strong><small>{attempt.agentType.replaceAll('_', ' ')} · {formatDate(attempt.createdAt, true)}{attempt.resultStatus === 'ERROR' && ' · Tool operation failed'}</small></div><Badge status={attempt.decision} /></summary><div className="security-details"><p>{attempt.reason}</p><dl><dt>Decision source</dt><dd>{attempt.enforcementSource?.replaceAll('_', ' ') ?? 'Not recorded'}</dd><dt>MCP handler</dt><dd>{attempt.mcpInvoked ? 'Invoked' : 'Not invoked'}</dd><dt>Operation result</dt><dd>{attempt.resultStatus.replaceAll('_', ' ')}</dd><dt>Execution receipt</dt><dd>{attempt.executed ? 'Present' : 'No receipt recorded'}</dd><dt>ArmorIQ trace</dt><dd className="mono">{attempt.armorTraceId ?? 'Not supplied by SDK'}</dd><dt>ArmorIQ plan ID</dt><dd className="mono break-word">{attempt.armorPlanId ?? 'Not supplied by SDK'}</dd><dt>ArmorIQ plan hash</dt><dd className="mono break-word">{attempt.planHash ?? 'No signed plan returned'}</dd><dt>Claim</dt><dd>{attempt.claimId ? shortId(attempt.claimId) : 'Intake session'}</dd></dl></div></details>)}</div>;
}
export function Activity() {
  const [decision, setDecision] = useState('');
  const [role, setRole] = useState('');
  const [exportError, setExportError] = useState('');
  const { data, error, loading, refresh } = useResource<AttemptView[]>(`/security?${new URLSearchParams({ ...(decision ? { decision } : {}), ...(role ? { role } : {}) })}`, 5000);
  async function exportEvidence() {
    setExportError('');
    try {
    const evidence = await api<AttemptView[]>('/security');
    const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), source: 'CrashLine ToolAttempt records', evidence }, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'crashline-enforcement.json'; anchor.click(); URL.revokeObjectURL(url);
    } catch (failure) { setExportError(failure instanceof Error ? failure.message : 'Evidence could not be exported.'); }
  }
  return <><div className="page-heading"><div><p className="eyebrow">ACTIONS WITH ACCOUNTABILITY</p><h1>Agent activity</h1><p>A clear record of what was requested, permitted, and executed.</p></div><button className="button secondary" onClick={() => void exportEvidence()}>Export evidence <ExternalLink size={15} /></button></div>
    <div className="info-banner"><ShieldCheck size={20} /><p>These decisions come from persisted backend attempts. An SDK plan rejection is labeled separately from a remote policy block. Missing proof stays missing.</p></div>
    {exportError && <ErrorNotice message={exportError} />}
    <section className="panel"><div className="panel-heading"><h2>Enforcement timeline <span className="count">{data?.length ?? 0}</span></h2><div className="filters"><select aria-label="Filter decision" value={decision} onChange={(event) => setDecision(event.target.value)}><option value="">All decisions</option>{['ALLOW', 'BLOCK', 'HOLD', 'UNAVAILABLE'].map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter agent" value={role} onChange={(event) => setRole(event.target.value)}><option value="">All agents</option>{['INTAKE', 'POLICY_AGENT', 'INVESTIGATOR', 'ORCHESTRATOR'].map((item) => <option key={item}>{item}</option>)}</select></div></div>{error ? <ErrorNotice message={error} retry={refresh} /> : loading ? <Loading /> : <SecurityTimeline attempts={data ?? []} />}</section>
  </>;
}
