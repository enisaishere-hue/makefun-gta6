// Neon Harbor — the heat: wanted stars, police cars that chase and ram,
// foot cops that chase, punch, and arrest. Arrest only ever touches a
// player ON FOOT — a driving player can never be busted by a foot cop.
import { MAX_WANTED, PALETTE, clamp } from './config.js';
import { mulberry32, pick } from './rng.js';
import { makeCar, driveCar } from './player.js';
import { roadPointFar } from './world.js';

export function makeWanted() {
  return { stars: 0, heat: 0, decayTimer: 0 };
}

export function addHeat(wanted, amount) {
  wanted.heat = clamp(wanted.heat + amount, 0, MAX_WANTED);
  wanted.stars = Math.floor(wanted.heat);
  wanted.decayTimer = 6;
}

export function updateWanted(wanted, dt) {
  wanted.decayTimer -= dt;
  if (wanted.decayTimer <= 0 && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - dt * 0.08);
    wanted.stars = Math.floor(wanted.heat);
  }
}

export function makePolice() {
  return { cars: [], cops: [] };
}

function spawnPoliceCar(police, city, player, rng) {
  const p = roadPointFar(rng, player.x, player.y, 400); // never on top of the player
  const car = makeCar(p.x, p.y, 0, PALETTE.copCar, 'Interceptor', { special: 'police' });
  car.parked = false;
  police.cars.push(car);
}

function spawnFootCop(police, city, player, rng) {
  const p = roadPointFar(rng, player.x, player.y, 300); // never on top of the player
  police.cops.push({
    x: p.x, y: p.y, angle: 0, speed: 195,
    punchCooldown: 0, arrestHold: 0, health: 50,
  });
}

export function updatePolice(police, city, player, wanted, dt, rng, events) {
  const wantCars = wanted.stars >= 1 ? Math.min(1 + Math.floor(wanted.stars / 2), 4) : 0;
  const wantCops = wanted.stars >= 1 ? Math.min(wanted.stars, 4) : 0;
  while (police.cars.length < wantCars) spawnPoliceCar(police, city, player, rng);
  while (police.cops.length < wantCops) spawnFootCop(police, city, player, rng);
  if (wanted.stars === 0) {
    police.cars.length = 0;
    police.cops.length = 0;
  }
  // Drop units that fell far behind once the heat is low.
  police.cars = police.cars.filter((c) => !c.dead && Math.hypot(c.x - player.x, c.y - player.y) < 1400);
  police.cops = police.cops.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) < 1200);

  for (const car of police.cars) {
    const dx = player.x - car.x, dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (car.roadblock) {
      // A roadblock car sits still and blocks the road; it never chases.
      continue;
    }
    const target = Math.atan2(dy, dx);
    let da = target - car.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const steer = clamp(da * 1.4, -1, 1);
    const throttle = dist > 90 ? 1 : 0.4;
    driveCar(car, throttle, steer, false, dt, city);
    // Ram: a police car touching the player's car dents it and shoves both
    // apart, so a chase wears the car down instead of deleting it outright.
    if (player.inCar) {
      const pc = player.inCar;
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      if (Math.hypot(car.x - pc.x, car.y - pc.y) < 34) {
        // One solid hit per second per cruiser, then shove apart: a chase
        // wears the car down over time instead of deleting it on contact.
        if (car.ramCooldown <= 0) {
          pc.health -= 5;
          car.ramCooldown = 1.0;
        }
        pc.x += (pc.x - car.x) / dist * 30 * dt; pc.y += (pc.y - car.y) / dist * 30 * dt;
        events.push({ type: 'ram' });
      }
    } else if (dist < 30) {
      player.health -= 30 * dt;
      player.x += (dx / dist) * -60 * dt; player.y += (dy / dist) * -60 * dt;
    }
  }

  for (const cop of police.cops) {
    cop.punchCooldown = Math.max(0, cop.punchCooldown - dt);
    const dx = player.x - cop.x, dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const target = Math.atan2(dy, dx);
    let da = target - cop.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    cop.angle += clamp(da, -4 * dt, 4 * dt);
    if (dist > 24) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    }
    if (player.inCar) {
      // A foot cop cannot arrest a driver: he bangs on the car instead —
      // but only when the car is nearly stopped, and only for a dent.
      const carSpeed = Math.hypot(player.inCar.vx, player.inCar.vy);
      if (dist < 34 && carSpeed < 80 && cop.punchCooldown <= 0) {
        cop.punchCooldown = 0.8;
        player.inCar.health -= 2;
        events.push({ type: 'copBang' });
      }
      cop.arrestHold = 0;
    } else if (dist < 30) {
      // On foot and cornered: the arrest meter fills, then BUSTED.
      cop.arrestHold += dt;
      if (cop.punchCooldown <= 0) {
        cop.punchCooldown = 0.9;
        player.health -= 8;
        events.push({ type: 'copPunch' });
      }
      if (cop.arrestHold > 1.4) events.push({ type: 'busted' });
    } else {
      cop.arrestHold = Math.max(0, cop.arrestHold - dt * 2);
    }
  }
}
