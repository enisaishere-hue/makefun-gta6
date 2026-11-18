// Neon Harbor — deterministic screenshot poses (?shot=<name>&seed=1) and the
// autopilot that stages them. The autopilot brakes INTO turns: it coasts and
// pulls the handbrake when the road bends, never accelerating through walls.
import { makeCar } from './player.js';
import { addHeat } from './police.js';
import { startMission } from './missions.js';
import { spawnSquad } from './enemies.js';
import { clamp } from './config.js';

// A road-following route: avenue 1280 north, then west on street 720.
const CHASE_ROUTE = [
  { x: 1280, y: 1500 }, { x: 1280, y: 1120 }, { x: 1280, y: 720 },
  { x: 800, y: 720 }, { x: 320, y: 720 }, { x: 320, y: 320 },
];
const DRIVE_ROUTE = [
  { x: 1280, y: 1120 }, { x: 1280, y: 720 }, { x: 1760, y: 720 },
  { x: 1760, y: 1120 }, { x: 1280, y: 1120 },
];

export function applyShot(S, name) {
  const p = S.player;
  S.shotMode = name;
  S.shotTime = 0;
  if (name === 'title') {
    S.screen = 'title';
    return;
  }
  S.screen = 'playing';
  if (name === 'chase') {
    const car = makeCar(1280, 1500, -Math.PI / 2, '#c0392b', 'Comet S', { special: 'comet' });
    S.allCars.push(car);
    p.inCar = car; p.x = car.x; p.y = car.y;
    S.autopilot = { route: CHASE_ROUTE, wp: 0 };
    S.wanted.heat = 3.4; S.wanted.stars = 3; S.wanted.decayTimer = 99;
    startMission(S.missions, 2);
    S.missions.stage = 1;
    S.missions.text = 'Package secured. Deliver it to the east docks.';
    S.missions.target = { x: 320, y: 1120, label: 'Drop-off' };
    S.sfx.setSiren(true);
  }
  if (name === 'drive') {
    const car = makeCar(1280, 1120, -Math.PI / 2, '#c0392b', 'Comet S', { special: 'comet' });
    S.allCars.push(car);
    p.inCar = car; p.x = car.x; p.y = car.y;
    S.autopilot = { route: DRIVE_ROUTE, wp: 0 };
    startMission(S.missions, 1);
    S.missions.stage = 1;
    S.missions.text = 'Nice wheels. Now lose the heat and bring it to the garage.';
    S.missions.target = { x: 700, y: 1360, label: 'Garage' };
  }
  if (name === 'mission') {
    p.inCar = null;
    p.x = 1700; p.y = 618; // on the sidewalk, clear of passing traffic
    p.angle = Math.atan2(720 - 618, 1760 - 1700);
    startMission(S.missions, 2);
    S.missions.text = 'Delia: grab the package on Meridian Ave. The heat is on — 3 stars.';
    S.missions.target = { x: 1760, y: 720, label: 'Package' };
  }
  if (name === 'combat') {
    // On foot on Meridian Ave, three Kings enforcers advancing down the
    // avenue, pistol ready. They start far enough out that the fight is
    // still standing when the shutter falls.
    p.inCar = null;
    p.x = 1280; p.y = 760;
    p.angle = -Math.PI / 2;
    p.ammo = 12; p.reserve = 48;
    startMission(S.missions, 4);
    // The job would spawn its own squad at the warehouse; hold the pose
    // here instead, so the fight is in frame.
    S.missions.spawned = true;
    S.enemies.list.length = 0;
    spawnSquad(S.enemies, 1280, 420, 3);
    for (const e of S.enemies.list) e.fireCooldown = 2.2 + Math.random() * 0.6;
    // No police in this shot: foot cops would arrest a player who stands
    // still for the camera. The fight is with the Kings, not the law.
    S.wanted.heat = 0; S.wanted.stars = 0; S.wanted.decayTimer = 99;
  }
  if (name === 'night') {
    // Deep night in Downtown: neon, headlights, two stars, sirens on.
    S.clockMin = 23 * 60 + 15;
    const car = makeCar(1280, 1120, -Math.PI / 2, '#c0392b', 'Comet S', { special: 'comet' });
    S.allCars.push(car);
    p.inCar = car; p.x = car.x; p.y = car.y;
    S.autopilot = { route: DRIVE_ROUTE, wp: 0 };
    S.wanted.heat = 2.4; S.wanted.stars = 2; S.wanted.decayTimer = 99;
    startMission(S.missions, 1);
    S.missions.stage = 1;
    S.missions.text = 'Nice wheels. Now lose the heat and bring it to the garage.';
    S.missions.target = { x: 700, y: 1360, label: 'Garage' };
    S.sfx.setSiren(true);
  }
  if (name === 'bike') {
    // The Falcon at dusk: the new bike, the Street King gates on the road,
    // one star of heat behind it. The bike starts just south of gate 1 and
    // rides north through it on the autopilot's route.
    S.clockMin = 18 * 60 + 45;
    const bike = makeCar(1280, 1650, -Math.PI / 2, '#e74c3c', 'Falcon', { kind: 'bike' });
    S.allCars.push(bike);
    p.inCar = bike; p.x = bike.x; p.y = bike.y;
    S.autopilot = { route: [{ x: 1280, y: 1520 }, { x: 1280, y: 1120 }, { x: 1280, y: 720 }, { x: 1760, y: 720 }, { x: 1760, y: 1120 }], wp: 0 };
    S.wanted.heat = 1.4; S.wanted.stars = 1; S.wanted.decayTimer = 99;
    startMission(S.missions, 8);
  }
}

// Drive the player's car along the route, slowing for bends first.
export function autopilotDrive(S, dt) {
  const car = S.player.inCar;
  const ap = S.autopilot;
  if (!car || !ap) return { throttle: 0, steer: 0, handbrake: false };
  const wp = ap.route[ap.wp];
  const dx = wp.x - car.x, dy = wp.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 60) { ap.wp = (ap.wp + 1) % ap.route.length; return { throttle: 0, steer: 0, handbrake: false }; }
  const targetAngle = Math.atan2(dy, dx);
  let da = targetAngle - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const speed = Math.hypot(car.vx, car.vy);
  const bend = Math.abs(da);
  // Look one waypoint ahead: if the route turns sharply after this one,
  // shed speed early instead of arriving at the corner too hot to turn.
  const nextWp = ap.route[(ap.wp + 1) % ap.route.length];
  const turnAhead = Math.abs(((Math.atan2(nextWp.y - wp.y, nextWp.x - wp.x) - targetAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const closing = dist < 280 && turnAhead > 0.5;
  // Brake into the turn: coast below 260, handbrake below 180 on sharp bends.
  let throttle = 0.7, handbrake = false;
  if (closing && speed > 200) { throttle = 0; handbrake = speed > 240; }
  else if (bend > 0.9) { throttle = 0; handbrake = speed > 120; }
  else if (bend > 0.45) { throttle = speed > 260 ? 0 : 0.4; }
  else if (speed > 320) { throttle = 0.25; }
  const steer = clamp(da * 1.8, -1, 1);
  return { throttle, steer, handbrake };
}
