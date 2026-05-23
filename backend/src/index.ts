import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import path from 'path';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'crowdshield-super-secret-key-987654321';

export interface AuthenticatedRequest extends express.Request {
  user?: {
    username: string;
    role: 'admin' | 'operator' | 'viewer';
  };
}

const authenticateJWT = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired security token' });
      }
      (req as AuthenticatedRequest).user = decoded as any;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Security token missing' });
  }
};

const requireRole = (roles: Array<'admin' | 'operator' | 'viewer'>) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    if (user && roles.includes(user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Forbidden: Insufficient privileges for this action' });
    }
  };
};

export const app = express();
app.use(cors());
app.use(express.json());

export const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Initialize Supabase Client if credentials are provided
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (supabase) {
  console.log('Supabase client initialized successfully.');
} else {
  console.warn('Supabase credentials missing. Running in local fallback/mock mode.');
}

// In-memory fallback state
let zones = [
  { id: 'zone_a', name: 'Zone A - North Stand', capacity: 23000, current_occupancy: 11500, risk_level: 'safe' },
  { id: 'zone_b', name: 'Zone B - East Stand', capacity: 20000, current_occupancy: 16000, risk_level: 'warning' },
  { id: 'zone_c', name: 'Zone C - South Stand (Club)', capacity: 28000, current_occupancy: 25480, risk_level: 'critical' },
  { id: 'zone_d', name: 'Zone D - West Stand', capacity: 24000, current_occupancy: 9600, risk_level: 'safe' },
];

let gates = [
  { id: 'gate_a', name: 'Gate A - North Plaza', status: 'open', wait_time: 5, flow_rate: 80, capacity: 23000, current_throughput: 9200 },
  { id: 'gate_b', name: 'Gate B - East Access', status: 'open', wait_time: 12, flow_rate: 110, capacity: 20000, current_throughput: 13200 },
  { id: 'gate_c', name: 'Gate C - South Main (Club)', status: 'restricted', wait_time: 28, flow_rate: 45, capacity: 28000, current_throughput: 25200 },
  { id: 'gate_d', name: 'Gate D - West Entrance', status: 'open', wait_time: 3, flow_rate: 95, capacity: 24000, current_throughput: 9120 },
];

let incidents: any[] = [
  {
    id: 'inc-01',
    title: 'Crowd Surge at Turnstiles',
    description: 'Minor bottlenecks forming at Gate C outer perimeter due to ticket scanner failure.',
    severity: 'high',
    status: 'reported',
    zone_id: 'zone_c',
    location_details: 'Gate C outer entrance',
    created_at: new Date(Date.now() - 15 * 60000).toISOString(),
  }
];

let alerts: any[] = [
  {
    id: 'alt-01',
    type: 'crowd_surge',
    message: 'Gate C is experiencing high congestion (91% capacity). Rerouting suggested.',
    severity: 'warning',
    is_active: true,
    created_at: new Date(Date.now() - 10 * 60000).toISOString(),
  },
  {
    id: 'alt-02',
    type: 'weather',
    message: 'Light rain predicted within 30 minutes. Crowd flow velocity may decrease.',
    severity: 'info',
    is_active: true,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
  }
];

let evacuationState = {
  is_active: false,
  triggered_at: null as string | null,
  triggered_by: null as string | null,
  estimated_duration: 900, // 15 mins
};

// Sync from Supabase on startup
async function syncFromSupabase() {
  if (!supabase) return;
  try {
    const { data: dbZones } = await supabase.from('stadium_zones').select('*');
    if (dbZones && dbZones.length > 0) zones = dbZones;

    const { data: dbGates } = await supabase.from('gates').select('*');
    if (dbGates && dbGates.length > 0) gates = dbGates;

    const { data: dbIncidents } = await supabase.from('incidents').select('*').order('created_at', { ascending: false });
    if (dbIncidents) incidents = dbIncidents;

    const { data: dbAlerts } = await supabase.from('alerts').select('*').order('created_at', { ascending: false });
    if (dbAlerts) alerts = dbAlerts;

    const { data: dbEvac } = await supabase.from('evacuation_status').select('*').single();
    if (dbEvac) {
      evacuationState = {
        is_active: dbEvac.is_active,
        triggered_at: dbEvac.triggered_at,
        triggered_by: dbEvac.triggered_by,
        estimated_duration: dbEvac.estimated_duration,
      };
    }
    console.log('State successfully synchronized with Supabase.');
  } catch (err) {
    console.error('Error syncing with Supabase:', err);
  }
}

