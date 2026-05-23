import React, { useEffect, useRef, useState } from 'react';
import { Shield, Zap, Brain, Radio, Eye, Lock, ChevronRight, Activity, Users, AlertTriangle, TrendingUp, ArrowRight, Github } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
}

const STATS = [
  { value: '100K+', label: 'Fan Capacity', icon: Users },
  { value: '<2s', label: 'Telemetry Latency', icon: Activity },
  { value: '99.9%', label: 'System Uptime', icon: Zap },
  { value: '94%', label: 'Incident Prevention', icon: Shield },
];

const FEATURES = [
  { icon: Brain, color: '#00F5D4', title: 'AI Cognitive Engine', desc: 'Gemini-powered reasoning generates real-time operational briefings, predicts crowd surges 5 minutes ahead, and explains every decision with full transparency.' },
  { icon: Eye, color: '#3B82F6', title: 'Digital Twin Simulation', desc: 'Live particle-physics crowd simulation across all stadium zones with evacuation wave propagation, congestion ripple modeling, and directional flow vectors.' },
  { icon: Radio, color: '#F59E0B', title: 'Real-Time Telemetry', desc: 'Sub-2-second Socket.io streaming from 500+ IoT sensors. Live gate throughput, zone density, and incident alerts synchronized across all operator devices.' },
  { icon: AlertTriangle, color: '#EF4444', title: 'Emergency Orchestration', desc: 'One-hold evacuation trigger cascades AI-optimized routing across all zones simultaneously, with automatic gate balancing and crowd-safe flow vectors.' },
  { icon: Lock, color: '#8B5CF6', title: 'Counterfeit Detection', desc: 'ML-powered ticket verification at every turnstile. Cryptographic barcode validation with instant fraud alerts and automatic gate lockout sequences.' },
  { icon: TrendingUp, color: '#22C55E', title: 'Analytics Intelligence', desc: 'Post-event forensic analytics with hourly crowd velocity charts, gate bottleneck analysis, and incident severity classification dashboards.' },
];

const ARCH_NODES = [
  { label: 'CCTV / IoT Sensors', sub: '500+ edge devices', color: '#415A77' },
  { label: 'Vision AI Processing', sub: 'Vertex AI inference', color: '#3B82F6' },
  { label: 'Telemetry Engine', sub: 'Event aggregation', color: '#8B5CF6' },
  { label: 'Supabase Realtime', sub: 'PostgreSQL + WebSockets', color: '#00F5D4' },
  { label: 'Socket.io Gateway', sub: 'Pub/Sub broadcast', color: '#F59E0B' },
  { label: 'Command Center', sub: 'Operator dashboard', color: '#22C55E' },
];

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: string };
    const particles: Particle[] = [];
    const COLORS = ['#00F5D4', '#3B82F6', '#8B5CF6', '#F59E0B'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: 1 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    let frame: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 245, 212, ${0.05 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();
      });

      frame = requestAnimationFrame(render);
    };
    render();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />;
}

