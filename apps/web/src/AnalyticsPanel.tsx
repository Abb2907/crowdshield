import React, { useEffect } from 'react';
import { useStore } from './store';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  Legend,
  Cell
} from 'recharts';
import { TrendingUp, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

interface AnalyticsPanelProps {
  backendUrl: string;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ backendUrl }) => {
  const { fetchAnalytics, analyticsData, isAnalyticsLoading } = useStore();

  useEffect(() => {
    fetchAnalytics(backendUrl);
  }, [backendUrl, fetchAnalytics]);

  if (isAnalyticsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 font-mono text-slate-400 gap-3 border border-brand-border rounded-lg bg-slate-950/60">
        <div className="w-6 h-6 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
        LOADING POST-MATCH DATASETS...
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center h-96 font-mono text-slate-400 border border-brand-border rounded-lg bg-slate-950/60">
        NO ANALYTICS DATA AVAILABLE.
      </div>
    );
  }

  // Formatting colors
  const SEVERITY_COLORS: Record<string, string> = {
    critical: '#EF4444',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#22C55E'
  };

  // Convert raw gate analytics to charts format
  const gateData = Object.entries(analyticsData.gateMetrics || {}).map(([key, val]: [string, { totalScans: number; avgWaitTime: number; maxWaitTime: number }]) => ({
    name: key.toUpperCase(),
    scans: val.totalScans,
    avgWait: val.avgWaitTime,
    maxWait: val.maxWaitTime,
  }));

  const incidentData = Object.entries(analyticsData.incidentBreakdown || {}).map(([key, val]) => ({
    name: key.toUpperCase(),
    count: val,
  }));

  return (
    <div className="flex flex-col gap-6 text-brand-text">
      {/* Analytics KPIs Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-brand-border bg-slate-900/60 p-4 rounded-lg flex items-center gap-3">
          <div className="p-2 bg-brand-teal/10 rounded text-brand-teal">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 block">TOTAL TICKETS VALIDATED</span>
            <span className="text-xl font-bold font-mono text-white">
              {analyticsData.kpis?.totalTicketsValidated}
            </span>
          </div>
        </div>

        <div className="border border-brand-border bg-slate-900/60 p-4 rounded-lg flex items-center gap-3">
          <div className="p-2 bg-brand-red/10 rounded text-brand-red">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 block">FRAUDULENT SCANS BLOCKED</span>
            <span className="text-xl font-bold font-mono text-white">
              {analyticsData.kpis?.totalFraudDetections}
            </span>
          </div>
        </div>

        <div className="border border-brand-border bg-slate-900/60 p-4 rounded-lg flex items-center gap-3">
          <div className="p-2 bg-brand-green/10 rounded text-brand-green">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 block">PEAK STADIUM OCCUPANCY</span>
            <span className="text-xl font-bold font-mono text-white">
              {analyticsData.kpis?.peakOccupancyPercent}%
            </span>
          </div>
        </div>

        <div className="border border-brand-border bg-slate-900/60 p-4 rounded-lg flex items-center gap-3">
          <div className="p-2 bg-brand-amber/10 rounded text-brand-amber">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-slate-400 block">EVAC DRILL EXIT SPEED</span>
            <span className="text-xl font-bold font-mono text-white">
              {analyticsData.kpis?.avgEvacTimeSeconds}s avg
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Crowd Flow Velocity */}
        <div className="border border-brand-border bg-slate-950/60 p-4 rounded-lg flex flex-col gap-3">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Hourly Crowd Velocity & Exit Throughput
          </span>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsData.occupancyHistory || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F5D4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00F5D4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,90,119,0.15)" />
                <XAxis dataKey="hour" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1B263B', borderColor: '#415A77', borderRadius: '4px', fontSize: '11px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#FFF' }}
                />
                <Area type="monotone" dataKey="occupancy" stroke="#00F5D4" fillOpacity={1} fill="url(#colorOccupancy)" strokeWidth={2} name="Crowd Inflow (PAX)" />
                <Area type="monotone" dataKey="evacThroughput" stroke="#EF4444" fillOpacity={0} strokeWidth={1.5} name="Exit Flow Velocity" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Gate Wait Times & Bottlenecks */}
        <div className="border border-brand-border bg-slate-950/60 p-4 rounded-lg flex flex-col gap-3">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Gate Bottleneck Analysis (Minutes Waiting)
          </span>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,90,119,0.15)" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1B263B', borderColor: '#415A77', borderRadius: '4px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="avgWait" fill="#3B82F6" name="Avg Wait Time" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maxWait" fill="#F59E0B" name="Max Wait Time" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Incident Severity Breakdown */}
        <div className="border border-brand-border bg-slate-950/60 p-4 rounded-lg flex flex-col gap-3">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Operational Incidents by Severity Classification
          </span>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,90,119,0.15)" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1B263B', borderColor: '#415A77', borderRadius: '4px', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="#EF4444" name="Incidents Reported">
                  {incidentData.map((entry, index) => {
                    const sev = entry.name.toLowerCase();
                    return <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[sev] || '#415A77'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Gate Throughput Scan Volume */}
        <div className="border border-brand-border bg-slate-950/60 p-4 rounded-lg flex flex-col gap-3">
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Total Turnstile Scanning Volumes
          </span>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gateData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,90,119,0.15)" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1B263B', borderColor: '#415A77', borderRadius: '4px', fontSize: '11px' }}
                />
                <Area type="monotone" dataKey="scans" stroke="#3B82F6" fillOpacity={1} fill="url(#colorScans)" strokeWidth={2} name="Scans Volume" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
