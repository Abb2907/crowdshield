import React, { useEffect, useState, useRef } from 'react';
import { useStore } from './store';
import { 
  AlertTriangle, 
  Clock, 
  Activity, 
  Users, 
  Map as MapIcon, 
  Plus, 
  Send, 
  RefreshCw, 
  Shield, 
  Volume2, 
  Terminal,
  VolumeX,
  MapPin,
  CheckCircle,
  MessageSquare,
  Mic,
  QrCode,
  LineChart,
  Lock,
  Unlock,
  AlertOctagon,
  Rewind
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StadiumCanvas } from './StadiumCanvas';
import { AnalyticsPanel } from './AnalyticsPanel';
import LandingPage from './LandingPage';
import { AiExplainabilityPanel } from './AiExplainabilityPanel';
import { TelemetryReplay } from './TelemetryReplay';
import { audioEngine } from './audio';

type OperationalMode = 'live' | 'emergency' | 'simulation' | 'night';

const MODE_CONFIG: Record<OperationalMode, { label: string; badge: string; cssClass: string; accent: string }> = {
  live:       { label: 'LIVE MATCH',   badge: 'mode-live',      cssClass: '',              accent: '#22C55E' },
  emergency:  { label: 'EMERGENCY',    badge: 'mode-emergency', cssClass: 'data-mode-emergency', accent: '#EF4444' },
  simulation: { label: 'SIMULATION',   badge: 'mode-sim',       cssClass: '',              accent: '#F59E0B' },
  night:      { label: 'NIGHT OPS',    badge: 'mode-night',     cssClass: '',              accent: '#8B5CF6' },
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (
  typeof window !== 'undefined'
    ? (window.location.port === '5173' ? 'http://localhost:4000' : window.location.origin)
    : 'http://localhost:4000'
);

export default function App() {
  const {
    zones,
    gates,
    incidents,
    alerts,
    evacuation,
    aiBriefing,
    isAiLoading,
    socketConnected,
    initSocket,
    disconnectSocket,
    triggerEmergency,
    reportIncident,
    updateGateStatus,
    generateAiBriefing,
    
    // Extended states/actions
    sendChatMessage,
    sendVoiceCommand,
    ticketScan,
    isChatLoading,
    isVoiceLoading,

    // Auth states/actions
    user,
    token,
    login,
    logout
  } = useStore();

  const [showLanding, setShowLanding] = useState(true);
  const [operationalMode, setOperationalMode] = useState<OperationalMode>('live');
  const [showReplay, setShowReplay] = useState(false);
  const [activeTab, setActiveTab] = useState<'map' | 'gates' | 'analytics'>('map');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [showAuthDropdown, setShowAuthDropdown] = useState(false);
  const [audioMuted, setAudioMuted] = useState(() => audioEngine.getIsMuted());

  const toggleMute = () => {
    const nextMuted = !audioMuted;
    setAudioMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
    if (!nextMuted) {
      audioEngine.playChime();
    }
  };
  
  // Incident Form States
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [incidentZone, setIncidentZone] = useState('zone_c');
  const [incidentLocation, setIncidentLocation] = useState('');
  
  // Evacuation Hold-to-Trigger State
  const [isHoldingEvac, setIsHoldingEvac] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [evacTimer, setEvacTimer] = useState('15:00');

  // Voice Command States
  const [voiceCommandText, setVoiceCommandText] = useState('');
  const [voiceTerminalLogs, setVoiceTerminalLogs] = useState<string[]>(['Voice node active. Ready for instructions...']);

  // Spectator Chatbot States
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: 'Namaste! Welcome to Chinnaswamy Stadium Fan Assistant. How can I help you navigate the match today?' }
  ]);

  // Ticketing Simulator States
  const [scanGateId, setScanGateId] = useState('gate-1');
  const [scanIsFake, setScanIsFake] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Synchronize audio engine with evacuation state
  useEffect(() => {
    if (evacuation.is_active) {
      audioEngine.startEvacSiren();
      audioEngine.announceText("Attention! Evacuation sequence initiated. Please proceed to the nearest emergency exit calmly and follow the directional flow vectors on your screen.");
    } else {
      audioEngine.stopEvacSiren();
    }
  }, [evacuation.is_active]);

  // Synchronize audio engine with AI briefing updates
  const prevBriefingRef = useRef(aiBriefing);
  useEffect(() => {
    if (aiBriefing && aiBriefing !== prevBriefingRef.current && !evacuation.is_active) {
      const cleanBriefing = aiBriefing.replace(/[#*`_-]/g, '').trim();
      const firstSentence = cleanBriefing.split(/[.!?]+/)[0] || cleanBriefing;
      if (firstSentence.length > 5) {
        audioEngine.announceText("AI Operational Briefing: " + firstSentence);
      }
    }
    prevBriefingRef.current = aiBriefing;
  }, [aiBriefing, evacuation.is_active]);

  // Play alert sound when a new alert is received
  const prevAlertsLengthRef = useRef(alerts.length);
  useEffect(() => {
    if (alerts.length > prevAlertsLengthRef.current) {
      audioEngine.playAlert();
    }
    prevAlertsLengthRef.current = alerts.length;
  }, [alerts]);

  useEffect(() => {
    if (!token) {
      login(BACKEND_URL, { username: 'operator', password: 'operator123' });
    }
  }, [token, login]);

  useEffect(() => {
    initSocket(BACKEND_URL);
    generateAiBriefing(BACKEND_URL);
    return () => disconnectSocket();
  }, [initSocket, generateAiBriefing, disconnectSocket]);

  // Sync AI Briefing periodically (e.g. every 15s)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!evacuation.is_active) {
        generateAiBriefing(BACKEND_URL);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [evacuation.is_active, generateAiBriefing]);

  // Evacuation countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (evacuation.is_active && evacuation.triggered_at) {
      const durationSeconds = evacuation.estimated_duration;
      const startTime = new Date(evacuation.triggered_at).getTime();

      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, durationSeconds - elapsed);
        
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        
        setEvacTimer(
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );

        if (remaining <= 0) {
          clearInterval(timer);
        }
      };

      updateTimer();
      timer = setInterval(updateTimer, 1000);
    } else {
      const timeoutId = setTimeout(() => {
        setEvacTimer('00:00');
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return () => clearInterval(timer);
  }, [evacuation.is_active, evacuation.triggered_at, evacuation.estimated_duration]);

  // Handle Evacuation Trigger Hold
  const startEvacHold = () => {
    if (evacuation.is_active) {
      triggerEmergency(BACKEND_URL, false);
      return;
    }
    setIsHoldingEvac(true);
    setHoldProgress(0);
    const startTime = Date.now();
    holdIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / 2000) * 100);
      setHoldProgress(pct);
      
      if (elapsed >= 2000) {
        clearInterval(holdIntervalRef.current);
        setIsHoldingEvac(false);
        triggerEmergency(BACKEND_URL, true);
      }
    }, 50);
  };

  const cancelEvacHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    setIsHoldingEvac(false);
    setHoldProgress(0);
  };

  // Calculate stats
  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0);
  const totalOccupancy = zones.reduce((acc, z) => acc + z.current_occupancy, 0);
  const overallDensity = totalCapacity > 0 ? (totalOccupancy / totalCapacity) * 100 : 0;
  
  const avgWaitTime = gates.length > 0 
    ? Math.round(gates.reduce((acc, g) => acc + g.wait_time, 0) / gates.length)
    : 0;

  const currentRisk = overallDensity > 85 ? 'CRITICAL' : overallDensity > 60 ? 'HIGH' : 'LOW';

  const handleIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle) return;
    
    reportIncident(BACKEND_URL, {
      title: incidentTitle,
      description: incidentDesc,
      severity: incidentSeverity,
      zone_id: incidentZone,
      location_details: incidentLocation,
    });

    setIncidentTitle('');
    setIncidentDesc('');
    setIncidentLocation('');
    setShowIncidentForm(false);
  };

  // Voice command execution
  const handleVoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceCommandText.trim()) return;

    const cmd = voiceCommandText.trim();
    setVoiceTerminalLogs(prev => [...prev, `> Interpreting: "${cmd}"`]);
    setVoiceCommandText('');

    const res = await sendVoiceCommand(BACKEND_URL, cmd);
    if (res) {
      setVoiceTerminalLogs(prev => [
        ...prev, 
        `[System] ${res.actionTaken || 'No action identified.'}`,
        `[AI Node] ${res.reply}`
      ]);
    } else {
      setVoiceTerminalLogs(prev => [...prev, `[System] Error communicating with interpretation server.`]);
    }
  };

  // Spectator Chatbot message submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const msg = chatInput.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: msg }]);
    setChatInput('');

    const reply = await sendChatMessage(BACKEND_URL, msg);
    setChatMessages(prev => [...prev, { sender: 'ai', text: reply }]);
  };

  // Ticket scanner execution
  const handleTicketScanSubmit = async () => {
    setIsScanning(true);
    setScanResult(null);
    
    // artificial delay for scan visual feedback
    setTimeout(async () => {
      const res = await ticketScan(BACKEND_URL, scanGateId, scanIsFake);
      setScanResult(res);
      setIsScanning(false);
    }, 800);
  };

  if (showLanding) {
    return <LandingPage onEnter={() => setShowLanding(false)} />;
  }

  const modeConf = MODE_CONFIG[operationalMode];

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col antialiased" data-mode={operationalMode}>
      {/* HEADER SECTION */}
      <header className="border-b border-brand-border bg-brand-surface/30 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="bg-brand-teal text-brand-bg p-2 rounded-md font-mono font-bold tracking-tighter text-lg flex items-center gap-1 glow-teal">
              <Shield className="w-5 h-5" />
              CS
            </div>
            {socketConnected ? (
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-brand-green border border-brand-bg rounded-full pulse-glow" title="Live Connection Active" />
            ) : (
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-brand-red border border-brand-bg rounded-full" title="Connecting..." />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono tracking-wider m-0 p-0 text-white flex items-center gap-2">
              CROWDSHIELD <span className="text-brand-teal text-xs border border-brand-teal px-1 rounded">OS</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              STADIUM OPERATING SYSTEM • LIVE TELEMETRY
            </p>
          </div>
        </div>

        {/* Live Match Info */}
        <div className="bg-slate-900/60 border border-brand-border px-4 py-2 rounded flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
            <span className="text-slate-200 font-bold">LIVE: RCB vs CSK (IPL 2026)</span>
          </div>
          <div className="text-slate-400">OVERS: 18.4</div>
          <div className="text-slate-400">SCORE: 198/5</div>
        </div>

        {/* Operational Mode Switcher */}
        <div className="hidden lg:flex items-center gap-1 bg-brand-surface/60 border border-brand-border rounded-lg p-1">
          {(Object.entries(MODE_CONFIG) as [OperationalMode, typeof MODE_CONFIG[OperationalMode]][]).map(([mode, conf]) => (
            <button
              key={mode}
              onClick={() => setOperationalMode(mode)}
              className={`font-mono text-[9px] font-bold px-2.5 py-1.5 rounded transition-all ${
                operationalMode === mode
                  ? 'text-brand-bg'
                  : 'text-brand-text-dim hover:text-white'
              }`}
              style={operationalMode === mode ? { background: conf.accent } : {}}
            >
              {conf.label}
            </button>
          ))}
        </div>

        {/* SECURITY & RBAC CONTEXT SWITCHER */}
        <div className="relative">
          <button
            onClick={() => setShowAuthDropdown(!showAuthDropdown)}
            className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-900 border border-brand-border px-3 py-2 rounded-lg text-xs font-mono transition-all text-white cursor-pointer"
          >
            <Shield className={`w-4 h-4 ${user?.role === 'admin' ? 'text-brand-red animate-pulse' : user?.role === 'operator' ? 'text-brand-teal' : 'text-slate-400'}`} />
            <span>ROLE: <strong className="text-brand-teal">{user?.role?.toUpperCase() || 'CONNECTING...'}</strong></span>
            <span className="text-[10px] text-slate-500">▼</span>
          </button>
          
          {showAuthDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-950 border border-brand-border rounded-xl shadow-2xl p-4 z-[100] font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-brand-border mb-3">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Security Context</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-brand-teal/20 text-brand-teal font-bold">{user?.username || 'anonymous'}</span>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    await login(BACKEND_URL, { username: 'admin', password: 'admin123' });
                    setShowAuthDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded flex items-center justify-between transition-all cursor-pointer ${user?.role === 'admin' ? 'bg-brand-red/20 border border-brand-red/40 text-white font-bold' : 'hover:bg-slate-900 text-slate-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-brand-red" />
                    <span>Administrator</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Full Access</span>
                </button>

                <button
                  onClick={async () => {
                    await login(BACKEND_URL, { username: 'operator', password: 'operator123' });
                    setShowAuthDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded flex items-center justify-between transition-all cursor-pointer ${user?.role === 'operator' ? 'bg-brand-teal/20 border border-brand-teal/40 text-white font-bold' : 'hover:bg-slate-900 text-slate-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Operator</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Standard Control</span>
                </button>

                <button
                  onClick={async () => {
                    await login(BACKEND_URL, { username: 'viewer', password: 'viewer123' });
                    setShowAuthDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded flex items-center justify-between transition-all cursor-pointer ${user?.role === 'viewer' ? 'bg-slate-800/40 border border-slate-700 text-white font-bold' : 'hover:bg-slate-900 text-slate-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Viewer</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Read-Only</span>
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-brand-border flex items-center justify-between">
                <button
                  onClick={() => {
                    logout();
                    setShowAuthDropdown(false);
                  }}
                  className="text-[10px] text-brand-red hover:underline cursor-pointer"
                >
                  Clear Session
                </button>
                <span className="text-[9px] text-slate-600">RBAC (JWT)</span>
              </div>
            </div>
          )}
        </div>

        {/* Current Info & Controls */}
        <div className="flex items-center gap-3">
          {/* Audio Mute/Unmute Toggle */}
          <button
            onClick={toggleMute}
            className={`flex items-center justify-center p-2 rounded-lg border transition-all cursor-pointer ${
              audioMuted 
                ? 'bg-brand-red/10 border-brand-red/30 text-brand-red hover:bg-brand-red/20' 
                : 'bg-slate-900/80 border-brand-border text-brand-teal hover:text-white hover:bg-slate-900'
            }`}
            title={audioMuted ? "Unmute Sound Engine" : "Mute Sound Engine"}
          >
            {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="text-right hidden md:block">
            <div className="text-sm font-mono font-bold text-white">
              {new Date().toLocaleTimeString()}

            </div>
            <div className="text-xs text-slate-400 font-mono">UTC+05:30 • SECURE</div>
          </div>

          {/* EMERGENCY TRIGGER BUTTON */}
          <button
            onMouseDown={startEvacHold}
            onMouseUp={cancelEvacHold}
            onMouseLeave={cancelEvacHold}
            onTouchStart={startEvacHold}
            onTouchEnd={cancelEvacHold}
            className={`relative overflow-hidden font-mono text-xs font-bold px-4 py-3 rounded transition-all duration-300 ${
              evacuation.is_active 
                ? 'bg-brand-teal hover:bg-brand-teal/90 text-brand-bg glow-teal' 
                : 'bg-brand-red hover:bg-brand-red/90 text-white glow-red'
            }`}
          >
            {evacuation.is_active ? (
              <span className="flex items-center gap-2">
                <VolumeX className="w-4 h-4" /> DISARM EVACUATION
              </span>
            ) : (
              <span className="flex items-center gap-2 relative z-10 select-none">
                <Volume2 className="w-4 h-4 animate-bounce" /> HOLD TO TRIGGER EVAC
              </span>
            )}

            {/* Hold progress overlay */}
            {isHoldingEvac && (
              <div 
                className="absolute left-0 top-0 bottom-0 bg-white/20 transition-all duration-75"
                style={{ width: `${holdProgress}%` }}
              />
            )}
          </button>
        </div>
      </header>

      {/* EMERGENCY ACTIVATED WARNING BAR */}
      <AnimatePresence>
        {evacuation.is_active && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-brand-red text-white py-3 px-6 flex justify-between items-center font-mono text-sm border-b border-red-500 glow-red overflow-hidden z-40"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <span className="font-bold tracking-wide">EMERGENCY EVACUATION ORDER ACTIVATED</span>
            </div>
            <div className="flex items-center gap-4">
              <span>ELAPSED COUNTDOWN:</span>
              <span className="text-xl font-bold bg-black/40 px-3 py-1 rounded border border-red-400">
                {evacTimer}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* PANEL 1: TELEMETRY WIDGETS (Left Column - 3 Columns) */}
        <section className="xl:col-span-3 flex flex-col gap-6">
          <div className="border border-brand-border bg-brand-surface/40 backdrop-blur px-4 py-3 rounded flex items-center justify-between">
            <span className="text-xs font-mono tracking-wider font-bold text-slate-400">SYSTEM TELEMETRY</span>
            <span className="text-[10px] bg-brand-teal/10 text-brand-teal px-2 py-0.5 rounded font-mono border border-brand-teal/20">LIVE STREAMING</span>
          </div>

          {/* Density Widget */}
          <div className={`border rounded p-4 bg-brand-surface/20 transition-all ${
            overallDensity > 85 ? 'border-brand-red glow-red' : overallDensity > 60 ? 'border-brand-amber glow-amber' : 'border-brand-border'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-slate-400">OVERALL DENSITY</span>
              <span className={`w-2.5 h-2.5 rounded-full ${
                overallDensity > 85 ? 'bg-brand-red' : overallDensity > 60 ? 'bg-brand-amber' : 'bg-brand-green'
              } pulse-glow`} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-mono font-bold text-white tracking-tight">
                {overallDensity.toFixed(1)}%
              </span>
              <span className={`text-xs font-mono font-bold ${
                overallDensity > 85 ? 'text-brand-red' : overallDensity > 60 ? 'text-brand-amber' : 'text-brand-green'
              }`}>
                {overallDensity > 85 ? 'SURGE RISK' : overallDensity > 60 ? 'WARNING' : 'NOMINAL'}
              </span>
            </div>
            {/* Sparkline simulation */}
            <div className="mt-4 h-8 flex items-end gap-1 overflow-hidden opacity-80">
              {Array.from({ length: 24 }).map((_, idx) => {
                const height = 15 + Math.sin(idx * 0.4) * 10 + (overallDensity > 80 ? 10 : 0);
                return (
                  <div 
                    key={idx} 
                    className={`w-full rounded-t-sm transition-all duration-300 ${
                      overallDensity > 85 ? 'bg-brand-red/50' : overallDensity > 60 ? 'bg-brand-amber/50' : 'bg-brand-green/50'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Wait Time Widget */}
          <div className="border border-brand-border rounded p-4 bg-brand-surface/20">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-slate-400">AVG WAITING TIME</span>
              <Clock className="w-4 h-4 text-brand-teal" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-mono font-bold text-white tracking-tight">
                {avgWaitTime} <span className="text-lg">MIN</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-mono">Based on active turnstile flows</p>
          </div>

          {/* Incident Risk Score */}
          <div className="border border-brand-border rounded p-4 bg-brand-surface/20">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-slate-400">RISK INDEX</span>
              <Activity className="w-4 h-4 text-brand-amber" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-mono font-bold tracking-tight ${
                currentRisk === 'CRITICAL' ? 'text-brand-red text-glow-red' : currentRisk === 'HIGH' ? 'text-brand-amber text-glow-amber' : 'text-brand-green'
              }`}>
                {currentRisk}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-mono">AI-calculated threat vector</p>
          </div>

          {/* Selected Zone Analysis (If selected) */}
          {selectedZoneId ? (
            <div className="border border-brand-teal/80 bg-brand-surface/40 p-4 rounded relative animate-pulse">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-mono text-brand-teal font-bold">ZONE METRIC FOCUS</span>
                <button onClick={() => setSelectedZoneId(null)} className="text-slate-400 hover:text-white text-xs">✕</button>
              </div>
              {(() => {
                const z = zones.find(zone => zone.id === selectedZoneId);
                if (!z) return null;
                return (
                  <div className="font-mono text-xs text-slate-300 flex flex-col gap-1.5">
                    <div className="text-white font-bold">{z.name.toUpperCase()}</div>
                    <div>Occupancy: <span className="text-white font-bold">{z.current_occupancy} / {z.capacity}</span></div>
                    <div>Density: <span className="text-white font-bold">{((z.current_occupancy / z.capacity) * 100).toFixed(1)}%</span></div>
                    <div>Risk Level: <span className={`font-bold ${z.risk_level === 'critical' ? 'text-brand-red' : z.risk_level === 'warning' ? 'text-brand-amber' : 'text-brand-green'}`}>{z.risk_level.toUpperCase()}</span></div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="border border-dashed border-slate-700/60 p-4 rounded text-center text-xs font-mono text-slate-500">
              Click a Zone on the Digital Twin to view localized metrics
            </div>
          )}

          {/* Operational Resources */}
          <div className="border border-brand-border rounded p-4 bg-brand-surface/20">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-slate-400">STADIUM SECURITY FORCE</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-mono font-bold text-white">124</span>
              <span className="text-xs text-brand-green font-mono">ACTIVE DEPLOYED</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="bg-brand-surface/40 p-2 rounded border border-brand-border">
                <span className="text-slate-400 block">SECURITY</span>
                <span className="text-white font-bold">48 Units</span>
              </div>
              <div className="bg-brand-surface/40 p-2 rounded border border-brand-border">
                <span className="text-slate-400 block">VOLUNTEERS</span>
                <span className="text-white font-bold">76 Units</span>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL 2: STADIUM DIGITAL TWIN (Center Column - 6 Columns) */}
        <section className="xl:col-span-6 flex flex-col gap-6">
          {/* View Toggle */}
          <div className="flex border-b border-brand-border bg-slate-950/20 rounded-t p-1">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold border-b-2 transition-all ${
                activeTab === 'map' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-4 h-4" /> DIGITAL TWIN
            </button>
            <button
              onClick={() => setActiveTab('gates')}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold border-b-2 transition-all ${
                activeTab === 'gates' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-4 h-4" /> GATE METRICS & SCANNER
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold border-b-2 transition-all ${
                activeTab === 'analytics' ? 'border-brand-teal text-brand-teal' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <LineChart className="w-4 h-4" /> POST-MATCH ANALYTICS
            </button>
          </div>

          {/* Content Views */}
          <div className="flex-1 flex flex-col justify-center">
            {activeTab === 'map' && (
              <StadiumCanvas
                zones={zones}
                gates={gates}
                evacuationActive={evacuation.is_active}
                onSelectZone={setSelectedZoneId}
                selectedZoneId={selectedZoneId}
              />
            )}

            {activeTab === 'gates' && (
              <div className="flex flex-col gap-6">
                {/* Ticketing Scan Simulator Station */}
                <div className="border border-brand-teal/40 bg-slate-900/60 p-4 rounded-lg flex flex-col gap-3">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold text-white">
                    <QrCode className="w-4 h-4 text-brand-teal" />
                    TICKET VERIFICATION SIMULATION DOCK
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Inject a simulated ticket scan at any stadium gate. Toggle "Simulate Counterfeit Ticket" to trigger fraud alerts.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-950/80 p-3 rounded border border-brand-border">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 mb-1">SELECT TURNSTILE GATE</label>
                      <select 
                        value={scanGateId}
                        onChange={(e) => setScanGateId(e.target.value)}
                        className="w-full bg-slate-900 border border-brand-border rounded p-1 text-xs text-white font-mono"
                      >
                        {gates.map(g => (
                          <option key={g.id} value={g.id}>{g.name.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 py-2">
                      <input 
                        type="checkbox"
                        id="fake-ticket"
                        checked={scanIsFake}
                        onChange={(e) => setScanIsFake(e.target.checked)}
                        className="w-4 h-4 bg-slate-900 border-brand-border text-brand-teal rounded focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="fake-ticket" className="text-xs font-mono text-slate-300 select-none cursor-pointer flex items-center gap-1">
                        Simulate Counterfeit Ticket
                      </label>
                    </div>

                    <button
                      onClick={handleTicketScanSubmit}
                      disabled={isScanning}
                      className={`w-full py-1.5 px-3 rounded font-mono text-xs font-bold transition-all ${
                        isScanning 
                          ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                          : scanIsFake 
                            ? 'bg-brand-red text-white hover:bg-brand-red/80 glow-red'
                            : 'bg-brand-teal text-brand-bg hover:bg-brand-teal/80 glow-teal'
                      }`}
                    >
                      {isScanning ? 'SCANNING TICKET...' : 'EXECUTE SCAN'}
                    </button>
                  </div>

                  {/* Scan Result Feedback Banner */}
                  {scanResult && (
                    <div className={`p-3 rounded border font-mono text-xs flex items-center justify-between transition-all ${
                      scanResult.success 
                        ? 'bg-brand-green/10 border-brand-green/40 text-green-300' 
                        : 'bg-brand-red/15 border-brand-red/40 text-red-200 animate-bounce'
                    }`}>
                      <div className="flex items-center gap-2">
                        {scanResult.success ? (
                          <CheckCircle className="w-4 h-4 text-brand-green" />
                        ) : (
                          <AlertOctagon className="w-4 h-4 text-brand-red" />
                        )}
                        <span>{scanResult.message}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">
                        {scanResult.success ? 'TURNSTILE UNLOCKED' : 'ACCESS DENIED'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Gate Flow Control Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {gates.map((gate) => (
                    <div key={gate.id} className="border border-brand-border bg-brand-surface/20 p-4 rounded flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-mono font-bold text-white uppercase">{gate.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            gate.status === 'open' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' :
                            gate.status === 'restricted' ? 'bg-brand-amber/20 text-brand-amber border border-brand-amber/30' :
                            'bg-brand-red/20 text-brand-red border border-brand-red/30'
                          }`}>
                            {gate.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4 font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 block">WAIT TIME</span>
                            <span className={`text-xl font-bold ${
                              gate.wait_time > 20 ? 'text-brand-red' : gate.wait_time > 10 ? 'text-brand-amber' : 'text-white'
                            }`}>{gate.wait_time} MIN</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">FLOW RATE</span>
                            <span className="text-xl font-bold text-white">{gate.flow_rate} P/M</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2 pt-2 border-t border-brand-border/40">
                        <button
                          onClick={() => updateGateStatus(BACKEND_URL, gate.id, 'open')}
                          className={`flex-1 text-[10px] font-mono font-bold py-1 px-2 rounded border flex items-center justify-center gap-1 ${
                            gate.status === 'open' ? 'bg-brand-green/20 border-brand-green text-brand-green' : 'border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <Unlock className="w-3 h-3" /> OPEN
                        </button>
                        <button
                          onClick={() => updateGateStatus(BACKEND_URL, gate.id, 'restricted')}
                          className={`flex-1 text-[10px] font-mono font-bold py-1 px-2 rounded border flex items-center justify-center gap-1 ${
                            gate.status === 'restricted' ? 'bg-brand-amber/20 border-brand-amber text-brand-amber' : 'border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          RESTRICT
                        </button>
                        <button
                          onClick={() => updateGateStatus(BACKEND_URL, gate.id, 'closed')}
                          className={`flex-1 text-[10px] font-mono font-bold py-1 px-2 rounded border flex items-center justify-center gap-1 ${
                            gate.status === 'closed' ? 'bg-brand-red/20 border-brand-red text-brand-red' : 'border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <Lock className="w-3 h-3" /> CLOSE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel backendUrl={BACKEND_URL} />
            )}
          </div>

          {/* Voice Command Console Drawer */}
          <div className="border border-brand-border bg-slate-950/80 rounded-lg p-4 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-brand-teal animate-pulse" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">AI Operations Voice Command Station</span>
            </div>
            
            {/* Terminal output */}
            <div className="bg-black/60 border border-brand-border/40 p-3 rounded font-mono text-[10px] text-slate-300 h-28 overflow-y-auto mb-3 flex flex-col gap-1.5 scrollbar-thin">
              {voiceTerminalLogs.map((log, idx) => (
                <div key={idx} className={log.startsWith('>') ? 'text-brand-teal' : log.includes('[System]') ? 'text-slate-400' : 'text-slate-100'}>
                  {log}
                </div>
              ))}
            </div>

            <form onSubmit={handleVoiceSubmit} className="flex gap-2">
              <input
                type="text"
                value={voiceCommandText}
                onChange={(e) => setVoiceCommandText(e.target.value)}
                placeholder="Type command (e.g. 'open gate-1', 'close all gates', 'critical crowd in zone_c')"
                className="flex-1 bg-slate-900 border border-brand-border rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-brand-teal"
              />
              <button
                type="submit"
                disabled={isVoiceLoading}
                className="bg-brand-teal text-brand-bg px-4 py-1.5 rounded font-mono text-xs font-bold hover:bg-brand-teal/80 transition-all flex items-center gap-1.5 glow-teal disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" /> SEND
              </button>
            </form>

            {/* Quick Command Templates */}
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="text-[9px] font-mono text-slate-500 self-center">Presets:</span>
              <button 
                type="button" 
                onClick={() => setVoiceCommandText('open gate-1')} 
                className="bg-slate-900 hover:bg-slate-800 border border-brand-border text-[9px] font-mono px-2 py-0.5 rounded text-slate-300"
              >
                "open gate-1"
              </button>
              <button 
                type="button" 
                onClick={() => setVoiceCommandText('close all gates')} 
                className="bg-slate-900 hover:bg-slate-800 border border-brand-border text-[9px] font-mono px-2 py-0.5 rounded text-slate-300"
              >
                "close all gates"
              </button>
              <button 
                type="button" 
                onClick={() => setVoiceCommandText('critical crowd surge in zone_c')} 
                className="bg-slate-900 hover:bg-slate-800 border border-brand-border text-[9px] font-mono px-2 py-0.5 rounded text-slate-300"
              >
                "crowd surge in zone_c"
              </button>
            </div>
          </div>
        </section>

        {/* PANEL 3: OPERATIONS & ALERTS (Right Column - 3 Columns) */}
        <section className="xl:col-span-3 flex flex-col gap-6">

          {/* AI Decision Explainability */}
          <AiExplainabilityPanel zones={zones} gates={gates} />

          {/* AI Operational Briefing */}
          <div className="glass-card rounded-lg p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-brand-teal" />
                AI COGNITIVE BRIEFING
              </span>
              <div className="flex items-center gap-2">
                <span className={`mode-badge ${modeConf.badge}`}>{modeConf.label}</span>
                <button
                  onClick={() => generateAiBriefing(BACKEND_URL)}
                  disabled={isAiLoading}
                  className="text-slate-400 hover:text-white transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="cmd-terminal p-3 min-h-[120px] text-[10px] leading-relaxed text-slate-300">
              {isAiLoading ? (
                <div className="flex items-center justify-center h-24 font-mono text-slate-400 gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-brand-teal" />
                  ANALYZING TELEMETRY...
                </div>
              ) : (
                <div className="whitespace-pre-wrap cmd-line-ai">
                  {aiBriefing || 'No briefing generated. Check connection.'}
                  <span className="text-brand-teal animate-pulse">▋</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-brand-border">
              <div className="font-mono text-[9px] text-brand-text-dim">Generated by Gemini 1.5 • Real-time</div>
              <button
                onClick={() => setShowReplay(r => !r)}
                className={`flex items-center gap-1 font-mono text-[9px] px-2 py-1 rounded border transition-all ${
                  showReplay ? 'bg-brand-teal/15 border-brand-teal/40 text-brand-teal' : 'border-brand-border text-brand-text-dim hover:border-brand-teal/30'
                }`}
              >
                <Rewind className="w-3 h-3" /> REPLAY
              </button>
            </div>
          </div>

          {/* Telemetry Replay Panel (collapsible) */}
          <AnimatePresence>
            {showReplay && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <TelemetryReplay />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ACTIVE ALERTS FEED */}
          <div className="border border-brand-border rounded-lg bg-brand-surface/20 p-4 flex-1 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-brand-amber" />
                REAL-TIME ALERTS ({alerts.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[220px] flex flex-col gap-2 pr-1">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-xs font-mono text-slate-500">
                  NO ACTIVE ALERTS
                </div>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded border text-xs font-mono ${
                      alert.severity === 'critical' ? 'bg-brand-red/10 border-brand-red text-red-300' :
                      alert.severity === 'warning' ? 'bg-brand-amber/10 border-brand-amber text-amber-200' :
                      'bg-slate-800/40 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1 font-bold">
                      <span className="uppercase text-[10px]">{alert.type}</span>
                      <span>{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="font-sans leading-normal text-slate-200">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* INCIDENT REPORT & LIST */}
          <div className="border border-brand-border rounded-lg bg-brand-surface/20 p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-brand-border/40 pb-2">
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400" />
                INCIDENTS ({incidents.length})
              </span>
              <button
                onClick={() => setShowIncidentForm(!showIncidentForm)}
                className="text-xs font-mono font-bold text-brand-teal hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> REPORT
              </button>
            </div>

            {/* Incident reporter form */}
            {showIncidentForm ? (
              <form onSubmit={handleIncidentSubmit} className="bg-slate-900/80 p-3 rounded border border-brand-border flex flex-col gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">INCIDENT TITLE</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Crowd Surge, Medical Assistance"
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-brand-border rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">SEVERITY</label>
                  <select
                    value={incidentSeverity}
                    onChange={(e) => setIncidentSeverity(e.target.value as 'low' | 'medium' | 'high' | 'critical')}
                    className="w-full bg-slate-950 border border-brand-border rounded p-1.5 text-white font-mono"
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="critical">CRITICAL</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-mono mb-1">ZONE</label>
                    <select
                      value={incidentZone}
                      onChange={(e) => setIncidentZone(e.target.value)}
                      className="w-full bg-slate-950 border border-brand-border rounded p-1.5 text-white font-mono"
                    >
                      <option value="zone_a">ZONE A</option>
                      <option value="zone_b">ZONE B</option>
                      <option value="zone_c">ZONE C</option>
                      <option value="zone_d">ZONE D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-mono mb-1">LOCATION DETAIL</label>
                    <input
                      type="text"
                      placeholder="e.g. Row 12, Gate Entry"
                      value={incidentLocation}
                      onChange={(e) => setIncidentLocation(e.target.value)}
                      className="w-full bg-slate-950 border border-brand-border rounded p-1.5 text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">DESCRIPTION</label>
                  <textarea
                    placeholder="Brief description of the issue"
                    value={incidentDesc}
                    onChange={(e) => setIncidentDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-brand-border rounded p-1.5 text-white font-sans h-12"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-brand-teal text-brand-bg font-mono font-bold p-1.5 rounded flex items-center justify-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" /> SUBMIT
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIncidentForm(false)}
                    className="bg-slate-800 text-slate-400 font-mono p-1.5 rounded"
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            ) : (
              <div className="overflow-y-auto max-h-[220px] flex flex-col gap-2">
                {incidents.length === 0 ? (
                  <div className="text-center py-8 text-xs font-mono text-slate-500">
                    NO REPORTED INCIDENTS
                  </div>
                ) : (
                  incidents.map((inc) => (
                    <div 
                      key={inc.id} 
                      className="p-3 bg-slate-900/60 border border-brand-border/40 rounded text-xs flex flex-col gap-1"
                    >
                      <div className="flex justify-between items-start font-mono">
                        <span className={`font-bold uppercase ${
                          inc.severity === 'critical' ? 'text-brand-red' :
                          inc.severity === 'high' ? 'text-brand-amber' :
                          'text-white'
                        }`}>{inc.title}</span>
                        <span className="text-[10px] text-slate-400">{inc.zone_id.toUpperCase().replace('_', ' ')}</span>
                      </div>
                      {inc.description && <p className="text-slate-300 font-sans">{inc.description}</p>}
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-brand-border/10">
                        <span>LOC: {inc.location_details || 'N/A'}</span>
                        <span className="bg-slate-800 text-slate-400 px-1 rounded uppercase">{inc.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>

      </main>

      {/* FLOATABLE SPECTATOR CHATBOT MODAL/DRAWER */}
      <div className="fixed bottom-6 right-6 z-50">
        {!chatOpen ? (
          <button
            onClick={() => setChatOpen(true)}
            className="bg-brand-teal text-brand-bg p-4 rounded-full shadow-lg hover:scale-105 transition-all glow-teal flex items-center justify-center cursor-pointer"
          >
            <MessageSquare className="w-6 h-6 animate-bounce" />
          </button>
        ) : (
          <div className="w-80 h-96 border border-brand-border bg-slate-950/95 backdrop-blur-md rounded-lg shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Chat header */}
            <div className="bg-brand-surface border-b border-brand-border px-4 py-3 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
                <span className="text-xs font-mono font-bold text-white uppercase">Spectator Chat Help</span>
              </div>
              <button 
                onClick={() => setChatOpen(false)} 
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-2 scrollbar-thin text-xs font-sans">
              {chatMessages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`max-w-[85%] p-2.5 rounded-lg ${
                    msg.sender === 'user' 
                      ? 'bg-brand-teal/15 border border-brand-teal/30 text-brand-text self-end' 
                      : 'bg-slate-800 border border-slate-700 text-slate-200 self-start'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              {isChatLoading && (
                <div className="bg-slate-800 border border-slate-700 text-slate-400 p-2.5 rounded-lg self-start flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-brand-teal rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-brand-teal rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-brand-teal rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
            </div>

            {/* Chat input */}
            <form onSubmit={handleChatSubmit} className="p-3 border-t border-brand-border bg-slate-900/60 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask spectator help..."
                className="flex-1 bg-slate-950 border border-brand-border rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-brand-teal"
              />
              <button
                type="submit"
                className="bg-brand-teal text-brand-bg p-1.5 rounded hover:bg-brand-teal/80 transition-all flex items-center justify-center glow-teal"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Preset Help Questions */}
            <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto text-[8px] font-mono whitespace-nowrap scrollbar-none">
              <button 
                type="button" 
                onClick={() => setChatInput('where is the washroom near zone_b')} 
                className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 hover:text-white"
              >
                Closest Washroom?
              </button>
              <button 
                type="button" 
                onClick={() => setChatInput('how do I exit zone_c')} 
                className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 hover:text-white"
              >
                Exit Zone C?
              </button>
              <button 
                type="button" 
                onClick={() => setChatInput('which gate has the lowest waiting time')} 
                className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 hover:text-white"
              >
                Best gate?
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
