// The wanted level and the Meridian police. Crimes raise stars; police cars and
// foot cops spawn to match them, chase the player, ram the car or move in to make
// an arrest. Out of sight and out of trouble, the heat cools off on its own.
import { PALETTE, PLAYER, WANTED } from './config.js';
import { clamp, dist } from './random.js';
import { driveChase, makeCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';

// A spawn point on a road, pushed away from the player so a new unit never starts
// on top of them (a cop car spawning inside the player's car used to bust them
// before the chase had even begun).
function spawnPoint(state, minDistance) {
  const point = nearestRoadPoint(state.player.x, state.player.y);
  const dx = point.x - state.player.x;
  const dy = point.y - state.player.y;
  const d = Math.hypot(dx, dy);
  if (d < minDistance) {
    const away = d > 1 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
    const pushed = nearestRoadPoint(state.player.x + away.x * minDistance, state.player.y + away.y * minDistance);
    point.x = pushed.x;
    point.y = pushed.y;
  }
  return point;
}

export function makeWanted() {
  return { stars: 0, sinceCrime: 0, decayT: 0, bustedT: 0 };
}

export function addCrime(wanted, stars) {
  wanted.stars = clamp(wanted.stars + stars, 0, WANTED.maxStars);
  wanted.sinceCrime = 0;
  wanted.decayT = 0;
}

export function makeFootCop(x, y) {
  return {
    x, y,
    angle: 0,
    speed: 235,
    health: 60,
    punchT: 0,
    arrestT: 0,
    dead: false,
    shirt: PALETTE.copCar,
  };
}

// One step of the wanted system: cool down, then keep the police numbers matched
// to the stars. `spawnCar`/`spawnCop` are the world's spawn hooks.
export function stepWanted(wanted, dt, state, world) {
  wanted.sinceCrime += dt;
  if (wanted.stars > 0 && wanted.sinceCrime > WANTED.decayDelay) {
    wanted.decayT += dt;
    if (wanted.decayT >= WANTED.decayPeriod) {
      wanted.decayT = 0;
      wanted.stars -= 1;
      wanted.sinceCrime = 0;
    }
  }
  const wantCars = wanted.stars * WANTED.copCarPerStar;
  const wantCops = wanted.stars >= 2 ? (wanted.stars - 1) * WANTED.footCopPerStar : 0;
  while (world.copCars.length < wantCars) {
    const p = spawnPoint(state, 420);
    const angle = Math.atan2(state.player.y - p.y, state.player.x - p.x);
    const car = makeCar(p.x, p.y, angle, PALETTE.copCar, { kind: 'police' });
    car.speed = 200;
    world.copCars.push(car);
  }
  while (world.footCops.length < wantCops) {
    const p = spawnPoint(state, 320);
    const cop = makeFootCop(p.x + 40, p.y + 40);
    world.footCops.push(cop);
  }
  // Heat falls away when the player is far from every officer.
  if (wanted.stars > 0) {
    let nearest = Infinity;
    for (const c of world.copCars) nearest = Math.min(nearest, dist(c.x, c.y, state.player.x, state.player.y));
    for (const c of world.footCops) nearest = Math.min(nearest, dist(c.x, c.y, state.player.x, state.player.y));
    if (nearest > 900) wanted.sinceCrime += dt * 2;
  }
}

export function stepCopCar(car, dt, state, world, wobble) {
  driveChase(car, dt, state.player.x, state.player.y, wobble + car.id);
  // Ram the player's car: damage and a shove.
  const playerCar = state.player.car;
  if (playerCar && !playerCar.dead) {
    const d = dist(car.x, car.y, playerCar.x, playerCar.y);
    if (d < 58) {
      playerCar.health -= 26 * dt;
      playerCar.speed *= 0.985;
      world.addShake(3);
      if (playerCar.health <= 0) world.wreckCar(playerCar);
    }
  }
  // On foot, a police car that catches up ends the run with an arrest timer.
  if (!playerCar) {
    const d = dist(car.x, car.y, state.player.x, state.player.y);
    if (d < 46) world.bustedTimer += dt;
  }
}

export function stepFootCop(cop, dt, state, world) {
  const d = dist(cop.x, cop.y, state.player.x, state.player.y);
  cop.angle = Math.atan2(state.player.y - cop.y, state.player.x - cop.x);
  if (state.player.car) {
    // A foot cop runs at the car and tries to pull the player out.
    const cd = dist(cop.x, cop.y, state.player.car.x, state.player.car.y);
    if (cd < 60) {
      cop.arrestT += dt;
      if (cop.arrestT > 1.2) world.ejectPlayer();
      return;
    }
    cop.arrestT = 0;
    cop.x += Math.cos(Math.atan2(state.player.car.y - cop.y, state.player.car.x - cop.x)) * cop.speed * dt;
    cop.y += Math.sin(Math.atan2(state.player.car.y - cop.y, state.player.car.x - cop.x)) * cop.speed * dt;
    return;
  }
  if (d > 26) {
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
  } else {
    cop.punchT -= dt;
    if (cop.punchT <= 0) {
      cop.punchT = 0.9;
      state.player.health -= 12;
      world.addShake(4);
      world.addFloatText(state.player.x, state.player.y - 24, '-12', '#ff5a4d');
      world.bustedTimer += 0.35;
    }
  }
  if (d < 40) world.bustedTimer += dt * 0.5;
}

export function playerHealth() {
  return PLAYER.health;
}
