import React, { useEffect, useRef, useCallback } from 'react';
import type { StadiumZone, Gate } from './store';

interface StadiumCanvasProps {
  zones: StadiumZone[];
  gates: Gate[];
  evacuationActive: boolean;
  onSelectZone: (zoneId: string) => void;
  selectedZoneId: string | null;
}

interface CrowdParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  zoneId: string;
  color: string;
  size: number;
  targetX: number;
  targetY: number;
}

// Define Zone Coordinates relative to a 500x500 virtual coordinate system
const zoneCoords: Record<string, { x: number; y: number; rInner: number; rOuter: number; startAngle: number; endAngle: number }> = {
  zone_a: { x: 250, y: 250, rInner: 70, rOuter: 130, startAngle: Math.PI * 1.25, endAngle: Math.PI * 1.75 }, // North
  zone_b: { x: 250, y: 250, rInner: 70, rOuter: 130, startAngle: Math.PI * 1.75, endAngle: Math.PI * 2.25 }, // East
  zone_c: { x: 250, y: 250, rInner: 70, rOuter: 130, startAngle: Math.PI * 0.25, endAngle: Math.PI * 0.75 }, // South
  zone_d: { x: 250, y: 250, rInner: 70, rOuter: 130, startAngle: Math.PI * 0.75, endAngle: Math.PI * 1.25 }, // West
};

// Define Gate Positions on the 500x500 virtual board
const gateCoords: Record<string, { x: number; y: number; name: string }> = {
  'gate-1': { x: 250, y: 40, name: 'Gate 1 (North)' },
  'gate-2': { x: 460, y: 250, name: 'Gate 2 (East)' },
  'gate-3': { x: 250, y: 460, name: 'Gate 3 (South)' },
  'gate-4': { x: 40, y: 250, name: 'Gate 4 (West)' },
};

// Helper to generate a random point within an annular sector (doughnut slice)
const getRandomPointInZone = (zoneId: string) => {
  const coords = zoneCoords[zoneId];
  if (!coords) return { x: 250, y: 250 };
  const { x, y, rInner, rOuter, startAngle, endAngle } = coords;
  
  const r = rInner + Math.random() * (rOuter - rInner);
  const theta = startAngle + Math.random() * (endAngle - startAngle);
  
  return {
    x: x + r * Math.cos(theta),
    y: y + r * Math.sin(theta)
  };
};

