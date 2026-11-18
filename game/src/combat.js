// Neon Harbor — combat and juice: bullets, blood, sparks, smoke, floating
// damage numbers, screen shake, and the cash/ammo/health pickups.
import { hitsBuilding } from './world.js';

export function makeCombat() {
  return {
    bullets: [],
    particles: [],
    floaters: [],
    pickups: [],
    skids: [], // tyre marks: {x1, y1, x2, y2, life} — laid by hard driving
    shake: 0,
    pickupTimer: 0,
  };
}

// A short dark tyre mark between two points, fading over a few seconds.
export function addSkid(combat, x1, y1, x2, y2) {
  if (combat.skids.length > 240) combat.skids.shift();
  combat.skids.push({ x1, y1, x2, y2, life: 6 });
}

export function fireBullet(combat, x, y, angle, fromPlayer) {
  combat.bullets.push({
    x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900,
    life: 0.9, fromPlayer,
  });
}

export function spawnParticles(combat, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 140) * (0.4 + Math.random() * 0.8);
    combat.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.5, maxLife: 0.9,
      color, size: 2 + Math.random() * 3,
    });
  }
}

export function addFloater(combat, x, y, text, color) {
  combat.floaters.push({ x, y, text, color: color || '#fff', life: 1.1 });
}

export function addShake(combat, amount) {
  combat.shake = Math.min(14, combat.shake + amount);
}

export function spawnPickup(combat, x, y, kind) {
  combat.pickups.push({ x, y, kind, bob: Math.random() * Math.PI * 2 });
}

export function seedPickups(combat, city, rng) {
  const kinds = ['cash', 'ammo', 'health', 'cash', 'ammo', 'health', 'cash'];
  for (let i = 0; i < 26; i++) {
    const x = 120 + rng() * 2320, y = 120 + rng() * 1680;
    spawnPickup(combat, x, y, kinds[i % kinds.length]);
  }
}

export function updateCombat(combat, city, dt, player) {
  // Bullets fly, die on walls, and are tested by the caller against targets.
  for (const b of combat.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (hitsBuilding(city, b.x, b.y, 2)) {
      b.life = 0;
      spawnParticles(combat, b.x, b.y, '#c9c9c9', 5, 90);
    }
  }
  combat.bullets = combat.bullets.filter((b) => b.life > 0);
  for (const p of combat.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.exp(-2.4 * dt); p.vy *= Math.exp(-2.4 * dt);
    p.life -= dt;
  }
  combat.particles = combat.particles.filter((p) => p.life > 0);
  for (const f of combat.floaters) { f.y -= 42 * dt; f.life -= dt; }
  combat.floaters = combat.floaters.filter((f) => f.life > 0);
  combat.shake = Math.max(0, combat.shake - dt * 26);
  for (const s of combat.skids) s.life -= dt;
  combat.skids = combat.skids.filter((s) => s.life > 0);

  // Pickups bob, get collected, and slowly respawn.
  combat.pickupTimer -= dt;
  if (combat.pickupTimer <= 0) {
    combat.pickupTimer = 9;
    if (combat.pickups.length < 30) {
      spawnPickup(combat, 120 + Math.random() * 2320, 120 + Math.random() * 1680,
        ['cash', 'ammo', 'health'][Math.floor(Math.random() * 3)]);
    }
  }
  if (player) {
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    for (const pk of combat.pickups) {
      pk.bob += dt * 3;
      if (Math.hypot(pk.x - px, pk.y - py) < 30) {
        pk.taken = true;
        if (pk.kind === 'cash') { player.cash += 25; addFloater(combat, pk.x, pk.y, '+$25', '#2ecc71'); }
        if (pk.kind === 'ammo') { player.reserve += 24; addFloater(combat, pk.x, pk.y, '+24 AMMO', '#f1c40f'); }
        if (pk.kind === 'health') { player.health = Math.min(100, player.health + 35); addFloater(combat, pk.x, pk.y, '+35 HP', '#e74c3c'); }
      }
    }
    combat.pickups = combat.pickups.filter((pk) => !pk.taken);
  }
}
