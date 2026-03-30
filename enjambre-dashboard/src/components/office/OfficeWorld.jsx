import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useEventStream } from '../../hooks/useEventStream.js';

const CANVAS_W = 1200;
const CANVAS_H = 750;
const PX = 3;
const TILE = 16;

// ============================================
// PIXEL ART CHARACTER SPRITES (10x12)
// 0=transparent 1=hair 2=skin 3=eyes 4=shirt 5=pants 6=shoes 7=mouth
// ============================================
const SPRITE_IDLE = [
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,1,2,2,2,2,1,0,0],
  [0,0,2,3,2,2,3,2,0,0],
  [0,0,2,2,7,7,2,2,0,0],
  [0,0,0,2,2,2,2,0,0,0],
  [0,0,4,4,4,4,4,4,0,0],
  [0,4,4,4,4,4,4,4,4,0],
  [0,0,4,4,4,4,4,4,0,0],
  [0,0,0,5,5,5,5,0,0,0],
  [0,0,0,5,0,0,5,0,0,0],
  [0,0,0,6,0,0,6,0,0,0],
];
const SPRITE_WALK1 = [
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,1,2,2,2,2,1,0,0],
  [0,0,2,3,2,2,3,2,0,0],
  [0,0,2,2,7,7,2,2,0,0],
  [0,0,0,2,2,2,2,0,0,0],
  [0,0,4,4,4,4,4,4,0,0],
  [0,4,4,4,4,4,4,4,4,0],
  [0,0,4,4,4,4,4,4,0,0],
  [0,0,5,5,0,0,5,5,0,0],
  [0,0,5,0,0,0,0,5,0,0],
  [0,6,0,0,0,0,0,0,6,0],
];
const SPRITE_WALK2 = [
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,1,2,2,2,2,1,0,0],
  [0,0,2,3,2,2,3,2,0,0],
  [0,0,2,2,7,7,2,2,0,0],
  [0,0,0,2,2,2,2,0,0,0],
  [0,0,4,4,4,4,4,4,0,0],
  [0,4,4,4,4,4,4,4,4,0],
  [0,0,4,4,4,4,4,4,0,0],
  [0,0,0,5,5,5,0,0,0,0],
  [0,0,0,0,5,0,5,0,0,0],
  [0,0,0,0,6,0,0,6,0,0],
];
const WALK_FRAMES = [SPRITE_IDLE, SPRITE_WALK1, SPRITE_IDLE, SPRITE_WALK2];

// ============================================
// OFFICE ROOMS — designed as actual office spaces
// ============================================
const ROOMS = [
  { id: 'soc',        x: 16,  y: 16,  w: 224, h: 200, label: 'CIBER / SOC',     border: '#EF4444', doorX: 130, doorSide: 'bottom' },
  { id: 'crm',        x: 256, y: 16,  w: 224, h: 200, label: 'CRM / VENTAS',    border: '#3B82F6', doorX: 368, doorSide: 'bottom' },
  { id: 'ops',        x: 496, y: 16,  w: 224, h: 200, label: 'OPS / ERP',       border: '#22C55E', doorX: 608, doorSide: 'bottom' },
  { id: 'forms',      x: 736, y: 16,  w: 200, h: 200, label: 'FORMS',           border: '#A855F7', doorX: 836, doorSide: 'bottom' },
  { id: 'prospector', x: 952, y: 16,  w: 232, h: 200, label: 'PROSPECTOR',      border: '#EC4899', doorX: 1068, doorSide: 'bottom' },
  { id: 'comms',      x: 16,  y: 232, w: 280, h: 200, label: 'DISCORD / COMMS', border: '#5865F2', doorX: 156, doorSide: 'bottom' },
  { id: 'pizarra',    x: 312, y: 232, w: 480, h: 200, label: 'SALA DE REUNIONES',border: '#FF6B00', doorX: 552, doorSide: 'bottom' },
  { id: 'cerebro',    x: 808, y: 232, w: 376, h: 200, label: 'SALA DEL CEREBRO', border: '#FF6B00', doorX: 996, doorSide: 'bottom' },
  { id: 'dcc',        x: 16,  y: 448, w: 288, h: 200, label: 'DCC / LANDING',   border: '#F59E0B', doorX: 160, doorSide: 'top' },
  { id: 'email',      x: 320, y: 448, w: 288, h: 200, label: 'EMAIL MKT',       border: '#F97316', doorX: 464, doorSide: 'top' },
  { id: 'developer',  x: 624, y: 448, w: 280, h: 200, label: 'DEV AGENT',       border: '#10B981', doorX: 764, doorSide: 'top' },
  { id: 'logs',       x: 920, y: 448, w: 264, h: 200, label: 'CENTRO DE LOGS',  border: '#555',    doorX: 1052, doorSide: 'top' },
];

const WAYPOINTS = {
  soc: { x: 128, y: 130 }, crm: { x: 368, y: 130 }, ops: { x: 608, y: 130 },
  forms: { x: 836, y: 130 }, prospector: { x: 1068, y: 130 },
  comms: { x: 156, y: 340 }, pizarra: { x: 552, y: 340 }, cerebro: { x: 996, y: 340 },
  dcc: { x: 160, y: 550 }, email: { x: 464, y: 550 }, developer: { x: 764, y: 550 }, logs: { x: 1052, y: 550 },
};

