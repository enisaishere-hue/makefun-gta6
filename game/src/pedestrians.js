// Neon Harbor — pedestrians: citizens strolling the sidewalks who scatter
// when a gun fires or a car bears down on them.
import { WORLD_W, WORLD_H, clamp } from './config.js';
import { mulberry32, pick, range, chance } from './rng.js';
import { collideCircle, onRoad } from './world.js';

const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const SHIRTS = ['#3498db', '#e67e22', '#9b59b6', '#1abc9c', '#f39c12', '#ecf0f1', '#e74c3c'];

export function makePedestrians(city, seed, count) {
  const rng = mulberry32(seed ^ 0xbeef);
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = range(rng, 120, WORLD_W - 120);
    const y = range(rng, 120, WORLD_H - 120);
    peds.push({
      x, y, angle: range(rng, 0, Math.PI * 2),
      tx: x, ty: y, speed: range(rng, 40, 75),
      skin: pick(rng, SKINS), shirt: pick(rng, SHIRTS),
      fleeing: 0, dead: false, panic: 0,
      walkPhase: range(rng, 0, Math.PI * 2),
    });
  }
  return peds;
}

export function scarePeds(peds, x, y, radius) {
  for (const p of peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.fleeing = 2.5;
      p.panic = 1;
      const away = Math.atan2(p.y - y, p.x - x);
      p.tx = p.x + Math.cos(away) * 320;
      p.ty = p.y + Math.sin(away) * 320;
    }
  }
}

export function updatePedestrians(peds, city, dt, player) {
  const ranOver = [];
  for (const p of peds) {
    if (p.dead) continue;
    p.fleeing = Math.max(0, p.fleeing - dt);
    p.panic = Math.max(0, p.panic - dt * 0.4);
    const d = Math.hypot(p.tx - p.x, p.ty - p.y);
    if (d < 14 || (p.fleeing <= 0 && Math.random() < dt * 0.08)) {
      // Pick a new stroll target near a sidewalk (just off a road).
      p.tx = clamp(p.x + (Math.random() * 520 - 260), 90, WORLD_W - 90);
      p.ty = clamp(p.y + (Math.random() * 520 - 260), 90, WORLD_H - 90);
    }
    const want = Math.atan2(p.ty - p.y, p.tx - p.x);
    let da = want - p.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    p.angle += clamp(da, -3 * dt, 3 * dt);
    const speed = p.fleeing > 0 ? p.speed * 2.6 : p.speed;
    p.walkPhase += dt * speed * 0.09;
    const nx = p.x + Math.cos(p.angle) * speed * dt;
    const ny = p.y + Math.sin(p.angle) * speed * dt;
    const fixed = collideCircle(city, nx, ny, 10);
    p.x = fixed.x; p.y = fixed.y;
    // A speeding car kills a pedestrian it touches (and raises the heat).
    if (player && player.inCar) {
      const car = player.inCar;
      const cs = Math.hypot(car.vx, car.vy);
      if (cs > 200 && Math.hypot(p.x - car.x, p.y - car.y) < 26) {
        p.dead = true;
        ranOver.push(p);
      }
    }
  }
  return ranOver;
}
