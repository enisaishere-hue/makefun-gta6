// Neon Harbor — traffic: civilian cars cruising the road grid, turning at
// intersections, stopping for nothing but a wreck in their way.
import { WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, PALETTE, clamp } from './config.js';
import { mulberry32, pick, range, intRange } from './rng.js';
import { makeCar, driveCar } from './player.js';
import { nearestRoadPoint } from './world.js';

export function makeTraffic(city, seed, count) {
  const rng = mulberry32(seed ^ 0x5eed);
  const cars = [];
  for (let i = 0; i < count; i++) {
    const x = pick(rng, AVENUES) + range(rng, -14, 14);
    const y = range(rng, 100, WORLD_H - 100);
    const dir = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = makeCar(x, y, dir, pick(rng, PALETTE.carColors), pick(rng, ['Sedan', 'Hatch', 'Taxi', 'Truck', 'Van', 'Coupe']));
    car.cruise = range(rng, 130, 210);
    car.parked = false;
    cars.push(car);
  }
  return cars;
}

// Steer a traffic car along its road: keep to the centerline, turn at crossings.
export function updateTraffic(cars, city, dt, playerCar) {
  for (const car of cars) {
    if (car.dead) continue;
    // At an intersection, sometimes pick a new road direction.
    const nearCrossX = AVENUES.some((ax) => Math.abs(car.x - ax) < 26);
    const nearCrossY = STREETS.some((sy) => Math.abs(car.y - sy) < 26);
    if (nearCrossX && nearCrossY && Math.random() < dt * 0.5) {
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      car.angle = dirs[Math.floor(Math.random() * dirs.length)];
    }
    // Gentle centerline pull: nudge the heading toward the nearest road axis.
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const speed = car.vx * fx + car.vy * fy;
    // Slow down if a car is right ahead.
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * fx + dy * fy;
      if (ahead > 0 && ahead < 70 && Math.abs(dx * fy - dy * fx) < 26) { blocked = true; break; }
    }
    if (playerCar && !playerCar.dead) {
      const dx = playerCar.x - car.x, dy = playerCar.y - car.y;
      const ahead = dx * fx + dy * fy;
      if (ahead > 0 && ahead < 80 && Math.abs(dx * fy - dy * fx) < 30) blocked = true;
    }
    const throttle = blocked ? 0 : 0.55;
    const steer = 0;
    // Snap angle drift back to axis-aligned roads.
    const snapped = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
    car.angle += (snapped - car.angle) * Math.min(1, dt * 1.5);
    driveCar(car, throttle, steer, false, dt, city);
    // Keep traffic cars on roads: if pushed off, steer them back to the centerline.
    const rp = nearestRoadPoint(car.x, car.y);
    const off = Math.hypot(car.x - rp.x, car.y - rp.y);
    if (off > ROAD_W / 2 - 8) {
      const pull = Math.atan2(rp.y - car.y, rp.x - car.x);
      car.angle += (pull - car.angle) * Math.min(1, dt * 0.8);
    }
    if (Math.abs(speed) < 1 && !blocked) { car.x += Math.cos(car.angle) * 2; car.y += Math.sin(car.angle) * 2; }
  }
}
