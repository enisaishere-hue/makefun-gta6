// Neon Harbor: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over and story complete.
// Progress (cash, jobs done, best cash) is saved to localStorage between visits.
//
// ?seed=N fixes the city's random pattern. ?shot=chase|drive|mission|title (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRIME, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_STORY, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { startStory, startFreeRoam } from './missions.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
window.addEventListener('error', (event) => {
  status.textContent = `ERR: ${event.message}`;
});
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);
input.setAimConverter((sx, sy) => renderer.screenToWorld(sx, sy, world.state));

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash,
      jobs: world.state.missions.index,
      storyDone: world.state.storyDone,
      best: best,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // See saveGame.
  }
}

let best = readBest();
const saved = loadSave();
if (saved) {
  if (typeof saved.cash === 'number') world.state.cash = saved.cash;
  if (typeof saved.jobs === 'number') world.state.missions.index = Math.min(4, saved.jobs);
  if (saved.storyDone) world.state.storyDone = true;
  if (typeof saved.best === 'number') best = Math.max(best, saved.best);
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.city, scene.screen, { best: scene.best });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      document.title = 'READY';
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let titleChoice = 0; // 1 = story, 2 = free roam, picked with the 1/2 keys
  let accumulator = 0;
  let last = performance.now();

  window.addEventListener('keydown', (event) => {
    if (screen !== SCREEN_TITLE) return;
    if (event.code === 'Digit1') titleChoice = 1;
    else if (event.code === 'Digit2') titleChoice = 2;
  });

  function announce(message) {
    status.textContent = message;
  }

  function startGame(freeRoam) {
    world.reset();
    if (saved) {
      if (typeof saved.cash === 'number') world.state.cash = saved.cash;
      if (typeof saved.jobs === 'number') world.state.missions.index = Math.min(4, saved.jobs);
    }
    if (freeRoam) {
      startFreeRoam(world.state.missions);
      announce('Free roam. Port Meridian is yours.');
    } else {
      startStory(world.state.missions);
      world.setupObjective();
      announce(`Job 1: ${world.state.missions.list[0].name}. ${world.state.missions.list[0].brief}`);
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.cash > best) {
      best = world.state.cash;
      saveBest(best);
    }
    saveGame();
    announce(`Game over. Cash $${world.state.cash}. Best $${best}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_CRIME) audio.crime();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) { audio.mission(); saveGame(); }
    if (events & EVENT_STORY) { audio.mission(); saveGame(); screen = SCREEN_STORY; }
    if (events & EVENT_BUSTED) { audio.busted(); saveGame(); }
    if (events & EVENT_WASTED) { audio.busted(); saveGame(); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (input.takeMouseClick()) audio.unlock();
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM || titleChoice !== 0)) {
      audio.unlock();
      startGame(titleChoice === 2);
      titleChoice = 0;
    } else if (screen === SCREEN_OVER && (actions & ACTION_CONFIRM)) {
      screen = SCREEN_TITLE;
      announce('Neon Harbor. Press Enter or click to start.');
    } else if (screen === SCREEN_STORY && (actions & ACTION_CONFIRM)) {
      startGame(true);
    } else if (screen === SCREEN_PAUSED && (actions & ACTION_CONFIRM)) {
      startGame(false);
    }

    if (screen === SCREEN_PLAY) {
      let first = true;
      while (screen === SCREEN_PLAY && accumulator >= STEP) {
        const events = world.step(STEP, input, first ? actions : 0);
        first = false;
        handleEvents(events);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // The title screen's backdrop: the city idles behind the menu.
      if (screen === SCREEN_TITLE) world.step(STEP, input, 0);
    }

    audio.engine(world.state.player.car ? world.state.player.car.speed : 0, !!world.state.player.car);
    audio.siren(world.state.wanted.stars);
    if (world.state.muted) audio.setMuted(true);
    else audio.setMuted(false);
    renderer.draw(world.state, world.city, screen, { best });
  }

  // Leaving the tab pauses a running game rather than letting the police close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
