// Neon Harbor — the story: Jax Marlowe owes the Harbor Kings $12,000, and
// fixer Delia Voss hands out four jobs that pay it down, one after another.
import { MISSION_PAY, MISSION_NAMES } from './config.js';

export function makeMissions() {
  return {
    index: 0,            // which job is live (0-3); 4 means the story is done
    stage: 0,            // step inside the current job
    timer: 0,            // countdown for timed jobs (0 = untimed)
    target: null,        // {x, y, label} the marker points at
    text: '',
    done: false,
    mossWithYou: false,
    roadblock: false,
    started: false,
  };
}

const VAN_SPOT = { x: 1280, y: 470 };
const HARBOR_DROP = { x: 900, y: 1650 };
const COMET_SPOT = { x: 200, y: 175 };
const GARAGE_DROP = { x: 700, y: 1360 };
const HEAT_PICKUP = { x: 1760, y: 720 };
const HEAT_DROP = { x: 320, y: 1120 };
const MOSS_SPOT = { x: 800, y: 720 };
const KINGS_DROP = { x: 1550, y: 1650 };

export function missionSpots() {
  return { VAN_SPOT, HARBOR_DROP, COMET_SPOT, GARAGE_DROP, HEAT_PICKUP, HEAT_DROP, MOSS_SPOT, KINGS_DROP };
}

function setObjective(m, text, target, timer) {
  m.text = text; m.target = target; m.timer = timer || 0;
}

export function startMission(m, index) {
  m.index = index; m.stage = 0; m.started = true;
  m.mossWithYou = false; m.roadblock = false;
  if (index === 0) setObjective(m, 'Delia: take the van to the harbor warehouse. 90 seconds.', { ...HARBOR_DROP, label: 'Warehouse' }, 90);
  if (index === 1) setObjective(m, 'Delia: the red Comet S is parked in the north lot. Borrow it.', { ...COMET_SPOT, label: 'Comet S' }, 0);
  if (index === 2) setObjective(m, 'Delia: grab the package on Meridian Ave. The heat is on — 3 stars.', { ...HEAT_PICKUP, label: 'Package' }, 0);
  if (index === 3) setObjective(m, 'Delia: pick up Moss, then run the roadblock to the harbor.', { ...MOSS_SPOT, label: 'Moss' }, 0);
}

export function completeMission(m, events) {
  const pay = MISSION_PAY[m.index];
  events.push({ type: 'missionComplete', pay, name: MISSION_NAMES[m.index] });
  m.index += 1; m.stage = 0; m.target = null; m.text = '';
  if (m.index >= 4) {
    m.done = true;
    events.push({ type: 'storyComplete' });
  } else {
    startMission(m, m.index);
  }
}

// Called every frame while playing; returns nothing, pushes events.
export function updateMissions(m, S, dt, events) {
  if (m.done || !m.started) return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      events.push({ type: 'missionFail', name: MISSION_NAMES[m.index] });
      startMission(m, m.index); // retry the same job, no penalty
      return;
    }
  }
  const p = S.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const near = (t, r) => t && Math.hypot(px - t.x, py - t.y) < r;

  if (m.index === 0) {
    // Job 1: in the van, reach the harbor warehouse (checked against the
    // warehouse itself, never the van's own parking spot).
    if (p.inCar && p.inCar.special === 'van' && Math.hypot(px - HARBOR_DROP.x, py - HARBOR_DROP.y) < 70) completeMission(m, events);
    else if (!p.inCar) setObjective(m, 'Get in the white van first.', { ...VAN_SPOT, label: 'Van' }, m.timer);
    else setObjective(m, 'Delia: take the van to the harbor warehouse.', { ...HARBOR_DROP, label: 'Warehouse' }, m.timer);
  }
  if (m.index === 1) {
    if (m.stage === 0) {
      if (p.inCar && p.inCar.special === 'comet') {
        m.stage = 1;
        S.wanted.heat = Math.max(S.wanted.heat, 1.2); S.wanted.stars = 1; S.wanted.decayTimer = 6;
        setObjective(m, 'Nice wheels. Now lose the heat and bring it to the garage.', { ...GARAGE_DROP, label: 'Garage' }, 0);
      }
    } else if (near(m.target, 70)) {
      completeMission(m, events);
    }
  }
  if (m.index === 2) {
    // Heat stays at 3 stars until the package is delivered.
    S.wanted.heat = Math.max(S.wanted.heat, 3.2);
    S.wanted.stars = Math.max(S.wanted.stars, 3);
    if (m.stage === 0) {
      if (near(m.target, 60)) {
        m.stage = 1;
        setObjective(m, 'Package secured. Deliver it to the east docks.', { ...HEAT_DROP, label: 'Drop-off' }, 0);
      }
    } else if (near(m.target, 70)) {
      completeMission(m, events);
    }
  }
  if (m.index === 3) {
    if (m.stage === 0) {
      if (!p.inCar && near(m.target, 55)) {
        m.stage = 1; m.mossWithYou = true;
        m.roadblock = true; // main spawns the roadblock cars now
        setObjective(m, 'Moss is with you. Run the roadblock on Meridian Ave to the harbor.', { ...KINGS_DROP, label: 'Harbor drop' }, 0);
      }
    } else if (near(m.target, 80)) {
      completeMission(m, events);
    }
  }
}
