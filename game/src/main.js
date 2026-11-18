// Neon Harbor — the game loop: state, screens, shooting, stealing cars,
// busted/wasted, saving, and the camera. One clear job: run the game.
import { WORLD_W, WORLD_H, PLAYER, CAR, START_CASH, BUSTED_FINE, WASTED_FINE, clamp } from './config.js';
import { mulberry32 } from './rng.js';
import { buildCity } from './world.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { makePlayer, makeCar, driveCar, updatePlayerOnFoot, exitCar } from './player.js';
import { makeTraffic, updateTraffic } from './traffic.js';
import { makePedestrians, updatePedestrians, scarePeds } from './pedestrians.js';
import { makeWanted, makePolice, updatePolice, updateWanted, addHeat } from './police.js';
import { makeCombat, fireBullet, spawnParticles, addFloater, addShake, updateCombat, seedPickups } from './combat.js';
import { makeMissions, startMission, updateMissions, missionSpots } from './missions.js';
import { applyShot, autopilotDrive } from './shots.js';
import * as render from './render.js';

const SAVE_KEY = 'neon-harbor-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: START_CASH, jobsDone: 0, bestEarned: 0 };
    const s = JSON.parse(raw);
    return { cash: s.cash ?? START_CASH, jobsDone: s.jobsDone ?? 0, bestEarned: s.bestEarned ?? 0 };
  } catch { return { cash: START_CASH, jobsDone: 0, bestEarned: 0 }; }
}

function writeSave(S) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: S.player.cash,
      jobsDone: Math.min(4, S.missions.index),
      bestEarned: Math.max(S.save.bestEarned, S.earned),
    }));
  } catch { /* storage unavailable: the game still plays */ }
}

export function createGame(canvas) {
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed') || 1);
  const rng = mulberry32(seed);
  // ?fresh=1 starts a brand-new save (used by the screenshot poses).
  if (params.get('fresh')) { try { localStorage.removeItem(SAVE_KEY); } catch {} }
  const city = buildCity(seed);
  const spots = missionSpots();
  const save = loadSave();

  const S = {
    city, rng, seed,
    canvas, ctx: canvas.getContext('2d'),
    input: new Input(canvas),
    sfx: new Sfx(),
    player: makePlayer(1280, 560),
    wanted: makeWanted(),
    police: makePolice(),
    combat: makeCombat(),
    missions: makeMissions(),
    time: 0, clockMin: 18 * 60, timeStr: '18:00',
    screen: 'title',
    earned: 0, save,
    cam: { x: 640, y: 200 },
    autopilot: null, shotMode: null, shotTime: 0,
    roadblockSpawned: false,
    mossPed: null,
    engineTick: 0,
  };
  S.player.cash = save.cash;

  // Parked cars: the mission van, the red Comet S, and a few street cars.
  S.parkedCars = [
    makeCar(spots.VAN_SPOT.x, spots.VAN_SPOT.y, 0, '#ecf0f1', 'Van', { parked: true, special: 'van' }),
    makeCar(spots.COMET_SPOT.x, spots.COMET_SPOT.y, Math.PI / 2, '#c0392b', 'Comet S', { parked: true, special: 'comet' }),
    makeCar(850, 770, 0, '#2980b9', 'Sedan', { parked: true }),
    makeCar(1810, 1170, Math.PI, '#f1c40f', 'Taxi', { parked: true }),
    makeCar(330, 1570, Math.PI / 2, '#16a085', 'Hatch', { parked: true }),
    makeCar(2290, 770, 0, '#8e44ad', 'Sedan', { parked: true }),
  ];
  S.traffic = makeTraffic(city, seed, 14);
  S.peds = makePedestrians(city, seed, 26);
  S.allCars = [...S.parkedCars, ...S.traffic];
  seedPickups(S.combat, city, rng);
  S.mossPed = {
    x: spots.MOSS_SPOT.x, y: spots.MOSS_SPOT.y, angle: 0,
    tx: spots.MOSS_SPOT.x, ty: spots.MOSS_SPOT.y, speed: 0,
    skin: '#8d5524', shirt: '#ffd76a', fleeing: 0, dead: false, panic: 0, walkPhase: 0,
  };

  const shot = params.get('shot');
  if (shot) applyShot(S, shot);

  // Expose the live state for the shot driver and for debugging.
  window.__NEON_HARBOR__ = S;
  return S;
}

function nearestEnterableCar(S) {
  const p = S.player;
  let best = null, bestD = 48;
  for (const car of S.allCars) {
    if (car.dead || car.special === 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      const speed = Math.hypot(car.vx, car.vy);
      if (car.parked || speed < 40) { best = car; bestD = d; }
    }
  }
  return best;
}

