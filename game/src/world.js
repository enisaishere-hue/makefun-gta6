// The world of Neon Harbor: one state, one step. The player, the traffic, the
// pedestrians, the police, the bullets, the pickups and the story missions all live
// here; the renderer only draws what this file holds, and main.js only feeds it
// input. step() advances one fixed step and returns what happened as bit flags.
import { PALETTE, PLAYER } from './config.js';
import { createCity, buildingAt, onRoad, PLACES } from './city.js';
import { createRandom, clamp, dist } from './random.js';
import { ACTION_ENTER, ACTION_MUTE, ACTION_PUNCH, ACTION_RELOAD } from './input.js';
import { makePlayer, stepOnFoot, nearestCar, enterCar, exitCar } from './player.js';
import { makeCar, driveCar, driveTraffic, carsTouch, resetCarIds } from './vehicles.js';
import { makePed, stepPed, knockDown } from './pedestrians.js';
import { makeWanted, addCrime, stepWanted, stepCopCar, stepFootCop } from './police.js';
import { makeBullets, fireBullet, stepBullets, punchHits } from './combat.js';
import { makeMissions, currentMission, currentObjective, advanceObjective } from './missions.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_CRIME = 4;
export const EVENT_PICKUP = 8;
export const EVENT_MISSION = 16;
export const EVENT_BUSTED = 32;
export const EVENT_WASTED = 64;
export const EVENT_STORY = 128;
export const EVENT_HORN = 256;

const TRAFFIC_TARGET = 10;
const PED_TARGET = 14;