// Telemetry Simulation (Drift occupancy and wait times slightly)
setInterval(async () => {
  if (evacuationState.is_active) {
    // Evacuation simulation: occupancy drops, flow rate shifts
    zones = zones.map(z => {
      const drop = Math.floor(Math.random() * 200) + 100;
      const newOccupancy = Math.max(0, z.current_occupancy - drop);
      const rate = newOccupancy / z.capacity;
      return {
        ...z,
        current_occupancy: newOccupancy,
        risk_level: rate > 0.85 ? 'critical' : rate > 0.60 ? 'warning' : 'safe'
      };
    });

    gates = gates.map(g => ({
      ...g,
      flow_rate: Math.min(250, g.flow_rate + 5),
      wait_time: Math.max(1, g.wait_time - 1)
    }));
  } else {
    // Standard match simulator
    zones = zones.map(z => {
      const drift = Math.floor(Math.random() * 41) - 20; // -20 to +20
      const newOccupancy = Math.max(0, Math.min(z.capacity, z.current_occupancy + drift));
      const rate = newOccupancy / z.capacity;
      return {
        ...z,
        current_occupancy: newOccupancy,
        risk_level: rate > 0.85 ? 'critical' : rate > 0.60 ? 'warning' : 'safe'
      };
    });

    gates = gates.map(g => {
      const waitDrift = Math.floor(Math.random() * 3) - 1; // -1 to +1 min
      const flowDrift = Math.floor(Math.random() * 11) - 5; // -5 to +5 people/min
      return {
        ...g,
        wait_time: Math.max(1, Math.min(60, g.wait_time + waitDrift)),
        flow_rate: Math.max(10, Math.min(150, g.flow_rate + flowDrift)),
      };
    });
  }

  // Write changes to Supabase if available
  if (supabase) {
    for (const z of zones) {
      await supabase.from('stadium_zones').update({
        current_occupancy: z.current_occupancy,
        risk_level: z.risk_level,
        updated_at: new Date().toISOString()
      }).eq('id', z.id);
    }
    for (const g of gates) {
      await supabase.from('gates').update({
        wait_time: g.wait_time,
        flow_rate: g.flow_rate,
        updated_at: new Date().toISOString()
      }).eq('id', g.id);
    }
  }

  // Broadcast live state update to all clients
  io.emit('telemetry_update', { zones, gates, evacuationState });
}, 2000);

// API Endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    supabaseConnected: !!supabase,
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '2h' });
    return res.json({ success: true, token, user: { username: 'admin', role: 'admin' } });
  } else if (username === 'operator' && password === 'operator123') {
    const token = jwt.sign({ username: 'operator', role: 'operator' }, JWT_SECRET, { expiresIn: '2h' });
    return res.json({ success: true, token, user: { username: 'operator', role: 'operator' } });
  } else if (username === 'viewer' && password === 'viewer123') {
    const token = jwt.sign({ username: 'viewer', role: 'viewer' }, JWT_SECRET, { expiresIn: '2h' });
    return res.json({ success: true, token, user: { username: 'viewer', role: 'viewer' } });
  }
  res.status(401).json({ error: 'Invalid security credentials' });
});

app.get('/api/stadium', (req, res) => {
  res.json({ zones, gates, incidents, alerts, evacuationState });
});

