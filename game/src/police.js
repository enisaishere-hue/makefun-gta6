// Neon Harbor — the heat: wanted stars, police cars that chase and ram,
// foot cops that chase, punch, and arrest. Arrest only ever touches a
// player ON FOOT — a driving player can never be busted by a foot cop.
import { MAX_WANTED, PALETTE, clamp } from './config.js';
import { mulberry32, pick } from './rng.js';
import { makeCar, driveCar } from './player.js';
import { roadPointFar, nearestRoadPoint } from './world.js';

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
  return { cars: [], cops: [], roadblockTimer: 0 };
}

// At 4-5 stars the law stops chasing and starts cutting the player off:
// two cruisers park across the road ahead of the player's direction of
// travel, on the nearest road point in front of them.
function spawnRoadblockAhead(police, city, player, rng) {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const pvx = player.inCar ? player.inCar.vx : Math.cos(player.angle) * 120;
  const pvy = player.inCar ? player.inCar.vy : Math.sin(player.angle) * 120;
  const spd = Math.hypot(pvx, pvy) || 1;
  const ahead = nearestRoadPoint(px + (pvx / spd) * 380, py + (pvy / spd) * 380);
  // Park across the road: perpendicular to the player's travel.
  const perp = Math.atan2(pvy, pvx) + Math.PI / 2;
  for (const side of [-1, 1]) {
    const car = makeCar(
      ahead.x + Math.cos(perp) * 26 * side,
      ahead.y + Math.sin(perp) * 26 * side,
      perp, PALETTE.copCar, 'Interceptor', { special: 'police' });
    car.parked = true;
    car.roadblock = true;
    police.cars.push(car);
  }
  police.roadblockTimer = 25;
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
  // Four stars and up: cut the player off with a roadblock ahead of them,
  // at most one every 25 seconds, on top of the chase cars.
  police.roadblockTimer = Math.max(0, (police.roadblockTimer || 0) - dt);
  if (wanted.stars >= 4 && police.roadblockTimer <= 0) {
    spawnRoadblockAhead(police, city, player, rng);
    events.push({ type: 'roadblock' });
  }
  // Drop units that fell far behind once the heat is low.
  police.cars = police.cars.filter((c) => !c.dead && Math.hypot(c.x - player.x, c.y - player.y) < 1400);
  police.cops = police.cops.filter((c) => Math.hypot(c.x - player.x, c.y - player.y) < 1200);

  // The player's velocity, for the intercept: a car reports it directly,
  // on foot the player is slow enough that the lead is negligible.
  const pvx = player.inCar ? player.inCar.vx : 0;
  const pvy = player.inCar ? player.inCar.vy : 0;
  for (const car of police.cars) {
    const dx = player.x - car.x, dy = player.y - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (car.roadblock) {
      // A roadblock car sits still and blocks the road; it never chases.
      continue;
    }
    // The law gets faster as the stars climb: 1-2 stars drive stock, 3
    // stars a touch quicker, 4-5 stars run tuned interceptors.
    car.tune = wanted.stars >= 4
      ? { accel: 1.15, top: 1.12, steer: 1.1 }
      : wanted.stars >= 3
        ? { accel: 1.06, top: 1.05, steer: 1.05 }
        : { accel: 1, top: 1, steer: 1 };
    // Predictive pursuit: aim at where the player will be, not where they
    // are — the lead grows with distance, so a cruiser cuts the corner
    // instead of trailing the bumper forever.
    const lead = Math.min(0.9, 0.25 + dist / 1400);
    const ix = player.x + pvx * lead, iy = player.y + pvy * lead;
    const target = Math.atan2(iy - car.y, ix - car.x);
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
