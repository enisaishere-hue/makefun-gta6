// The story of Neon Harbor: Jax Marlowe, a courier driver in Port Meridian, owes
// a debt to the Harbor Kings and works it off for the fixer Delia Voss, one job at
// a time. Four missions in order, each a chain of objectives the world checks off;
// finishing one pays cash and unlocks the next. Free roam opens once all four are done.
import { PLACES } from './city.js';

export const STORY = {
  hero: 'Jax Marlowe',
  fixer: 'Delia Voss',
  crew: 'Harbor Kings',
  city: 'Port Meridian',
  intro: 'Jax Marlowe owes the Harbor Kings $12,000. Delia Voss will clear the debt, one job at a time. Drive careful. The Meridian police do not do careful.',
};

function obj(type, place, text, extra = {}) {
  return { type, x: place.x, y: place.y, label: place.label, text, done: false, ...extra };
}

export function missionList() {
  return [
    {
      id: 0,
      name: 'First Delivery',
      brief: 'Delia needs a package at the Old Pier before the tide turns. Take the courier van. Ninety seconds.',
      reward: 300,
      objectives: [
        obj('enterCar', PLACES.plaza, 'Get in the courier van', { carKind: 'van' }),
        obj('goto', PLACES.pier, 'Deliver the package to the Old Pier', { timer: 90 }),
      ],
    },
    {
      id: 1,
      name: 'Borrowed Wheels',
      brief: 'A red Comet S sits in the North Lot, keys in it, owner at lunch. Borrow it. Permanently. Ray pays at the garage.',
      reward: 450,
      objectives: [
        obj('stealCar', PLACES.northLot, 'Take the red Comet S from the North Lot', { carKind: 'sport' }),
        obj('goto', PLACES.garage, "Bring it to Ray's Garage", { needCar: true }),
      ],
    },
    {
      id: 2,
      name: 'Heat Run',
      brief: 'The market package is hot and so are you. Three stars the moment you touch it. Lose the heat at the safehouse.',
      reward: 700,
      objectives: [
        obj('pickup', PLACES.market, 'Pick up the package at Sunset Market'),
        obj('goto', PLACES.safehouse, 'Reach the safehouse with the package', { wanted: 3 }),
      ],
    },
    {
      id: 3,
      name: 'Harbor Kings',
      brief: 'Last job. Collect Moss at the Neon Diner, run the roadblock, and put the Kings’ ledger on the Lighthouse Point beacon. Then you are free.',
      reward: 1200,
      objectives: [
        obj('pickup', PLACES.diner, 'Collect Moss at the Neon Diner'),
        obj('goto', PLACES.lighthouse, 'Reach Lighthouse Point', { wanted: 2 }),
      ],
    },
  ];
}

export function makeMissions() {
  return {
    list: missionList(),
    index: 0, // the mission in progress
    objective: 0, // the objective in progress
    active: false,
    freeRoam: false,
    done: false, // the whole story is finished
    timer: 0, // counts down when an objective sets one
    failed: false,
  };
}

export function currentMission(missions) {
  return missions.list[missions.index] || null;
}

export function currentObjective(missions) {
  const m = currentMission(missions);
  return m ? m.objectives[missions.objective] : null;
}

export function startStory(missions) {
  missions.active = true;
  missions.index = 0;
  missions.objective = 0;
  missions.freeRoam = false;
  missions.done = false;
  const o = currentObjective(missions);
  missions.timer = o && o.timer ? o.timer : 0;
}

export function startFreeRoam(missions) {
  missions.active = false;
  missions.freeRoam = true;
}

export function advanceObjective(missions) {
  const m = currentMission(missions);
  if (!m) return 'done';
  missions.objective += 1;
  if (missions.objective >= m.objectives.length) {
    missions.index += 1;
    missions.objective = 0;
    if (missions.index >= missions.list.length) {
      missions.done = true;
      missions.active = false;
      missions.freeRoam = true;
      return 'story';
    }
    return 'mission';
  }
  const o = currentObjective(missions);
  missions.timer = o && o.timer ? o.timer : 0;
  return 'objective';
}