app.post('/api/emergency', authenticateJWT, requireRole(['admin', 'operator']), async (req, res) => {
  const { active, triggeredBy, duration } = req.body;

  // RBAC check: only admin can activate evacuation, operator can only deactivate or trigger with confirmation
  const user = (req as AuthenticatedRequest).user;
  if (active && user?.role === 'operator') {
    // Let operators trigger, but note they are operator class
    // (In a real system they might need higher authorization, but for demo we allow it and log role)
  }

  evacuationState = {
    is_active: active !== undefined ? active : true,
    triggered_at: active ? new Date().toISOString() : null,
    triggered_by: triggeredBy || `${user?.username} (${user?.role})`,
    estimated_duration: duration || 900,
  };

  if (supabase) {
    await supabase.from('evacuation_status').update({
      is_active: evacuationState.is_active,
      triggered_at: evacuationState.triggered_at,
      triggered_by: evacuationState.triggered_by,
      estimated_duration: evacuationState.estimated_duration,
    }).eq('id', 1);

    // Create an alert
    if (evacuationState.is_active) {
      await supabase.from('alerts').insert({
        type: 'system',
        message: `EMERGENCY EVACUATION ACTIVE. Triggered by ${user?.username}.`,
        severity: 'critical',
        is_active: true
      });
    }
  }

  // Add in-memory alert
  if (evacuationState.is_active) {
    alerts.unshift({
      id: `alt-${Date.now()}`,
      type: 'system',
      message: `EMERGENCY EVACUATION ACTIVE. Triggered by ${user?.username}.`,
      severity: 'critical',
      is_active: true,
      created_at: new Date().toISOString()
    });
  }

  io.emit('telemetry_update', { zones, gates, evacuationState });
  io.emit('alert_broadcast', alerts[0] || null);

  res.json({ success: true, evacuationState });
});

app.post('/api/incident', authenticateJWT, requireRole(['admin', 'operator']), async (req, res) => {
  const { title, description, severity, zoneId, locationDetails } = req.body;
  const user = (req as AuthenticatedRequest).user;

  const newIncident = {
    id: `inc-${Date.now()}`,
    title,
    description,
    severity: severity || 'low',
    status: 'reported',
    zone_id: zoneId,
    location_details: locationDetails || `Logged by ${user?.username}`,
    created_at: new Date().toISOString(),
  };

  incidents.unshift(newIncident);

  if (supabase) {
    await supabase.from('incidents').insert({
      title,
      description,
      severity,
      status: 'reported',
      zone_id: zoneId,
      location_details: newIncident.location_details,
    });
  }

  io.emit('incident_report', newIncident);
  res.json({ success: true, incident: newIncident });
});

