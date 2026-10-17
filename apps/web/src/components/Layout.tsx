import { Activity, ArrowUpRight, AudioLines, CircleHelp, Command, FileText, LayoutDashboard, Settings2, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function Layout({ page, navigate, children }: { page: string; navigate: (path: string) => void; children: ReactNode }) {
  const links = [{ path: '/', label: 'Overview', icon: LayoutDashboard }, { path: '/claims', label: 'Claims', icon: FileText }, { path: '/activity', label: 'Agent activity', icon: Activity }];
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => navigate('/')}><span className="brand-icon"><AudioLines size={22} /></span>crashline<span className="brand-dot">.</span></button>
      <div className="workspace"><span className="workspace-avatar">CL</span><div><strong>Claims workspace</strong><small>Sandbox environment</small></div><Command size={14} /></div>
      <p className="nav-label">WORKSPACE</p>
      <nav>{links.map(({ path, label, icon: Icon }) => <button key={path} className={`nav-item ${(path === '/' ? page === '/' : page.startsWith(path)) ? 'active' : ''}`} onClick={() => navigate(path)}><Icon size={18} />{label}{path === '/activity' && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="safety-card"><ShieldCheck size={20} /><strong>Permission by design.</strong><p>Every agent action follows a scoped, verified plan.</p><button onClick={() => navigate('/activity')}>View activity <ArrowUpRight size={14} /></button></div>
        <button className="nav-item" onClick={() => navigate('/settings')}><Settings2 size={17} />Connection settings</button>
        <a className="nav-item" href="https://docs.armoriq.ai/sdk" target="_blank" rel="noreferrer"><CircleHelp size={17} />Enforcement docs <ArrowUpRight size={14} /></a>
        <div className="profile"><span className="profile-avatar">AM</span><div><strong>Alex Morgan</strong><small>Synthetic demo account</small></div><span className="online-dot" /></div>
      </div>
    </aside>
    <main className="main"><header className="topbar"><span>Workspace <span className="crumb-divider">/</span> <strong>{page === '/' ? 'Overview' : page.startsWith('/claims/') ? 'Claim detail' : page === '/intake' ? 'Report an accident' : page === '/activity' ? 'Agent activity' : page === '/settings' ? 'Settings' : 'Claims'}</strong></span><span className="environment"><span />Synthetic data only</span></header><div className="page-content">{children}</div><footer>Built for a calmer claims experience.<span>CrashLine · Sandbox prototype</span></footer></main>
  </div>;
}
