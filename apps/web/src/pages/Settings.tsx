import { useState } from 'react';
import { Check, KeyRound, ShieldCheck } from 'lucide-react';
import { useResource } from '../lib/hooks';
import { ErrorNotice } from '../components/common';

export function Settings() {
  const { data, error, refresh } = useResource<{ armoriq: boolean; voice: boolean; mcpEndpoint: boolean; model: string | null }>('/configuration');
  const [token, setToken] = useState('');
  function save() { sessionStorage.setItem('crashline-access-token', token.trim()); setToken(''); void refresh(); }
  return <><div className="page-heading"><div><p className="eyebrow">WORKSPACE CONNECTIONS</p><h1>A few things behind the scenes.</h1><p>Provider keys are configured on the server and stay out of the browser.</p></div></div>{error && <ErrorNotice message={error} retry={refresh} />}<section className="panel settings-panel"><h2>Integration configuration</h2>{[{ name: 'ArmorIQ', ready: data?.armoriq }, { name: 'ElevenLabs agent', ready: data?.voice }, { name: 'MCP endpoint', ready: data?.mcpEndpoint }, { name: data?.model ?? 'Specialist model', ready: Boolean(data?.model) }].map((item) => <div className="connection-row" key={item.name}><span><ShieldCheck size={18} />{item.name}</span><span className={item.ready ? 'configured' : 'muted'}>{item.ready ? <><Check size={14} />Configured</> : 'Needs setup'}</span></div>)}<p className="small-note">Configuration presence is shown here. Successful execution is proven separately in agent activity.</p></section><section className="panel settings-panel"><h2><KeyRound size={19} />Demo operator access</h2><p>Local development connects through the Vite server. For another frontend connection, enter the demo access token from the server environment.</p><div className="token-input"><input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Demo access token" aria-label="Demo access token" /><button className="button secondary" disabled={!token.trim()} onClick={save}>Connect</button></div></section></>;
}