function handlePoliceEvents(S, events) {
  for (const ev of events) {
    if (ev.type === 'ram') { S.sfx.crash(); addShake(S.combat, 4); }
    if (ev.type === 'copBang') { S.sfx.punch(); }
    if (ev.type === 'copPunch') { S.sfx.punch(); addShake(S.combat, 3); }
    if (ev.type === 'busted') busted(S);
  }
}

function busted(S) {
  const fine = Math.min(S.player.cash, BUSTED_FINE);
  S.player.cash -= fine;
  S.lastFine = fine;
  respawnAtHospital(S);
  S.wanted.heat = 0; S.wanted.stars = 0;
  S.police.cars.length = 0; S.police.cops.length = 0;
  S.sfx.busted(); S.sfx.setSiren(false);
  S.screen = 'busted';
  writeSave(S);
}

function wasted(S) {
  const fine = Math.min(S.player.cash, WASTED_FINE);
  S.player.cash -= fine;
  S.lastFine = fine;
  respawnAtHospital(S);
  S.player.health = PLAYER.maxHealth;
  S.wanted.heat = 0; S.wanted.stars = 0;
  S.police.cars.length = 0; S.police.cops.length = 0;
  S.sfx.setSiren(false);
  S.screen = 'wasted';
  writeSave(S);
}

function respawnAtHospital(S) {
  const h = S.city.hospital;
  const p = S.player;
  if (p.inCar) { p.inCar = null; }
  p.x = h.x + h.w / 2; p.y = h.y + h.h + 30;
  p.health = PLAYER.maxHealth;
  p.ammo = PLAYER.pistolAmmo;
  p.arrestTimer = 0;
}

function handleMissionEvents(S, events) {
  for (const ev of events) {
    if (ev.type === 'missionComplete') {
      S.player.cash += ev.pay;
      S.earned += ev.pay;
      S.sfx.missionDone();
      addFloater(S.combat, S.player.x, S.player.y - 30, '+$' + ev.pay + '  ' + ev.name, '#2ecc71');
      writeSave(S);
    }
    if (ev.type === 'missionFail') {
      S.sfx.missionFail();
      addFloater(S.combat, S.player.x, S.player.y - 30, 'JOB FAILED — try again', '#e74c3c');
    }
    if (ev.type === 'storyComplete') {
      S.screen = 'story';
      writeSave(S);
    }
  }
}

function spawnRoadblock(S) {
  if (S.roadblockSpawned) return;
  S.roadblockSpawned = true;
  const left = makeCar(1230, 1400, Math.PI / 2, '#e8e8e8', 'Interceptor', { special: 'police' });
  const right = makeCar(1330, 1400, Math.PI / 2, '#e8e8e8', 'Interceptor', { special: 'police' });
  left.roadblock = true; right.roadblock = true;
  left.parked = true; right.parked = true;
  S.police.cars.push(left, right);
  addHeat(S.wanted, 1);
}

function shootAt(S, tx, ty) {
  const p = S.player;
  if (p.reloading > 0 || p.fireCooldown > 0 || p.ammo <= 0) return;
  p.ammo -= 1;
  p.fireCooldown = PLAYER.fireCooldown;
  fireBullet(S.combat, p.x, p.y, Math.atan2(ty - p.y, tx - p.x), true);
  S.sfx.shot();
  addShake(S.combat, 2);
  scarePeds(S.peds, p.x, p.y, 320);
  addHeat(S.wanted, 0.15);
  if (p.ammo === 0) p.reloading = PLAYER.reloadTime;
}

function punchAt(S) {
  const p = S.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  S.sfx.punch();
  const fx = Math.cos(p.angle), fy = Math.sin(p.angle);
  const hit = (t, r, dmg) => {
    const dx = t.x - p.x, dy = t.y - p.y;
    if (Math.hypot(dx, dy) < 34 + r && dx * fx + dy * fy > 0) {
      t.health = (t.health ?? 50) - dmg;
      spawnParticles(S.combat, t.x, t.y, '#ff6b35', 6, 120);
      addFloater(S.combat, t.x, t.y - 14, '-' + dmg, '#ffb199');
      return true;
    }
    return false;
  };
  for (const cop of S.police.cops) if (hit(cop, 10, PLAYER.punchDamage) && cop.health <= 0) {
    cop.health = 0;
    S.police.cops = S.police.cops.filter((c) => c !== cop);
    addHeat(S.wanted, 1.5);
  }
  for (const ped of S.peds) if (!ped.dead && hit(ped, 8, PLAYER.punchDamage)) {
    ped.dead = true;
    addHeat(S.wanted, 1);
  }
}

