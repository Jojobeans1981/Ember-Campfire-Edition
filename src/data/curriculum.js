export const PHONEME_ORDER = [
  's', 'a', 'm', 't', 'p', 'n', 'i', 'c',
  'b', 'f', 'l', 'o', 'h', 'd', 'g', 'e',
  'r', 'u', 'k', 'w', 'j', 'y', 'x', 'q', 'z', 'v',
];

export const UNITS = [
  {
    unitId: 'unit-01',
    title: 'First Flames',
    phonemes: ['s', 'a', 'm'],
    prerequisiteUnit: null,
    campgroundStation: 'fire-pit',
    stationLabel: 'Fire Pit',
    storyId: 'story-01',
  },
  {
    unitId: 'unit-02',
    title: 'Gathering Kindling',
    phonemes: ['t', 'p'],
    prerequisiteUnit: 'unit-01',
    campgroundStation: 'kindling-grove',
    stationLabel: 'Kindling Grove',
    storyId: 'story-02',
  },
  {
    unitId: 'unit-03',
    title: 'Sparks Fly',
    phonemes: ['n', 'i'],
    prerequisiteUnit: 'unit-02',
    campgroundStation: 'ranger-station',
    stationLabel: 'Ranger Station',
    storyId: 'story-03',
  },
  {
    unitId: 'unit-04',
    title: 'Steady Glow',
    phonemes: ['c'],
    prerequisiteUnit: 'unit-03',
    campgroundStation: 'treehouse',
    stationLabel: 'Treehouse',
    storyId: 'story-04',
  },
  {
    unitId: 'unit-05',
    title: 'Campfire Crackle',
    phonemes: ['b', 'f'],
    prerequisiteUnit: 'unit-04',
    campgroundStation: 'fishing-dock',
    stationLabel: 'Fishing Dock',
    storyId: 'story-05',
  },
  {
    unitId: 'unit-06',
    title: 'Trail Blazer',
    phonemes: ['l', 'o'],
    prerequisiteUnit: 'unit-05',
    campgroundStation: 'hiking-trail',
    stationLabel: 'Hiking Trail',
    storyId: 'story-06',
  },
  {
    unitId: 'unit-07',
    title: 'Hidden Clearing',
    phonemes: ['h', 'd'],
    prerequisiteUnit: 'unit-06',
    campgroundStation: 'meadow',
    stationLabel: 'Meadow',
    storyId: 'story-07',
  },
  {
    unitId: 'unit-08',
    title: 'Growing Flames',
    phonemes: ['g', 'e'],
    prerequisiteUnit: 'unit-07',
    campgroundStation: 'lookout-tower',
    stationLabel: 'Lookout Tower',
    storyId: 'story-08',
  },
  {
    unitId: 'unit-09',
    title: 'Roaring Fire',
    phonemes: ['r', 'u'],
    prerequisiteUnit: 'unit-08',
    campgroundStation: 'bear-cave',
    stationLabel: 'Bear Cave',
    storyId: 'story-09',
  },
  {
    unitId: 'unit-10',
    title: 'Warm Winds',
    phonemes: ['k', 'w'],
    prerequisiteUnit: 'unit-09',
    campgroundStation: 'canoe-lake',
    stationLabel: 'Canoe Lake',
    storyId: 'story-10',
  },
  {
    unitId: 'unit-11',
    title: 'Starlight Stories',
    phonemes: ['j', 'y'],
    prerequisiteUnit: 'unit-10',
    campgroundStation: 'stargazing-hill',
    stationLabel: 'Stargazing Hill',
    storyId: 'story-11',
  },
  {
    unitId: 'unit-12',
    title: 'Explorer\'s Quest',
    phonemes: ['x', 'q'],
    prerequisiteUnit: 'unit-11',
    campgroundStation: 'treasure-rock',
    stationLabel: 'Treasure Rock',
    storyId: 'story-12',
  },
  {
    unitId: 'unit-13',
    title: 'Campfire Legends',
    phonemes: ['z', 'v'],
    prerequisiteUnit: 'unit-12',
    campgroundStation: 'story-circle',
    stationLabel: 'Story Circle',
    storyId: 'story-13',
  },
];

export function getUnitByIndex(index) {
  return UNITS[index] || null;
}

export function getPhonemesUpToUnit(unitId) {
  const phonemes = [];
  for (const unit of UNITS) {
    phonemes.push(...unit.phonemes);
    if (unit.unitId === unitId) break;
  }
  return phonemes;
}
