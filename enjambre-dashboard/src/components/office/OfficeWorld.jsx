import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEventStream } from '../../hooks/useEventStream.js';

// ============================================
// BLACKWOLF ENJAMBRE - OFICINA VIRTUAL
// Visualización tipo AI Town / Generative Agents
// ============================================

const CANVAS_W = 1100;
const CANVAS_H = 680;

// Mapa de la oficina - rooms
const ROOMS = [
  { id: 'soc', x: 30, y: 30, w: 240, h: 280, label: 'SOC / CIBER', color: '#1a0a0f', border: '#ff4466', icon: '🛡️' },
  { id: 'crm', x: 300, y: 30, w: 240, h: 280, label: 'CRM / VENTAS', color: '#0a0f1a', border: '#4a9eff', icon: '👥' },
  { id: 'ops', x: 570, y: 30, w: 240, h: 280, label: 'OPS / ERP', color: '#0a1a0f', border: '#00d68f', icon: '📊' },
  { id: 'forms', x: 840, y: 30, w: 230, h: 280, label: 'FORMS', color: '#0f0a1a', border: '#b366ff', icon: '📝' },
  { id: 'pizarra', x: 30, y: 340, w: 520, h: 310, label: 'PIZARRA COMPARTIDA', color: '#0a0a14', border: '#00d4ff', icon: '📋' },
  { id: 'cerebro', x: 580, y: 340, w: 490, h: 310, label: 'CEREBRO / IA', color: '#0f0a0a', border: '#00d4ff', icon: '🧠' },
];

// Muebles / objetos decorativos por sala
const FURNITURE = [
  // SOC
  { room: 'soc', type: 'desk', x: 60, y: 80, w: 80, h: 40, label: '🖥️ Monitores' },
  { room: 'soc', type: 'desk', x: 160, y: 80, w: 80, h: 40, label: '🔍 Scanner' },
  { room: 'soc', type: 'board', x: 60, y: 200, w: 190, h: 60, label: '⚠️ Threat Board' },
  // CRM
  { room: 'crm', type: 'desk', x: 330, y: 80, w: 80, h: 40, label: '📞 Calls' },
  { room: 'crm', type: 'desk', x: 430, y: 80, w: 80, h: 40, label: '📧 Inbox' },
  { room: 'crm', type: 'board', x: 330, y: 200, w: 180, h: 60, label: '📈 Pipeline' },
  // OPS
  { room: 'ops', type: 'desk', x: 600, y: 80, w: 80, h: 40, label: '💰 Revenue' },
  { room: 'ops', type: 'desk', x: 700, y: 80, w: 80, h: 40, label: '📋 Reports' },
  { room: 'ops', type: 'board', x: 600, y: 200, w: 180, h: 60, label: '🎯 Targets' },
  // FORMS
  { room: 'forms', type: 'desk', x: 870, y: 80, w: 80, h: 40, label: '📥 Leads In' },
  { room: 'forms', type: 'board', x: 870, y: 200, w: 170, h: 60, label: '🌐 Webhooks' },
  // Cerebro
  { room: 'cerebro', type: 'server', x: 750, y: 420, w: 100, h: 80, label: '🧠 Claude API' },
  { room: 'cerebro', type: 'server', x: 880, y: 420, w: 100, h: 80, label: '⚡ Event Bus' },
  { room: 'cerebro', type: 'board', x: 620, y: 540, w: 420, h: 70, label: '📊 Decisiones del Cerebro' },
];