function testBullets(S) {
  const p = S.player;
  for (const b of S.combat.bullets) {
    if (!b.fromPlayer) continue;
    let consumed = false;
    const hitTarget = (t, r, dmg, onKill) => {
      if (consumed) return;
      if (Math.hypot(b.x - t.x, b.y - t.y) < r + 6) {
        consumed = true;
        t.health = (t.health ?? 50) - dmg;
        spawnParticles(S.combat, b.x, b.y, '#e74c3c', 8, 150);
        addFloater(S.combat, t.x, t.y - 14, '-' + dmg, '#ffb199');
        if (t.health <= 0) onKill();
      }
    };
    for (const cop of S.police.cops) hitTarget(cop, 12, PLAYER.pistolDamage, () => {
      S.police.cops = S.police.cops.filter((c) => c !== cop);
      addHeat(S.wanted, 1.5);
      addFloater(S.combat, cop.x, cop.y - 26, 'COP DOWN', '#e74c3c');
    });
    for (const ped of S.peds) if (!ped.dead) hitTarget(ped, 10, PLAYER.pistolDamage, () => {
      ped.dead = true;
      addHeat(S.wanted, 1);
    });
    for (const car of S.allCars) {
      if (car === p.inCar) continue;
      hitTarget(car, 22, PLAYER.pistolDamage, () => { car.dead = true; });
      if (car.health <= 0 && !car.dead) car.dead = true;
    }
    for (const car of S.police.cars) hitTarget(car, 22, PLAYER.pistolDamage, () => { car.dead = true; });
    if (consumed) b.life = 0;
  }
}

function updatePlaying(S, dt) {
  const p = S.player;
  const input = S.input;
  S.time += dt;
  S.clockMin += dt * 0.5;
  const hh = Math.floor(S.clockMin / 60) % 24, mm = Math.floor(S.clockMin % 60);
  S.timeStr = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  if (S.shotMode) S.shotTime += dt;

  // Missions first: the roadblock flag may spawn police cars.
  const mEvents = [];
  updateMissions(S.missions, S, dt, mEvents);
  handleMissionEvents(S, mEvents);
  if (S.missions.roadblock && !S.roadblockSpawned) spawnRoadblock(S);

  // Enter / exit cars.
  if (input.consumeKey('KeyE')) {
    if (p.inCar) {
      const speed = Math.hypot(p.inCar.vx, p.inCar.vy);
      if (speed < 60) { exitCar(p, p.inCar); }
    } else {
      const car = nearestEnterableCar(S);
      if (car) {
        p.inCar = car;
        car.parked = false;
        if (car.special === 'comet' || car.special === 'van') { /* mission cars: heat handled by missions */ }
        else addHeat(S.wanted, 0.4);
        S.sfx.pickup();
      }
    }
  }
  if (input.consumeKey('KeyR') && !p.inCar && p.reloading <= 0 && p.ammo < PLAYER.pistolAmmo && p.reserve > 0) {
    p.reloading = PLAYER.reloadTime;
  }
  if (input.consumeKey('KeyF') && !p.inCar) punchAt(S);
  if (input.consumeKey('KeyM')) { S.sfx.muted = !S.sfx.muted; S.sfx.setSiren(false); }

  if (p.inCar) {
    const car = p.inCar;
    let drive;
    if (S.autopilot) drive = autopilotDrive(S, dt);
    else {
      drive = {
        throttle: input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp'),
        steer: input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight'),
        handbrake: input.held('Space'),
      };
    }
    const speed = driveCar(car, drive.throttle, drive.steer, drive.handbrake, dt, S.city);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    S.engineTick -= dt;
    if (speed > 120 && S.engineTick <= 0) { S.engineTick = 0.12; S.sfx.engineTick(); }
    // Car-vs-car bumps.
    for (const other of S.allCars) {
      if (other === car || other.dead) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = (car.x - other.x) / d, ny = (car.y - other.y) / d;
        car.x += nx * push; car.y += ny * push;
        other.x -= nx * push; other.y -= ny * push;
        if (Math.abs(speed) > 240) { car.health -= 2; other.health -= 2; S.sfx.crash(); addShake(S.combat, 3); }
      }
    }
    for (const pc of S.police.cars) {
      if (pc.roadblock) {
        const d = Math.hypot(pc.x - car.x, pc.y - car.y);
        if (d < 44 && d > 0.01) {
          const nx = (car.x - pc.x) / d, ny = (car.y - pc.y) / d;
          car.x += nx * (44 - d); car.y += ny * (44 - d);
          if (Math.abs(speed) > 200) { car.health -= 8; S.sfx.crash(); addShake(S.combat, 5); }
        }
      }
    }
    if (car.health <= 0 && !car.dead) {
      car.dead = true;
      spawnParticles(S.combat, car.x, car.y, '#ff6b35', 24, 260);
      addShake(S.combat, 10);
      S.sfx.crash();
      exitCar(p, car);
    }
  } else {
    updatePlayerOnFoot(p, input, dt, S.city, S.cam);
    if (input.consumeClick()) {
      const wx = S.cam.x + input.mouseX, wy = S.cam.y + input.mouseY;
      shootAt(S, wx, wy);
    }
  }

  updateTraffic(S.traffic, S.city, dt, p.inCar);
  const ranOver = updatePedestrians(S.peds, S.city, dt, p);
  for (const ped of ranOver) {
    addHeat(S.wanted, 1);
    spawnParticles(S.combat, ped.x, ped.y, '#e74c3c', 10, 160);
    addFloater(S.combat, ped.x, ped.y - 16, 'RAN OVER +1★', '#e74c3c');
    S.sfx.crash();
  }
  updateWanted(S.wanted, dt);
  const pEvents = [];
  updatePolice(S.police, S.city, p, S.wanted, dt, S.rng, pEvents);
  handlePoliceEvents(S, pEvents);
  updateCombat(S.combat, S.city, dt, p);
  testBullets(S);
  S.sfx.setSiren(S.wanted.stars >= 2 && S.screen === 'playing');

  if (p.health <= 0 && !p.inCar) wasted(S);

  // Camera follows the player, with shake on top.
  const tx = clamp((p.inCar ? p.inCar.x : p.x) - 640, 0, WORLD_W - 1280);
  const ty = clamp((p.inCar ? p.inCar.y : p.y) - 360, 0, WORLD_H - 720);
  S.cam.x += (tx - S.cam.x) * Math.min(1, dt * 5);
  S.cam.y += (ty - S.cam.y) * Math.min(1, dt * 5);
}