app.post('/api/gate/status', authenticateJWT, requireRole(['admin', 'operator']), async (req, res) => {
  const { gateId, status } = req.body;

  if (!['open', 'closed', 'restricted'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  gates = gates.map(g => g.id === gateId ? { ...g, status } : g);

  if (supabase) {
    try {
      await supabase.from('gates').update({
        status,
        updated_at: new Date().toISOString()
      }).eq('id', gateId);
    } catch (err) {
      console.error('Failed to update gate in Supabase:', err);
    }
  }

  io.emit('telemetry_update', { zones, gates, evacuationState });
  res.json({ success: true, gates });
});

app.post('/api/ai/briefing', authenticateJWT, requireRole(['admin', 'operator', 'viewer']), async (req, res) => {
  const briefingSystemPrompt = `You are CrowdShield AI, the operating intelligence of a modern smart stadium.
Analyze the following telemetry data and create a concise operational briefing:
1. Identify immediate risks or bottlenecks.
2. Provide concrete operational directives (e.g., dispatch volunteers, restrict gate entry, reroute fans).
3. Use a structured, professional, Palantir-inspired markdown tone.
4. Keep the output extremely concise and action-oriented (maximum 3 bullet points, under 100 words total).`;

  const inputTelemetryData = {
    stadiumOccupancy: zones.map(z => ({ name: z.name, occupancy: z.current_occupancy, capacity: z.capacity, rate: (z.current_occupancy / z.capacity * 100).toFixed(1) + '%' })),
    gateStatus: gates.map(g => ({ name: g.name, status: g.status, waitTime: g.wait_time + 'm', flowRate: g.flow_rate + 'p/m' })),
    incidents: incidents.filter(i => i.status !== 'resolved'),
    alerts: alerts.filter(a => a.is_active),
    evacuationActive: evacuationState.is_active,
  };

  if (!GEMINI_API_KEY) {
    // Generate a high-fidelity local briefing mock
    let briefing = '';
    if (evacuationState.is_active) {
      briefing = `**CRITICAL DIRECTIVE: EVACUATION OPERATIONS ACTIVE**
*   **Gate Clearance:** All gates (A, B, C, D) forced to OPEN. Current outflow velocity is 420 people/minute.
*   **Priority Sectors:** South Stand (Zone C) evacuation rate is 86%. Directing flow away from east access corridors.
*   **Volunteer Dispatch:** 24 team leaders dispatched to Gate C perimeter to guide egress pathing.`;
    } else {
      briefing = `**OPERATIONAL BRIEFING: ZONE C bottleneck**
*   **Surge Alert:** South Stand (Zone C) occupancy at 91.0%. Access bottleneck detected at Gate C (Wait time: 28m).
*   **Routing Action:** Reroute incoming spectator traffic from Gate C to Gate D (Wait time: 3m).
*   **Weather Warning:** Rain anticipated in 30 minutes; expect crowd velocity to decrease. Pre-staging shelters.`;
    }
    return res.json({ briefing });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${briefingSystemPrompt}\n\nTelemetry data:\n${JSON.stringify(inputTelemetryData, null, 2)}`
            }]
          }]
        })
      }
    );

    const data = await response.json();
    const briefing = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to retrieve briefing from Gemini.';
    res.json({ briefing });
  } catch (error) {
    console.error('Error generating briefing with Gemini API:', error);
    res.status(500).json({ error: 'Failed to generate briefing.' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  const chatSystemPrompt = `You are CrowdShield AI, the stadium intelligence voice assistant.
Provide helpful, natural, and concise answers to spectators or volunteers.
If the message is from a spectator, guide them safely (e.g., shortest queues, restroom congestion, parking).
Use a polite, clear, and reassuring tone. Maintain responses under 80 words.`;

  if (!GEMINI_API_KEY) {
    let reply = `CrowdShield AI: I am currently monitoring all stadium stands. Gate D has the shortest queue (3 min wait). Restrooms in the North Stand (Zone A) are currently at low occupancy (24%). Let me know how else I can assist you!`;
    const msgLower = message.toLowerCase();
    if (msgLower.includes('emergency') || msgLower.includes('evacuate')) {
      reply = `EMERGENCY ALERT: Evacuation is active. Please proceed calmly to your nearest designated exit (Gate A or Gate D). Follow instructions from stewards.`;
    } else if (msgLower.includes('parking')) {
      reply = `West Parking Lot has 120 available spaces. East Parking is currently FULL. We recommend using the West entrance gates.`;
    } else if (msgLower.includes('restroom') || msgLower.includes('washroom')) {
      reply = `Restroom capacity: Stand A (24% occupied - recommended), Stand C (89% occupied - high congestion).`;
    } else if (msgLower.includes('food') || msgLower.includes('beer') || msgLower.includes('eat')) {
      reply = `Food court wait times: North Concourse has a 4-minute queue. South Concourse is experiencing heavy traffic, wait time 18 minutes.`;
    }
    return res.json({ reply });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: `${chatSystemPrompt}\n\nUser Message: ${message}` }] }
          ]
        })
      }
    );
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI assistant.';
    res.json({ reply });
  } catch (error) {
    console.error('Error generating chat response:', error);
    res.status(500).json({ error: 'Failed to generate chat response.' });
  }
});

app.post('/api/ai/voice', authenticateJWT, requireRole(['admin', 'operator']), async (req, res) => {
  const { command } = req.body;
  const cmdLower = command.toLowerCase();
  let actionTaken = 'No structural action required.';

  if (cmdLower.includes('emergency') || cmdLower.includes('evacuate') || cmdLower.includes('evacuation')) {
    if (cmdLower.includes('stop') || cmdLower.includes('disarm') || cmdLower.includes('cancel') || cmdLower.includes('disable')) {
      evacuationState = {
        is_active: false,
        triggered_at: null,
        triggered_by: null,
        estimated_duration: 900,
      };
      actionTaken = 'EVACUATION OPERATION DISARMED. Restoring stadium status to nominal.';
    } else {
      evacuationState = {
        is_active: true,
        triggered_at: new Date().toISOString(),
        triggered_by: 'Voice Command Center',
        estimated_duration: 900,
      };
      alerts.unshift({
        id: `alt-${Date.now()}`,
        type: 'system',
        message: 'EMERGENCY EVACUATION ACTIVATED VIA VOICE COMMAND.',
        severity: 'critical',
        is_active: true,
        created_at: new Date().toISOString()
      });
      actionTaken = 'EMERGENCY EVACUATION ORDER INITIATED. Opening all exit gates.';
    }
    io.emit('telemetry_update', { zones, gates, evacuationState });
    io.emit('alert_broadcast', alerts[0] || null);
  } else if (cmdLower.includes('gate') || cmdLower.includes('turnstile')) {
    let status: 'open' | 'closed' | 'restricted' = 'open';
    if (cmdLower.includes('close') || cmdLower.includes('lock')) status = 'closed';
    else if (cmdLower.includes('restrict')) status = 'restricted';

    let targetGateId = '';
    if (cmdLower.includes('gate a') || cmdLower.includes('gate_a') || cmdLower.includes('stand a')) targetGateId = 'gate_a';
    else if (cmdLower.includes('gate b') || cmdLower.includes('gate_b') || cmdLower.includes('stand b')) targetGateId = 'gate_b';
    else if (cmdLower.includes('gate c') || cmdLower.includes('gate_c') || cmdLower.includes('stand c')) targetGateId = 'gate_c';
    else if (cmdLower.includes('gate d') || cmdLower.includes('gate_d') || cmdLower.includes('stand d')) targetGateId = 'gate_d';

    if (targetGateId) {
      gates = gates.map(g => g.id === targetGateId ? { ...g, status } : g);
      actionTaken = `Gate ${targetGateId.replace('gate_', '').toUpperCase()} status updated to ${status.toUpperCase()}.`;

      if (supabase) {
        try {
          await supabase.from('gates').update({ status, updated_at: new Date().toISOString() }).eq('id', targetGateId);
        } catch (e) {
          console.error(e);
        }
      }
      io.emit('telemetry_update', { zones, gates, evacuationState });
    } else {
      actionTaken = 'Gate specified not found. Please specify Gate A, B, C, or D.';
    }
  } else if (cmdLower.includes('incident') || cmdLower.includes('report')) {
    const title = 'Voice-Reported Incident';
    const description = command;
    const newIncident = {
      id: `inc-${Date.now()}`,
      title,
      description,
      severity: 'medium',
      status: 'reported',
      zone_id: 'zone_c',
      location_details: 'Operator Voice Intake',
      created_at: new Date().toISOString(),
    };
    incidents.unshift(newIncident);
    actionTaken = `Incident logged and dispatched to security: "${command}"`;

    if (supabase) {
      try {
        await supabase.from('incidents').insert({
          title,
          description,
          severity: 'medium',
          status: 'reported',
          zone_id: 'zone_c',
          location_details: 'Operator Voice Intake',
        });
      } catch (e) {
        console.error(e);
      }
    }
    io.emit('incident_report', newIncident);
  }

  const voiceSystemPrompt = `You are CrowdShield AI, the stadium command voice system.
Confirm the operational action taken in response to the user's voice directive.
Action executed: ${actionTaken}
Provide a crisp, formal, military-style verbal response confirming command execution. Under 40 words.`;

  if (!GEMINI_API_KEY) {
    return res.json({
      reply: `Command Acknowledged. Executing operation: ${actionTaken}`,
      actionTaken
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: voiceSystemPrompt }] }]
        })
      }
    );
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || `Command Executed: ${actionTaken}`;
    res.json({ reply, actionTaken });
  } catch (error) {
    res.json({ reply: `Command Acknowledged. Executing: ${actionTaken}`, actionTaken });
  }
});

app.post('/api/ticket/scan', (req, res) => {
  const { gateId, isFake } = req.body;
  const gate = gates.find(g => g.id === gateId);
  if (!gate) return res.status(404).json({ error: 'Gate not found' });

  if (isFake) {
    const newAlert = {
      id: `alt-${Date.now()}`,
      type: 'fraud',
      message: `TICKET VALIDATION ANOMALY: Duplicate scan attempt flagged at ${gate.name}. CCTV locked on turnstile.`,
      severity: 'critical',
      is_active: true,
      created_at: new Date().toISOString()
    };
    alerts.unshift(newAlert);

    const newIncident = {
      id: `inc-${Date.now()}`,
      title: 'Ticket Fraud Detected',
      description: `Multiple barcode scans of same ID at ${gate.name} outer terminal. Scan blocked.`,
      severity: 'medium',
      status: 'reported',
      zone_id: gateId === 'gate_a' ? 'zone_a' : gateId === 'gate_b' ? 'zone_b' : gateId === 'gate_c' ? 'zone_c' : 'zone_d',
      location_details: `${gate.name} Turnstile 3`,
      created_at: new Date().toISOString()
    };
    incidents.unshift(newIncident);

    io.emit('alert_broadcast', newAlert);
    io.emit('incident_report', newIncident);
    return res.json({ success: false, fraudDetected: true, message: 'Barcode invalidated. Already active in venue.' });
  }

  // Success scan
  gate.current_throughput += 1;
  gate.wait_time = Math.max(1, Math.min(60, gate.wait_time + (Math.random() > 0.6 ? 1 : -1)));

  let targetZoneId = 'zone_a';
  if (gateId === 'gate_b') targetZoneId = 'zone_b';
  else if (gateId === 'gate_c') targetZoneId = 'zone_c';
  else if (gateId === 'gate_d') targetZoneId = 'zone_d';

  const zone = zones.find(z => z.id === targetZoneId);
  if (zone && zone.current_occupancy < zone.capacity) {
    zone.current_occupancy += Math.floor(Math.random() * 3) + 1; // Increment a bit
  }

  io.emit('telemetry_update', { zones, gates, evacuationState });
  res.json({ success: true, gate, message: 'Ticket verified. Access granted.' });
});

app.get('/api/analytics', (req, res) => {
  const totalTicketsValidated = gates.reduce((acc, g) => acc + g.current_throughput, 0);
  const totalFraudDetections = incidents.filter(i => i.title.toLowerCase().includes('fraud') || i.title.toLowerCase().includes('counterfeit')).length;
  const totalOccupancy = zones.reduce((acc, z) => acc + z.current_occupancy, 0);
  const totalCapacity = zones.reduce((acc, z) => acc + z.capacity, 0);
  const peakOccupancyPercent = Math.round((totalOccupancy / (totalCapacity || 1)) * 100);

  const kpis = {
    totalTicketsValidated,
    totalFraudDetections,
    peakOccupancyPercent,
    avgEvacTimeSeconds: evacuationState.is_active ? 112 : 180,
  };

  const occupancyHistory = [
    { hour: '12:00', occupancy: 6000, evacThroughput: 800 },
    { hour: '13:00', occupancy: 14000, evacThroughput: 1200 },
    { hour: '14:00', occupancy: 28000, evacThroughput: 2400 },
    { hour: '15:00', occupancy: totalOccupancy, evacThroughput: evacuationState.is_active ? 4200 : 0 }
  ];

  const gateMetrics = {
    gate_a: {
      totalScans: gates.find(g => g.id === 'gate_a')?.current_throughput || 4800,
      avgWaitTime: gates.find(g => g.id === 'gate_a')?.wait_time || 5,
      maxWaitTime: 18
    },
    gate_b: {
      totalScans: gates.find(g => g.id === 'gate_b')?.current_throughput || 7920,
      avgWaitTime: gates.find(g => g.id === 'gate_b')?.wait_time || 12,
      maxWaitTime: 25
    },
    gate_c: {
      totalScans: gates.find(g => g.id === 'gate_c')?.current_throughput || 16200,
      avgWaitTime: gates.find(g => g.id === 'gate_c')?.wait_time || 28,
      maxWaitTime: 45
    },
    gate_d: {
      totalScans: gates.find(g => g.id === 'gate_d')?.current_throughput || 5700,
      avgWaitTime: gates.find(g => g.id === 'gate_d')?.wait_time || 3,
      maxWaitTime: 12
    }
  };

  const incidentBreakdown = {
    critical: incidents.filter(i => i.severity === 'critical').length,
    high: incidents.filter(i => i.severity === 'high').length,
    medium: incidents.filter(i => i.severity === 'medium').length,
    low: incidents.filter(i => i.severity === 'low').length
  };

  res.json({
    kpis,
    occupancyHistory,
    gateMetrics,
    incidentBreakdown
  });
});

// Serve static assets from apps/web/dist if it exists
const frontendDistPath = path.join(__dirname, '../../apps/web/dist');
app.use(express.static(frontendDistPath));

// Fallback all non-API routes to index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('CrowdShield AI Portal is compiling/loading or frontend assets are missing.');
    }
  });
});

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit('telemetry_update', { zones, gates, evacuationState });
  socket.emit('initial_state', { zones, gates, incidents, alerts, evacuationState });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

syncFromSupabase();

server.listen(PORT, () => {
  console.log(`CrowdShield AI Backend running on port ${PORT}`);
});