// ============================================
// OFFICE FURNITURE per room
// ============================================
const OFFICE_OBJECTS = [
  // SOC — monitors wall, desk
  { room: 'soc', type: 'desk_long', x: 40, y: 70, w: 100, h: 20 },
  { room: 'soc', type: 'monitor', x: 50, y: 50, w: 24, h: 20 },
  { room: 'soc', type: 'monitor', x: 80, y: 50, w: 24, h: 20 },
  { room: 'soc', type: 'monitor', x: 110, y: 50, w: 24, h: 20 },
  { room: 'soc', type: 'chair', x: 65, y: 95 },
  { room: 'soc', type: 'chair', x: 105, y: 95 },
  { room: 'soc', type: 'plant', x: 200, y: 170 },
  // CRM — desk pods
  { room: 'crm', type: 'desk_pod', x: 280, y: 65, w: 70, h: 50 },
  { room: 'crm', type: 'desk_pod', x: 380, y: 65, w: 70, h: 50 },
  { room: 'crm', type: 'whiteboard', x: 280, y: 160, w: 80, h: 6 },
  { room: 'crm', type: 'plant', x: 450, y: 170 },
  // OPS — big table
  { room: 'ops', type: 'table_big', x: 520, y: 80, w: 120, h: 40 },
  { room: 'ops', type: 'chart_board', x: 660, y: 40, w: 40, h: 50 },
  { room: 'ops', type: 'chair', x: 545, y: 130 },
  { room: 'ops', type: 'chair', x: 595, y: 130 },
  { room: 'ops', type: 'chair', x: 545, y: 70 },
  // FORMS — inbox, single desk
  { room: 'forms', type: 'desk_long', x: 760, y: 80, w: 80, h: 20 },
  { room: 'forms', type: 'monitor', x: 775, y: 60, w: 24, h: 20 },
  { room: 'forms', type: 'inbox_tray', x: 870, y: 70, w: 30, h: 35 },
  // PROSPECTOR — research station
  { room: 'prospector', type: 'desk_long', x: 976, y: 75, w: 100, h: 20 },
  { room: 'prospector', type: 'monitor', x: 990, y: 55, w: 24, h: 20 },
  { room: 'prospector', type: 'monitor', x: 1040, y: 55, w: 24, h: 20 },
  { room: 'prospector', type: 'bookshelf', x: 1140, y: 40, w: 30, h: 60 },
  // COMMS — communication hub
  { room: 'comms', type: 'desk_pod', x: 40, y: 280, w: 70, h: 50 },
  { room: 'comms', type: 'server_rack', x: 220, y: 260, w: 40, h: 60 },
  { room: 'comms', type: 'plant', x: 260, y: 390 },
  // PIZARRA — meeting room
  { room: 'pizarra', type: 'table_big', x: 450, y: 290, w: 180, h: 50 },
  { room: 'pizarra', type: 'whiteboard', x: 340, y: 250, w: 120, h: 8 },
  { room: 'pizarra', type: 'chair', x: 470, y: 350 },
  { room: 'pizarra', type: 'chair', x: 520, y: 350 },
  { room: 'pizarra', type: 'chair', x: 570, y: 350 },
  { room: 'pizarra', type: 'chair', x: 620, y: 350 },
  { room: 'pizarra', type: 'plant', x: 760, y: 390 },
  // CEREBRO — server room
  { room: 'cerebro', type: 'server_rack', x: 840, y: 260, w: 50, h: 70 },
  { room: 'cerebro', type: 'server_rack', x: 900, y: 260, w: 50, h: 70 },
  { room: 'cerebro', type: 'server_rack', x: 1100, y: 260, w: 50, h: 70 },
  { room: 'cerebro', type: 'desk_long', x: 960, y: 380, w: 80, h: 20 },
  // DCC — sync station
  { room: 'dcc', type: 'desk_pod', x: 50, y: 490, w: 70, h: 50 },
  { room: 'dcc', type: 'server_rack', x: 220, y: 475, w: 40, h: 60 },
  { room: 'dcc', type: 'plant', x: 270, y: 610 },
  // EMAIL — campaign desk
  { room: 'email', type: 'desk_long', x: 345, y: 500, w: 100, h: 20 },
  { room: 'email', type: 'monitor', x: 360, y: 480, w: 24, h: 20 },
  { room: 'email', type: 'monitor', x: 410, y: 480, w: 24, h: 20 },
  { room: 'email', type: 'inbox_tray', x: 550, y: 490, w: 30, h: 35 },
  // DEVELOPER — dev station
  { room: 'developer', type: 'desk_long', x: 650, y: 500, w: 100, h: 20 },
  { room: 'developer', type: 'monitor', x: 660, y: 478, w: 28, h: 22 },
  { room: 'developer', type: 'monitor', x: 700, y: 478, w: 28, h: 22 },
  { room: 'developer', type: 'monitor', x: 740, y: 478, w: 28, h: 22 },
  { room: 'developer', type: 'chair', x: 700, y: 530 },
  { room: 'developer', type: 'bookshelf', x: 860, y: 470, w: 30, h: 60 },
  { room: 'developer', type: 'plant', x: 640, y: 610 },
  // LOGS — log screens
  { room: 'logs', type: 'monitor', x: 950, y: 470, w: 30, h: 24 },
  { room: 'logs', type: 'monitor', x: 1000, y: 470, w: 30, h: 24 },
  { room: 'logs', type: 'monitor', x: 1050, y: 470, w: 30, h: 24 },
  { room: 'logs', type: 'desk_long', x: 940, y: 495, w: 160, h: 20 },
];

