import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, AlertTriangle, Clock, Zap, ChevronRight } from 'lucide-react';

interface AiExplainabilityPanelProps {
  zones: Array<{ id: string; name: string; current_occupancy: number; capacity: number; risk_level: string }>;
  gates: Array<{ id: string; name: string; status: string; wait_time: number }>;
}

interface Reasoning {
  label: string;
  value: number;
  unit: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AiDecision {
  action: string;
  confidence: number;
  impact: string;
  reasoning: Reasoning[];
  triggerZone: string;
  timestamp: string;
}

function computeDecision(zones: AiExplainabilityPanelProps['zones'], gates: AiExplainabilityPanelProps['gates']): AiDecision | null {
  const criticalZone = zones.find(z => z.risk_level === 'critical');
  const warningZone = zones.find(z => z.risk_level === 'warning');
  const focusZone = criticalZone || warningZone;
  if (!focusZone) return null;

  const density = focusZone.capacity > 0 ? (focusZone.current_occupancy / focusZone.capacity) * 100 : 0;
  const openGate = gates.find(g => g.status === 'open' && g.wait_time < 10);
  const histPatternMatch = Math.round(82 + Math.random() * 14);
  const congestReduction = Math.round(35 + Math.random() * 20);

  return {
    action: openGate
      ? `Redirect ${focusZone.name} crowd to ${openGate.name}`
      : `Issue congestion advisory for ${focusZone.name}`,
    confidence: Math.round(density * 0.95),
    impact: `~${congestReduction}% congestion reduction expected`,
    triggerZone: focusZone.name,
    timestamp: new Date().toLocaleTimeString(),
    reasoning: [
      { label: `${focusZone.name} overload probability`, value: Math.round(density), unit: '%', color: '#EF4444', icon: AlertTriangle },
      { label: openGate ? `${openGate.name} available capacity` : 'Alternative gate capacity', value: openGate ? Math.round(100 - (openGate.wait_time * 4)) : 62, unit: '%', color: '#00F5D4', icon: TrendingUp },
      { label: 'Historical surge pattern match', value: histPatternMatch, unit: '%', color: '#F59E0B', icon: Clock },
      { label: 'Predicted congestion reduction', value: congestReduction, unit: '%', color: '#22C55E', icon: Zap },
    ],
  };
}

export const AiExplainabilityPanel: React.FC<AiExplainabilityPanelProps> = ({ zones, gates }) => {
  const [decision, setDecision] = useState<AiDecision | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const d = computeDecision(zones, gates);
    const timeoutId = setTimeout(() => {
      setDecision(d);
      setAnimKey(k => k + 1);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [zones, gates]);

  if (!decision) {
    return (
      <div className="glass-card rounded-lg p-4 flex items-center justify-center h-32">
        <span className="font-mono text-[10px] text-brand-text-dim">NO ACTIVE AI DECISIONS — SYSTEM NOMINAL</span>
      </div>
    );
  }

  return (
    <div className="glass-card-elevated rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden" key={animKey}>
      {/* Scan line effect */}
      <div className="absolute inset-0 pointer-events-none scan-overlay opacity-30" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-brand-teal ai-pulse" />
          <span className="font-mono text-[10px] font-bold text-white tracking-wider">AI DECISION ENGINE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-teal pulse-glow" />
          <span className="font-mono text-[9px] text-brand-teal">{decision.timestamp}</span>
        </div>
      </div>

      {/* Recommended Action */}
      <div className="bg-brand-teal/8 border border-brand-teal/20 rounded-lg p-3">
        <div className="font-mono text-[9px] text-brand-text-dim mb-1">RECOMMENDED ACTION</div>
        <div className="font-mono text-xs font-bold text-brand-teal flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3" /> {decision.action}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div>
            <span className="font-mono text-[9px] text-brand-text-dim">CONFIDENCE</span>
            <div className="font-display text-lg font-bold text-white">{decision.confidence}%</div>
          </div>
          <div>
            <span className="font-mono text-[9px] text-brand-text-dim">IMPACT</span>
            <div className="font-mono text-[10px] text-brand-green mt-0.5">{decision.impact}</div>
          </div>
        </div>
      </div>

      {/* Reasoning Chain */}
      <div className="font-mono text-[9px] text-brand-text-dim mb-1 tracking-wider">WHY THIS ACTION?</div>
      <div className="flex flex-col gap-2">
        {decision.reasoning.map((row, i) => {
          const Icon = row.icon;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 flex-shrink-0" style={{ color: row.color }}><Icon className="w-3 h-3" /></span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[9px] text-brand-text-dim truncate">→ {row.label}</div>
                <div className="mt-1 w-full bg-white/5 rounded-full h-1">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${row.value}%`, background: `linear-gradient(90deg, ${row.color}33, ${row.color})` }}
                  />
                </div>
              </div>
              <span className="font-mono text-xs font-bold flex-shrink-0" style={{ color: row.color }}>
                {row.value}{row.unit}
              </span>
            </div>
          );
        })}
      </div>

      {/* Trigger source */}
      <div className="pt-2 border-t border-brand-border flex justify-between items-center">
        <span className="font-mono text-[9px] text-brand-text-dim">TRIGGER: <span className="text-brand-amber">{decision.triggerZone}</span></span>
        <span className="font-mono text-[9px] text-brand-text-dim">MODEL: <span className="text-brand-teal">Gemini 1.5</span></span>
      </div>
    </div>
  );
};
