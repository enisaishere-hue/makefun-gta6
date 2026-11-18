// Neon Harbor — everything on screen: the city, the cars, the people, the
// HUD with its minimap, and the title / pause / game-over screens.
import { WORLD_W, WORLD_H, ROAD_W, AVENUES, STREETS, PALETTE, DEBT_TOTAL, MISSION_NAMES } from './config.js';
import { districtAt } from './world.js';

export function drawWorld(ctx, city, cam, time) {
  const { x: cx, y: cy } = cam;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, 1280, 720);
  // Mow stripes for the grass.
  ctx.fillStyle = PALETTE.grassDark;
  for (let gy = 0; gy < WORLD_H; gy += 160) {
    const sy = gy - cy;
    if (sy > -160 && sy < 720) ctx.fillRect(0, sy, 1280, 80);
  }
  for (const park of city.parks) {
    ctx.fillStyle = '#3a7d44';
    ctx.fillRect(park.x - cx, park.y - cy, park.w, park.h);
    ctx.fillStyle = '#2a6b34';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(park.x - cx + park.w * (0.25 + i * 0.25), park.y - cy + park.h * 0.5, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const lot of city.lots) {
    ctx.fillStyle = '#6a6e75';
    ctx.fillRect(lot.x - cx, lot.y - cy, lot.w, lot.h);
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 2;
    for (let i = 0; i < Math.floor(lot.w / 46); i++) {
      ctx.beginPath();
      ctx.moveTo(lot.x - cx + 12 + i * 46, lot.y - cy + 10);
      ctx.lineTo(lot.x - cx + 12 + i * 46, lot.y - cy + 34);
      ctx.stroke();
    }
  }
  // Harbor water + piers.
  const w = city.harbor.water;
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(w.x - cx, w.y - cy, w.w, w.h);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let i = 0; i < 24; i++) {
    const wx = ((i * 173 + time * 12) % WORLD_W) - cx;
    ctx.fillRect(wx, w.y - cy + 20 + (i % 4) * 26, 60, 3);
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, w.y - cy - 8, 1280, 8);
  for (const pier of city.harbor.piers) {
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(pier.x - cx, pier.y - cy, pier.w, pier.h);
  }
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_W / 2 - cx, -cy, ROAD_W, WORLD_H);
  for (const sy of STREETS) ctx.fillRect(-cx, sy - ROAD_W / 2 - cy, WORLD_W, ROAD_W);
  ctx.fillStyle = PALETTE.sidewalk;
  for (const ax of AVENUES) {
    ctx.fillRect(ax - ROAD_W / 2 - 10 - cx, -cy, 10, WORLD_H);
    ctx.fillRect(ax + ROAD_W / 2 - cx, -cy, 10, WORLD_H);
  }
  for (const sy of STREETS) {
    ctx.fillRect(-cx, sy - ROAD_W / 2 - 10 - cy, WORLD_W, 10);
    ctx.fillRect(-cx, sy + ROAD_W / 2 - cy, WORLD_W, 10);
  }
  // Center dashes.
  ctx.fillStyle = PALETTE.roadLine;
  for (const ax of AVENUES) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(ax - 2 - cx, y - cy, 4, 30);
  }
  for (const sy of STREETS) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x - cx, sy - 2 - cy, 30, 4);
  }
  // Buildings with lit windows at night.
  for (const b of city.buildings) {
    const bx = b.x - cx, by = b.y - cy;
    if (bx > 1280 || by > 720 || bx + b.w < 0 || by + b.h < 0) continue;
    ctx.fillStyle = '#00000033';
    ctx.fillRect(bx + 6, by + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge; ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, b.w, b.h);
    ctx.fillStyle = '#ffffff22';
    ctx.fillRect(bx + 6, by + 6, b.w - 12, 10);
    if (b.lit) {
      ctx.fillStyle = '#ffd76a';
      const cols = Math.max(1, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (((i * 7 + j * 3 + (b.x | 0)) % 5) < 2) ctx.fillRect(bx + 10 + i * 34, by + 22 + j * 34, 12, 14);
      }
    }
  }
  // Landmark labels.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('HOSPITAL', city.hospital.x - cx + 14, city.hospital.y - cy + 60);
  ctx.fillText('DELIA\'S GARAGE', city.garage.x - cx + 8, city.garage.y - cy + 55);
}

