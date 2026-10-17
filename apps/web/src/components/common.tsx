import { ArrowUpRight, FileSearch, LoaderCircle, RotateCw } from 'lucide-react';
import type { ClaimView } from '@crashline/contracts';
import { formatDate, shortId } from '../lib/api';

const labels: Record<string, string> = { DRAFT: 'Draft', SUBMITTED: 'Submitted', INVESTIGATING: 'Investigating', PENDING_HUMAN_REVIEW: 'Awaiting review', INVESTIGATION_FAILED: 'Needs attention', ALLOW: 'Allowed', BLOCK: 'Blocked', HOLD: 'On hold', UNAVAILABLE: 'Unavailable' };
export function Badge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}><i />{labels[status] ?? status.replaceAll('_', ' ').toLowerCase()}</span>;
}
export function Empty({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty"><span className="empty-icon"><FileSearch size={22} /></span><h3>{title}</h3><p>{children}</p></div>;
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="error-notice" role="alert"><span>{message}</span>{retry && <button className="text-button" onClick={retry}><RotateCw size={14} />Try again</button>}</div>;
}
export function Loading() { return <div className="loading" role="status"><LoaderCircle size={20} className="spin" /> Loading workspace…</div>; }
export function ClaimTable({ claims, onOpen }: { claims: ClaimView[]; onOpen: (id: string) => void }) {
  if (!claims.length) return <Empty title="A clear road ahead">New accident reports will appear here when a draft is saved.</Empty>;
  return <div className="table-scroll"><table><thead><tr><th>Claim reference</th><th>Incident</th><th>Policy</th><th>Status</th><th>Created</th><th><span className="sr-only">Open</span></th></tr></thead>
    <tbody>{claims.map((claim) => <tr key={claim.id} onClick={() => onOpen(claim.id)}>
      <td><button className="claim-link" onClick={(event) => { event.stopPropagation(); onOpen(claim.id); }}>{shortId(claim.id)}</button>{claim.seeded && <span className="demo-label">Seeded demo</span>}</td>
      <td><span className="table-primary">{claim.location ?? 'Location unknown'}</span><small>{formatDate(claim.incidentAt)}</small></td>
      <td className="mono muted">{claim.policyId}</td><td><Badge status={claim.status} /></td><td className="muted">{formatDate(claim.createdAt)}</td><td><ArrowUpRight size={16} className="muted" /></td>
    </tr>)}</tbody></table></div>;
}