// Definición de agentes
const AGENT_DEFS = [
  {
    id: 'ciber', name: 'CIBER', emoji: '🛡️', homeRoom: 'soc',
    color: '#ff4466', thoughts: [
      'Analizando tráfico de red...', 'Verificando IPs sospechosas...', 'Revisando reglas Suricata...',
      'Correlacionando amenazas...', 'Escaneando puertos abiertos...', 'Actualizando firmas IDS...',
      'Consultando AbuseIPDB...', 'Revisando honeypot logs...',
    ],
  },
  {
    id: 'crm', name: 'CRM', emoji: '👥', homeRoom: 'crm',
    color: '#4a9eff', thoughts: [
      'Revisando pipeline de ventas...', 'Asignando leads a setters...', 'Actualizando contactos...',
      'Calculando tasas de conversión...', 'Preparando seguimiento...', 'Clasificando leads nuevos...',
      'Revisando actividad de closers...', 'Sincronizando datos...',
    ],
  },
  {
    id: 'ops', name: 'OPS', emoji: '📊', homeRoom: 'ops',
    color: '#00d68f', thoughts: [
      'Calculando comisiones...', 'Revisando revenue del mes...', 'Proyectando cierre mensual...',
      'Auditando transacciones...', 'Analizando ticket promedio...', 'Comparando con targets...',
      'Generando reporte de equipo...', 'Verificando pagos pendientes...',
    ],
  },
  {
    id: 'forms', name: 'FORMS', emoji: '📝', homeRoom: 'forms',
    color: '#b366ff', thoughts: [
      'Esperando formularios...', 'Procesando lead entrante...', 'Validando datos del form...',
      'Capturando UTMs...', 'Verificando email...', 'Registrando nueva entrada...',
      'Enviando a pipeline...', 'Detectando duplicados...',
    ],
  },
];

// Posiciones clave para que los agentes visiten
const WAYPOINTS = {
  soc: { x: 150, y: 170 },
  crm: { x: 420, y: 170 },
  ops: { x: 690, y: 170 },
  forms: { x: 950, y: 170 },
  pizarra: { x: 290, y: 500 },
  cerebro: { x: 800, y: 500 },
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randomThought(agent) {
  return agent.thoughts[Math.floor(Math.random() * agent.thoughts.length)];
}

class Agent {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.emoji = def.emoji;
    this.color = def.color;
    this.homeRoom = def.homeRoom;
    this.thoughts = def.thoughts;
    this.x = WAYPOINTS[def.homeRoom].x;
    this.y = WAYPOINTS[def.homeRoom].y;
    this.targetX = this.x;
    this.targetY = this.y;
    this.currentRoom = def.homeRoom;
    this.thought = randomThought(def);
    this.thoughtTimer = 0;
    this.speechBubble = null;
    this.speechTimer = 0;
    this.state = 'idle'; // idle, walking, working, talking
    this.interactingWith = null;
    this.trail = [];
    this.wobble = 0;
    this.actionQueue = [];
  }

  moveTo(room) {
    const wp = WAYPOINTS[room];
    if (!wp) return;
    this.targetX = wp.x + (Math.random() - 0.5) * 60;
    this.targetY = wp.y + (Math.random() - 0.5) * 40;
    this.currentRoom = room;
    this.state = 'walking';
  }

  say(text, duration = 4000) {
    this.speechBubble = text;
    this.speechTimer = duration;
  }

  update(dt) {
    this.wobble += dt * 3;

    // Mover hacia target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 2) {
      const speed = 0.03;
      this.x = lerp(this.x, this.targetX, speed);
      this.y = lerp(this.y, this.targetY, speed);
      this.state = 'walking';

      // Trail
      if (this.trail.length === 0 || Math.abs(this.x - this.trail[this.trail.length - 1].x) > 5) {
        this.trail.push({ x: this.x, y: this.y, alpha: 0.6 });
        if (this.trail.length > 15) this.trail.shift();
      }
    } else {
      if (this.state === 'walking') this.state = 'working';
    }

    // Fade trail
    this.trail.forEach((t) => { t.alpha *= 0.96; });
    this.trail = this.trail.filter((t) => t.alpha > 0.05);

    // Thoughts rotation
    this.thoughtTimer -= dt * 1000;
    if (this.thoughtTimer <= 0) {
      this.thought = randomThought(this);
      this.thoughtTimer = 5000 + Math.random() * 8000;
    }

    // Speech bubble timer
    if (this.speechTimer > 0) {
      this.speechTimer -= dt * 1000;
      if (this.speechTimer <= 0) {
        this.speechBubble = null;
      }
    }

    // Random movement within room
    if (this.state !== 'walking' && Math.random() < 0.003) {
      const wp = WAYPOINTS[this.currentRoom];
      this.targetX = wp.x + (Math.random() - 0.5) * 80;
      this.targetY = wp.y + (Math.random() - 0.5) * 50;
    }

    // Random room visit
    if (Math.random() < 0.001) {
      const rooms = Object.keys(WAYPOINTS);
      const target = rooms[Math.floor(Math.random() * rooms.length)];
      this.moveTo(target);
    }

    // Process action queue
    if (this.actionQueue.length > 0 && this.state !== 'walking') {
      const action = this.actionQueue.shift();
      action();
    }
  }
}

