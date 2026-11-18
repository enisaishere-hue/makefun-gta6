// The screenshot scenes behind ?shot=chase|drive|mission|title. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame.
import { STEP } from './config.js';
import { PLACES, onRoad } from './city.js';
import { makeCar } from './vehicles.js';
import { enterCar } from './player.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

// A fake input for staged scenes: full throttle, steering that follows the road
// loop around one downtown block, never shooting. The car stays inside the city.
// `startIndex` picks the first waypoint so the car's first leg runs along a road,
// not diagonally across a block.
function loopInput(world, startIndex) {
  const loop = [
    { x: 800, y: 700 }, { x: 1280, y: 700 }, { x: 1280, y: 1100 }, { x: 800, y: 1100 },
  ];
  let index = startIndex;
  const input = {
    keys: { up: true, down: false, left: false, right: false, sprint: false, brake: false },
    mouse: { x: 0, y: 0, down: false, clicked: false },
    throttle() {
      const p = world.state.player;
      const target = loop[index];
      const want = Math.atan2(target.y - p.y, target.x - p.x);
      let diff = want - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // Brake into a sharp turn: coast off the throttle, and pull the handbrake
      // while still fast, so the car rounds the corner instead of smashing
      // through the building past it. (A small throttle would still accelerate.)
      const speed = p.car ? Math.abs(p.car.speed) : 0;
      const turning = Math.abs(diff) > 0.5;
      input.keys.brake = turning && speed > 200;
      if (speed < 40) return 0.6;
      if (turning) return 0;
      return 1;
    },
    steer() {
      const p = world.state.player;
      const target = loop[index];
      const want = Math.atan2(target.y - p.y, target.x - p.x);
      let diff = want - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.hypot(target.x - p.x, target.y - p.y) < 160) index = (index + 1) % loop.length;
      return Math.max(-1, Math.min(1, diff * 2));
    },
    moveX() { return 0; },
    moveY() { return 0; },
    aimAngle: null,
    takeActions() { return 0; },
    takeMouseClick() { return false; },
  };
  return input;
}

// A still input for on-foot scenes: the player stands where placed.
function stillInput() {
  return {
    keys: { up: false, down: false, left: false, right: false, sprint: false, brake: false },
    mouse: { x: 0, y: 0, down: false, clicked: false },
    throttle() { return 0; },
    steer() { return 0; },
    moveX() { return 0; },
    moveY() { return 0; },
    aimAngle: null,
    takeActions() { return 0; },
    takeMouseClick() { return false; },
  };
}

function putPlayerInCar(world, x, y, angle, color, kind) {
  const car = makeCar(x, y, angle, color, { kind: kind || 'traffic' });
  world.state.cars.push(car);
  enterCar(world.state.player, car);
  return car;
}

function runSteps(world, input, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, input, 0);
}

// Step forward in small slices and stop at the first moment after `minSeconds` that
// looks like the scene should: the player driving fast on a road, and for the
// chase a police car close behind. The frame is still the real simulation, just
// caught at a good moment instead of at a fixed clock time.
function runUntil(world, input, seconds, minSeconds, goodFrame) {
  const slice = 0.25;
  let t = 0;
  while (t < seconds) {
    runSteps(world, input, slice);
    t += slice;
    if (t >= minSeconds && goodFrame(world)) return;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best cash to show. Scenes: chase (cover: a police pursuit at three stars),
 * drive (cruising downtown traffic), mission (on foot at the North Lot job),
 * title (the title screen over the living city).
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'chase') {
    s.missions.active = true;
    s.missions.index = 2;
    s.missions.objective = 1;
    s.missions.timer = 0;
    s.wanted.stars = 3;
    s.wanted.sinceCrime = 0;
    s.cash = 740;
    const chaseCar = putPlayerInCar(world, 800, 700, 0, '#d94f3d', 'sport');
    chaseCar.health = 200;
    s.player.car.speed = 420;
    runUntil(world, loopInput(world, 1), 12, 3, (w) => {
      const p = w.state.player;
      if (!p.car || Math.abs(p.car.speed) < 350) return false;
      if (!onRoad(p.x, p.y)) return false;
      return w.state.copCars.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 280);
    });
    return { screen: SCREEN_PLAY, best: 740 };
  }
  if (name === 'drive') {
    s.cash = 320;
    const driveCar = putPlayerInCar(world, 800, 1100, -Math.PI / 2, '#3d7fd9', 'traffic');
    driveCar.health = 200;
    s.player.car.speed = 300;
    runUntil(world, loopInput(world, 0), 12, 2, (w) => {
      const p = w.state.player;
      return !!p.car && Math.abs(p.car.speed) > 250 && onRoad(p.x, p.y);
    });
    return { screen: SCREEN_PLAY, best: 320 };
  }
  if (name === 'mission') {
    s.missions.active = true;
    s.missions.index = 1;
    s.missions.objective = 0;
    world.setupObjective();
    s.player.x = PLACES.northLot.x - 90;
    s.player.y = PLACES.northLot.y + 60;
    s.cash = 300;
    runSteps(world, stillInput(), 4);
    return { screen: SCREEN_PLAY, best: 300 };
  }
  // Title: the city alive behind the menu.
  runSteps(world, stillInput(), 5);
  return { screen: SCREEN_TITLE, best: 0 };
}
