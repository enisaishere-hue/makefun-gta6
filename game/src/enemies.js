// Neon Harbor — Harbor Kings enforcers: armed gang muscle who patrol the
// streets, chase the player on foot once he gets close, and shoot back.
// An enforcer who falls drops a cash roll; killing one raises the heat.
// They are the teeth of the Kings' Payback job and the final score.
import { hitsBuilding, collideCircle } from './world.js';
import { fireBullet, spawnParticles, spawnPickup, addFloater, addShake } from './combat.js';
import { addHeat } from './police.js';

export function makeEnemies() {
  return { list: [], backupTimer: 0 };
}

export function spawnEnforcer(enemies, x, y) {
  const e = {
    x, y, angle: 0, speed: 148, health: 68,
    fireCooldown: 0.8 + Math.random() * 0.8,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 0, walkPhase: Math.random() * 6,
    wx: x, wy: y, // wander target while the player is far away
  };
  enemies.list.push(e);
  return e;
}

export function spawnSquad(enemies, x, y, n) {
  for (let i = 0; i < n; i++) {
    spawnEnforcer(enemies, x + (Math.random() * 140 - 70), y + (Math.random() * 140 - 70));
  }
}

// A straight line is clear when no building stands between its ends.
function sightClear(city, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(d / 24));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (hitsBuilding(city, ax + (bx - ax) * t, ay + (by - ay) * t, 4)) return false;
  }
  return true;
}

// What an enforcer drops when he goes down: a cash roll on the pavement.
export function dropEnforcerLoot(S, e) {
  spawnPickup(S.combat, e.x, e.y, 'cash');
  addFloater(S.combat, e.x, e.y - 26, 'ENFORCER DOWN', '#e74c3c');
  addHeat(S.wanted, 1);
  S.sfx.pickup();
}

export function updateEnemies(enemies, S, dt) {
  const p = S.player, city = S.city;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;

  // The Kings send backup while the heat is high: at most two extra guns
  // on the street, never spawned on top of the player — and never during
  // Kings' Payback, where the job's own squad is the objective: backup
  // arriving mid-job would make the "Left: N" count grow instead of fall.
  enemies.backupTimer -= dt;
  if (S.wanted.stars >= 3 && S.missions.index !== 4 && enemies.list.length < 2 && enemies.backupTimer <= 0) {
    enemies.backupTimer = 14;
    const a = Math.random() * Math.PI * 2;
    spawnEnforcer(enemies, px + Math.cos(a) * 520, py + Math.sin(a) * 520);
  }

  for (const e of enemies.list) {
    const dx = px - e.x, dy = py - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    e.fireCooldown -= dt;
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = 0.7 + Math.random() * 0.9;
      e.strafeDir *= -1;
    }
    if (dist > 650) {
      // Too far to care: drift around the block they started on.
      const wd = Math.hypot(e.wx - e.x, e.wy - e.y);
      if (wd < 24) {
        e.wx = e.x + (Math.random() * 320 - 160);
        e.wy = e.y + (Math.random() * 320 - 160);
      }
      const wa = Math.atan2(e.wy - e.y, e.wx - e.x);
      e.x += Math.cos(wa) * e.speed * 0.4 * dt;
      e.y += Math.sin(wa) * e.speed * 0.4 * dt;
    } else if (dist > 300) {
      // Close the distance, cutting straight across the street.
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else {
      // In range: strafe sideways and shoot when the lane is clear.
      const sa = e.angle + (Math.PI / 2) * e.strafeDir;
      e.x += Math.cos(sa) * e.speed * 0.55 * dt;
      e.y += Math.sin(sa) * e.speed * 0.55 * dt;
      if (e.fireCooldown <= 0 && sightClear(city, e.x, e.y, px, py)) {
        e.fireCooldown = 1.15 + Math.random() * 0.8;
        fireBullet(S.combat, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.14, false);
        S.sfx.shot();
      }
    }
    const fixed = collideCircle(city, e.x, e.y, 11);
    e.x = fixed.x; e.y = fixed.y;
    e.walkPhase += dt * 9;
  }

  // Enemy bullets only hurt a player on foot; a car shrugs them off.
  for (const b of S.combat.bullets) {
    if (b.fromPlayer || b.life <= 0) continue;
    if (!p.inCar && Math.hypot(b.x - p.x, b.y - p.y) < 15) {
      b.life = 0;
      p.health -= 6;
      spawnParticles(S.combat, p.x, p.y, '#e74c3c', 6, 130);
      addShake(S.combat, 3);
      addHeat(S.wanted, 0.05);
    }
  }
  enemies.list = enemies.list.filter((e) => e.health > 0);
}

export function drawEnemies(ctx, enemies, cam) {
  for (const e of enemies.list) {
    const x = e.x - cam.x, y = e.y - cam.y;
    if (x < -30 || y < -30 || x > 1310 || y > 750) continue;
    const wob = Math.sin(e.walkPhase) * 2;
    ctx.fillStyle = '#00000033';
    ctx.beginPath(); ctx.ellipse(x, y + 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Maroon jacket, gold chain, gun out.
    ctx.fillStyle = '#5a1f1f';
    ctx.beginPath(); ctx.arc(x, y + wob * 0.3, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + wob * 0.3, 11, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(x + Math.cos(e.angle) * 4, y + Math.sin(e.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c2733'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(e.angle) * 8, y + Math.sin(e.angle) * 8);
    ctx.lineTo(x + Math.cos(e.angle) * 20, y + Math.sin(e.angle) * 20);
    ctx.stroke();
    if (e.health < 68) {
      ctx.fillStyle = '#222';
      ctx.fillRect(x - 13, y - 24, 26, 4);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(x - 13, y - 24, 26 * Math.max(0, e.health) / 68, 4);
    }
  }
}
