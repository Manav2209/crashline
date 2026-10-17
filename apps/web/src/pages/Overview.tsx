import { ArrowRight, ArrowUpRight, AudioLines, ChevronRight, FileCheck2, FileClock, Files, Plus, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { statuses, type ClaimView } from '@crashline/contracts';
import { useResource } from '../lib/hooks';
import { ClaimTable, ErrorNotice, Loading } from '../components/common';

export function Overview({ navigate, claimsPage = false }: { navigate: (path: string) => void; claimsPage?: boolean }) {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), ...(status ? { status } : {}), ...(search ? { search } : {}) });
  const { data, error, loading, refresh } = useResource<{ claims: ClaimView[]; total: number; counts: Record<string, number> }>(`/claims?${query}`, 5000);
  const counts = data?.counts ?? {};
  const metrics = [
    { label: 'Total claims', value: Object.values(counts).reduce((a, b) => a + b, 0), icon: Files, note: 'All reports in your workspace' },
    { label: 'Drafts', value: counts.DRAFT ?? 0, icon: FileClock, note: 'Ready to finish and submit' },
    { label: 'Under investigation', value: (counts.INVESTIGATING ?? 0) + (counts.SUBMITTED ?? 0), icon: Sparkles, note: 'Your agents are on it' },
    { label: 'Awaiting review', value: counts.PENDING_HUMAN_REVIEW ?? 0, icon: FileCheck2, note: 'For a human to take forward' },
  ];
  return <>
    <div className="page-heading"><div><p className="eyebrow">YOUR CLAIMS, IN FOCUS</p><h1>{claimsPage ? 'Claims' : 'A little clarity. A lot less worry.'}</h1><p>From first report to informed review. Everything in one place.</p></div><button className="button primary" onClick={() => navigate('/intake')}><Plus size={17} />Report an accident</button></div>
    {!claimsPage && <section className="welcome-panel"><div className="welcome-copy"><span className="subtle-tag"><AudioLines size={13} /> A CONVERSATION IS ALL IT TAKES</span><h2>Tell us what happened.<br />We’ll help with what’s next.</h2><p>Report an accident in your own words. Our specialists<br className="desktop-break" /> gather the details for a human to review.</p><button className="button dark" onClick={() => navigate('/intake')}>Start a report <ArrowRight size={16} /></button><span className="hero-footnote">Voice or text. Always at your pace.</span></div><RoadIllustration /></section>}
    {!claimsPage && <div className="metrics">{metrics.map(({ label, value, icon: Icon, note }) => <div className="metric" key={label}><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{data ? value : '—'}</strong><small>{note}</small></div>)}</div>}
    <section className="panel"><div className="panel-heading"><div><h2>{claimsPage ? 'All claims' : 'Recent claims'}<span className="count">{data?.total ?? 0}</span></h2><p>Real saved reports, from intake to review.</p></div><button className="text-button" onClick={() => claimsPage ? void refresh() : navigate('/claims')}>{claimsPage ? 'Refresh' : 'View all claims'}<ChevronRight size={15} /></button></div>
      {claimsPage && <form className="claim-filters" onSubmit={(event) => { event.preventDefault(); setSearch(searchText.trim()); setPage(1); }}><input aria-label="Search claims" placeholder="Search by claim ID or location" value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={100} /><select aria-label="Filter claim status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map((item) => <option value={item} key={item}>{item.replaceAll('_', ' ').toLowerCase()}</option>)}</select><button className="button secondary" type="submit">Search</button></form>}
      {error ? <ErrorNotice message={error} retry={refresh} /> : loading ? <Loading /> : <ClaimTable claims={data?.claims ?? []} onOpen={(id) => navigate(`/claims/${id}`)} />}
      {claimsPage && data && <div className="pagination"><span>{data.total ? `${(page - 1) * 20 + 1}-${Math.min(page * 20, data.total)} of ${data.total} claims` : 'No matching claims'}</span><div><button className="button secondary" disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button secondary" disabled={page * 20 >= data.total || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
    </section>
    <div className="trust-strip"><span className="trust-icon"><ShieldCheck size={21} /></span><div><strong>Helpful agents. Clear boundaries.</strong><p>ArmorIQ checks agent tool calls against scoped plans. Reports are preliminary and require human review.</p></div><button className="text-button" onClick={() => navigate('/activity')}>Explore activity <ArrowUpRight size={16} /></button></div>
  </>;
}
function RoadIllustration() {
  return <div className="road-illustration" aria-hidden="true"><svg viewBox="0 0 420 270" fill="none"><path d="M30 254L252 126L413 219M12 202L160 116L273 181L382 117M88 39L204 106L322 38" stroke="#d7e7df" strokeWidth="32" /><path d="M30 254L252 126L413 219M12 202L160 116L273 181L382 117M88 39L204 106L322 38" stroke="#fbfdfb" strokeWidth="2" strokeDasharray="7 9" /><path d="M207 79l67-39 66 39v76l-66 39-67-39V79Z" fill="#e0eee5" stroke="#cbded0" /><path d="m207 79 67 39 66-39M274 118v76" stroke="#cbded0"/><path d="m274 65 28 16v24c0 22-28 38-28 38s-28-16-28-38V81l28-16Z" fill="#254d3e"/><path d="m261 103 9 10 18-22" stroke="#d8f4dd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="m86 168 35-20 46 26v19l-35 20-46-27v-18Z" fill="#fff" stroke="#c6d9cb"/><path d="m95 160 15-20 28 16 20 22-26 15-37-22v-11Z" fill="#d1e3d7"/><path d="m112 145 20 12 10 14-18-10-12-16Z" fill="#6b8d78"/><ellipse cx="98" cy="183" rx="5" ry="8" fill="#355747" transform="rotate(-30 98 183)"/><ellipse cx="143" cy="204" rx="5" ry="8" fill="#355747" transform="rotate(-30 143 204)"/><circle cx="361" cy="62" r="20" fill="#e4efe7"/><path d="M361 75v28M350 92l11 6 12-6" stroke="#95b39e" strokeWidth="2"/><circle cx="181" cy="220" r="16" fill="#dfece3"/><path d="M181 231v22" stroke="#95b39e" strokeWidth="2"/></svg><div className="illustration-label"><span><ShieldCheck size={14} /></span>Human review. Every time.</div></div>;
}