function ArchFlow() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % ARCH_NODES.length), 800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center gap-0 w-full max-w-xs mx-auto">
      {ARCH_NODES.map((node, i) => (
        <React.Fragment key={node.label}>
          <div
            className="w-full rounded-lg px-4 py-3 text-center transition-all duration-300"
            style={{
              background: i === active ? `${node.color}18` : 'rgba(15,31,53,0.8)',
              border: `1px solid ${i <= active ? node.color + '60' : 'rgba(65,90,119,0.3)'}`,
              boxShadow: i === active ? `0 0 20px ${node.color}25` : 'none',
            }}
          >
            <div className="font-mono text-[11px] font-bold text-white">{node.label}</div>
            <div className="font-mono text-[9px] mt-0.5" style={{ color: node.color + 'aa' }}>{node.sub}</div>
          </div>
          {i < ARCH_NODES.length - 1 && (
            <div className="flex flex-col items-center" style={{ height: 24 }}>
              <div
                className="w-px flex-1 transition-all duration-300"
                style={{ background: `linear-gradient(180deg, ${i < active ? ARCH_NODES[i].color : 'rgba(65,90,119,0.3)'} 0%, ${i + 1 <= active ? ARCH_NODES[i+1].color : 'rgba(65,90,119,0.3)'} 100%)` }}
              />
              <div
                className="w-0 h-0 transition-all duration-300"
                style={{
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: `5px solid ${i < active ? ARCH_NODES[i].color : 'rgba(65,90,119,0.3)'}`,
                }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const liveMetrics = [
    { label: 'OCCUPANCY', value: `${(72 + (tick % 5)).toFixed(1)}%` },
    { label: 'RISK INDEX', value: tick % 3 === 0 ? 'HIGH' : 'MODERATE' },
    { label: 'ACTIVE GATES', value: '4/4' },
    { label: 'AI LATENCY', value: `${1.2 + (tick % 3) * 0.3}s` },
  ];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans overflow-x-hidden">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-brand-border" style={{ background: 'rgba(6,13,24,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-teal text-brand-bg p-1.5 rounded font-mono font-bold text-sm flex items-center gap-1 glow-teal">
              <Shield className="w-4 h-4" /> CS
            </div>
            <div>
              <div className="font-display font-bold text-white tracking-wide text-lg leading-none">CROWDSHIELD</div>
              <div className="font-mono text-[9px] text-brand-teal tracking-widest opacity-80">AI STADIUM OS</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6 font-mono text-xs text-brand-text-dim">
            <a href="#features" className="hover:text-brand-teal transition-colors">Platform</a>
            <a href="#architecture" className="hover:text-brand-teal transition-colors">Architecture</a>
            <a href="#security" className="hover:text-brand-teal transition-colors">Security</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Github className="w-3.5 h-3.5" /> GitHub
            </a>
          </div>
          <button onClick={onEnter} className="btn-solid text-xs">
            Launch Command Center <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 hero-gradient overflow-hidden noise-overlay">
        <HeroCanvas />

        {/* Live ticker */}
        <div className="relative z-10 mb-8 flex flex-wrap gap-3 justify-center">
          {liveMetrics.map(m => (
            <div key={m.label} className="glass-card rounded px-3 py-1.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green pulse-glow" />
              <span className="font-mono text-[10px] text-brand-text-dim">{m.label}:</span>
              <span className="font-mono text-[10px] font-bold text-brand-teal">{m.value}</span>
            </div>
          ))}
        </div>

        {/* Headline */}
        <div className="relative z-10 text-center max-w-5xl mx-auto">
          <div className="section-label mb-4">Enterprise Stadium Intelligence Platform</div>
          <h1 className="hero-headline text-5xl md:text-7xl mb-6">
            AI-Powered Stadium
            <span className="block text-brand-teal text-glow-teal">Intelligence OS</span>
            <span className="block text-4xl md:text-5xl text-brand-text-dim font-normal">for 100,000+ Fans</span>
          </h1>
          <p className="text-brand-text-dim text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Predict congestion. Prevent incidents. Coordinate operations in real time.
            The same intelligence powering Formula 1 telemetry and smart city command centers — now for stadiums.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={onEnter} className="btn-solid text-sm py-3 px-8">
              <Zap className="w-4 h-4" /> Launch Command Center
            </button>
            <a href="#features" className="btn-primary text-sm py-3 px-8">
              <Eye className="w-4 h-4" /> Explore Platform
            </a>
          </div>
        </div>

        {/* Dashboard preview mockup */}
        <div className="relative z-10 mt-16 w-full max-w-5xl mx-auto">
          <div className="glass-card-elevated rounded-2xl p-1 shadow-2xl scan-overlay" style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 60px rgba(0,245,212,0.08)' }}>
            <div className="bg-brand-surface rounded-xl p-4 font-mono text-xs">
              <div className="flex items-center gap-2 mb-4 border-b border-brand-border pb-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-brand-text-dim text-[10px]">CROWDSHIELD OS — LIVE MATCH TELEMETRY — RCB vs CSK (IPL 2026)</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-brand-green pulse-glow" />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'ZONE A', val: '94%', status: 'critical' },
                  { label: 'ZONE B', val: '67%', status: 'warning' },
                  { label: 'ZONE C', val: '82%', status: 'warning' },
                  { label: 'ZONE D', val: '51%', status: 'normal' },
                ].map(z => (
                  <div key={z.label} className={`rounded p-3 ${z.status === 'critical' ? 'telemetry-card-critical' : z.status === 'warning' ? 'telemetry-card-warning' : 'telemetry-card'}`}>
                    <div className="text-[9px] text-brand-text-dim">{z.label}</div>
                    <div className={`text-2xl font-bold font-display mt-1 ${z.status === 'critical' ? 'text-brand-red' : z.status === 'warning' ? 'text-brand-amber' : 'text-brand-teal'}`}>{z.val}</div>
                    <div className={`text-[8px] mt-1 ${z.status === 'critical' ? 'text-brand-red' : z.status === 'warning' ? 'text-brand-amber' : 'text-brand-green'}`}>
                      {z.status === 'critical' ? '⚠ SURGE RISK' : z.status === 'warning' ? '⚡ ELEVATED' : '✓ NOMINAL'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 glass-card rounded-lg p-3 text-brand-text-dim text-[10px]">
                <span className="text-brand-teal font-bold">AI BRIEFING: </span>
                Zone A approaching critical density threshold. Gate 1 load-balancing recommended. Predicted 37% congestion reduction if Gate D is opened immediately.
                <span className="text-brand-teal animate-pulse ml-1">▋</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="py-20 px-6 border-y border-brand-border grid-pattern">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="stat-card text-center">
                <Icon className="w-5 h-5 text-brand-teal mx-auto mb-2" />
                <div className="stat-value text-center">{s.value}</div>
                <div className="stat-label text-center">{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mb-3">Platform Capabilities</div>
            <h2 className="hero-headline text-4xl md:text-5xl">Built for Operational Excellence</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="feature-card">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: f.color + '18', border: `1px solid ${f.color}30` }}>
                    <Icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-white text-xl mb-2">{f.title}</h3>
                    <p className="text-brand-text-dim text-sm leading-relaxed">{f.desc}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 font-mono text-[10px]" style={{ color: f.color }}>
                    View Details <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* AI EXPLAINABILITY */}
      <section className="py-24 px-6 bg-brand-surface/30">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="section-label mb-3">AI Explainability</div>
            <h2 className="hero-headline text-4xl mb-6">Every Decision. Explained.</h2>
            <p className="text-brand-text-dim leading-relaxed mb-8">
              Unlike black-box AI systems, CrowdShield surfaces the full reasoning chain behind every recommendation — giving operators confidence to act instantly.
            </p>
            <button onClick={onEnter} className="btn-primary">
              <Brain className="w-4 h-4" /> Explore AI Engine
            </button>
          </div>
          <div className="glass-card-elevated rounded-2xl p-6">
            <div className="font-mono text-[10px] text-brand-teal tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-teal ai-pulse" />
              AI DECISION LOG — GATE REBALANCING
            </div>
            {[
              { label: 'Zone A overload probability', value: 94, color: '#EF4444' },
              { label: 'Gate D available capacity', value: 61, color: '#00F5D4' },
              { label: 'Historical surge pattern match', value: 88, color: '#F59E0B' },
              { label: 'Estimated congestion reduction', value: 41, color: '#22C55E' },
            ].map(row => (
              <div key={row.label} className="explain-row">
                <div className="flex-1">
                  <div className="font-mono text-[10px] text-brand-text-dim mb-1.5">→ {row.label}</div>
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div className="explain-bar" style={{ width: `${row.value}%`, background: `linear-gradient(90deg, ${row.color}33, ${row.color})` }} />
                  </div>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: row.color }}>{row.value}%</span>
              </div>
            ))}
            <div className="mt-4 pt-4 border-t border-brand-border">
              <div className="font-mono text-[10px] text-brand-text-dim">RECOMMENDED ACTION</div>
              <div className="font-mono text-xs font-bold text-brand-teal mt-1">Open Gate D → Redirect Zone A flow →  Reduce surge risk</div>
            </div>
          </div>
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section id="architecture" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <div className="section-label mb-3">System Architecture</div>
            <h2 className="hero-headline text-4xl md:text-5xl">Real-Time Intelligence Stack</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <ArchFlow />
            <div className="flex flex-col gap-4">
              {[
                { icon: Radio, color: '#00F5D4', title: 'Edge-First Design', desc: 'IoT sensors transmit at 500ms intervals. Vision AI runs at the edge for sub-100ms object detection.' },
                { icon: Zap, color: '#3B82F6', title: 'Event-Driven Core', desc: 'All telemetry flows through an immutable event log, enabling full audit trails and historical replay.' },
                { icon: Lock, color: '#8B5CF6', title: 'Zero-Trust Security', desc: 'Row-Level Security on every Supabase table. RBAC enforced at API gateway. Encrypted telemetry in transit.' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="glass-card rounded-xl p-4 flex gap-4 items-start">
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: item.color + '18', border: `1px solid ${item.color}30` }}>
                      <Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <div className="font-display font-bold text-white mb-1">{item.title}</div>
                      <div className="text-brand-text-dim text-sm">{item.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY & PRIVACY */}
      <section id="security" className="py-24 px-6 bg-brand-surface/30 border-y border-brand-border">
        <div className="max-w-5xl mx-auto text-center">
          <div className="section-label mb-3">Privacy & Ethics</div>
          <h2 className="hero-headline text-4xl mb-4">Intelligence Without Surveillance</h2>
          <p className="text-brand-text-dim max-w-xl mx-auto mb-12">CrowdShield is built on privacy-first principles. All telemetry is anonymized at the edge. No biometrics. No facial recognition. GDPR-compliant by design.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Anonymized Telemetry', icon: '🔒' },
              { label: 'No Facial Recognition', icon: '🚫' },
              { label: 'GDPR Compliant', icon: '✅' },
              { label: 'Zero PII Storage', icon: '🛡️' },
            ].map(item => (
              <div key={item.label} className="glass-card rounded-xl p-4 flex flex-col gap-2 items-center">
                <span className="text-2xl">{item.icon}</span>
                <span className="font-mono text-[10px] text-brand-text-dim text-center">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 px-6 hero-gradient relative overflow-hidden noise-overlay">
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="section-label mb-4">Built for the Future</div>
          <h2 className="hero-headline text-5xl md:text-6xl mb-6">
            The Operating System for
            <span className="block text-brand-teal text-glow-teal">Intelligent Stadiums</span>
          </h2>
          <p className="text-brand-text-dim text-lg mb-10">From pre-match crowd buildup to post-match evacuation — CrowdShield AI coordinates every moment of the fan journey.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <button onClick={onEnter} className="btn-solid text-sm py-4 px-10">
              <Zap className="w-4 h-4" /> Launch Live Command Center
            </button>
            <button onClick={onEnter} className="btn-primary text-sm py-4 px-10">
              <Activity className="w-4 h-4" /> View Live Telemetry
            </button>
          </div>
          <div className="mt-8 font-mono text-[10px] text-brand-text-dim flex flex-wrap gap-4 justify-center">
            <span className="privacy-badge">🔒 ANONYMIZED TELEMETRY</span>
            <span className="privacy-badge">✅ GDPR COMPLIANT</span>
            <span className="privacy-badge">⚡ SUB-2s LATENCY</span>
            <span className="privacy-badge">🛡 ZERO-TRUST SECURITY</span>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-brand-border py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-teal text-brand-bg p-1 rounded font-mono font-bold text-xs flex items-center gap-1">
              <Shield className="w-3 h-3" /> CS
            </div>
            <span className="font-mono text-[10px] text-brand-text-dim">CROWDSHIELD AI © 2026 — STADIUM INTELLIGENCE PLATFORM</span>
          </div>
          <div className="flex gap-4 font-mono text-[10px] text-brand-text-dim">
            <span className="privacy-badge">Google Cloud Run</span>
            <span className="privacy-badge">Supabase</span>
            <span className="privacy-badge">Gemini AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