export function drawCar(ctx, car, cam, time) {
  const x = car.x - cam.x, y = car.y - cam.y;
  if (x < -60 || y < -60 || x > 1340 || y > 780) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(car.angle);
  ctx.fillStyle = '#00000044';
  ctx.fillRect(-22, -12, 46, 28);
  ctx.fillStyle = car.color;
  roundRect(ctx, -24, -13, 48, 26, 7); ctx.fill();
  ctx.fillStyle = '#1c2733';
  roundRect(ctx, -8, -11, 16, 22, 4); ctx.fill();
  ctx.fillStyle = '#dfe9f2';
  ctx.fillRect(14, -11, 4, 22);
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(22, -11, 3, 5); ctx.fillRect(22, 6, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-25, -11, 3, 5); ctx.fillRect(-25, 6, 3, 5);
  if (car.special === 'police') {
    ctx.fillStyle = '#2c4a8a';
    ctx.fillRect(-6, -13, 12, 26);
    const blink = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#2d7dff';
    ctx.beginPath(); ctx.arc(0, -6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = blink ? '#2d7dff' : '#ff2d2d';
    ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (car.special === 'comet') {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText('COMET S', -18, 4);
  }
  if (car.special === 'armored') {
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(-24, -4, 48, 8);
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.fillText('ARMORED', -20, 3);
  }
  ctx.restore();
  if (car.smoke > 0 && Math.random() < car.smoke * 0.5) {
    ctx.fillStyle = '#88888888';
    ctx.beginPath();
    ctx.arc(x + (Math.random() * 20 - 10), y + (Math.random() * 20 - 10), 6 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.dead) {
    ctx.fillStyle = '#00000088';
    ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff6b35';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('WRECK', x - 20, y - 30);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawPlayer(ctx, p, cam, time) {
  const x = p.x - cam.x, y = p.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);
  const bob = p.moving ? Math.sin(time * 14) * 2 : 0;
  ctx.fillStyle = '#00000044';
  ctx.beginPath(); ctx.ellipse(0, 6, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.playerJacket;
  ctx.beginPath(); ctx.arc(0, bob * 0.3, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(6, -4, 12, 8);
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(2, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawPed(ctx, ped, cam) {
  const x = ped.x - cam.x, y = ped.y - cam.y;
  if (x < -20 || y < -20 || x > 1300 || y > 740) return;
  const wob = Math.sin(ped.walkPhase) * 2;
  ctx.fillStyle = '#00000033';
  ctx.beginPath(); ctx.ellipse(x, y + 7, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(x, y + wob * 0.3, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(x + Math.cos(ped.angle) * 3, y + Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2); ctx.fill();
  if (ped.panic > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('!', x + 9, y - 10);
  }
}

export function drawCop(ctx, cop, cam) {
  const x = cop.x - cam.x, y = cop.y - cam.y;
  ctx.fillStyle = '#00000033';
  ctx.beginPath(); ctx.ellipse(x, y + 7, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.copBlue;
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(x + Math.cos(cop.angle) * 4, y + Math.sin(cop.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(x - 6, y - 14, 12, 4);
  if (cop.arrestHold > 0) {
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(x - 14, y - 26, 28 * Math.min(1, cop.arrestHold / 1.4), 4);
  }
}

export function drawCombat(ctx, combat, cam) {
  for (const pk of combat.pickups) {
    const x = pk.x - cam.x, y = pk.y - cam.y + Math.sin(pk.bob) * 3;
    if (x < -20 || y < -20 || x > 1300 || y > 740) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pk.kind === 'cash' ? '#2ecc71' : pk.kind === 'ammo' ? '#f1c40f' : '#e74c3c';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'ammo' ? 'A' : '+', 0, 4);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  for (const b of combat.bullets) {
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - cam.x - b.vx * 0.012, b.y - cam.y - b.vy * 0.012);
    ctx.lineTo(b.x - cam.x, b.y - cam.y);
    ctx.stroke();
  }
  for (const pt of combat.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of combat.floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x - cam.x, f.y - cam.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

export function drawTarget(ctx, target, cam, time) {
  if (!target) return;
  const x = target.x - cam.x, y = target.y - cam.y;
  const pulse = 1 + Math.sin(time * 5) * 0.15;
  if (x > -40 && y > -40 && x < 1320 && y < 760) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 4;
    const s = 16 * pulse;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.label || 'GO', x, y - 26);
    ctx.textAlign = 'left';
  }
}

export function drawHUD(ctx, S) {
  const p = S.player;
  ctx.fillStyle = '#00000088';
  ctx.fillRect(0, 0, 1280, 46);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('$' + p.cash.toLocaleString('en-US'), 16, 32);
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('DEBT $' + (DEBT_TOTAL - S.earned).toLocaleString('en-US'), 130, 30);
  // Wanted stars.
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < S.wanted.stars ? '#ffd76a' : '#555';
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('★', 330 + i * 30, 32);
  }
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(500, 14, 150, 16);
  ctx.fillStyle = p.health > 30 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(500, 14, 150 * Math.max(0, p.health) / 100, 16);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.ceil(Math.max(0, p.health)), 505, 26);
  // Ammo / speed.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px system-ui, sans-serif';
  if (p.inCar) {
    const sp = Math.round(Math.hypot(p.inCar.vx, p.inCar.vy) * 0.22);
    ctx.fillText(sp + ' MPH', 690, 31);
    ctx.fillText('CAR ' + Math.ceil(p.inCar.health) + '%', 780, 31);
  } else {
    ctx.fillText('AMMO ' + p.ammo + ' / ' + p.reserve, 690, 31);
  }
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(districtAt(S.city, p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y), 900, 30);
  ctx.fillText(S.timeStr, 1080, 30);
  // Caches found.
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('CACHES ' + S.collectibles.found + '/' + S.collectibles.total, 1150, 30);
  // Mission line.
  if (S.missions.text) {
    ctx.fillStyle = '#00000099';
    ctx.fillRect(16, 56, 700, 30);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    let line = 'JOB ' + (S.missions.index + 1) + '/7 — ' + MISSION_NAMES[Math.min(6, S.missions.index)] + ': ' + S.missions.text;
    if (S.missions.timer > 0) line += '  [' + Math.ceil(S.missions.timer) + 's]';
    ctx.fillText(line.slice(0, 110), 24, 76);
  }
  // Controls hint.
  ctx.fillStyle = '#ffffffaa';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move/drive · Mouse aim · Click shoot · F punch · R reload · E enter car · Shift sprint · Space handbrake · P pause · M mute', 16, 708);
  drawMinimap(ctx, S);
}

export function drawMinimap(ctx, S) {
  const mw = 220, mh = 165, mx = 1280 - mw - 14, my = 720 - mh - 14;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.fillStyle = '#000000aa';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#1d4a2a';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#555';
  for (const ax of AVENUES) ctx.fillRect(mx + ax * sx - 2, my, 4, mh);
  for (const sy2 of STREETS) ctx.fillRect(mx, my + sy2 * sy - 2, mw, 4);
  ctx.fillStyle = '#1d5f8a';
  ctx.fillRect(mx, my + 1780 * sy, mw, mh - 1780 * sy);
  const p = S.player;
  const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
  if (S.missions.target) {
    const tx = mx + S.missions.target.x * sx, ty = my + S.missions.target.y * sy;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(tx, ty, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const car of S.police.cars) {
    ctx.fillStyle = '#2d7dff';
    ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(mx + px * sx, my + py * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(mx + px * sx, my + py * sy, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('PORT MERIDIAN', mx + 4, my + 14);
}

function screenPanel(ctx, title, lines, accent) {
  ctx.fillStyle = '#000000d8';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = accent || '#ffd76a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 640, 200);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, 640, 260 + i * 36));
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, S) {
  // A live city backdrop behind the title: draw the world at the start spot.
  drawWorld(ctx, S.city, S.cam, S.time);
  ctx.fillStyle = '#0000008c';
  ctx.fillRect(0, 0, 1280, 720);
  // Neon frame.
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, 1224, 664);
  ctx.strokeStyle = '#ff2d78';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, 1208, 648);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 88px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEON HARBOR', 640, 190);
  ctx.fillStyle = '#ff2d78';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('PORT MERIDIAN', 640, 232);
  ctx.fillStyle = '#fff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Jax Marlowe owes the Harbor Kings $12,000.', 640, 300);
  ctx.fillText('Fixer Delia Voss has seven jobs that pay it down.', 640, 332);
  ctx.fillText('Steal cars. Outrun the law. Survive the night.', 640, 364);
  ctx.fillStyle = '#2ecc71';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Gunfights with the Kings · live synth music · day & night · 8 hidden caches', 640, 412);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(S.save.jobsDone > 0 || S.save.cash > 40 ? 'Press ENTER to continue — ' + S.save.jobsDone + '/7 jobs done' : 'Press ENTER to start', 640, 478);
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('WASD move & drive · Mouse aim · Click shoot · F punch · E enter car · P pause · M mute', 640, 526);
  ctx.fillText('Find the caches, finish the jobs, and the debt is gone.', 640, 556);
  ctx.textAlign = 'left';
}

export function drawPause(ctx) {
  screenPanel(ctx, 'PAUSED', ['Press P to keep playing', 'M mute · R reload · E enter or leave a car'], '#9fb4c8');
}

export function drawBusted(ctx, fine) {
  screenPanel(ctx, 'BUSTED', ['The Port Meridian police hauled you in.', 'Fine: $' + fine + ' — you wake up at the hospital.', 'Press ENTER to walk free'], '#2d7dff');
}

export function drawWasted(ctx, fine) {
  screenPanel(ctx, 'WASTED', ['You flatlined on a Meridian street.', 'Hospital bill: $' + fine, 'Press ENTER to get back up'], '#e74c3c');
}

export function drawStoryDone(ctx, S) {
  screenPanel(ctx, 'STORY COMPLETE', [
    'All seven jobs done. The Harbor Kings are paid, and Jax walks free.',
    'Cash earned: $' + S.earned.toLocaleString('en-US') + ' · Jobs: 7/7 · Debt: $0',
    'Free roam continues — press ENTER to keep playing Port Meridian',
  ], '#2ecc71');
}
