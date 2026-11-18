// Pedestrians: the people of Port Meridian. They stroll the sidewalks, cross at
// corners, and run for cover when gunfire or a siren gets close. Hitting one is a
// crime, and the wanted level notices.
import { AVENUES, PALETTE, ROAD_W, STREETS } from './config.js';
import { clamp, dist } from './random.js';

export function makePed(random, x, y) {
  return {
    x, y,
    angle: random.range(0, Math.PI * 2),
    speed: random.range(28, 52),
    health: 50,
    radius: 14,
    shirt: random.pick(PALETTE.pedShirt),
    state: 'walk', // walk | flee | down
    stateT: 0,
    target: null,
    downT: 0,
    bob: random.range(0, Math.PI * 2),
  };
}

// Pick a new strolling target on a nearby sidewalk (beside a road, off the road).
function newStrollTarget(random, ped) {
  if (random.chance(0.5)) {
    const ax = random.pick(AVENUES);
    const side = random.chance(0.5) ? -1 : 1;
    return { x: ax + side * (ROAD_W / 2 + 12), y: clamp(ped.y + random.range(-320, 320), 60, 1640) };
  }
  const sy = random.pick(STREETS);
  const side = random.chance(0.5) ? -1 : 1;
  return { x: clamp(ped.x + random.range(-320, 320), 60, 2500), y: sy + side * (ROAD_W / 2 + 12) };
}

export function stepPed(ped, dt, random, city, danger) {
  ped.bob += dt * 6;
  if (ped.state === 'down') {
    ped.downT -= dt;
    if (ped.downT <= 0) {
      ped.state = 'walk';
      ped.target = null;
    }
    return;
  }
  const d = danger ? dist(ped.x, ped.y, danger.x, danger.y) : Infinity;
  if (d < 260 && ped.state !== 'flee') {
    ped.state = 'flee';
    ped.stateT = 2.5;
    const away = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.target = { x: ped.x + Math.cos(away) * 320, y: ped.y + Math.sin(away) * 320 };
  }
  if (ped.state === 'flee') {
    ped.stateT -= dt;
    if (ped.stateT <= 0) { ped.state = 'walk'; ped.target = null; }
  }
  if (!ped.target) ped.target = newStrollTarget(random, ped);
  const tx = ped.target.x;
  const ty = ped.target.y;
  const dd = dist(ped.x, ped.y, tx, ty);
  if (dd < 12) {
    ped.target = null;
    return;
  }
  const speed = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
  ped.angle = Math.atan2(ty - ped.y, tx - ped.x);
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.x = clamp(ped.x, 30, 2530);
  ped.y = clamp(ped.y, 30, 1670);
}

// Knocked down by a car or a bullet: out cold for a while, then gets back up.
export function knockDown(ped, seconds) {
  ped.state = 'down';
  ped.downT = seconds;
}