// ============================================
// DRAW FUNCTIONS
// ============================================
function drawPixelSprite(ctx, sprite, x, y, palette, scale) {
  sprite.forEach((row, py) => {
    row.forEach((idx, px) => {
      if (idx === 0) return;
      ctx.fillStyle = palette[idx];
      ctx.fillRect(Math.round(x + px * scale), Math.round(y + py * scale), scale, scale);
    });
  });
}

function drawRoom(ctx, room, time) {
  const r = room;
  // Floor — wood/carpet tiles
  for (let tx = r.x + 4; tx < r.x + r.w - 4; tx += TILE) {
    for (let ty = r.y + 24; ty < r.y + r.h - 4; ty += TILE) {
      const w = Math.min(TILE, r.x + r.w - 4 - tx);
      const h = Math.min(TILE, r.y + r.h - 4 - ty);
      const checker = (Math.floor((tx - r.x) / TILE) + Math.floor((ty - r.y) / TILE)) % 2;
      ctx.fillStyle = checker ? '#121214' : '#0F0F11';
      ctx.fillRect(tx, ty, w, h);
      // Tile border
      ctx.fillStyle = '#0A0A0C';
      ctx.fillRect(tx, ty, w, 1);
      ctx.fillRect(tx, ty, 1, h);
    }
  }

  // Walls — thick with shading
  const bc = room.border;
  // Top wall
  ctx.fillStyle = '#1A1A1E';
  ctx.fillRect(r.x, r.y, r.w, 22);
  ctx.fillStyle = '#222226';
  ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, 18);
  // Wall trim (color accent)
  ctx.fillStyle = bc + '50';
  ctx.fillRect(r.x, r.y + 20, r.w, 3);

  // Side walls
  ctx.fillStyle = '#161618';
  ctx.fillRect(r.x, r.y, 4, r.h);
  ctx.fillRect(r.x + r.w - 4, r.y, 4, r.h);
  // Bottom wall
  ctx.fillStyle = '#161618';
  ctx.fillRect(r.x, r.y + r.h - 4, r.w, 4);

  // Door gap
  ctx.fillStyle = '#0E0E10';
  const dx = r.doorX - 16;
  if (r.doorSide === 'bottom') {
    ctx.fillRect(dx, r.y + r.h - 4, 32, 4);
    // Door mat
    ctx.fillStyle = bc + '20';
    ctx.fillRect(dx + 2, r.y + r.h - 8, 28, 4);
  } else {
    ctx.fillRect(dx, r.y, 32, 4);
    ctx.fillStyle = bc + '20';
    ctx.fillRect(dx + 2, r.y + 4, 28, 4);
  }

  // Room label (on wall)
  ctx.fillStyle = bc;
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(r.label, r.x + 8, r.y + 15);

  // Ceiling light
  const lightX = r.x + r.w / 2;
  const lightFlicker = 0.03 + Math.sin(time / 800 + r.x) * 0.01;
  ctx.fillStyle = `rgba(255, 255, 255, ${lightFlicker})`;
  ctx.beginPath();
  ctx.ellipse(lightX, r.y + 40, r.w * 0.3, 20, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFurniture(ctx, f, time) {
  if (f.type === 'desk_long') {
    ctx.fillStyle = '#2A2018'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#352A1E'; ctx.fillRect(f.x + 1, f.y + 1, f.w - 2, 3); // top shine
    ctx.fillStyle = '#1A1408'; // legs
    ctx.fillRect(f.x + 3, f.y + f.h, 3, 8);
    ctx.fillRect(f.x + f.w - 6, f.y + f.h, 3, 8);
  }
  else if (f.type === 'desk_pod') {
    ctx.fillStyle = '#252018'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#302820'; ctx.fillRect(f.x + 1, f.y + 1, f.w - 2, 2);
    // Divider
    ctx.fillStyle = '#333'; ctx.fillRect(f.x + f.w / 2 - 1, f.y, 2, f.h);
  }
  else if (f.type === 'table_big') {
    ctx.fillStyle = '#1E1A14'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#28221A'; ctx.fillRect(f.x + 2, f.y + 2, f.w - 4, 3);
    ctx.fillStyle = '#151008';
    ctx.fillRect(f.x + 4, f.y + f.h, 4, 10);
    ctx.fillRect(f.x + f.w - 8, f.y + f.h, 4, 10);
    ctx.fillRect(f.x + 4, f.y + f.h, f.w - 8, 2);
  }
  else if (f.type === 'monitor') {
    ctx.fillStyle = '#1A1A1E'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#0A1018'; ctx.fillRect(f.x + 2, f.y + 2, f.w - 4, f.h - 6);
    // Screen glow scanlines
    const flicker = Math.sin(time / 200 + f.x) * 0.5 + 0.5;
    for (let i = 0; i < f.h - 8; i += 2) {
      ctx.fillStyle = `rgba(0, 180, 255, ${0.03 * flicker})`;
      ctx.fillRect(f.x + 2, f.y + 2 + i, f.w - 4, 1);
    }
    // Text on screen
    ctx.fillStyle = `rgba(0, 200, 255, ${0.15 + flicker * 0.1})`;
    ctx.fillRect(f.x + 4, f.y + 5, f.w * 0.6, 2);
    ctx.fillRect(f.x + 4, f.y + 9, f.w * 0.4, 2);
    // Stand
    ctx.fillStyle = '#222'; ctx.fillRect(f.x + f.w / 2 - 2, f.y + f.h, 4, 5);
  }
  else if (f.type === 'chair') {
    ctx.fillStyle = '#1E1E22';
    ctx.fillRect(f.x, f.y, 16, 12); // seat
    ctx.fillStyle = '#252528';
    ctx.fillRect(f.x + 2, f.y - 10, 12, 12); // back
    ctx.fillStyle = '#151518';
    ctx.fillRect(f.x + 6, f.y + 12, 4, 4); // pole
  }
  else if (f.type === 'plant') {
    // Pot
    ctx.fillStyle = '#4A2A1A'; ctx.fillRect(f.x, f.y + 8, 14, 10);
    ctx.fillStyle = '#5A3420'; ctx.fillRect(f.x + 1, f.y + 6, 12, 3);
    // Leaves
    ctx.fillStyle = '#1A4A1A'; ctx.fillRect(f.x + 2, f.y - 2, 10, 10);
    ctx.fillStyle = '#226622'; ctx.fillRect(f.x + 4, f.y - 4, 6, 6);
    ctx.fillStyle = '#2A7A2A'; ctx.fillRect(f.x + 5, f.y - 2, 4, 4);
  }
  else if (f.type === 'whiteboard') {
    ctx.fillStyle = '#F8F8F0'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#DDD'; ctx.fillRect(f.x, f.y, f.w, 1);
    ctx.fillStyle = '#CCC'; ctx.fillRect(f.x, f.y + f.h - 1, f.w, 1);
    // Scribbles
    ctx.fillStyle = '#E44'; ctx.fillRect(f.x + 5, f.y + 2, 20, 1);
    ctx.fillStyle = '#44E'; ctx.fillRect(f.x + 5, f.y + 4, 30, 1);
    ctx.fillStyle = '#4A4'; ctx.fillRect(f.x + 40, f.y + 2, 15, 1);
  }
  else if (f.type === 'server_rack') {
    ctx.fillStyle = '#0A0A10'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#131318';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(f.x + 3, f.y + 4 + i * 13, f.w - 6, 10);
    }
    // Blinking lights
    for (let i = 0; i < 5; i++) {
      const on = Math.sin(time / 300 + i * 1.5 + f.x) > 0;
      ctx.fillStyle = on ? '#22C55E' : '#0A0A0A';
      ctx.fillRect(f.x + f.w - 8, f.y + 6 + i * 13, 3, 3);
      const on2 = Math.sin(time / 400 + i * 2 + f.x) > 0.3;
      ctx.fillStyle = on2 ? '#FF6B00' : '#0A0A0A';
      ctx.fillRect(f.x + f.w - 12, f.y + 6 + i * 13, 3, 3);
    }
  }
  else if (f.type === 'inbox_tray') {
    ctx.fillStyle = '#222228'; ctx.fillRect(f.x, f.y, f.w, f.h);
    // Paper stacks
    ctx.fillStyle = '#E8E4D8'; ctx.fillRect(f.x + 3, f.y + 3, f.w - 6, 4);
    ctx.fillStyle = '#DDD8CC'; ctx.fillRect(f.x + 3, f.y + 12, f.w - 6, 4);
    ctx.fillStyle = '#D0CCBB'; ctx.fillRect(f.x + 3, f.y + 21, f.w - 6, 4);
  }
  else if (f.type === 'bookshelf') {
    ctx.fillStyle = '#2A1E14'; ctx.fillRect(f.x, f.y, f.w, f.h);
    // Shelves
    ctx.fillStyle = '#352818';
    ctx.fillRect(f.x, f.y + 15, f.w, 3);
    ctx.fillRect(f.x, f.y + 35, f.w, 3);
    // Books
    const bookColors = ['#4444AA', '#AA3333', '#33AA44', '#AA8833', '#8833AA', '#33AAAA'];
    for (let s = 0; s < 2; s++) {
      for (let b = 0; b < 4; b++) {
        ctx.fillStyle = bookColors[(s * 4 + b) % bookColors.length];
        ctx.fillRect(f.x + 3 + b * 6, f.y + 3 + s * 20, 5, 12);
      }
    }
  }
  else if (f.type === 'chart_board') {
    ctx.fillStyle = '#0E0E12'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(f.x, f.y, f.w, f.h);
    const h1 = 12 + Math.sin(time / 2000) * 5;
    const h2 = 20 + Math.sin(time / 1500 + 1) * 5;
    const h3 = 16 + Math.sin(time / 1800 + 2) * 5;
    ctx.fillStyle = '#22C55E'; ctx.fillRect(f.x + 5, f.y + f.h - h1, 8, h1);
    ctx.fillStyle = '#3B82F6'; ctx.fillRect(f.x + 16, f.y + f.h - h2, 8, h2);
    ctx.fillStyle = '#FF6B00'; ctx.fillRect(f.x + 27, f.y + f.h - h3, 8, h3);
  }
}

