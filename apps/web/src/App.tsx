import { Component, useEffect, useState, type ReactNode } from 'react';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { Intake } from './pages/Intake';
import { ClaimDetail } from './pages/ClaimDetail';
import { Activity } from './pages/Activity';
import { Settings } from './pages/Settings';

export function App() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => { const change = () => setPath(location.pathname); addEventListener('popstate', change); return () => removeEventListener('popstate', change); }, []);
  function navigate(next: string) { history.pushState(null, '', next); setPath(next); window.scrollTo(0, 0); }
  let page: ReactNode;
  if (path === '/intake') page = <Intake navigate={navigate} />;
  else if (path.startsWith('/claims/')) page = <ClaimDetail key={path} id={decodeURIComponent(path.slice(8))} navigate={navigate} />;
  else if (path === '/activity') page = <Activity />;
  else if (path === '/settings') page = <Settings />;
  else page = <Overview claimsPage={path === '/claims'} navigate={navigate} />;
  return <Layout page={path} navigate={navigate}><ErrorBoundary key={path}>{page}</ErrorBoundary></Layout>;
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="error-notice" role="alert">This view could not be displayed. Please refresh the page.</div> : this.props.children; }
}
