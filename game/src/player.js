// Neon Harbor — the player on foot and behind the wheel, plus car physics.
// One clear job: move the hero and any car they drive, with arcade handling.
import { WORLD_W, WORLD_H, PLAYER, CAR, BIKE, clamp, angleLerp } from './config.js';
import { collideCircle, onRoad } from './world.js';

export function makeCar(x, y, angle, color, model, opts = {}) {
  const kind = opts.kind || 'car';
  return {
    x, y, angle, vx: 0, vy: 0,
    color, model: model || 'Sedan',
    kind, // 'car' or 'bike' — a bike rides the BIKE tuning below
    health: kind === 'bike' ? BIKE.maxHealth : CAR.maxHealth,
    parked: !!opts.parked,
    special: opts.special || null, // 'comet' | 'van' | 'police' | null
    smoke: 0, dead: false,
  };
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, radius: PLAYER.radius,
    health: PLAYER.maxHealth, cash: 40,
    ammo: PLAYER.pistolAmmo, reserve: PLAYER.pistolReserve,
    reloading: 0, fireCooldown: 0, punchCooldown: 0,
    inCar: null, // the car object, or null when on foot
    sprinting: false, moving: false,
    arrestTimer: 0, dead: false,
  };
}

// Arcade car physics: accelerate along the nose, steer with speed, kill sideways slide.
// A bike rides the BIKE tuning (quicker, faster, looser); a police cruiser
// carries a `tune` multiplier the heat sets, so the law gets faster as the
// stars climb. `tune` is {accel, top, steer} multipliers, defaulting to 1.
export function driveCar(car, throttle, steer, handbrake, dt, city) {
  const base = car.kind === 'bike' ? BIKE : CAR;
  const tune = car.tune || { accel: 1, top: 1, steer: 1 };
  const accel = base.accel * tune.accel;
  const maxF = base.maxSpeed * tune.top, maxR = base.maxReverse;
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let speed = car.vx * fx + car.vy * fy;
  const rx = -fy, ry = fx;
  let lateral = car.vx * rx + car.vy * ry;

  if (throttle > 0) speed += accel * throttle * dt;
  else if (throttle < 0) {
    if (speed > 5) speed -= accel * 0.9 * dt; // brake while rolling forward
    else speed -= base.reverseAccel * dt;           // then reverse
  }

  speed = clamp(speed, -maxR, maxF);
  // A car steers with speed — but never to zero: a cruiser wedged on a
  // building at a standstill could never turn its nose toward its target
  // and drive out, so it sat there forever. The floor (30% authority) lets
  // any slow or stopped car turn its wheels and wriggle free; at speed the
  // normal authority takes over and nothing about the handling changes.
  const steerAuthority = Math.max(0.3, clamp(Math.abs(speed) / 140, 0, 1));
  const steerAmount = steer * base.steerRate * tune.steer * steerAuthority * (speed >= 0 ? 1 : -1);
  car.angle += steerAmount * dt * (handbrake ? 1.5 : 1);
  lateral *= Math.exp(-base.grip * dt * (handbrake ? 0.35 : 1));
  const drag = onRoad(car.x, car.y) ? base.drag : base.offroadDrag;
  speed *= Math.exp(-drag * dt * (handbrake ? 2.2 : 1));

  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  const nrx = -nfy, nry = nfx;
  car.vx = nfx * speed + nrx * lateral;
  car.vy = nfy * speed + nry * lateral;
  const nx = car.x + car.vx * dt, ny = car.y + car.vy * dt;
  const fixed = collideCircle(city, nx, ny, base.radius);
  if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
    // Hit a wall: scrape off speed; damage at most once per half second,
    // so grinding along a wall cannot delete a car in a single slide.
    const hitSpeed = Math.hypot(car.vx, car.vy);
    car.scrapeCooldown = Math.max(0, (car.scrapeCooldown || 0) - dt);
    if (hitSpeed > 220 && car.scrapeCooldown <= 0) {
      car.health -= (hitSpeed - 220) * 0.03;
      car.scrapeCooldown = 0.5;
    }
    car.vx *= 0.45; car.vy *= 0.45;
  } else {
    car.scrapeCooldown = Math.max(0, (car.scrapeCooldown || 0) - dt);
  }
  car.x = fixed.x; car.y = fixed.y;
  if (car.health <= 0 && !car.dead) { car.dead = true; car.health = 0; }
  car.smoke = car.health < 45 ? 1 - car.health / 45 : 0;
  return Math.hypot(car.vx, car.vy);
}

export function updatePlayerOnFoot(p, input, dt, city, cam) {
  const mx = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const my = input.axis('KeyW', 'KeyS') + input.axis('ArrowUp', 'ArrowDown');
  const mag = Math.hypot(mx, my) || 1;
  p.sprinting = input.held('ShiftLeft') || input.held('ShiftRight');
  const speed = p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const nx = p.x + (mx / mag) * speed * dt;
    const ny = p.y + (my / mag) * speed * dt;
    const fixed = collideCircle(city, nx, ny, p.radius);
    p.x = fixed.x; p.y = fixed.y;
  }
  // Aim at the mouse: screen mouse -> world coords via the camera.
  const wx = cam.x + input.mouseX, wy = cam.y + input.mouseY;
  p.angle = Math.atan2(wy - p.y, wx - p.x);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const need = PLAYER.pistolAmmo - p.ammo;
      const take = Math.min(need, p.reserve);
      p.ammo += take; p.reserve -= take;
    }
  }
}

// Eject the player from a wrecked or exited car, standing beside it.
export function exitCar(p, car) {
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 26;
  p.y = car.y + Math.sin(side) * 26;
  p.inCar = null;
  p.angle = car.angle;
}