function draw(S) {
  const ctx = S.ctx;
  ctx.save();
  const sh = S.combat.shake;
  if (sh > 0) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
  const cam = { x: S.cam.x, y: S.cam.y };
  render.drawWorld(ctx, S.city, cam, S.time);
  if (S.missions.target) render.drawTarget(ctx, S.missions.target, cam, S.time);
  for (const car of S.allCars) render.drawCar(ctx, car, cam, S.time);
  for (const car of S.police.cars) render.drawCar(ctx, car, cam, S.time);
  for (const ped of S.peds) if (!ped.dead) render.drawPed(ctx, ped, cam);
  if (S.mossPed && !S.missions.mossWithYou && S.missions.index === 3) render.drawPed(ctx, S.mossPed, cam);
  for (const cop of S.police.cops) render.drawCop(ctx, cop, cam);
  if (!S.player.inCar) render.drawPlayer(ctx, S.player, cam, S.time);
  render.drawCombat(ctx, S.combat, cam);
  ctx.restore();
  if (S.screen === 'playing') render.drawHUD(ctx, S);
  else if (S.screen === 'title') render.drawTitle(ctx, S);
  else if (S.screen === 'paused') { render.drawHUD(ctx, S); render.drawPause(ctx); }
  else if (S.screen === 'busted') render.drawBusted(ctx, S.lastFine || 0);
  else if (S.screen === 'wasted') render.drawWasted(ctx, S.lastFine || 0);
  else if (S.screen === 'story') render.drawStoryDone(ctx, S);
}

export function startGame(S) {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const input = S.input;
    if (input.consumeKey('KeyP') && (S.screen === 'playing' || S.screen === 'paused')) {
      S.screen = S.screen === 'playing' ? 'paused' : 'playing';
    }
    if (S.screen === 'title' && (input.consumeKey('Enter') || input.consumeClick())) {
      S.screen = 'playing';
      if (S.save.jobsDone > 0 && S.save.jobsDone < 4) startMission(S.missions, S.save.jobsDone);
      else startMission(S.missions, 0);
      S.sfx.ensure();
    } else if ((S.screen === 'busted' || S.screen === 'wasted') && input.consumeKey('Enter')) {
      S.screen = 'playing';
    } else if (S.screen === 'story' && input.consumeKey('Enter')) {
      S.screen = 'playing';
    }
    if (S.screen === 'playing') updatePlaying(S, dt);
    else if (S.screen === 'title') { S.time += dt; }
    draw(S);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
