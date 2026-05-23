import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export interface StadiumZone {
  id: string;
  name: string;
  capacity: number;
  current_occupancy: number;
  risk_level: 'safe' | 'warning' | 'critical';
}

export interface Gate {
  id: string;
  name: string;
  status: 'open' | 'closed' | 'restricted';
  wait_time: number;
  flow_rate: number;
  capacity: number;
  current_throughput: number;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'dispatched' | 'resolved';
  zone_id: string;
  location_details: string;
  created_at: string;
  resolved_at?: string | null;
}

export interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_active: boolean;
  created_at: string;
}

export interface EvacuationState {
  is_active: boolean;
  triggered_at: string | null;
  triggered_by: string | null;
  estimated_duration: number;
}

export interface AnalyticsKPIs {
  totalTicketsValidated: number;
  totalFraudDetections: number;
  peakOccupancyPercent: number;
  avgEvacTimeSeconds: number;
}

export interface OccupancyHistoryItem {
  hour: string;
  occupancy: number;
  evacThroughput: number;
}

export interface GateMetric {
  totalScans: number;
  avgWaitTime: number;
  maxWaitTime: number;
}

export interface GateMetrics {
  [gateId: string]: GateMetric;
}

export interface IncidentBreakdown {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface AnalyticsData {
  kpis: AnalyticsKPIs;
  occupancyHistory: OccupancyHistoryItem[];
  gateMetrics: GateMetrics;
  incidentBreakdown: IncidentBreakdown;
}

export interface VoiceCommandResponse {
  reply: string;
  actionTaken: string;
}

export interface TicketScanResponse {
  success: boolean;
  message: string;
  fraudDetected?: boolean;
  gate?: Gate;
  error?: string;
}

export interface InitialStateData {
  zones: StadiumZone[];
  gates: Gate[];
  incidents: Incident[];
  alerts: Alert[];
  evacuationState: EvacuationState;
}

export interface TelemetryUpdateData {
  zones: StadiumZone[];
  gates: Gate[];
  evacuationState: EvacuationState;
}

interface CrowdShieldStore {
  zones: StadiumZone[];
  gates: Gate[];
  incidents: Incident[];
  alerts: Alert[];
  evacuation: EvacuationState;
  aiBriefing: string;
  isAiLoading: boolean;
  socketConnected: boolean;
  socket: Socket | null;
  
  // New States
  chatReply: string;
  isChatLoading: boolean;
  voiceReply: string;
  voiceActionTaken: string;
  isVoiceLoading: boolean;
  analyticsData: AnalyticsData | null;
  isAnalyticsLoading: boolean;
  
  // Security / Auth State
  user: { username: string; role: 'admin' | 'operator' | 'viewer' } | null;
  token: string | null;

  // Actions
  initSocket: (backendUrl: string) => void;
  disconnectSocket: () => void;
  triggerEmergency: (backendUrl: string, active: boolean) => Promise<void>;
  reportIncident: (backendUrl: string, incidentData: Omit<Incident, 'id' | 'created_at' | 'status'>) => Promise<void>;
  updateGateStatus: (backendUrl: string, gateId: string, status: 'open' | 'closed' | 'restricted') => Promise<void>;
  generateAiBriefing: (backendUrl: string) => Promise<void>;
  
