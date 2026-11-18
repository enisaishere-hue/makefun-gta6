// Neon Harbor — the story: Jax Marlowe owes the Harbor Kings $12,000, and
// fixer Delia Voss hands out seven jobs that pay it down, one after another:
// the first four are the old runs; the last three are a shootout with the
// Kings' muscle, a night of taxi fares, and one final armored score.
import { MISSION_PAY, MISSION_NAMES } from './config.js';
import { spawnSquad } from './enemies.js';

export function makeMissions() {
  return {
    index: 0,            // which job is live (0-6); 7 means the story is done
    stage: 0,            // step inside the current job
    timer: 0,            // countdown for timed jobs (0 = untimed)
    target: null,        // {x, y, label} the marker points at
    text: '',
    done: false,
    mossWithYou: false,
    roadblock: false,
    started: false,
    spawned: false,      // the Kings' squad is already on the street
    fare: 0,             // fares finished on the Night Shift
    farePed: null,       // the fare waiting on the curb
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
const KINGS_WAREHOUSE = { x: 1100, y: 1650 };
const ARMORED_SPOT = { x: 1980, y: 1650 };
const FARE_SPOTS = [
  { x: 1280, y: 680, label: 'Fare — Downtown' },
  { x: 320, y: 1080, label: 'Fare — Old Town' },
  { x: 2240, y: 680, label: 'Fare — East End' },
];
const FARE_DROPS = [
  { x: 700, y: 1360, label: "Delia's Garage" },
  { x: 2080, y: 1280, label: 'Hospital' },
  { x: 900, y: 1650, label: 'Harbor' },
];

export function missionSpots() {
  return { VAN_SPOT, HARBOR_DROP, COMET_SPOT, GARAGE_DROP, HEAT_PICKUP, HEAT_DROP, MOSS_SPOT, KINGS_DROP, KINGS_WAREHOUSE, ARMORED_SPOT, FARE_SPOTS, FARE_DROPS };
}

function setObjective(m, text, target, timer) {
  m.text = text; m.target = target; m.timer = timer || 0;
}

export function startMission(m, index) {
  m.index = index; m.stage = 0; m.started = true;
  m.mossWithYou = false; m.roadblock = false;
  m.spawned = false; m.fare = 0; m.farePed = null;
  if (index === 0) setObjective(m, 'Delia: take the van to the harbor warehouse. 90 seconds.', { ...HARBOR_DROP, label: 'Warehouse' }, 90);
  if (index === 1) setObjective(m, 'Delia: the red Comet S is parked in the north lot. Borrow it.', { ...COMET_SPOT, label: 'Comet S' }, 0);
  if (index === 2) setObjective(m, 'Delia: grab the package on Meridian Ave. The heat is on — 3 stars.', { ...HEAT_PICKUP, label: 'Package' }, 0);
  if (index === 3) setObjective(m, 'Delia: pick up Moss, then run the roadblock to the harbor.', { ...MOSS_SPOT, label: 'Moss' }, 0);
  if (index === 4) setObjective(m, "Delia: the Kings sent muscle to the east warehouse. Put them down.", { ...KINGS_WAREHOUSE, label: 'Kings muscle' }, 0);
  if (index === 5) {
    m.farePed = makeFarePed(FARE_SPOTS[0]);
    setObjective(m, 'Delia: drive fares around Port Meridian. Three pickups, no questions.', { ...FARE_SPOTS[0] }, 0);
  }
  if (index === 6) setObjective(m, 'Delia: one last score — the armored van at the east warehouse. Bring it to the garage.', { ...ARMORED_SPOT, label: 'Armored van' }, 0);
}

// A fare waiting on the curb: a plain pedestrian the renderer can draw.
function makeFarePed(spot) {
  return {
    x: spot.x, y: spot.y, angle: 0,
    skin: '#f1c27d', shirt: '#f39c12',
    fleeing: 0, dead: false, panic: 0, walkPhase: 0,
  };
}

export function completeMission(m, events) {
  const pay = MISSION_PAY[m.index];
  events.push({ type: 'missionComplete', pay, name: MISSION_NAMES[m.index] });
  m.index += 1; m.stage = 0; m.target = null; m.text = '';
  if (m.index >= 7) {
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
  if (m.index === 4) {
    // Kings' Payback: four enforcers hold the east warehouse. The job ends
    // when the street is empty — the live count is the objective line.
    if (!m.spawned) {
      m.spawned = true;
      S.enemies.list.length = 0;
      spawnSquad(S.enemies, KINGS_WAREHOUSE.x, KINGS_WAREHOUSE.y, 4);
    }
    const left = S.enemies.list.length;
    setObjective(m, "Kings muscle at the east warehouse — put them down. Left: " + left, { ...KINGS_WAREHOUSE, label: 'Kings muscle' }, 0);
    if (left === 0) completeMission(m, events);
  }
  if (m.index === 5) {
    // Night Shift: three fares. Drive to the waiting fare in a car, then to
    // the drop-off; the next fare is already on the curb when you arrive.
    if (m.stage === 0) {
      if (p.inCar && near(m.target, 60)) {
        m.stage = 1;
        m.farePed = null;
        setObjective(m, 'Fare aboard. Take them to ' + FARE_DROPS[m.fare].label + '.', { ...FARE_DROPS[m.fare] }, 0);
      }
    } else if (p.inCar && near(m.target, 70)) {
      m.fare += 1;
      if (m.fare >= 3) {
        completeMission(m, events);
      } else {
        m.stage = 0;
        m.farePed = makeFarePed(FARE_SPOTS[m.fare]);
        setObjective(m, 'Fare ' + (m.fare + 1) + ' of 3 is waiting at ' + FARE_SPOTS[m.fare].label + '.', { ...FARE_SPOTS[m.fare] }, 0);
      }
    }
  }
  if (m.index === 6) {
    // The Last Score: steal the armored van, survive four stars of heat,
    // and bring it to Delia's garage. The debt ends here.
    if (m.stage === 0) {
      if (p.inCar && p.inCar.special === 'armored') {
        m.stage = 1;
        spawnSquad(S.enemies, px + 120, py - 120, 2);
        setObjective(m, 'Four stars and counting — bring the van to Delia\'s garage.', { ...GARAGE_DROP, label: 'Garage' }, 0);
      }
    } else {
      S.wanted.heat = Math.max(S.wanted.heat, 4.2);
      S.wanted.stars = Math.max(S.wanted.stars, 4);
      if (near(m.target, 80)) completeMission(m, events);
    }
  }
}