export const StadiumCanvas: React.FC<StadiumCanvasProps> = ({
  zones,
  gates,
  evacuationActive,
  onSelectZone,
  selectedZoneId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<CrowdParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and Maintain Particles based on current occupancy
  useEffect(() => {
    const maxParticles = 350; // Limit for performance and visual clarity
    const targetParticleCounts = zones.reduce((acc, z) => {
      // Scale count down to a reasonable number of particles
      const ratio = z.capacity > 0 ? z.current_occupancy / z.capacity : 0;
      acc[z.id] = Math.max(12, Math.floor(ratio * 80));
      return acc;
    }, {} as Record<string, number>);

    let currentParticles = [...particlesRef.current];

    // Clean up particles in wrong zones or adjust counts
    zones.forEach((z) => {
      const zoneParts = currentParticles.filter(p => p.zoneId === z.id);
      const targetCount = targetParticleCounts[z.id] || 0;

      // Add missing particles
      if (zoneParts.length < targetCount) {
        const diff = targetCount - zoneParts.length;
        for (let i = 0; i < diff; i++) {
          const pt = getRandomPointInZone(z.id);
          const color = z.risk_level === 'critical' ? '#EF4444' : z.risk_level === 'warning' ? '#F59E0B' : '#00F5D4';
          currentParticles.push({
            x: pt.x + (Math.random() - 0.5) * 15,
            y: pt.y + (Math.random() - 0.5) * 15,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            zoneId: z.id,
            color,
            size: 1.8 + Math.random() * 2.2,
            targetX: pt.x,
            targetY: pt.y
          });
        }
      } 
      // Remove excess particles
      else if (zoneParts.length > targetCount) {
        const diff = zoneParts.length - targetCount;
        let removed = 0;
        currentParticles = currentParticles.filter(p => {
          if (p.zoneId === z.id && removed < diff) {
            removed++;
            return false;
          }
          return true;
        });
      }
    });

    particlesRef.current = currentParticles.slice(0, maxParticles);
  }, [zones]);

  // Helper function to find nearest open gate
  const findNearestAvailableGate = useCallback((zoneId: string) => {
    // Priority to gates that are NOT closed
    const activeGates = gates.filter(g => g.status !== 'closed');
    if (activeGates.length === 0) return null; // No escape route!

    // Map zone to optimal gates
    let targetGateId = 'gate-1';
    if (zoneId === 'zone_a') targetGateId = 'gate-1';
    else if (zoneId === 'zone_b') targetGateId = 'gate-2';
    else if (zoneId === 'zone_c') targetGateId = 'gate-3';
    else if (zoneId === 'zone_d') targetGateId = 'gate-4';

    let selectedGate = activeGates.find(g => g.id === targetGateId);
    
    // If target gate is closed, fall back to first active gate
    if (!selectedGate) {
      selectedGate = activeGates[0];
    }

    const coord = gateCoords[selectedGate.id];
    return coord ? { x: coord.x, y: coord.y } : null;
  }, [gates]);

  // Main Render & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear Screen with premium grid overlay
      ctx.fillStyle = '#050c18';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid Lines
      ctx.strokeStyle = 'rgba(65, 90, 119, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 25;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw Pitch (Center Field)
      ctx.beginPath();
      ctx.arc(250, 250, 50, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 245, 212, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pitch boundary
      ctx.beginPath();
      ctx.arc(250, 250, 15, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();

      // Pitch text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CRICKET PITCH', 250, 253);

      // 3. Draw Zone Sectors & Highlight selected
      Object.entries(zoneCoords).forEach(([id, coords]) => {
        const zoneInfo = zones.find(z => z.id === id);
        const isSelected = selectedZoneId === id;
        
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, coords.rOuter, coords.startAngle, coords.endAngle);
        ctx.arc(coords.x, coords.y, coords.rInner, coords.endAngle, coords.startAngle, true);
        ctx.closePath();

        // Color coding depending on risk status
        let fillColor = 'rgba(65, 90, 119, 0.1)';
        let strokeColor = 'rgba(65, 90, 119, 0.3)';

        if (zoneInfo) {
          if (zoneInfo.risk_level === 'critical') {
            fillColor = isSelected ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.12)';
            strokeColor = 'rgba(239, 68, 68, 0.8)';
          } else if (zoneInfo.risk_level === 'warning') {
            fillColor = isSelected ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.12)';
            strokeColor = 'rgba(245, 158, 11, 0.7)';
          } else {
            fillColor = isSelected ? 'rgba(0, 245, 212, 0.2)' : 'rgba(0, 245, 212, 0.05)';
            strokeColor = isSelected ? 'rgba(0, 245, 212, 0.8)' : 'rgba(0, 245, 212, 0.4)';
          }
        }

        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.stroke();

        // Zone label text inside the sectors
        const textAngle = coords.startAngle + (coords.endAngle - coords.startAngle) / 2;
        const textDist = coords.rInner + (coords.rOuter - coords.rInner) / 2;
        const tx = coords.x + textDist * Math.cos(textAngle);
        const ty = coords.y + textDist * Math.sin(textAngle);

        ctx.fillStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(zoneInfo ? zoneInfo.name.toUpperCase() : id.toUpperCase(), tx, ty - 2);
        
        ctx.font = '7px monospace';
        ctx.fillStyle = zoneInfo?.risk_level === 'critical' ? '#EF4444' : 'rgba(255, 255, 255, 0.4)';
        ctx.fillText(zoneInfo ? `${zoneInfo.current_occupancy} PAX` : '', tx, ty + 6);
      });

      // 4. Evacuation Paths (Arrow Vectors)
      if (evacuationActive) {
        ctx.strokeStyle = '#22C55E';
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        
        // Draw routing arrows from zones to available open gates
        Object.entries(zoneCoords).forEach(([zoneId, coords]) => {
          // Find closest open/restricted gate
          const targetGate = findNearestAvailableGate(zoneId);
          if (targetGate) {
            const startAngle = coords.startAngle + (coords.endAngle - coords.startAngle) / 2;
            const sx = coords.x + coords.rInner * Math.cos(startAngle);
            const sy = coords.y + coords.rInner * Math.sin(startAngle);
            
            const gx = targetGate.x;
            const gy = targetGate.y;

            // Draw animated dotted path
            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.lineDashOffset = -((Date.now() / 40) % 12);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo((sx + gx) / 2, (sy + gy) / 2);
            ctx.lineTo(gx, gy);
            ctx.stroke();
            ctx.restore();

            // Evac vector tag
            ctx.fillStyle = '#22C55E';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('EVAC FLOW →', (sx + gx) / 2, (sy + gy) / 2 - 5);
          }
        });
      }

      // 5. Draw Gates
      gates.forEach(gate => {
        const coord = gateCoords[gate.id];
        if (!coord) return;

        // Gate color representation
        let color = '#22C55E'; // open
        if (gate.status === 'restricted') color = '#F59E0B';
        if (gate.status === 'closed') color = '#EF4444';

        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Gate border ring
        ctx.beginPath();
        ctx.arc(coord.x, coord.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}44`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        const labelY = coord.y < 250 ? coord.y - 12 : coord.y + 18;
        ctx.fillText(gate.name.toUpperCase(), coord.x, labelY);

        ctx.font = '7px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`${gate.wait_time}m Wait`, coord.x, labelY + 9);
      });

      // 6. Update and Draw Crowd Particles with repulsion & steering
      particlesRef.current.forEach((p, idx) => {
        // Physics update
        if (evacuationActive) {
          // Flow toward closest open gate
          const targetGate = findNearestAvailableGate(p.zoneId);
          if (targetGate) {
            p.targetX = targetGate.x;
            p.targetY = targetGate.y;
          }
        } else {
          // Normal behavior: drift within zone
          if (Math.random() < 0.02) {
            const pt = getRandomPointInZone(p.zoneId);
            p.targetX = pt.x;
            p.targetY = pt.y;
          }
        }

        // Steer force
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let steerX = 0;
        let steerY = 0;
        if (dist > 5) {
          const speed = evacuationActive ? 2.0 : 0.5;
          steerX = (dx / dist) * speed;
          steerY = (dy / dist) * speed;
        } else {
          if (evacuationActive) {
            const pt = getRandomPointInZone(p.zoneId);
            p.x = pt.x;
            p.y = pt.y;
          }
        }

        // Social Force Model: Particle-to-particle repulsion
        let repX = 0;
        let repY = 0;
        const personalSpace = 8;
        
        // Optimize inner loop - look at a subset of particles to maintain performance
        // Only run check if we're not too laggy
        const list = particlesRef.current;
        const listLen = list.length;
        const sampleStep = listLen > 200 ? 2 : 1; // Sample particles for performance if count is high
        
        for (let otherIdx = 0; otherIdx < listLen; otherIdx += sampleStep) {
          if (idx === otherIdx) continue;
          const other = list[otherIdx];
          if (other.zoneId !== p.zoneId) continue; // Only repel within the same zone for clean structures
          
          const pdx = p.x - other.x;
          const pdy = p.y - other.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pdist > 0 && pdist < personalSpace) {
            const force = (personalSpace - pdist) / personalSpace;
            repX += (pdx / pdist) * force * 0.5;
            repY += (pdy / pdist) * force * 0.5;
          }
        }

        // Interactive Cursor Repulsion
        let mouseRepX = 0;
        let mouseRepY = 0;
        if (mousePosRef.current) {
          const mdx = p.x - mousePosRef.current.x;
          const mdy = p.y - mousePosRef.current.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          const activeRadius = 45;
          if (mdist > 0 && mdist < activeRadius) {
            const force = (activeRadius - mdist) / activeRadius;
            // Stronger push in evac mode, normal push otherwise
            const pushFactor = evacuationActive ? 5.0 : 3.5;
            mouseRepX = (mdx / mdist) * force * pushFactor;
            mouseRepY = (mdy / mdist) * force * pushFactor;
          }
        }

        // Apply velocities
        p.vx = steerX * 0.7 + repX + mouseRepX;
        p.vy = steerY * 0.7 + repY + mouseRepY;

        // Apply friction/drag and jitter
        p.x += p.vx + (Math.random() - 0.5) * 0.15;
        p.y += p.vy + (Math.random() - 0.5) * 0.15;

        // Keep inside bounds
        if (p.x < 0 || p.x > width) p.x = width / 2;
        if (p.y < 0 || p.y > height) p.y = height / 2;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        const zoneInfo = zones.find(z => z.id === p.zoneId);
        if (zoneInfo?.risk_level === 'critical') {
          ctx.fillStyle = '#EF4444';
        } else if (zoneInfo?.risk_level === 'warning') {
          ctx.fillStyle = '#F59E0B';
        } else {
          ctx.fillStyle = evacuationActive ? '#22C55E' : '#00F5D4';
        }
        ctx.fill();
      });

      // Draw interactive mouse ripple radar effect
      if (mousePosRef.current) {
        ctx.beginPath();
        ctx.arc(mousePosRef.current.x, mousePosRef.current.y, 45, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 245, 212, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mousePosRef.current.x, mousePosRef.current.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00F5D4';
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [zones, gates, evacuationActive, selectedZoneId, findNearestAvailableGate]);

  // Handle click on canvas to select zones
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Scale client coordinate space to 500x500 virtual coordinate space
    const clickX = ((e.clientX - rect.left) / rect.width) * 500;
    const clickY = ((e.clientY - rect.top) / rect.height) * 500;

    // Detect click in annular sector
    const dx = clickX - 250;
    const dy = clickY - 250;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI * 2; // Normalize angle [0, 2PI]

    let foundZoneId: string | null = null;

    Object.entries(zoneCoords).forEach(([id, coords]) => {
      if (dist >= coords.rInner && dist <= coords.rOuter) {
        // Adjust angles to positive standard coordinates
        const start = coords.startAngle;
        const end = coords.endAngle;
        
        // Normalize coordinates to handle wrap-arounds (e.g. Zone B crosses 0 / 2PI)
        if (id === 'zone_b') {
          // Zone B spans from 7/4 PI to 9/4 PI
          if (angle >= 1.75 * Math.PI || angle <= 0.25 * Math.PI) {
            foundZoneId = id;
          }
        } else {
          if (angle >= start && angle <= end) {
            foundZoneId = id;
          }
        }
      }
    });

    if (foundZoneId) {
      onSelectZone(foundZoneId);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: ((e.clientX - rect.left) / rect.width) * 500,
      y: ((e.clientY - rect.top) / rect.height) * 500
    };
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
  };

  return (
    <div className="relative w-full border border-brand-border rounded-lg bg-slate-950/80 p-4 aspect-square flex flex-col justify-between overflow-hidden">
      <div className="text-[10px] font-mono text-slate-400 z-10 flex justify-between select-none">
        <span>DIGITAL TWIN RADAR OVERLAY</span>
        <span className={`${evacuationActive ? 'text-brand-red animate-pulse' : 'text-brand-teal'}`}>
          ● {evacuationActive ? 'EVAC ROUTING ACTIVE' : 'SYSTEM HEALTH: OPTIMAL'}
        </span>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-2 relative">
        <canvas
          ref={canvasRef}
          width={500}
          height={500}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full max-w-[440px] aspect-square cursor-pointer rounded-full border border-brand-border/20 bg-slate-950"
        />
      </div>

      <div className="flex gap-4 justify-between items-center text-[10px] font-mono z-10 bg-brand-surface/60 p-2 rounded border border-brand-border select-none mt-2">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand-green" />
          <span>&lt;60% SAFE</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand-amber animate-pulse" />
          <span>60-85% HIGH</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand-red pulse-glow" />
          <span>&gt;85% OVERLOAD</span>
        </div>
      </div>
    </div>
  );
};