  // New Actions
  sendChatMessage: (backendUrl: string, message: string) => Promise<string>;
  sendVoiceCommand: (backendUrl: string, command: string) => Promise<VoiceCommandResponse | undefined>;
  ticketScan: (backendUrl: string, gateId: string, isFake: boolean) => Promise<TicketScanResponse>;
  fetchAnalytics: (backendUrl: string) => Promise<void>;
  login: (backendUrl: string, credentials: { username: string; password: string }) => Promise<boolean>;
  logout: () => void;
}

export const useStore = create<CrowdShieldStore>((set, get) => ({
  zones: [],
  gates: [],
  incidents: [],
  alerts: [],
  evacuation: { is_active: false, triggered_at: null, triggered_by: null, estimated_duration: 900 },
  aiBriefing: '',
  isAiLoading: false,
  socketConnected: false,
  socket: null,
  
  chatReply: '',
  isChatLoading: false,
  voiceReply: '',
  voiceActionTaken: '',
  isVoiceLoading: false,
  analyticsData: null,
  isAnalyticsLoading: false,

  // Load from storage if available
  user: (() => {
    try {
      const stored = localStorage.getItem('crowdshield_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('crowdshield_token') || null,

  initSocket: (backendUrl: string) => {
    if (get().socket) return;

    const socket = io(backendUrl);

    socket.on('connect', () => {
      set({ socketConnected: true });
    });

    socket.on('disconnect', () => {
      set({ socketConnected: false });
    });

    socket.on('initial_state', (data: InitialStateData) => {
      set({
        zones: data.zones,
        gates: data.gates,
        incidents: data.incidents,
        alerts: data.alerts,
        evacuation: data.evacuationState,
      });
    });

    socket.on('telemetry_update', (data: TelemetryUpdateData) => {
      set({
        zones: data.zones,
        gates: data.gates,
        evacuation: data.evacuationState,
      });
    });

    socket.on('incident_report', (newIncident: Incident) => {
      set((state) => ({
        incidents: [newIncident, ...state.incidents],
      }));
    });

    socket.on('alert_broadcast', (newAlert: Alert) => {
      if (newAlert) {
        set((state) => ({
          alerts: [newAlert, ...state.alerts],
        }));
      }
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, socketConnected: false });
    }
  },

  triggerEmergency: async (backendUrl: string, active: boolean) => {
    try {
      const token = get().token;
      const response = await fetch(`${backendUrl}/api/emergency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ active, triggeredBy: 'Operator Dashboard' }),
      });
      if (response.status === 401 || response.status === 403) {
        const role = get().user?.role || 'anonymous';
        set((state) => ({
          alerts: [{
            id: `alt-rbac-${Date.now()}`,
            type: 'system',
            message: `SECURITY PROTOCOL VIOLATION: Role "${role.toUpperCase()}" lacks clearance for Evacuation command. Authorization denied.`,
            severity: 'critical',
            is_active: true,
            created_at: new Date().toISOString()
          }, ...state.alerts]
        }));
        return;
      }
      const data = await response.json();
      if (data.success) {
        set({ evacuation: data.evacuationState });
      }
    } catch (error) {
      console.error('Failed to trigger emergency:', error);
    }
  },

  reportIncident: async (backendUrl: string, incidentData) => {
    try {
      const token = get().token;
      const response = await fetch(`${backendUrl}/api/incident`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(incidentData),
      });
      if (response.status === 401 || response.status === 403) {
        const role = get().user?.role || 'anonymous';
        set((state) => ({
          alerts: [{
            id: `alt-rbac-${Date.now()}`,
            type: 'system',
            message: `SECURITY PROTOCOL VIOLATION: Role "${role.toUpperCase()}" unauthorized to report incidents. Access denied.`,
            severity: 'critical',
            is_active: true,
            created_at: new Date().toISOString()
          }, ...state.alerts]
        }));
        return;
      }
      const data = await response.json();
      if (data.success) {
        // Incident will be broadcasted over Socket.io
      }
    } catch (error) {
      console.error('Failed to report incident:', error);
    }
  },

  updateGateStatus: async (backendUrl: string, gateId: string, status: 'open' | 'closed' | 'restricted') => {
    set((state) => ({
      gates: state.gates.map((g) => (g.id === gateId ? { ...g, status } : g)),
    }));

    try {
      const token = get().token;
      const response = await fetch(`${backendUrl}/api/gate/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ gateId, status }),
      });
      if (response.status === 401 || response.status === 403) {
        const role = get().user?.role || 'anonymous';
        set((state) => ({
          alerts: [{
            id: `alt-rbac-${Date.now()}`,
            type: 'system',
            message: `SECURITY PROTOCOL VIOLATION: Role "${role.toUpperCase()}" unauthorized to alter Gate status. Access denied.`,
            severity: 'critical',
            is_active: true,
            created_at: new Date().toISOString()
          }, ...state.alerts]
        }));
        return;
      }
      const data = await response.json();
      if (data.success) {
        // Updated state will be broadcasted over Socket.io
      }
    } catch (error) {
      console.error('Failed to update gate status:', error);
    }
  },

  generateAiBriefing: async (backendUrl: string) => {
    set({ isAiLoading: true });
    try {
      const token = get().token;
      const response = await fetch(`${backendUrl}/api/ai/briefing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });
      if (response.status === 401 || response.status === 403) {
        set({ aiBriefing: 'SECURITY EXCLUSION: Unauthorized role. AI briefing requires active viewer clearance.' });
        return;
      }
      const data = await response.json();
      if (data.briefing) {
        set({ aiBriefing: data.briefing });
      }
    } catch (error) {
      console.error('Failed to generate AI briefing:', error);
      set({ aiBriefing: 'Error contacting AI engine.' });
    } finally {
      set({ isAiLoading: false });
    }
  },

  sendChatMessage: async (backendUrl: string, message: string) => {
    set({ isChatLoading: true });
    try {
      const response = await fetch(`${backendUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      set({ chatReply: data.reply || 'No response.' });
      return data.reply || 'No response.';
    } catch (error) {
      console.error(error);
      set({ chatReply: 'Failed to reach AI support assistant.' });
      return 'Failed to reach AI support assistant.';
    } finally {
      set({ isChatLoading: false });
    }
  },

  sendVoiceCommand: async (backendUrl: string, command: string) => {
    set({ isVoiceLoading: true });
    try {
      const token = get().token;
      const response = await fetch(`${backendUrl}/api/ai/voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ command }),
      });
      if (response.status === 401 || response.status === 403) {
        const role = get().user?.role || 'anonymous';
        set({ 
          voiceReply: `SECURITY ERROR: Access Denied. Role "${role.toUpperCase()}" is unauthorized for voice system override commands.`,
          voiceActionTaken: 'COMMAND REJECTED.'
        });
        return {
          reply: `SECURITY ERROR: Access Denied. Role "${role.toUpperCase()}" is unauthorized.`,
          actionTaken: 'COMMAND REJECTED.'
        };
      }
      const data = await response.json();
      set({ 
        voiceReply: data.reply || 'Acknowledged.', 
        voiceActionTaken: data.actionTaken || 'None.' 
      });
      return data;
    } catch (error) {
      console.error(error);
      set({ voiceReply: 'Voice node offline. Action aborted.' });
    } finally {
      set({ isVoiceLoading: false });
    }
  },

  ticketScan: async (backendUrl: string, gateId: string, isFake: boolean) => {
    try {
      const response = await fetch(`${backendUrl}/api/ticket/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateId, isFake }),
      });
      return await response.json();
    } catch (error) {
      console.error('Scan error:', error);
      return { success: false, message: 'Terminal offline.' };
    }
  },

  fetchAnalytics: async (backendUrl: string) => {
    set({ isAnalyticsLoading: true });
    try {
      const response = await fetch(`${backendUrl}/api/analytics`);
      const data = await response.json();
      set({ analyticsData: data });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      set({ isAnalyticsLoading: false });
    }
  },

  login: async (backendUrl: string, credentials: { username: string; password: string }) => {
    try {
      const response = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (data.success && data.token) {
        set({ user: data.user, token: data.token });
        localStorage.setItem('crowdshield_token', data.token);
        localStorage.setItem('crowdshield_user', JSON.stringify(data.user));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },

  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem('crowdshield_token');
    localStorage.removeItem('crowdshield_user');
  },
}));