// ============================================
// HALLWAY (corridor between rooms)
// ============================================
function drawHallway(ctx) {
  // Horizontal corridors
  ctx.fillStyle = '#0D0D0F';
  ctx.fillRect(16, 216, CANVAS_W - 32, 16); // between row 1 & 2
  ctx.fillRect(16, 432, CANVAS_W - 32, 16); // between row 2 & 3

  // Floor pattern in corridors
  for (let x = 16; x < CANVAS_W - 16; x += 32) {
    ctx.fillStyle = '#101012';
    ctx.fillRect(x, 218, 14, 12);
    ctx.fillRect(x + 16, 218, 14, 12);
    ctx.fillRect(x, 434, 14, 12);
    ctx.fillRect(x + 16, 434, 14, 12);
  }

  // Corridor lights
  for (let x = 80; x < CANVAS_W; x += 160) {
    ctx.fillStyle = 'rgba(255,200,100,0.03)';
    ctx.beginPath();
    ctx.ellipse(x, 224, 40, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, 440, 40, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================
// AGENT DEFINITIONS
// ============================================
const AGENT_DEFS = [
  { id: 'cerebro', name: 'CEREBRO', homeRoom: 'cerebro', hair: '#FF6B00', shirt: '#FF6B00', pants: '#8B4000', shoes: '#4A2800',
    thoughts: ['Orquestando...', 'Correlaciones...', 'Decision tree...', 'Coordinando...', 'Tool chain...'] },
  { id: 'ciber', name: 'CIBER', homeRoom: 'soc', hair: '#222', shirt: '#EF4444', pants: '#7F1D1D', shoes: '#450A0A',
    thoughts: ['Trafico red...', 'IPs sospechosas...', 'Suricata...', 'Amenazas...', 'Puertos...'] },
  { id: 'crm', name: 'CRM', homeRoom: 'crm', hair: '#6B4400', shirt: '#3B82F6', pants: '#1E3A5F', shoes: '#0F1D30',
    thoughts: ['Pipeline...', 'Leads a setters...', 'Conversion...', 'Clasificando...', 'Closers...'] },
  { id: 'ops', name: 'OPS', homeRoom: 'ops', hair: '#333', shirt: '#22C55E', pants: '#14532D', shoes: '#052E16',
    thoughts: ['Comisiones...', 'Revenue...', 'Proyecciones...', 'Auditando...', 'Targets...'] },
  { id: 'forms', name: 'FORMS', homeRoom: 'forms', hair: '#4A3060', shirt: '#A855F7', pants: '#581C87', shoes: '#3B0764',
    thoughts: ['Esperando forms...', 'Validando...', 'UTMs...', 'Email check...', 'Dedup...'] },
  { id: 'discord', name: 'DISCORD', homeRoom: 'comms', hair: '#2C2F7A', shirt: '#5865F2', pants: '#3B3F8C', shoes: '#23264F',
    thoughts: ['Escuchando...', 'Comando...', 'Al Cerebro...', 'Respondiendo...', 'Roles...'] },
  { id: 'dcc', name: 'DCC', homeRoom: 'dcc', hair: '#6B4E00', shirt: '#F59E0B', pants: '#854D0E', shoes: '#4A3000',
    thoughts: ['Polling 30s...', 'Sync leads...', 'Dedup...', 'Insert CRM...', 'Supabase...'] },
  { id: 'prospector', name: 'PROSPECT', homeRoom: 'prospector', hair: '#6B2040', shirt: '#EC4899', pants: '#831843', shoes: '#500724',
    thoughts: ['Buscando B2B...', 'Enriqueciendo...', 'Scraping...', 'Emails...', 'TMview...'] },
  { id: 'developer', name: 'DEV', homeRoom: 'developer', hair: '#1A3A2A', shirt: '#10B981', pants: '#065F46', shoes: '#022C22',
    thoughts: ['Analizando codigo...', 'Optimizando...', 'Review PR...', 'Git push...', 'Refactoring...', 'Testing...'] },
];

function lerp(a, b, t) { return a + (b - a) * t; }

class Agent {
  constructor(def) {
    this.id = def.id; this.name = def.name; this.homeRoom = def.homeRoom;
    this.palette = { 1: def.hair, 2: '#E8C4A0', 3: '#1A1A1A', 4: def.shirt, 5: def.pants, 6: def.shoes, 7: '#D4A574' };
    this.thoughts = def.thoughts;
    const wp = WAYPOINTS[def.homeRoom];
    this.x = wp.x + (Math.random() - 0.5) * 30; this.y = wp.y + (Math.random() - 0.5) * 20;
    this.targetX = this.x; this.targetY = this.y; this.currentRoom = def.homeRoom;
    this.thought = this.thoughts[0]; this.thoughtTimer = Math.random() * 5000;
    this.speechBubble = null; this.speechTimer = 0; this.state = 'idle';
    this.frame = 0; this.frameTimer = 0; this.trail = []; this.actionQueue = []; this.history = [];
  }
  moveTo(room) { const wp = WAYPOINTS[room]; if (!wp) return; this.targetX = wp.x + (Math.random() - 0.5) * 50; this.targetY = wp.y + (Math.random() - 0.5) * 30; this.currentRoom = room; this.state = 'walking'; }
  say(text, dur = 4000) { this.speechBubble = text; this.speechTimer = dur; this.history.unshift({ text, time: Date.now() }); if (this.history.length > 20) this.history.pop(); }
  update(dt) {
    const dist = Math.sqrt((this.targetX - this.x) ** 2 + (this.targetY - this.y) ** 2);
    if (dist > 2) {
      this.x = lerp(this.x, this.targetX, 0.022); this.y = lerp(this.y, this.targetY, 0.022);
      this.state = 'walking'; this.frameTimer += dt;
      if (this.frameTimer > 0.18) { this.frame = (this.frame + 1) % 4; this.frameTimer = 0; }
      if (!this.trail.length || Math.abs(this.x - this.trail[this.trail.length - 1].x) > 10) { this.trail.push({ x: this.x, y: this.y, alpha: 0.3 }); if (this.trail.length > 6) this.trail.shift(); }
    } else { if (this.state === 'walking') this.state = 'working'; this.frame = 0; }
    this.trail.forEach(t => t.alpha *= 0.94); this.trail = this.trail.filter(t => t.alpha > 0.02);
    this.thoughtTimer -= dt * 1000;
    if (this.thoughtTimer <= 0) { this.thought = this.thoughts[Math.floor(Math.random() * this.thoughts.length)]; this.thoughtTimer = 5000 + Math.random() * 8000; }
    if (this.speechTimer > 0) { this.speechTimer -= dt * 1000; if (this.speechTimer <= 0) this.speechBubble = null; }
    if (this.state !== 'walking' && Math.random() < 0.002) { const wp = WAYPOINTS[this.currentRoom]; this.targetX = wp.x + (Math.random() - 0.5) * 40; this.targetY = wp.y + (Math.random() - 0.5) * 25; }
    if (this.actionQueue.length > 0 && this.state !== 'walking') this.actionQueue.shift()();
  }
}

class InteractionLine {
  constructor(f, t, l, c) { this.fromId = f; this.toId = t; this.label = l; this.color = c; this.life = 3500; this.maxLife = 3500; }
  update(dt) { this.life -= dt * 1000; }
  get alpha() { return Math.max(0, this.life / this.maxLife); }
  get alive() { return this.life > 0; }
}

// ============================================
// COMPONENT
// ============================================
export default function OfficeWorld() {
  const canvasRef = useRef(null);
  const agentsRef = useRef(AGENT_DEFS.map(d => new Agent(d)));
  const linesRef = useRef([]);
  const pizarraRef = useRef([]);
  const { events } = useEventStream();
  const lastEvtRef = useRef(0);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (events.length <= lastEvtRef.current) return;
    const nw = events.slice(0, events.length - lastEvtRef.current);
    lastEvtRef.current = events.length;
    const A = agentsRef.current, F = id => A.find(a => a.id === id);
    nw.forEach(ev => {
      const s = ev.source_agent, a = F(s), t = ev.event_type || '';
      pizarraRef.current.unshift({ text: `[${(s||'?').toUpperCase()}] ${t}`, time: Date.now() });
      if (pizarraRef.current.length > 10) pizarraRef.current.pop();
      if (!a) return;
      if (t === 'lead.created') { a.say('Nuevo lead!', 4000); a.moveTo('pizarra'); const c = F('crm'); if (c) { c.actionQueue.push(() => { c.moveTo('pizarra'); c.say('Procesando...', 3000); }); linesRef.current.push(new InteractionLine(s, 'crm', 'Lead', '#A855F7')); } }
      if (t === 'threat.detected') { a.say('AMENAZA!', 5000); a.moveTo('cerebro'); linesRef.current.push(new InteractionLine('ciber', 'cerebro', 'ALERT', '#EF4444')); }
      if (t === 'tool.executed') a.say(`${ev.payload?.tool || '?'}`, 3000);
      if (t === 'sale.closed') { const o = F('ops'); if (o) { o.say('Comision!', 4000); o.moveTo('pizarra'); linesRef.current.push(new InteractionLine('crm', 'ops', 'Venta', '#22C55E')); } }
      if (t === 'chat.discord') { const d = F('discord'); if (d) { d.say('Discord msg', 3000); d.moveTo('cerebro'); linesRef.current.push(new InteractionLine('discord', 'cerebro', 'Chat', '#5865F2')); } }
      if (t.startsWith('agent.')) { a.say(t.replace('agent.', ''), 3000); a.moveTo('pizarra'); linesRef.current.push(new InteractionLine(s, 'cerebro', t.replace('agent.', ''), '#FF6B00')); }
    });
  }, [events]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (isPaused) return;
      const A = agentsRef.current, F = id => A.find(a => a.id === id);
      if (Math.random() < 0.02) F('dcc').say('Polling...', 2000);
      if (Math.random() < 0.015) { const c = F('cerebro'), t = A[Math.floor(Math.random() * A.length)]; if (t.id !== 'cerebro') { c.say(`Query ${t.name}`, 2500); linesRef.current.push(new InteractionLine('cerebro', t.id, 'query', '#FF6B00')); t.actionQueue.push(() => t.say('OK', 2000)); } }
      if (Math.random() < 0.01) { F('prospector').say('Buscando...', 3000); F('prospector').moveTo('prospector'); }
      if (Math.random() < 0.02) { const a = A[Math.floor(Math.random() * A.length)]; if (a.currentRoom !== a.homeRoom) a.moveTo(a.homeRoom); }
      if (Math.random() < 0.025) { const m = ['[SYS] Heartbeat OK', '[CEREBRO] OK', '[DCC] Sync 0', '[DISCORD] On']; pizarraRef.current.unshift({ text: m[Math.floor(Math.random() * m.length)], time: Date.now() }); if (pizarraRef.current.length > 10) pizarraRef.current.pop(); }
    }, 3000);
    return () => clearInterval(iv);
  }, [isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    let animId, last = performance.now();
    function draw(now) {
      const dt = (now - last) / 1000; last = now;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Outer background
      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Hallways
      drawHallway(ctx);

      // Rooms
      ROOMS.forEach(r => drawRoom(ctx, r, now));

      // Furniture
      OFFICE_OBJECTS.forEach(f => drawFurniture(ctx, f, now));

      // Pizarra text
      const pr = ROOMS.find(r => r.id === 'pizarra');
      pizarraRef.current.forEach((m, i) => {
        const alpha = Math.max(0.15, 1 - (Date.now() - m.time) / 60000);
        ctx.fillStyle = `rgba(255,107,0,${alpha * 0.65})`; ctx.font = '8px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
        ctx.fillText(m.text.slice(0, 55), pr.x + 10, pr.y + 34 + i * 14);
      });

      // Logs
      const lr = ROOMS.find(r => r.id === 'logs');
      const hist = []; agentsRef.current.forEach(a => a.history.slice(0, 3).forEach(h => hist.push({ n: a.name, c: a.palette[4], t: h.text, d: h.time })));
      hist.sort((a, b) => b.d - a.d);
      hist.slice(0, 11).forEach((h, i) => {
        const al = Math.max(0.1, 1 - (Date.now() - h.d) / 120000); ctx.globalAlpha = al;
        ctx.fillStyle = h.c; ctx.font = 'bold 7px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
        ctx.fillText(`[${h.n}]`, lr.x + 8, lr.y + 30 + i * 14);
        ctx.fillStyle = '#666'; ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillText(h.t.slice(0, 42), lr.x + 80, lr.y + 30 + i * 14);
        ctx.globalAlpha = 1;
      });

      // Lines
      const agents = agentsRef.current;
      linesRef.current = linesRef.current.filter(l => l.alive);
      linesRef.current.forEach(l => {
        l.update(dt); const f = agents.find(a => a.id === l.fromId), t = agents.find(a => a.id === l.toId);
        if (!f || !t) return;
        ctx.strokeStyle = l.color; ctx.globalAlpha = l.alpha * 0.35; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = l.color; ctx.globalAlpha = l.alpha * 0.7; ctx.font = 'bold 7px Inter'; ctx.textAlign = 'center';
        ctx.fillText(l.label, (f.x + t.x) / 2, (f.y + t.y) / 2 - 4); ctx.globalAlpha = 1;
      });

      // Agents
      agents.forEach(agent => {
        if (!isPaused) agent.update(dt);
        // Trail
        agent.trail.forEach(t => { ctx.fillStyle = agent.palette[4]; ctx.globalAlpha = t.alpha * 0.2; ctx.fillRect(Math.round(t.x) - 1, Math.round(t.y) + 12, 2, 2); }); ctx.globalAlpha = 1;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(agent.x, agent.y + 18, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
        // Sprite
        drawPixelSprite(ctx, agent.state === 'walking' ? WALK_FRAMES[agent.frame] : SPRITE_IDLE, agent.x - 15, agent.y - 18, agent.palette, PX);
        // Name
        ctx.fillStyle = agent.palette[4]; ctx.font = 'bold 10px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(agent.name, agent.x, agent.y + 28);
        // State dot
        ctx.fillStyle = agent.state === 'working' ? '#22C55E' : agent.state === 'walking' ? '#FFB800' : '#555';
        ctx.fillRect(Math.round(agent.x) + 12, Math.round(agent.y) - 16, 3, 3);
        // Thought
        if (!agent.speechBubble && agent.state !== 'walking') {
          ctx.fillStyle = 'rgba(120,120,120,0.6)'; ctx.font = '9px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(agent.thought, agent.x, agent.y - 24);
        }
        // Speech bubble
        if (agent.speechBubble) {
          ctx.font = '10px "JetBrains Mono", monospace';
          const tw = ctx.measureText(agent.speechBubble).width + 14, bx = Math.round(agent.x - tw / 2), by = Math.round(agent.y - 46);
          ctx.fillStyle = '#0A0A0A'; ctx.fillRect(bx, by, tw, 20);
          ctx.fillStyle = agent.palette[4]; ctx.fillRect(bx, by, tw, 2); ctx.fillRect(bx, by + 18, tw, 2); ctx.fillRect(bx, by, 2, 20); ctx.fillRect(bx + tw - 2, by, 2, 20);
          ctx.fillRect(Math.round(agent.x) - 2, by + 20, 4, 4);
          ctx.textAlign = 'center'; ctx.fillText(agent.speechBubble, agent.x, by + 14);
        }
      });

      // Cerebro brain
      const cr = ROOMS.find(r => r.id === 'cerebro');
      ctx.fillStyle = Math.sin(now / 400) > 0 ? '#FF6B00' : '#CC5500';
      ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.fillText('🧠', cr.x + cr.w / 2, cr.y + 55);
      ctx.fillStyle = '#FF6B00'; ctx.font = 'bold 7px "JetBrains Mono", monospace'; ctx.fillText('CLAUDE ORCHESTRATOR', cr.x + cr.w / 2, cr.y + 68);

      // Status bar
      ctx.fillStyle = '#080808'; ctx.fillRect(0, CANVAS_H - 18, CANVAS_W, 18);
      ctx.fillStyle = '#3A3A3A'; ctx.font = '7px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
      ctx.fillText(agents.map(a => `${a.name}${a.state === 'working' ? '●' : a.state === 'walking' ? '◎' : '○'}`).join(' '), 8, CANVAS_H - 5);
      ctx.textAlign = 'right'; ctx.fillText(`${linesRef.current.length} links | 9 agentes`, CANVAS_W - 8, CANVAS_H - 5);

      animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [isPaused]);

  const handleClick = useCallback(e => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (CANVAS_W / r.width), my = (e.clientY - r.top) * (CANVAS_H / r.height);
    for (const a of agentsRef.current) { if (Math.abs(mx - a.x) < 18 && Math.abs(my - a.y) < 22) { setSelectedAgent(a.id === selectedAgent ? null : a.id); return; } }
    setSelectedAgent(null);
  }, [selectedAgent]);

  function test(type) {
    const A = agentsRef.current, F = id => A.find(a => a.id === id);
    if (type === 'lead') { F('forms').say('Lead!', 4000); F('forms').moveTo('pizarra'); setTimeout(() => { F('crm').moveTo('pizarra'); F('crm').say('Setter asignado', 3000); linesRef.current.push(new InteractionLine('forms', 'crm', 'Lead', '#A855F7')); }, 1500); }
    if (type === 'threat') { F('ciber').say('Brute Force!', 5000); F('ciber').moveTo('cerebro'); linesRef.current.push(new InteractionLine('ciber', 'cerebro', 'THREAT', '#EF4444')); setTimeout(() => { F('ops').moveTo('cerebro'); F('ops').say('Audit...', 3000); }, 2000); }
    if (type === 'sale') { F('crm').say('$2,400!', 4000); F('crm').moveTo('pizarra'); setTimeout(() => { F('ops').moveTo('pizarra'); F('ops').say('$360', 3000); linesRef.current.push(new InteractionLine('crm', 'ops', '$2.4K', '#22C55E')); }, 1500); }
    if (type === 'sync') { A.forEach(a => { a.moveTo('cerebro'); a.say('Sync', 3000); }); A.forEach((a, i) => { if (a.id !== 'cerebro') setTimeout(() => linesRef.current.push(new InteractionLine('cerebro', a.id, 'sync', '#FF6B00')), i * 200); }); }
  }

  const sel = agentsRef.current.find(a => a.id === selectedAgent);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>
          <span className="title-gradient">Oficina Virtual</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>BlackWolf HQ</span>
        </h2>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => setIsPaused(!isPaused)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.7rem' }}>{isPaused ? '▶' : '⏸'}</button>
          <button onClick={() => test('lead')} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.7rem', borderColor: '#A855F7', color: '#A855F7' }}>Lead</button>
          <button onClick={() => test('threat')} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.7rem', borderColor: '#EF4444', color: '#EF4444' }}>Amenaza</button>
          <button onClick={() => test('sale')} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.7rem', borderColor: '#22C55E', color: '#22C55E' }}>Venta</button>
          <button onClick={() => test('sync')} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.7rem', borderColor: '#FF6B00', color: '#FF6B00' }}>Sync</button>
        </div>
      </div>
      <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} onClick={handleClick}
          style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer', imageRendering: 'pixelated' }} />
      </div>
      {sel && (
        <div className="agent-detail-panel fade-in" style={{ marginTop: 10, borderColor: sel.palette[4] + '30' }}>
          <div className="agent-detail-header">
            <div className="agent-detail-title-row">
              <canvas ref={el => { if (!el) return; const c = el.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 36, 42); drawPixelSprite(c, SPRITE_IDLE, 3, 3, sel.palette, 3); }} width={36} height={42} style={{ imageRendering: 'pixelated' }} />
              <div>
                <h3 className="agent-detail-name" style={{ color: sel.palette[4] }}>{sel.name}</h3>
                <span className="agent-detail-sub">{sel.state} | {sel.currentRoom}</span>
              </div>
              <button className="agent-detail-close" onClick={() => setSelectedAgent(null)}>✕</button>
            </div>
            {sel.thought && <p className="agent-detail-desc">"{sel.thought}"</p>}
            {sel.speechBubble && <p style={{ marginTop: 4, padding: '4px 8px', background: sel.palette[4] + '10', borderRadius: 4, color: sel.palette[4], fontSize: '0.8rem' }}>"{sel.speechBubble}"</p>}
          </div>
          <div className="agent-detail-section">
            <div className="agent-detail-section-title">📜 Historial</div>
            <div className="agent-detail-history">
              {sel.history.length === 0 ? <div className="agent-history-empty">Sin actividad</div> : sel.history.map((h, i) => (
                <div key={i} className="agent-history-item">
                  <span className="agent-history-time">{new Date(h.time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span className="agent-history-text">{h.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