export function createWorld(seed) {
  const random = createRandom(seed);
  const city = createCity(createRandom(seed ^ 0x9e3779b9));
  const state = {
    player: makePlayer(PLACES.plaza.x, PLACES.plaza.y),
    cars: [],
    peds: [],
    copCars: [],
    footCops: [],
    bullets: makeBullets(),
    particles: [],
    floats: [],
    pickups: [],
    cash: 0,
    wanted: makeWanted(),
    missions: makeMissions(),
    camera: { x: PLACES.plaza.x, y: PLACES.plaza.y, zoom: 0.95 },
    shake: 0,
    bustedTimer: 0,
    bustedFlash: 0,
    wastedFlash: 0,
    missionFlash: '',
    missionFlashT: 0,
    storyDone: false,
    elapsed: 0,
    trafficTimer: 0,
    pedTimer: 0,
    muted: false,
    stats: { shots: 0, stolen: 0, pedsDown: 0 },
    missionCar: null,
    passenger: null,
  };

  function addShake(amount) {
    state.shake = Math.min(14, state.shake + amount);
  }
  function addFloatText(x, y, text, color) {
    state.floats.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
  }
  function addParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, Math.PI * 2);
      const s = random.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: random.range(0.3, 0.7), color, size: random.range(2, 5) });
    }
  }
  function addCash(amount) {
    state.cash += amount;
    addFloatText(state.player.x, state.player.y - 30, `+$${amount}`, '#7fc94f');
  }

  function spawnTrafficCar() {
    const loop = random.pick(city.loops);
    const idx = random.int(0, loop.length - 1);
    const p = loop[idx];
    const next = loop[(idx + 1) % loop.length];
    const car = makeCar(p.x, p.y, Math.atan2(next.y - p.y, next.x - p.x), random.pick(PALETTE.car), {
      loop, loopIndex: (idx + 1) % loop.length, cruise: random.range(120, 190),
    });
    state.cars.push(car);
    return car;
  }

  function spawnPed() {
    const ax = random.pick([320, 800, 1280, 1760, 2240]);
    const sy = random.pick([300, 700, 1100, 1500]);
    const onAvenue = random.chance(0.5);
    const x = onAvenue ? ax + (random.chance(0.5) ? -60 : 60) : clamp(random.range(120, 2440), 60, 2500);
    const y = onAvenue ? clamp(random.range(120, 1600), 60, 1640) : sy + (random.chance(0.5) ? -60 : 60);
    state.peds.push(makePed(random, x, y));
  }

  function spawnPickup(kind, x, y, amount) {
    state.pickups.push({ kind, x, y, amount, taken: false, bob: random.range(0, 6) });
  }

  function spawnMissionCar(kind, place, color) {
    const car = makeCar(place.x, place.y, -Math.PI / 2, color, { kind });
    state.cars.push(car);
    state.missionCar = car;
    return car;
  }

  function setupObjective() {
    const o = currentObjective(state.missions);
    if (!o) return;
    if (o.type === 'enterCar') spawnMissionCar('van', PLACES.plaza, '#7fa8a0');
    if (o.type === 'stealCar') spawnMissionCar('sport', PLACES.northLot, '#d94f3d');
  }

  function wreckCar(car) {
    car.dead = true;
    addParticles(car.x, car.y, '#3a3f4a', 26, 260);
    addParticles(car.x, car.y, '#f08a2e', 14, 200);
    addShake(8);
    if (state.player.car === car) {
      exitCar(state.player);
      state.player.health -= 15;
    }
  }

  function ejectPlayer() {
    if (!state.player.car) return;
    exitCar(state.player);
    state.player.health -= 5;
    addFloatText(state.player.x, state.player.y - 30, 'Pulled out!', '#ff5a4d');
  }

  function bustPlayer() {
    const lost = Math.min(state.cash, 150);
    state.cash -= lost;
    state.wanted = makeWanted();
    state.copCars = [];
    state.footCops = [];
    state.bustedTimer = 0;
    state.bustedFlash = 2.2;
    state.player.x = PLACES.hospital.x;
    state.player.y = PLACES.hospital.y;
    if (state.player.car) { state.player.car.driver = null; state.player.car = null; }
    state.player.health = PLAYER.health;
    addFloatText(state.player.x, state.player.y - 30, `BUSTED — lost $${lost}`, '#ff5a4d');
  }

  function wastePlayer() {
    const lost = Math.min(state.cash, 100);
    state.cash -= lost;
    state.wanted = makeWanted();
    state.copCars = [];
    state.footCops = [];
    state.bustedTimer = 0;
    state.wastedFlash = 2.2;
    state.player.x = PLACES.hospital.x;
    state.player.y = PLACES.hospital.y;
    if (state.player.car) { state.player.car.driver = null; state.player.car = null; }
    state.player.health = PLAYER.health;
    addFloatText(state.player.x, state.player.y - 30, `WASTED — lost $${lost}`, '#ff5a4d');
  }

  function failMission() {
    const m = currentMission(state.missions);
    if (!m) return;
    state.missions.objective = 0;
    state.missions.timer = 0;
    state.missions.failed = true;
    state.missionFlash = `Mission failed: ${m.name}. Try again.`;
    state.missionFlashT = 3;
    state.player.x = PLACES.plaza.x;
    state.player.y = PLACES.plaza.y;
    if (state.player.car) { state.player.car.driver = null; state.player.car = null; }
    state.wanted = makeWanted();
    state.copCars = [];
    state.footCops = [];
    setupObjective();
  }

  function completeObjective() {
    const result = advanceObjective(state.missions);
    if (result === 'objective') {
      state.missionFlash = 'Objective complete.';
      state.missionFlashT = 2;
      setupObjective();
      return EVENT_MISSION;
    }
    if (result === 'mission') {
      const m = state.missions.list[state.missions.index - 1];
      addCash(m.reward);
      state.missionFlash = `Mission complete: ${m.name} — +$${m.reward}`;
      state.missionFlashT = 3;
      setupObjective();
      return EVENT_MISSION;
    }
    if (result === 'story') {
      const m = state.missions.list[state.missions.list.length - 1];
      addCash(m.reward);
      state.storyDone = true;
      state.missionFlash = 'Story complete. The debt is paid. Port Meridian is yours.';
      state.missionFlashT = 5;
      return EVENT_STORY;
    }
    return 0;
  }

  function checkObjective() {
    const o = currentObjective(state.missions);
    if (!o || !state.missions.active) return 0;
    const p = state.player;
    if (o.type === 'enterCar') {
      if (p.car && p.car.kind === 'van') return completeObjective();
      return 0;
    }
    if (o.type === 'stealCar') {
      if (p.car && p.car === state.missionCar) {
        addCrime(state.wanted, 1);
        state.stats.stolen += 1;
        state.missionFlash = 'Stolen! The police noticed.';
        state.missionFlashT = 2;
        return completeObjective() | EVENT_CRIME;
      }
      return 0;
    }
    if (o.type === 'pickup') {
      if (dist(p.x, p.y, o.x, o.y) < 56) {
        if (state.missions.index === 2) {
          addCrime(state.wanted, 3);
          state.missionFlash = 'Package taken. Three stars. Run!';
          state.missionFlashT = 2;
        }
        if (state.missions.index === 3) {
          state.passenger = 'Moss';
          state.missionFlash = 'Moss is with you. Go.';
          state.missionFlashT = 2;
        }
        return completeObjective();
      }
      return 0;
    }
    if (o.type === 'goto') {
      const needCar = !!o.needCar;
      if ((!needCar || p.car) && dist(p.x, p.y, o.x, o.y) < 78) return completeObjective();
      return 0;
    }
    return 0;
  }

  function reset() {
    resetCarIds();
    state.player = makePlayer(PLACES.plaza.x, PLACES.plaza.y);
    state.cars = [];
    state.peds = [];
    state.copCars = [];
    state.footCops = [];
    state.bullets = makeBullets();
    state.particles = [];
    state.floats = [];
    state.pickups = [];
    state.cash = 0;
    state.wanted = makeWanted();
    state.missions = makeMissions();
    state.camera = { x: PLACES.plaza.x, y: PLACES.plaza.y, zoom: 0.95 };
    state.shake = 0;
    state.bustedTimer = 0;
    state.bustedFlash = 0;
    state.wastedFlash = 0;
    state.missionFlash = '';
    state.missionFlashT = 0;
    state.storyDone = false;
    state.elapsed = 0;
    state.trafficTimer = 0;
    state.pedTimer = 0;
    state.stats = { shots: 0, stolen: 0, pedsDown: 0 };
    state.missionCar = null;
    state.passenger = null;
    for (let i = 0; i < 8; i += 1) spawnTrafficCar();
    for (let i = 0; i < 12; i += 1) spawnPed();
    spawnPickup('cash', PLACES.plaza.x + 120, PLACES.plaza.y - 80, 50);
    spawnPickup('ammo', PLACES.market.x - 90, PLACES.market.y + 60, 0);
    spawnPickup('health', PLACES.hospital.x + 100, PLACES.hospital.y + 40, 0);
    spawnPickup('cash', PLACES.park.x + 60, PLACES.park.y - 40, 40);
    spawnPickup('cash', PLACES.pier.x - 140, PLACES.pier.y - 40, 60);
  }

  function step(dt, input, actions) {
    let events = 0;
    state.elapsed += dt;
    const p = state.player;
    const world = {
      copCars: state.copCars,
      footCops: state.footCops,
      addShake, addFloatText, wreckCar, ejectPlayer,
      get bustedTimer() { return state.bustedTimer; },
      set bustedTimer(v) { state.bustedTimer = v; },
    };

    if (actions & ACTION_MUTE) state.muted = !state.muted;

    // One-shot actions.
    if (actions & ACTION_ENTER) {
      if (p.car) {
        exitCar(p);
      } else {
        const car = nearestCar(p, state.cars, 70);
        if (car) {
          enterCar(p, car);
          if (car.kind === 'traffic') {
            addCrime(state.wanted, 1);
            events |= EVENT_CRIME;
            state.missionFlash = 'Car stolen! The police noticed.';
            state.missionFlashT = 2;
          }
        }
      }
    }
    if (actions & ACTION_RELOAD && !p.car && p.reloading <= 0 && p.ammo < PLAYER.pistolAmmo) {
      p.reloading = 1.1;
    }

    // Movement: drive or walk.
    if (p.car) {
      const car = p.car;
      const moved = driveCar(car, dt, input.throttle(), input.steer(), input.keys.brake);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      // Buildings stop cars hard.
      const front = { x: car.x + Math.cos(car.angle) * 30, y: car.y + Math.sin(car.angle) * 30 };
      if (buildingAt(city, front.x, front.y)) {
        if (Math.abs(car.speed) > 300) car.health -= 6;
        car.speed *= -0.25;
        car.x -= Math.cos(car.angle) * 6;
        car.y -= Math.sin(car.angle) * 6;
        if (car.health <= 0) wreckCar(car);
      }
    } else {
      stepOnFoot(p, input, dt, city);
      // Aim at the mouse; click fires, F punches.
      if (input.aimAngle) p.angle = input.aimAngle(p);
      if (input.mouse.down && p.shootT <= 0 && p.reloading <= 0) {
        if (p.ammo > 0) {
          p.ammo -= 1;
          p.shootT = 0.22;
          state.stats.shots += 1;
          const gx = p.x + Math.cos(p.angle) * 22;
          const gy = p.y + Math.sin(p.angle) * 22;
          fireBullet(state.bullets, gx, gy, p.angle, true);
          addParticles(gx, gy, '#ffd94d', 4, 120);
          events |= EVENT_SHOT;
        } else {
          p.shootT = 0.3;
          p.reloading = 1.1;
        }
      }
      if (actions & ACTION_PUNCH && p.punchT <= 0) {
        p.punchT = 0.45;
        const targets = [...state.footCops, ...state.peds];
        const hit = punchHits(p.x, p.y, p.angle, targets, 46, PLAYER.punchDamage, (t) => {
          addParticles(t.x, t.y, '#ffffff', 6, 140);
          if (t.health <= 0 && !t.dead) {
            t.dead = true;
            if (state.footCops.includes(t)) { addCrime(state.wanted, 2); events |= EVENT_CRIME; }
            else { addCrime(state.wanted, 1); state.stats.pedsDown += 1; events |= EVENT_CRIME; }
          }
        });
        if (hit) events |= EVENT_HIT;
      }
    }

    // Traffic and pedestrians keep the city alive.
    state.trafficTimer -= dt;
    if (state.trafficTimer <= 0 && state.cars.filter((c) => c.kind === 'traffic' && !c.dead).length < TRAFFIC_TARGET) {
      spawnTrafficCar();
      state.trafficTimer = 1.2;
    }
    for (const car of state.cars) {
      if (car.dead || car.driver === 'player' || car.kind === 'police') continue;
      if (car.kind === 'traffic') driveTraffic(car, dt, state.cars);
    }
    state.pedTimer -= dt;
    if (state.pedTimer <= 0 && state.peds.filter((x) => x.state !== 'down').length < PED_TARGET) {
      spawnPed();
      state.pedTimer = 1.5;
    }
    const danger = state.wanted.stars > 0 ? { x: p.x, y: p.y } : null;
    for (const ped of state.peds) stepPed(ped, dt, random, city, danger);

    // Car collisions: the player's car against traffic and pedestrians.
    if (p.car && !p.car.dead) {
      for (const other of state.cars) {
        if (other === p.car || other.dead) continue;
        if (carsTouch(p.car, other)) {
          other.health -= 8;
          p.car.health -= 4;
          p.car.speed *= 0.6;
          other.speed *= 0.6;
          addParticles((p.car.x + other.x) / 2, (p.car.y + other.y) / 2, '#c9c9c9', 5, 120);
          if (other.health <= 0) wreckCar(other);
          if (p.car.health <= 0) wreckCar(p.car);
        }
      }
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist(p.x, p.y, ped.x, ped.y) < 34 && Math.abs(p.car.speed) > 60) {
          knockDown(ped, 6);
          addCrime(state.wanted, 1);
          state.stats.pedsDown += 1;
          events |= EVENT_CRIME;
          addParticles(ped.x, ped.y, '#ff5a4d', 8, 160);
        }
      }
    }

    // Bullets: cops and pedestrians are the targets; a hit on either is a crime.
    stepBullets(state.bullets, dt, { buildingAt: (x, y) => buildingAt(city, x, y) }, [...state.footCops, ...state.peds], (t) => {
      addParticles(t.x, t.y, '#ff5a4d', 6, 150);
      if (t.health <= 0 && !t.dead) {
        t.dead = true;
        if (state.footCops.includes(t)) { addCrime(state.wanted, 2); events |= EVENT_CRIME; }
        else { addCrime(state.wanted, 1); state.stats.pedsDown += 1; events |= EVENT_CRIME; }
      }
    });

    // Pickups.
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      pk.bob += dt * 3;
      if (dist(p.x, p.y, pk.x, pk.y) < 40) {
        pk.taken = true;
        if (pk.kind === 'cash') addCash(pk.amount);
        else if (pk.kind === 'ammo') { p.ammo = PLAYER.pistolAmmo; p.reloading = 0; addFloatText(p.x, p.y - 30, 'Ammo refilled', '#7fc94f'); }
        else if (pk.kind === 'health') { p.health = PLAYER.health; addFloatText(p.x, p.y - 30, 'Health restored', '#7fc94f'); }
        events |= EVENT_PICKUP;
      }
    }

    // The wanted system and the police.
    stepWanted(state.wanted, dt, state, world);
    for (const car of state.copCars) stepCopCar(car, dt, state, world, state.elapsed);
    for (const cop of state.footCops) {
      if (!cop.dead) stepFootCop(cop, dt, state, world);
    }
    state.copCars = state.copCars.filter((c) => !c.dead && dist(c.x, c.y, p.x, p.y) < 1400);
    state.footCops = state.footCops.filter((c) => !c.dead && dist(c.x, c.y, p.x, p.y) < 900);

    // Mission timer and objectives.
    const m = currentMission(state.missions);
    if (state.missions.active && m) {
      if (state.missions.timer > 0) {
        state.missions.timer -= dt;
        if (state.missions.timer <= 0) {
          failMission();
          return events;
        }
      }
      events |= checkObjective();
    }

    // Busted or wasted.
    if (state.bustedTimer > 2) {
      bustPlayer();
      events |= EVENT_BUSTED;
    }
    if (p.health <= 0) {
      wastePlayer();
      events |= EVENT_WASTED;
    }
    if (state.bustedFlash > 0) state.bustedFlash -= dt;
    if (state.wastedFlash > 0) state.wastedFlash -= dt;
    if (state.missionFlashT > 0) state.missionFlashT -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;

    // Particles and floating text.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floats.length - 1; i >= 0; i -= 1) {
      const f = state.floats[i];
      f.y -= 26 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floats.splice(i, 1);
    }

    // Camera follows the player; the car pulls the view a little wider.
    const zoom = p.car ? 0.8 : 0.95;
    state.camera.zoom += (zoom - state.camera.zoom) * Math.min(1, dt * 3);
    state.camera.x += (p.x - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (p.y - state.camera.y) * Math.min(1, dt * 5);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 22);

    return events;
  }

  reset();
  return {
    state, city, reset, step, setupObjective,
    addShake, addFloatText, addParticles, addCash, spawnMissionCar,
    get bustedTimer() { return state.bustedTimer; },
  };
}
