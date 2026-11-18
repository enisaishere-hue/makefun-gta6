// Jax Marlowe, on foot and behind the wheel. On foot he walks, sprints, punches
// and shoots toward the mouse; in a car he is the car. E gets in and out.
import { CAR, PLAYER } from './config.js';
import { clamp, dist } from './random.js';
import { collideBuildings } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    ammo: PLAYER.pistolAmmo,
    reloading: 0,
    punchT: 0,
    shootT: 0,
    invulnerable: 0,
    car: null, // the car being driven, or null on foot
    radius: PLAYER.radius,
    dead: false,
  };
}

export function stepOnFoot(player, input, dt, city) {
  const mx = input.moveX();
  const my = input.moveY();
  const moving = mx !== 0 || my !== 0;
  const speed = input.keys.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (moving) {
    const len = Math.hypot(mx, my);
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
    player.angle = Math.atan2(my, mx);
  }
  player.x = clamp(player.x, 20, 2540);
  player.y = clamp(player.y, 20, 1680);
  collideBuildings(city, player, player.radius);
  if (player.punchT > 0) player.punchT -= dt;
  if (player.shootT > 0) player.shootT -= dt;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) player.ammo = PLAYER.pistolAmmo;
  }
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

// The nearest drivable car within reach, if any.
export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.dead) continue;
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(player, car) {
  player.car = car;
  car.driver = 'player';
  player.x = car.x;
  player.y = car.y;
}

export function exitCar(player) {
  const car = player.car;
  if (!car) return;
  car.driver = null;
  // Step out beside the car, on the driver's side.
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * (CAR.width / 2 + 20), y: car.y + Math.sin(car.angle + Math.PI / 2) * (CAR.width / 2 + 20) };
  player.x = side.x;
  player.y = side.y;
  player.car = null;
}
