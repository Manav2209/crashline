import { useEffect, useRef, useState } from 'react';
import type { Conversation } from '@elevenlabs/client';
import { AudioLines, Mic, MicOff, PhoneOff } from 'lucide-react';
import { post } from '../lib/api';
import { ErrorNotice } from './common';

export type IntakeSession = { sessionId: string; sessionCapability: string; policyId: string; expiresAt: string };
export function VoicePanel({ session }: { session: IntakeSession }) {
  const conversation = useRef<Conversation | null>(null);
  const mounted = useRef(true);
  const [status, setStatus] = useState('disconnected');
  const [mode, setMode] = useState('listening');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState<{ source: string; message: string }[]>([]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void conversation.current?.endSession(); };
  }, []);
  async function connect() {
    setError(''); setStatus('connecting');
    try {
      const { Conversation } = await import('@elevenlabs/client');
      const { signedUrl, sessionCapability } = await post<{ signedUrl: string; sessionCapability: string }>(`/intake/sessions/${session.sessionId}/voice-url`);
      const current = await Conversation.startSession({
        signedUrl, connectionType: 'websocket',
        dynamicVariables: { session_id: session.sessionId, secret__session_capability: sessionCapability },
        onStatusChange: ({ status: value }) => { if (mounted.current) setStatus(value); },
        onModeChange: ({ mode: value }) => { if (mounted.current) setMode(value); },
        onMessage: ({ source, message }) => { if (mounted.current) setTranscript((items) => [...items.slice(-19), { source, message }]); },
        onError: () => { if (mounted.current) setError('The voice connection was interrupted. Please reconnect or continue with text.'); },
      });
      if (!mounted.current) { await current.endSession(); return; }
      conversation.current = current;
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Voice connection failed.'); setStatus('disconnected'); }
  }
  async function disconnect() { await conversation.current?.endSession(); conversation.current = null; setStatus('disconnected'); }
  function toggleMute() { conversation.current?.setMicMuted(!muted); setMuted(!muted); }
  return <section className="voice-panel"><span className="subtle-tag"><AudioLines size={14} /> ELEVENLABS VOICE</span><div className={`voice-orb ${status === 'connected' ? 'live' : ''}`}><AudioLines size={42} strokeWidth={1.2} /></div>
    <h2>{status === 'connected' ? mode === 'speaking' ? 'We’re here to help.' : 'We’re listening.' : 'Let’s take it one step at a time.'}</h2>
    <p>Speak naturally. Your assistant will gather the details<br />and ask you to confirm before submitting.</p>
    <div className="voice-actions">{status === 'connected' ? <><button className="button secondary" onClick={toggleMute}>{muted ? <MicOff size={17} /> : <Mic size={17} />}{muted ? 'Unmute' : 'Mute'}</button><button className="button danger" onClick={() => void disconnect()}><PhoneOff size={17} />End conversation</button></> : <button className="button primary" disabled={status === 'connecting'} onClick={() => void connect()}><Mic size={17} />{status === 'connecting' ? 'Connecting…' : 'Start voice conversation'}</button>}</div>
    <small>Uses your browser microphone. No phone call needed.</small>{error && <ErrorNotice message={error} />}
    {!!transcript.length && <div className="transcript" aria-live="polite">{transcript.map((line, index) => <p key={index}><strong>{line.source === 'user' ? 'You' : 'CrashLine'}</strong>{line.message}</p>)}</div>}
  </section>;
}
