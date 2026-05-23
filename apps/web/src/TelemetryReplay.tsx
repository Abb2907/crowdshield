import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Clock, Rewind } from 'lucide-react';

interface ReplayEvent {
  ts: string;
  label: string;
  type: 'info' | 'warning' | 'critical' | 'ai';
  detail?: string;
}

const REPLAY_SCRIPT: ReplayEvent[] = [
  { ts: '18:30', label: 'Match starts. Gates A-D open. Normal inflow detected.', type: 'info' },
  { ts: '18:35', label: 'Gate C throughput elevated: 400 P/M. Wait time: 8min.', type: 'info' },
  { ts: '18:38', label: 'Zone A occupancy reaches 62%. Elevated risk flagged.', type: 'warning' },
  { ts: '18:40', label: 'AI prediction: Zone A surge probability 78% in 5min.', type: 'ai', detail: 'Historical pattern match: 91%' },
  { ts: '18:42', label: '⚠ Crowd surge detected: Zone A → 89% capacity.', type: 'critical' },
  { ts: '18:42', label: 'AI routing: Redirect Zone A to Gate D (38% capacity).', type: 'ai', detail: 'Congestion reduction: 41%' },
  { ts: '18:44', label: 'Gate D flow rate increased. Wait time stabilizing.', type: 'info' },
  { ts: '18:46', label: 'Counterfeit ticket detected at Gate C Turnstile 3.', type: 'critical' },
  { ts: '18:47', label: 'Zone A density drops to 74%. Incident resolved.', type: 'info' },
  { ts: '18:51', label: 'All zones nominal. AI briefing updated.', type: 'info' },
];

const typeColor: Record<string, string> = {
  info: '#c8dff5',
  warning: '#F59E0B',
  critical: '#EF4444',
  ai: '#00F5D4',
};
const typeLabel: Record<string, string> = {
  info: 'SYS',
  warning: 'WARN',
  critical: 'ALERT',
  ai: 'AI',
};

export const TelemetryReplay: React.FC = () => {
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const progress = Math.round((cursor / (REPLAY_SCRIPT.length - 1)) * 100);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCursor(c => {
          if (c >= REPLAY_SCRIPT.length - 1) {
            setPlaying(false);
            return c;
          }
          return c + 1;
        });
      }, 1200 / speed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [cursor]);

  const reset = () => { setPlaying(false); setCursor(0); };

  return (
    <div className="glass-card-elevated rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rewind className="w-4 h-4 text-brand-teal" />
          <span className="font-mono text-[10px] font-bold text-white tracking-wider">TELEMETRY REPLAY ENGINE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-brand-text-dim">SPEED</span>
          {[1, 2, 4].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded border transition-all ${speed === s ? 'bg-brand-teal/20 border-brand-teal/40 text-brand-teal' : 'border-brand-border text-brand-text-dim hover:border-brand-teal/30'}`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Context label */}
      <div className="font-mono text-[9px] text-brand-text-dim border border-brand-border/40 rounded px-3 py-1.5 bg-brand-surface/40">
        📼 REPLAY: <span className="text-brand-amber">RCB vs CSK (IPL 2026) — Crowd Surge Incident — 18:42–18:51</span>
      </div>

      {/* Event log */}
      <div ref={logRef} className="cmd-terminal p-3 h-40 overflow-y-auto flex flex-col gap-1 scrollbar-none">
        {REPLAY_SCRIPT.slice(0, cursor + 1).map((evt, i) => (
          <div key={i} className={`flex gap-2 items-start transition-all ${i === cursor ? 'opacity-100' : 'opacity-50'}`}>
            <span className="font-mono text-[9px] text-brand-text-dim flex-shrink-0 w-10">{evt.ts}</span>
            <span className="font-mono text-[8px] font-bold rounded px-1 flex-shrink-0" style={{ color: typeColor[evt.type], background: typeColor[evt.type] + '18', border: `1px solid ${typeColor[evt.type]}30` }}>
              {typeLabel[evt.type]}
            </span>
            <span className="font-mono text-[10px] leading-relaxed" style={{ color: typeColor[evt.type] }}>
              {evt.label}
              {evt.detail && <span className="block text-[9px] opacity-60 mt-0.5">  ↳ {evt.detail}</span>}
            </span>
          </div>
        ))}
        {playing && cursor < REPLAY_SCRIPT.length - 1 && (
          <div className="font-mono text-[10px] text-brand-teal animate-pulse">▋</div>
        )}
      </div>

      {/* Timeline scrubber */}
      <div className="flex flex-col gap-1.5">
        <div className="replay-track" onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          setCursor(Math.round(pct * (REPLAY_SCRIPT.length - 1)));
        }}>
          <div className="replay-fill" style={{ width: `${progress}%` }} />
          <div className="replay-thumb" style={{ left: `${progress}%` }} />
        </div>
        <div className="flex justify-between font-mono text-[8px] text-brand-text-dim">
          <span>{REPLAY_SCRIPT[0].ts}</span>
          <span className="text-brand-teal">{REPLAY_SCRIPT[cursor].ts}</span>
          <span>{REPLAY_SCRIPT[REPLAY_SCRIPT.length - 1].ts}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pt-1 border-t border-brand-border">
        <button onClick={reset} className="text-brand-text-dim hover:text-white transition-colors p-1.5">
          <SkipBack className="w-4 h-4" />
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="flex items-center gap-1.5 btn-primary text-[10px] py-1.5 px-3"
        >
          {playing ? <><Pause className="w-3 h-3" /> PAUSE</> : <><Play className="w-3 h-3" /> REPLAY</>}
        </button>
        <button onClick={() => setCursor(c => Math.min(c + 1, REPLAY_SCRIPT.length - 1))} className="text-brand-text-dim hover:text-white transition-colors p-1.5">
          <SkipForward className="w-4 h-4" />
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-brand-text-dim" />
          <span className="font-mono text-[9px] text-brand-text-dim">{cursor + 1}/{REPLAY_SCRIPT.length} EVENTS</span>
        </div>
      </div>
    </div>
  );
};
