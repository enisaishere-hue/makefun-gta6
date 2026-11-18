// Drawing only: the world's state and the current screen in, pixels out. A camera
// follows the player over Port Meridian; the HUD, the minimap and the menus are
// drawn on top. Flat shapes, canvas text, and a warm late-afternoon light.
import { AVENUES, CAR, CONTROLS, FONT, PALETTE, ROAD_W, STREETS, WATER_TOP, WORLD } from './config.js';
import { currentMission, currentObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_STORY = 'story';

const MINIMAP = { w: 230, h: 172, margin: 16 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, dpr: 1, width: 0, height: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    view.dpr = ratio;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  // Screen (CSS) pixels -> world coordinates, for aiming with the mouse.
  function screenToWorld(sx, sy, state) {
    const cam = state.camera;
    const cx = view.width / 2;
    const cy = view.height / 2;
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    return {
      x: cam.x + (sx - cx - shx) / cam.zoom,
      y: cam.y + (sy - cy - shy) / cam.zoom,
    };
  }

  function drawCity(state, city) {
    const cam = state.camera;
    const vw = view.width / cam.zoom;
    const vh = view.height / cam.zoom;
    const x0 = cam.x - vw / 2 - 60;
    const y0 = cam.y - vh / 2 - 60;
    const x1 = cam.x + vw / 2 + 60;
    const y1 = cam.y + vh / 2 + 60;

    // Ground: grass, sand along the harbor, water to the south.
    context.fillStyle = PALETTE.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    const sandTop = Math.max(y0, WATER_TOP - 90);
    const sandBottom = Math.min(y1, WATER_TOP);
    if (sandBottom > sandTop) {
      context.fillStyle = PALETTE.sand;
      context.fillRect(x0, sandTop, x1 - x0, sandBottom - sandTop);
    }
    const waterTop = Math.max(y0, WATER_TOP);
    if (y1 > waterTop) {
      context.fillStyle = PALETTE.water;
      context.fillRect(x0, waterTop, x1 - x0, y1 - waterTop);
    }
    context.fillStyle = PALETTE.waterDeep;
    for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
      context.fillRect(x, WATER_TOP + 30 + ((x / 90) % 3) * 40, 46, 5);
    }
    // The pier.
    context.fillStyle = '#8a6b48';
    context.fillRect(1210, WATER_TOP - 130, 140, 130);
    context.fillStyle = '#6b543a';
    for (let y = WATER_TOP - 120; y < WATER_TOP; y += 18) context.fillRect(1210, y, 140, 3);

    // Roads and sidewalks.
    for (const ax of AVENUES) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(ax - ROAD_W / 2 - 14, y0, ROAD_W + 28, y1 - y0);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(ax - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    }
    for (const sy of STREETS) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(x0, sy - ROAD_W / 2 - 14, x1 - x0, ROAD_W + 28);
      context.fillStyle = PALETTE.asphalt;
      context.fillRect(x0, sy - ROAD_W / 2, x1 - x0, ROAD_W);
    }
    // Lane dashes.
    context.fillStyle = PALETTE.lane;
    for (const ax of AVENUES) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
        if (y > WATER_TOP) continue;
        context.fillRect(ax - 2, y, 4, 22);
      }
    }
    for (const sy of STREETS) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
        context.fillRect(x, sy - 2, 22, 4);
      }
    }

    // Blocks: parks, the plaza, and the buildings with lit windows.
    for (const block of city.blocks) {
      if (block.x > x1 || block.x + block.w < x0 || block.y > y1 || block.y + block.h < y0) continue;
      if (block.kind === 'park') {
        context.fillStyle = '#5d9448';
        context.fillRect(block.x, block.y, block.w, block.h);
        for (const t of block.trees) drawTree(t.x, t.y, t.r);
      } else if (block.kind === 'plaza') {
        context.fillStyle = '#b8a888';
        context.fillRect(block.x, block.y, block.w, block.h);
        context.fillStyle = '#8a7a5a';
        context.beginPath();
        context.arc(block.x + block.w / 2, block.y + block.h / 2, 26, 0, Math.PI * 2);
        context.fill();
      }
      for (const b of block.buildings) {
        context.fillStyle = 'rgba(0,0,0,0.25)';
        context.fillRect(b.x + 6, b.y + 8, b.w, b.h);
        context.fillStyle = b.color;
        context.fillRect(b.x, b.y, b.w, b.h);
        context.fillStyle = b.roof;
        context.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
        context.fillStyle = '#ffe9a8';
        const cols = Math.max(1, Math.floor(b.w / 22));
        const rows = Math.max(1, Math.floor(b.h / 24));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            if ((cx * 7 + cy * 3 + b.floors) % 3 === 0) {
              context.fillRect(b.x + 9 + cx * 22, b.y + 9 + cy * 24, 8, 10);
            }
          }
        }
      }
    }
    for (const t of city.trees) {
      if (t.x > x0 && t.x < x1 && t.y > y0 && t.y < y1) drawTree(t.x, t.y, t.r);
    }
  }

  function drawTree(x, y, r) {
    context.fillStyle = '#5a4632';
    context.fillRect(x - 2, y - 2, 4, 12);
    context.fillStyle = '#3f7a3a';
    context.beginPath();
    context.arc(x, y - 6, r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#4f8a44';
    context.beginPath();
    context.arc(x - r * 0.4, y - r * 0.5, r * 0.6, 0, Math.PI * 2);
    context.fill();
  }

  function drawCar(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    if (car.health < 40) {
      context.fillStyle = 'rgba(60,60,60,0.5)';
      context.beginPath();
      context.arc(-8, -14, 7 + Math.random() * 4, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#1a1a1a';
    context.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 - 3, 10, 6);
    context.fillRect(-CAR.length / 2 + 4, CAR.width / 2 - 3, 10, 6);
    context.fillRect(CAR.length / 2 - 14, -CAR.width / 2 - 3, 10, 6);
    context.fillRect(CAR.length / 2 - 14, CAR.width / 2 - 3, 10, 6);
    context.fillStyle = car.color;
    context.beginPath();
    context.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    context.fill();
    context.fillStyle = 'rgba(20,30,40,0.85)';
    context.beginPath();
    context.roundRect(-6, -CAR.width / 2 + 4, 16, CAR.width - 8, 4);
    context.fill();
    if (car.kind === 'police') {
      context.fillStyle = '#ffffff';
      context.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 2, CAR.length - 12, 5);
      context.fillStyle = '#ff3b30';
      context.fillRect(-4, -CAR.width / 2 - 1, 8, 4);
      context.fillStyle = '#2b4fd9';
      context.fillRect(-4, CAR.width / 2 - 3, 8, 4);
    }
    if (car.kind === 'van') {
      context.fillStyle = 'rgba(255,255,255,0.75)';
      context.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 4, 8, CAR.width - 8);
    }
    context.restore();
  }

  function drawPerson(x, y, angle, shirt, down, isPlayer) {
    context.save();
    context.translate(x, y);
    if (down) {
      context.rotate(Math.PI / 2);
      context.fillStyle = shirt;
      context.beginPath();
      context.ellipse(0, 0, 14, 8, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.rotate(angle);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = shirt;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(7, 0, 6, 0, Math.PI * 2);
    context.fill();
    if (isPlayer) {
      context.fillStyle = '#ffd94d';
      context.beginPath();
      context.arc(-4, -8, 3, 0, Math.PI * 2);
      context.arc(-4, 8, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawObjectiveMarker(state) {
    const o = currentObjective(state.missions);
    if (!o || !state.missions.active) return;
    const pulse = 1 + Math.sin(state.elapsed * 5) * 0.15;
    context.save();
    context.translate(o.x, o.y);
    context.scale(pulse, pulse);
    context.strokeStyle = '#ffd94d';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(0, -26);
    context.lineTo(16, 0);
    context.lineTo(0, 26);
    context.lineTo(-16, 0);
    context.closePath();
    context.stroke();
    context.fillStyle = 'rgba(255,217,77,0.25)';
    context.fill();
    context.restore();
    text(o.label, o.x, o.y - 38, 15, '#ffd94d', 'center', '700 ');
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(pk.bob) * 3;
      context.save();
      context.translate(pk.x, pk.y + bob);
      if (pk.kind === 'cash') {
        context.fillStyle = '#7fc94f';
        context.beginPath();
        context.arc(0, 0, 12, 0, Math.PI * 2);
        context.fill();
        text('$', 0, 5, 16, '#12340a', 'center', '700 ');
      } else if (pk.kind === 'ammo') {
        context.fillStyle = '#e8c33d';
        context.fillRect(-10, -6, 20, 12);
        text('AMMO', 0, 4, 9, '#3a2f00', 'center', '700 ');
      } else {
        context.fillStyle = '#ff6a6a';
        context.fillRect(-10, -10, 20, 20);
        context.fillStyle = '#ffffff';
        context.fillRect(-2, -7, 4, 14);
        context.fillRect(-7, -2, 14, 4);
      }
      context.restore();
    }
  }

  function drawMinimap(state, city) {
    const mw = MINIMAP.w;
    const mh = MINIMAP.h;
    const mx = view.width - mw - MINIMAP.margin;
    const my = MINIMAP.margin;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    context.save();
    context.fillStyle = 'rgba(10,14,20,0.78)';
    context.beginPath();
    context.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.25)';
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.rect(mx, my, mw, mh);
    context.clip();
    context.fillStyle = '#23301f';
    context.fillRect(mx, my, mw, mh);
    context.fillStyle = '#4a4f58';
    for (const ax of AVENUES) context.fillRect(mx + ax * sx - 2, my, 4, mh);
    for (const s of STREETS) context.fillRect(mx, my + s * sy - 2, mw, 4);
    context.fillStyle = '#2e7f9e';
    context.fillRect(mx, my + 1700 * sy, mw, mh - 1700 * sy);
    const o = currentObjective(state.missions);
    if (o && state.missions.active) {
      context.fillStyle = '#ffd94d';
      context.beginPath();
      context.arc(mx + o.x * sx, my + o.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const c of state.copCars) {
      context.fillStyle = '#5a8cff';
      context.beginPath();
      context.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();
    text('PORT MERIDIAN', mx + mw, my + mh + 20, 12, 'rgba(255,255,255,0.75)', 'right', '700 ');
  }

  function drawHud(state) {
    const p = state.player;
    // Cash and wanted stars, top-left (clear of the Roblox-style menu corner is
    // not a concern here, but the top-left stays readable on the contact sheet).
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.beginPath();
    context.roundRect(14, 12, 250, 64, 8);
    context.fill();
    text(`$${state.cash}`, 28, 40, 26, '#7fc94f', 'left', '700 ');
    for (let s = 0; s < 5; s += 1) {
      text('★', 28 + s * 26, 66, 20, s < state.wanted.stars ? '#ffd94d' : 'rgba(255,255,255,0.25)', 'left');
    }
    // Health, ammo and speed, bottom-left.
    context.fillStyle = 'rgba(10,14,20,0.72)';
    context.beginPath();
    context.roundRect(14, view.height - 58, 250, 44, 8);
    context.fill();
    context.fillStyle = '#3a3f4a';
    context.fillRect(28, view.height - 44, 120, 12);
    context.fillStyle = p.health > 30 ? '#7fc94f' : '#ff5a4d';
    context.fillRect(28, view.height - 44, 120 * Math.max(0, p.health) / 100, 12);
    text(p.car ? `${Math.round(Math.abs(p.car.speed) * 0.12)} mph` : `${p.ammo} / 12`, 160, view.height - 32, 16, '#ffffff', 'left', '700 ');
    if (p.car) text(`CAR ${Math.min(100, Math.max(0, Math.round(p.car.health)))}%`, 28, view.height - 22, 12, '#c9c9c9', 'left');
    else text('ON FOOT', 28, view.height - 22, 12, '#c9c9c9', 'left');

    // Mission line, top-center.
    const m = currentMission(state.missions);
    if (state.missions.active && m) {
      const o = currentObjective(state.missions);
      context.fillStyle = 'rgba(10,14,20,0.72)';
      const label = `${m.name} — ${o ? o.text : ''}`;
      const w = Math.min(view.width - 320, 34 + label.length * 7.2);
      context.beginPath();
      context.roundRect((view.width - w) / 2, 12, w, 34, 8);
      context.fill();
      text(label, view.width / 2, 35, 16, '#ffd94d', 'center', '700 ');
      if (state.missions.timer > 0) {
        text(`${Math.ceil(state.missions.timer)}s`, view.width / 2, 58, 15, '#ff8a7a', 'center', '700 ');
      }
    } else if (state.missions.freeRoam && !state.storyDone) {
      text('FREE ROAM — press Enter for the next job', view.width / 2, 34, 15, 'rgba(255,255,255,0.85)', 'center');
    }
    if (state.passenger) {
      text(`Passenger: ${state.passenger}`, view.width / 2, view.height - 24, 14, '#ffd94d', 'center', '700 ');
    }
    drawMinimap(state);
    // Flash messages.
    if (state.missionFlashT > 0) {
      context.fillStyle = 'rgba(10,14,20,0.72)';
      const w = Math.min(view.width - 200, 40 + state.missionFlash.length * 7.5);
      context.beginPath();
      context.roundRect((view.width - w) / 2, view.height - 118, w, 34, 8);
      context.fill();
      text(state.missionFlash, view.width / 2, view.height - 95, 16, '#ffffff', 'center');
    }
    if (state.bustedFlash > 0) {
      context.fillStyle = `rgba(20,40,160,${Math.min(0.55, state.bustedFlash * 0.3)})`;
      context.fillRect(0, 0, view.width, view.height);
      text('BUSTED', view.width / 2, view.height / 2, 64, '#ffffff', 'center', '900 ');
    }
    if (state.wastedFlash > 0) {
      context.fillStyle = `rgba(160,20,20,${Math.min(0.55, state.wastedFlash * 0.3)})`;
      context.fillRect(0, 0, view.width, view.height);
      text('WASTED', view.width / 2, view.height / 2, 64, '#ffffff', 'center', '900 ');
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const h = 150 + lines.length * 34;
    const x = (view.width - w) / 2;
    const y = (view.height - h) / 2;
    context.fillStyle = 'rgba(8,12,18,0.88)';
    context.beginPath();
    context.roundRect(x, y, w, h, 12);
    context.fill();
    context.strokeStyle = accent || '#ffd94d';
    context.lineWidth = 2;
    context.stroke();
    text(title, view.width / 2, y + 72, 46, accent || '#ffd94d', 'center', '900 ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], view.width / 2, y + 118 + i * 34, 19, 'rgba(255,255,255,0.9)', 'center');
    }
    if (prompt) text(prompt, view.width / 2, y + h - 26, 19, '#ffd94d', 'center', '700 ');
  }

  function drawWorld(state, city) {
    const cam = state.camera;
    const shx = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    context.fillStyle = '#10141c';
    context.fillRect(0, 0, view.width, view.height);
    context.setTransform(view.dpr * cam.zoom, 0, 0, view.dpr * cam.zoom,
      view.dpr * (view.width / 2 - cam.x * cam.zoom + shx), view.dpr * (view.height / 2 - cam.y * cam.zoom + shy));
    drawCity(state, city);
    drawObjectiveMarker(state);
    drawPickups(state);
    // Bullets under the cars, particles above everything.
    for (const b of state.bullets) {
      context.fillStyle = '#ffe9a8';
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) if (!car.dead) drawCar(car);
    for (const car of state.copCars) drawCar(car);
    for (const ped of state.peds) drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.state === 'down', false);
    for (const cop of state.footCops) if (!cop.dead) drawPerson(cop.x, cop.y, cop.angle, cop.shirt, false, false);
    const p = state.player;
    if (!p.car) {
      const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
      if (!blink) drawPerson(p.x, p.y, p.angle, '#3d7fd9', false, true);
    }
    for (const pt of state.particles) {
      context.globalAlpha = Math.max(0, pt.life * 1.6);
      context.fillStyle = pt.color;
      context.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    context.globalAlpha = 1;
    for (const f of state.floats) {
      context.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, 17, f.color, 'center', '700 ');
    }
    context.globalAlpha = 1;
    // Back to screen space for the HUD.
    context.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function draw(state, city, screen, extra) {
    resize();
    drawWorld(state, city);
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Port Meridian, 6:47 PM. Jax Marlowe owes the Harbor Kings $12,000.',
        'Delia Voss will clear the debt — one job at a time.',
        '',
        'WASD move / drive · Mouse aim · E enter car · F punch · R reload',
        'Steal cars, outrun the police, finish all four jobs.',
      ];
      drawPanel('NEON HARBOR', lines, 'Press Enter or click: 1 Story · 2 Free roam', '#ffd94d');
      if (extra && extra.best > 0) text(`Best cash: $${extra.best}`, view.width / 2, view.height / 2 + 190, 17, 'rgba(255,255,255,0.8)', 'center');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits for no one. Except now.'], 'Press P to resume · Enter restarts the story', '#7fc94f');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Game over', [`Cash kept: $${state.cash}`, `Jobs done: ${state.missions.index} of 4`], 'Press Enter to play again', '#ff5a4d');
    } else if (screen === SCREEN_STORY) {
      drawPanel('Story complete', ['The debt is paid. Port Meridian is yours, Jax.', `Final cash: $${state.cash}`], 'Press Enter for free roam', '#7fc94f');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
