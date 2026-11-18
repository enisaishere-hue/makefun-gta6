// Cars: the player's ride and the traffic. A car is a position, an angle and a
// speed; driving is arcade physics (accelerate, steer, handbrake), and traffic cars
// follow the road loops around the blocks, slowing for the car ahead.
import { CAR } from './config.js';
import { angleDiff, angleLerp, clamp } from './random.js';

let nextId = 1;

export function makeCar(x, y, angle, color, opts = {}) {
  return {
    id: nextId,
    kind: opts.kind || 'traffic',
    x, y, angle,
    speed: 0,
    color,
    health: CAR.health,
    smoke: 0,
    loop: opts.loop || null,
    loopIndex: opts.loopIndex || 0,
    cruise: opts.cruise || 150,
    driver: opts.driver || null, // 'player' when the player drives it
    honk: 0,
    dead: false,
  };
}

// Arcade driving: throttle forward/back, steering that bites harder at speed,
// a handbrake that slides the tail out. Returns the distance moved this step.
export function driveCar(car, dt, throttle, steer, handbrake) {
  const forward = throttle > 0;
  const accel = forward ? CAR.accel * throttle : CAR.brake * throttle;
  car.speed = clamp(car.speed + accel * dt, -CAR.reverseMax, CAR.maxSpeed);
  if (throttle === 0) car.speed -= car.speed * 1.6 * dt; // rolling drag
  if (handbrake) {
    car.speed -= car.speed * 2.2 * dt;
    car.angle += steer * CAR.turnRate * 1.5 * dt * Math.sign(car.speed || 1);
  } else {
    const grip = clamp(Math.abs(car.speed) / 220, 0.25, 1);
    car.angle += steer * CAR.turnRate * grip * dt * Math.sign(car.speed || 1);
  }
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  car.x += dx;
  car.y += dy;
  // Cars stay inside Port Meridian; the harbor and the map edge stop them.
  if (car.x < 30) { car.x = 30; car.speed *= 0.4; }
  if (car.x > 2530) { car.x = 2530; car.speed *= 0.4; }
  if (car.y < 30) { car.y = 30; car.speed *= 0.4; }
  if (car.y > 1890) { car.y = 1890; car.speed *= 0.4; }
  return Math.hypot(dx, dy);
}

// Traffic: follow the loop's waypoints, slow for the car ahead, stop dead at a
// wreck. Police cars use the same steering but chase a moving target instead.
export function driveTraffic(car, dt, cars) {
  if (!car.loop) return;
  const target = car.loop[car.loopIndex];
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const turn = clamp(angleDiff(car.angle, want) * 2, -1, 1);
  let throttle = 1;
  for (const other of cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 90 && side < 40) { throttle = -0.4; break; }
  }
  driveCar(car, dt, throttle, turn, false);
  if (Math.hypot(target.x - car.x, target.y - car.y) < 46) {
    car.loopIndex = (car.loopIndex + 1) % car.loop.length;
  }
}

// A chase steer: point at the target and floor it, with a little wobble so two
// pursuers do not drive the same line.
export function driveChase(car, dt, tx, ty, wobble) {
  const want = Math.atan2(ty - car.y, tx - car.x) + Math.sin(wobble) * 0.12;
  const turn = clamp(angleDiff(car.angle, want) * 2.4, -1, 1);
  driveCar(car, dt, 1, turn, false);
}

export function carCorner(car, sx, sy) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  return { x: car.x + sx * c - sy * s, y: car.y + sx * s + sy * c };
}

// Rough circle test between two cars (their middles, radius = half length).
export function carsTouch(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = CAR.length * 0.62;
  return dx * dx + dy * dy < r * r;
}

export function resetCarIds() {
  nextId = 1;
}