class InteractionLine {
  constructor(from, to, label, color) {
    this.fromId = from;
    this.toId = to;
    this.label = label;
    this.color = color;
    this.life = 3000;
    this.maxLife = 3000;
  }

  update(dt) {
    this.life -= dt * 1000;
  }

  get alpha() {
    return Math.max(0, this.life / this.maxLife);
  }

  get alive() {
    return this.life > 0;
  }
}

export default function OfficeWorld() {
  const canvasRef = useRef(null);
  const agentsRef = useRef(AGENT_DEFS.map((d) => new Agent(d)));
  const linesRef = useRef([]);
  const pizarraMessagesRef = useRef([]);
  const { events } = useEventStream();
  const lastEventCountRef = useRef(0);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  // Process incoming events
  useEffect(() => {
    if (events.length <= lastEventCountRef.current) return;
    const newEvents = events.slice(0, events.length - lastEventCountRef.current);
    lastEventCountRef.current = events.length;

    const agents = agentsRef.current;
    const findAgent = (id) => agents.find((a) => a.id === id);

    newEvents.forEach((event) => {
      const source = event.source_agent;
      const agent = findAgent(source);
      const type = event.event_type || '';

      // Add to pizarra
      pizarraMessagesRef.current.unshift({
        text: `[${source?.toUpperCase()}] ${type}`,
        time: Date.now(),
      });
      if (pizarraMessagesRef.current.length > 8) pizarraMessagesRef.current.pop();

      if (!agent) return;

      if (type === 'lead.created') {
        agent.say('Nuevo lead recibido!', 4000);
        agent.moveTo('pizarra');
        const crm = findAgent('crm');
        const ciber = findAgent('ciber');
        if (crm) {
          crm.actionQueue.push(() => {
            crm.moveTo('pizarra');
            crm.say('Procesando lead...', 3000);
          });
          linesRef.current.push(new InteractionLine('forms', 'crm', 'Nuevo Lead', '#b366ff'));
        }
        if (ciber) {
          ciber.actionQueue.push(() => {
            ciber.moveTo('pizarra');
            ciber.say('Verificando IP...', 3000);
          });
          linesRef.current.push(new InteractionLine('forms', 'ciber', 'Check IP', '#ff4466'));
        }
      }

      if (type === 'threat.detected') {
        agent.say(`Amenaza: ${event.payload?.type || '?'}`, 5000);
        agent.moveTo('cerebro');
        const crm = findAgent('crm');
        if (crm) {
          crm.actionQueue.push(() => {
            crm.moveTo('cerebro');
            crm.say('Verificando clientes...', 3000);
          });
          linesRef.current.push(new InteractionLine('ciber', 'crm', 'Cross-check', '#ff4466'));
        }
        linesRef.current.push(new InteractionLine('ciber', 'cerebro', 'ALERT', '#ff4466'));
      }

      if (type === 'tool.executed') {
        agent.say(`Tool: ${event.payload?.tool || '?'}`, 3000);
      }

      if (type === 'sale.closed') {
        const ops = findAgent('ops');
        if (ops) {
          ops.say('Venta cerrada! Calculando...', 4000);
          ops.moveTo('pizarra');
          linesRef.current.push(new InteractionLine('crm', 'ops', 'Venta!', '#00d68f'));
        }
      }
    });
  }, [events]);

  // Simulated autonomous behavior
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused) return;
      const agents = agentsRef.current;

      // Random interactions between agents
      if (Math.random() < 0.08) {
        const a = agents[Math.floor(Math.random() * agents.length)];
        const b = agents[Math.floor(Math.random() * agents.length)];
        if (a.id !== b.id) {
          const meetingRoom = Math.random() < 0.5 ? 'pizarra' : 'cerebro';
          a.moveTo(meetingRoom);
          a.say(`Consultando con ${b.name}...`, 3000);
          b.actionQueue.push(() => {
            b.moveTo(meetingRoom);
            b.say(`Respondiendo a ${a.name}...`, 3000);
          });
          linesRef.current.push(new InteractionLine(a.id, b.id, 'sync', '#00d4ff'));
        }
      }

      // Random pizarra messages
      if (Math.random() < 0.05) {
        const msgs = [
          '[SISTEMA] Heartbeat OK - todos los agentes activos',
          '[CEREBRO] Análisis programado ejecutándose...',
          '[CIBER] Scan periódico completado',
          '[CRM] Pipeline actualizado',
          '[OPS] Métricas recalculadas',
          '[FORMS] Webhook listener activo',
        ];
        pizarraMessagesRef.current.unshift({
          text: msgs[Math.floor(Math.random() * msgs.length)],
          time: Date.now(),
        });
        if (pizarraMessagesRef.current.length > 8) pizarraMessagesRef.current.pop();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let lastTime = performance.now();

    function draw(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      ctx.fillStyle = '#08080d';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid pattern
      ctx.strokeStyle = 'rgba(42, 42, 69, 0.3)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < CANVAS_W; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
      }
      for (let y = 0; y < CANVAS_H; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
      }

      // Draw rooms
      ROOMS.forEach((room) => {
        // Room fill
        ctx.fillStyle = room.color;
        ctx.fillRect(room.x, room.y, room.w, room.h);

        // Room border
        ctx.strokeStyle = room.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(room.x, room.y, room.w, room.h);

        // Glow effect
        ctx.shadowColor = room.border;
        ctx.shadowBlur = 15;
        ctx.strokeRect(room.x, room.y, room.w, room.h);
        ctx.shadowBlur = 0;

        // Room label
        ctx.fillStyle = room.border;
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${room.icon} ${room.label}`, room.x + 10, room.y + 20);
      });

      // Draw furniture
      FURNITURE.forEach((f) => {
        ctx.fillStyle = 'rgba(30, 30, 50, 0.8)';
        ctx.strokeStyle = 'rgba(80, 80, 120, 0.5)';
        ctx.lineWidth = 1;

        // Rounded rect
        const r = 4;
        ctx.beginPath();
        ctx.roundRect(f.x, f.y, f.w, f.h, r);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = 'rgba(136, 136, 168, 0.7)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.label, f.x + f.w / 2, f.y + f.h / 2 + 4);
      });

      // Draw pizarra messages
      const pMsgs = pizarraMessagesRef.current;
      const pRoom = ROOMS.find((r) => r.id === 'pizarra');
      pMsgs.forEach((msg, i) => {
        const age = (Date.now() - msg.time) / 1000;
        const alpha = Math.max(0.2, 1 - age / 60);
        ctx.fillStyle = `rgba(0, 212, 255, ${alpha * 0.8})`;
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(msg.text.slice(0, 55), pRoom.x + 15, pRoom.y + 40 + i * 22);
      });

      // Draw interaction lines
      const agents = agentsRef.current;
      linesRef.current = linesRef.current.filter((l) => l.alive);
      linesRef.current.forEach((line) => {
        line.update(dt);
        const from = agents.find((a) => a.id === line.fromId);
        const to = agents.find((a) => a.id === line.toId);
        if (!from || !to) return;

        ctx.strokeStyle = line.color;
        ctx.globalAlpha = line.alpha * 0.6;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on line
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        ctx.fillStyle = line.color;
        ctx.globalAlpha = line.alpha;
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(line.label, mx, my - 8);
        ctx.globalAlpha = 1;
      });

      // Update and draw agents
      agents.forEach((agent) => {
        if (!isPaused) agent.update(dt);

        // Trail
        agent.trail.forEach((t) => {
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = agent.color;
          ctx.globalAlpha = t.alpha * 0.3;
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Agent body - circle with glow
        const wobbleY = Math.sin(agent.wobble) * 2;

        // Shadow
        ctx.beginPath();
        ctx.ellipse(agent.x, agent.y + 18, 14, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Glow
        ctx.shadowColor = agent.color;
        ctx.shadowBlur = agent.state === 'walking' ? 20 : 12;

        // Body
        ctx.beginPath();
        ctx.arc(agent.x, agent.y + wobbleY, 16, 0, Math.PI * 2);
        ctx.fillStyle = agent.color + '30';
        ctx.fill();
        ctx.strokeStyle = agent.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Emoji
        ctx.font = '18px serif';
        ctx.textAlign = 'center';
        ctx.fillText(agent.emoji, agent.x, agent.y + wobbleY + 6);

        // Name tag
        ctx.fillStyle = agent.color;
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillText(agent.name, agent.x, agent.y + 34);

        // State indicator
        const stateColors = { idle: '#555', walking: '#ffaa00', working: '#00d68f', talking: '#4a9eff' };
        ctx.beginPath();
        ctx.arc(agent.x + 14, agent.y - 12 + wobbleY, 4, 0, Math.PI * 2);
        ctx.fillStyle = stateColors[agent.state] || '#555';
        ctx.fill();

        // Thought bubble (small, above agent)
        if (!agent.speechBubble) {
          ctx.fillStyle = 'rgba(136, 136, 168, 0.5)';
          ctx.font = '9px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(agent.thought, agent.x, agent.y - 24 + wobbleY);
        }

        // Speech bubble
        if (agent.speechBubble) {
          const text = agent.speechBubble;
          const tw = ctx.measureText(text).width + 20;
          const bx = agent.x - tw / 2;
          const by = agent.y - 55 + wobbleY;

          // Bubble background
          ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
          ctx.strokeStyle = agent.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 26, 8);
          ctx.fill();
          ctx.stroke();

          // Bubble pointer
          ctx.beginPath();
          ctx.moveTo(agent.x - 5, by + 26);
          ctx.lineTo(agent.x, by + 34);
          ctx.lineTo(agent.x + 5, by + 26);
          ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
          ctx.fill();

          // Text
          ctx.fillStyle = agent.color;
          ctx.font = '11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(text, agent.x, by + 17);
        }
      });

      // Cerebro room - animated brain
      const cRoom = ROOMS.find((r) => r.id === 'cerebro');
      const brainPulse = Math.sin(Date.now() / 500) * 0.3 + 0.7;
      ctx.font = '40px serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = brainPulse;
      ctx.fillText('🧠', cRoom.x + cRoom.w / 2, cRoom.y + 80);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('CLAUDE ORCHESTRATOR', cRoom.x + cRoom.w / 2, cRoom.y + 110);
      ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('claude-sonnet-4-6', cRoom.x + cRoom.w / 2, cRoom.y + 128);

      // Status bar at bottom
      ctx.fillStyle = 'rgba(10, 10, 15, 0.8)';
      ctx.fillRect(0, CANVAS_H - 24, CANVAS_W, 24);
      ctx.fillStyle = '#555';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      const statusParts = agents.map((a) => `${a.emoji} ${a.name}:${a.state}`);
      ctx.fillText(statusParts.join('  |  '), 10, CANVAS_H - 8);
      ctx.textAlign = 'right';
      ctx.fillText(`Líneas: ${linesRef.current.length}  |  Eventos: ${pMsgs.length}`, CANVAS_W - 10, CANVAS_H - 8);

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [isPaused]);

  // Click handler
  const handleClick = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const agents = agentsRef.current;
    for (const agent of agents) {
      const dx = mx - agent.x;
      const dy = mx - agent.y;
      if (Math.abs(mx - agent.x) < 20 && Math.abs(my - agent.y) < 25) {
        setSelectedAgent(agent.id === selectedAgent ? null : agent.id);
        return;
      }
    }
    setSelectedAgent(null);
  }, [selectedAgent]);

  // Trigger test events
  function triggerTestEvent(type) {
    const agents = agentsRef.current;
    if (type === 'lead') {
      const forms = agents.find((a) => a.id === 'forms');
      forms.say('Lead entrante desde landing!', 4000);
      forms.moveTo('pizarra');

      setTimeout(() => {
        const crm = agents.find((a) => a.id === 'crm');
        crm.moveTo('pizarra');
        crm.say('Asignando setter...', 3000);
        linesRef.current.push(new InteractionLine('forms', 'crm', 'Nuevo Lead', '#b366ff'));
      }, 1500);

      setTimeout(() => {
        const ciber = agents.find((a) => a.id === 'ciber');
        ciber.moveTo('cerebro');
        ciber.say('IP verificada: limpia', 3000);
        linesRef.current.push(new InteractionLine('forms', 'ciber', 'IP Check', '#ff4466'));
      }, 2500);

      pizarraMessagesRef.current.unshift({ text: '[FORMS] Nuevo lead: test@email.com', time: Date.now() });
    }

    if (type === 'threat') {
      const ciber = agents.find((a) => a.id === 'ciber');
      ciber.say('ALERTA: Brute Force detectado!', 5000);
      ciber.moveTo('cerebro');
      linesRef.current.push(new InteractionLine('ciber', 'cerebro', 'THREAT!', '#ff4466'));

      setTimeout(() => {
        const crm = agents.find((a) => a.id === 'crm');
        crm.moveTo('cerebro');
        crm.say('Verificando si es cliente...', 3000);
        linesRef.current.push(new InteractionLine('ciber', 'crm', 'Cross-check', '#4a9eff'));
      }, 2000);

      setTimeout(() => {
        const ops = agents.find((a) => a.id === 'ops');
        ops.moveTo('cerebro');
        ops.say('Auditando transacciones...', 3000);
        linesRef.current.push(new InteractionLine('ciber', 'ops', 'Audit', '#00d68f'));
      }, 3000);

      pizarraMessagesRef.current.unshift({ text: '[CIBER] ⚠️ Brute force desde 45.33.x.x', time: Date.now() });
    }

    if (type === 'sale') {
      const crm = agents.find((a) => a.id === 'crm');
      crm.say('Venta cerrada: $2,400!', 4000);
      crm.moveTo('pizarra');

      setTimeout(() => {
        const ops = agents.find((a) => a.id === 'ops');
        ops.moveTo('pizarra');
        ops.say('Comisión calculada: $360', 3000);
        linesRef.current.push(new InteractionLine('crm', 'ops', 'Venta $2,400', '#00d68f'));
      }, 1500);

      pizarraMessagesRef.current.unshift({ text: '[CRM] 💰 Venta cerrada $2,400 por @closer1', time: Date.now() });
    }

    if (type === 'sync') {
      agents.forEach((a) => {
        a.moveTo('cerebro');
        a.say('Sincronización general...', 4000);
      });
      agents.forEach((a, i) => {
        agents.forEach((b, j) => {
          if (i < j) {
            setTimeout(() => {
              linesRef.current.push(new InteractionLine(a.id, b.id, 'sync', '#00d4ff'));
            }, i * 500);
          }
        });
      });
      pizarraMessagesRef.current.unshift({ text: '[CEREBRO] 🧠 Sincronización completa del enjambre', time: Date.now() });
    }
  }

  const selAgent = agentsRef.current.find((a) => a.id === selectedAgent);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontWeight: 700, fontSize: 22 }}>
          Oficina Virtual del Enjambre
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setIsPaused(!isPaused)} style={btnStyle}>
            {isPaused ? '▶ Play' : '⏸ Pause'}
          </button>
          <button onClick={() => triggerTestEvent('lead')} style={{ ...btnStyle, borderColor: '#b366ff', color: '#b366ff' }}>
            Simular Lead
          </button>
          <button onClick={() => triggerTestEvent('threat')} style={{ ...btnStyle, borderColor: '#ff4466', color: '#ff4466' }}>
            Simular Amenaza
          </button>
          <button onClick={() => triggerTestEvent('sale')} style={{ ...btnStyle, borderColor: '#00d68f', color: '#00d68f' }}>
            Simular Venta
          </button>
          <button onClick={() => triggerTestEvent('sync')} style={{ ...btnStyle, borderColor: '#00d4ff', color: '#00d4ff' }}>
            Sync Total
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onClick={handleClick}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer' }}
        />
      </div>

      {/* Agent detail panel */}
      {selAgent && (
        <div style={{
          marginTop: 16, padding: 20, background: 'var(--bg-card)',
          border: `1px solid ${selAgent.color}`, borderRadius: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 28 }}>{selAgent.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: selAgent.color }}>{selAgent.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Estado: {selAgent.state} | Sala: {selAgent.currentRoom} | Pos: ({Math.round(selAgent.x)}, {Math.round(selAgent.y)})
              </div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Pensando: "{selAgent.thought}"
          </div>
          {selAgent.speechBubble && (
            <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 8, color: selAgent.color }}>
              Diciendo: "{selAgent.speechBubble}"
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div style={{
        marginTop: 16, padding: 16, background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: 12,
        display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)'
      }}>
        <span>🟢 Working</span>
        <span>🟡 Walking</span>
        <span>⚪ Idle</span>
        <span>--- Líneas = interacción entre agentes</span>
        <span>💬 Burbujas = acciones en tiempo real</span>
        <span>Click en agente = detalle</span>
      </div>
    </div>
  );
}

const btnStyle = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '8px 14px',
  color: 'var(--text-secondary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
};
