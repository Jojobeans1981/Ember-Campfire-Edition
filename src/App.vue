<template>
  <div class="app app-mayhem">
    <Transition name="launch-splash">
      <div v-if="showLaunchSplash" class="launch-splash" aria-live="polite">
        <p class="launch-splash-text" :aria-label="splashMessage">
          <span
            v-for="(line, lineIndex) in splashLineWords"
            :key="`line-${lineIndex}`"
            class="launch-line"
          >
            <span
              v-for="(word, wordIndex) in line"
              :key="`${word}-${lineIndex}-${wordIndex}`"
              class="launch-word"
            >
              <span
                v-for="(char, charIndex) in word.split('')"
                :key="`${char}-${lineIndex}-${wordIndex}-${charIndex}`"
                class="launch-letter"
                :style="{ '--i': splashLetterIndex(lineIndex, wordIndex, charIndex) }"
              >
                {{ char }}
              </span>
            </span>
          </span>
        </p>
      </div>
    </Transition>

    <!-- Top bar -->
    <header v-if="!showLaunchSplash && showTopBar" class="top-bar">
      <button class="nav-btn" @click="goBack">
        <span class="back-arrow">&#8592;</span> Back
      </button>
      <div v-if="store.selectedFriend" class="guardian-pill">
        <img :src="'/assets/friends/' + store.selectedFriend.file" class="guardian-pill-img" />
        <span class="guardian-pill-text">{{ guardianLabel }}</span>
      </div>
      <div class="xp-display" :class="{ pop: xpPop }">
        <span class="spark-emoji">&#10024;</span> {{ store.xp }} Sparks
      </div>
    </header>

    <main v-if="!showLaunchSplash" class="main">
      <p v-if="showSyncBanner" class="sync-banner">{{ syncBannerText }}</p>

      <Transition name="page" mode="out-in">
        <div
          v-if="!entryPageResolved && store.bootstrapStatus !== 'unauthenticated' && store.bootstrapStatus !== 'error'"
          key="bootstrap-loading"
          class="status-card"
        >
          <h2>Waking the Campground</h2>
          <p>Loading your account and profiles...</p>
        </div>

        <div v-else-if="store.bootstrapStatus === 'unauthenticated'" key="bootstrap-unauthenticated" class="status-card">
          <h2>Sign-In Needed</h2>
          <p>Add a valid dev auth token so the frontend can call the backend.</p>
        </div>

        <div v-else-if="store.bootstrapStatus === 'error'" key="bootstrap-error" class="status-card">
          <h2>Campground Boot Failed</h2>
          <p>{{ store.bootstrapError }}</p>
          <button class="primary-btn" type="button" @click="runBootstrap">Try Again</button>
        </div>

        <form
          v-else-if="store.profiles.length === 0"
          key="create-profile"
          class="selection profile-flow"
          @submit.prevent="submitCreateProfile"
        >
          <div class="logo-area">
            <img src="/branding/ember-logo.svg" alt="Ember logo" class="hero-logo" />
            <h1 class="app-title">Ember Campground</h1>
            <p class="app-subtitle">Create the first reader profile for this household.</p>
          </div>

          <label class="field-label" for="profile-name">Reader Name</label>
          <input id="profile-name" v-model.trim="newProfileName" class="text-input" type="text" maxlength="60" />
          <button class="primary-btn" type="submit" :disabled="!newProfileName || profileActionBusy">
            {{ profileActionBusy ? 'Creating...' : 'Create Profile' }}
          </button>
        </form>

        <div v-else-if="requiresProfileSelection" key="profile-selection" class="selection profile-flow">
          <div class="logo-area">
            <img src="/branding/ember-logo.svg" alt="Ember logo" class="hero-logo" />
            <h1 class="app-title">Choose a Reader</h1>
            <p class="app-subtitle">Pick which profile should own this session's progress.</p>
          </div>

          <div class="profile-grid">
            <button
              v-for="profile in store.profiles"
              :key="profile.id"
              class="profile-card"
              type="button"
              @click="handleProfileSelection(profile.id)"
            >
              <span class="profile-name">{{ profile.name }}</span>
            </button>
          </div>
        </div>

        <div v-else-if="store.currentPage === 'selection'" key="selection" class="selection">
          <div class="selection-scene" aria-hidden="true">
            <img src="/assets/friends/fox_1984443.png" alt="" class="scene-animal fox" />
            <img src="/assets/friends/lion_1817275.png" alt="" class="scene-animal lion" />
            <img src="/assets/friends/panda_8493111.png" alt="" class="scene-animal panda" />
            <img src="/assets/friends/kangaroo_1018379.png" alt="" class="scene-animal kangaroo" />
            <span class="scene-spark s1">&#10024;</span>
            <span class="scene-spark s2">&#128293;</span>
            <span class="scene-spark s3">&#11088;</span>
          </div>
          <div class="logo-area">
            <img src="/branding/ember-logo.svg" alt="Ember logo" class="hero-logo" />
            <h1 class="app-title">Ember Campground</h1>
            <p class="app-subtitle">Learn to Read, One Spark at a Time</p>
          </div>
          <h2>Choose a Guardian</h2>
          <p class="selection-note">Profile: {{ activeProfileName }}</p>
          <div class="character-grid">
            <div v-for="friend in friendList" :key="friend.id" class="char-card" @click="selectFriend(friend)">
              <img :src="'/assets/friends/' + friend.file" class="friend-img" />
              <div class="friend-name">{{ friend.name }}</div>
            </div>
          </div>
        </div>

        <CampgroundMap v-else-if="store.currentPage === 'campground'" key="campground" />
        <UfliLessonHub v-else-if="store.currentPage === 'unit-hub'" key="unit-hub" />
        <LessonPlayer v-else-if="store.currentPage === 'lesson'" key="lesson" :unitId="store.activeLessonId" @complete="onLessonComplete" />
        <ActivityPlayer v-else-if="store.currentPage === 'activity'" key="activity" :lessonId="store.activeLessonId" :activityType="store.activeActivity" @complete="onActivityComplete" />
        <StoryReader v-else-if="store.currentPage === 'story'" key="story" :unitId="store.activeLessonId" @complete="onStoryComplete" />
        <Dashboard v-else-if="store.currentPage === 'dashboard'" key="dashboard" />

        <div v-else key="page-fallback" class="selection">
          <h2>Loading your trail...</h2>
          <p class="app-subtitle">Getting things ready. Tap below if needed.</p>
          <button class="adventure-btn" @click="store.currentPage = 'campground'">
            Continue
          </button>
        </div>
      </Transition>
    </main>

    <div v-if="hadRuntimeError" class="runtime-banner" role="status" aria-live="polite">
      We hit a loading snag and recovered.
    </div>

    <div v-if="!showLaunchSplash && streakCount > 0" class="streak-meter" aria-live="polite">
      <p class="streak-label">Spark Streak x{{ streakCount }}</p>
      <div class="streak-track">
        <div class="streak-fill" :style="{ width: `${streakPercent}%` }"></div>
      </div>
      <p class="streak-best">Best: {{ streakBest }}</p>
    </div>

    <div class="spark-burst-layer" aria-hidden="true">
      <span
        v-for="burst in sparkBursts"
        :key="burst.id"
        class="spark-burst"
        :style="{
          '--x': `${burst.x}%`,
          '--hue': burst.hue,
          '--size': `${burst.size}px`,
          '--delay': `${burst.delay}ms`,
        }"
      ></span>
    </div>

    <Transition name="storybeat">
      <div v-if="showStoryBeat" class="storybeat-overlay" @click="dismissStoryBeat">
        <div class="storybeat-card" @click.stop>
          <p class="storybeat-kicker">{{ storyBeatData.chapter }}</p>
          <h3 class="storybeat-title">{{ storyBeatData.title }}</h3>
          <p class="storybeat-line">{{ storyBeatData.line }}</p>
          <p class="storybeat-hint">{{ storyBeatData.hint }}</p>
          <button class="adventure-btn" @click="dismissStoryBeat">Next Spark</button>
        </div>
      </div>
    </Transition>

    <!-- Celebration overlay -->
    <Transition name="celebration">
      <div v-if="!showLaunchSplash && showCelebration" class="celebration-overlay" @click="dismissCelebration">
        <div class="celebration-card">
          <div class="celebration-icon">{{ celebrationData.icon }}</div>
          <h2 class="celebration-title">{{ celebrationData.title }}</h2>
          <p class="celebration-message">{{ celebrationData.message }}</p>
          <div class="celebration-sparks">+{{ celebrationData.sparks }} Sparks</div>
          <button class="celebration-btn" @click="dismissCelebration">Continue</button>
        </div>
      </div>
    </Transition>

    <Transition name="adventure">
      <div v-if="showAdventureIntro" class="adventure-overlay">
        <div class="adventure-card">
          <video
            v-if="selectedFriendClipSrc"
            ref="adventureClipEl"
            class="adventure-clip"
            :src="selectedFriendClipSrc"
            :aria-label="`${store.selectedFriend.name} animation`"
            playsinline
            autoplay
            preload="auto"
          ></video>
          <img
            v-else
            :src="'/assets/friends/' + store.selectedFriend.file"
            :alt="store.selectedFriend.name"
            class="adventure-guardian"
          />
          <p class="adventure-kicker">Story Time</p>
          <h2 class="adventure-title">{{ store.selectedFriend.name }} and the Spark Trail</h2>
          <p class="adventure-copy">{{ selectedStory }}</p>
          <button class="adventure-btn" @click="beginAdventure">Ignite the Adventure</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, watchEffect, onErrorCaptured, nextTick } from 'vue';
import { store } from './store';
import { useAppBootstrap } from './composables/useAppBootstrap.js';
import { useProfileProgress } from './composables/useProfileProgress.js';
import { useUfliProgression } from './composables/useUfliProgression.js';
import { stopAllAudio, preloadEmberVoice } from './composables/useEmber.js';
import { useEmber } from './composables/useEmber.js';
import { useSpeechRecognition } from './composables/useSpeechRecognition.js';
import { celebrateComplete, celebrateFireLit, celebrateStory, celebrateUnitComplete } from './composables/useCelebration.js';
import CampgroundMap from './components/CampgroundMap.vue';
import UfliLessonHub from './components/UfliLessonHub.vue';
import LessonPlayer from './components/LessonPlayer.vue';
import ActivityPlayer from './components/ActivityPlayer.vue';
import StoryReader from './components/StoryReader.vue';
import Dashboard from './components/Dashboard.vue';

const { bootstrapApp, createProfile, selectProfile } = useAppBootstrap();
const { submitOperation } = useProfileProgress();
const {
  completeUfliLesson,
  completeUfliActivity,
  completeUfliConnectedText,
  getUfliLessonStatus,
  ACTIVITY_TYPES,
} = useUfliProgression();
const { cancelListening } = useSpeechRecognition();
const ember = useEmber();

const activeProfileName = computed(() => {
  return store.profiles.find((profile) => profile.id === store.activeProfileId)?.name ?? 'Unknown reader';
});

const requiresProfileSelection = computed(() => {
  return store.bootstrapStatus === 'ready' && store.profiles.length > 1 && !store.activeProfileId;
});

const showTopBar = computed(() => {
  return store.bootstrapStatus === 'ready'
    && Boolean(store.activeProfileId)
    && store.currentPage !== 'selection';
});

const showSyncBanner = computed(() => {
  return store.bootstrapStatus === 'ready'
    && Boolean(store.activeProfileId)
    && (
      store.syncStatus === 'pending'
      || store.syncStatus === 'syncing'
      || Boolean(store.lastSyncError)
      || Boolean(store.lastRecoveryError)
    );
});

const syncBannerText = computed(() => {
  if (store.syncStatus === 'syncing') {
    return 'Saving progress...';
  }

  if (store.lastSyncError) {
    return `Progress saved locally and will retry. ${store.lastSyncError}`;
  }

  if (store.lastRecoveryError) {
    return `Recovery skipped. ${store.lastRecoveryError}`;
  }

  return 'Progress is queued locally.';
});

function isConnectedTextUnlocked(lessonId) {
  const p = store.ufliProgress[lessonId];
  if (!p || !p.lessonComplete) return false;
  return ACTIVITY_TYPES.every((t) => p.activitiesComplete[t]);
}

const xpPop = ref(false);
const showCelebration = ref(false);
const SPLASH_SEEN_KEY = 'ember-splash-seen';
const showLaunchSplash = ref(
  typeof sessionStorage !== 'undefined' ? !sessionStorage.getItem(SPLASH_SEEN_KEY) : true,
);
const showAdventureIntro = ref(false);
const hadRuntimeError = ref(false);
// True only once bootstrap has finished AND syncEntryPage has set the
// correct currentPage. Gates the content branches so we don't flash
// "Choose a Guardian" (the default currentPage) between bootstrapStatus
// becoming 'ready' and syncEntryPage running in the next microtask.
const entryPageResolved = ref(false);
const streakCount = ref(0);
const streakBest = ref(0);
const sparkBursts = ref([]);
const adventureClipEl = ref(null);
const splashLines = [
  'Every campfire starts with an Ember,',
  "Let's make reading your fire",
];
const splashMessage = splashLines.join('. ');
const splashLineWords = splashLines.map((line) => line.split(' '));
const celebrationData = ref({ icon: '', title: '', message: '', sparks: 0 });
const showStoryBeat = ref(false);
const storyBeatData = ref({ chapter: '', title: '', line: '', hint: '' });
const storyBeatProgress = ref(0);
let storyBeatResolve = null;
let celebrationResolve = null;
let completionFlowBusy = false;
const newProfileName = ref('');
const profileActionBusy = ref(false);
let launchSplashTimer = null;
let streakResetTimer = null;
let burstIdSeed = 0;
let lastSparkAt = 0;
let lastHypeAt = 0;
let hasSpokenSelectionIntro = false;
let userGestureWarmupAttached = false;
let firstGestureWarmupHandler = null;
let introSpeakInFlight = false;
let storyBeatAutoDismissTimer = null;

function splashLetterIndex(lineIndex, wordIndex, charIndex) {
  let offset = 0;
  for (let i = 0; i < lineIndex; i += 1) {
    offset += splashLines[i].length + 2;
  }
  for (let i = 0; i < wordIndex; i += 1) {
    offset += splashLineWords[lineIndex][i].length + 1;
  }
  return offset + charIndex;
}

function killAudio() {
  stopAdventureClip();
  stopAllAudio();
  cancelListening();
}

function stopAdventureClip() {
  const clip = adventureClipEl.value;
  if (!clip) return;
  clip.pause();
  clip.currentTime = 0;
}

function playAdventureClip() {
  const clip = adventureClipEl.value;
  if (!clip) return;
  clip.currentTime = 0;
  const maybePromise = clip.play();
  if (maybePromise && typeof maybePromise.catch === 'function') {
    maybePromise.catch(() => {});
  }
}

function pickRandomLine(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function spawnSparkBursts() {
  const count = 12;
  sparkBursts.value = Array.from({ length: count }, () => ({
    id: ++burstIdSeed,
    x: 8 + Math.random() * 84,
    hue: 20 + Math.floor(Math.random() * 300),
    size: 10 + Math.floor(Math.random() * 14),
    delay: Math.floor(Math.random() * 140),
  }));
  window.setTimeout(() => {
    sparkBursts.value = [];
  }, 1300);
}

function registerSparkGain(gain) {
  const amount = Math.max(1, Math.floor(gain));
  const now = Date.now();
  if (now - lastSparkAt <= 12000) {
    streakCount.value += amount;
  } else {
    streakCount.value = amount;
  }
  lastSparkAt = now;
  if (streakCount.value > streakBest.value) {
    streakBest.value = streakCount.value;
  }
  spawnSparkBursts();
}

const streakPercent = computed(() => Math.min((streakCount.value / 10) * 100, 100));

const friendHypeLines = {
  Fox: [
    'Fox says you are on a spark streak. Keep going!',
    'You and Fox are flying. Next stop!',
  ],
  Lion: [
    'Lion says wow, that was powerful reading.',
    'Lion is cheering. One more big win!',
  ],
  Panda: [
    'Panda says that was cozy and amazing.',
    'Panda is smiling. Let us light another stop!',
  ],
  Kangaroo: [
    'Kangaroo says boing, awesome work!',
    'Kangaroo is ready for the next leap!',
  ],
};

const genericHypeLines = [
  'That was awesome. Ready for another one?',
  'You are on fire. Let us keep the streak going!',
  'Big kid energy. Next challenge!',
];

async function maybeSpeakHypeLine() {
  const now = Date.now();
  if (now - lastHypeAt < 4500) return;
  lastHypeAt = now;
  const friendName = store.selectedFriend?.name;
  const lines = (friendName && friendHypeLines[friendName]) || genericHypeLines;
  await ember.speak(pickRandomLine(lines), {
    priority: 'background',
    rate: 1.03,
    pitch: 1.15,
    volume: 1,
  });
}

// Animate XP counter on change
watch(() => store.xp, (nextXp, prevXp) => {
  xpPop.value = true;
  setTimeout(() => { xpPop.value = false; }, 500);
  if (nextXp > prevXp) {
    registerSparkGain(nextXp - prevXp);
  }
});

watch(() => store.currentPage, (nextPage, prevPage) => {
  const startsActivity = prevPage === 'unit-hub' && (
    nextPage === 'lesson' || nextPage === 'activity' || nextPage === 'story'
  );
  const returnsFromActivity = nextPage === 'unit-hub' && (
    prevPage === 'lesson' || prevPage === 'activity' || prevPage === 'story'
  );
  if (showLaunchSplash.value || showAdventureIntro.value) return;
  if (startsActivity || returnsFromActivity) {
    void maybeSpeakHypeLine();
  }

  if (nextPage === 'selection' && !showLaunchSplash.value && !showAdventureIntro.value && !hasSpokenSelectionIntro) {
    hasSpokenSelectionIntro = true;
    void ember.speak('Choose your guardian friend. Then we will start your reading adventure.', {
      priority: 'instruction',
      rate: 0.9,
      pitch: 1.06,
    });
  }
  if (nextPage !== 'selection') {
    hasSpokenSelectionIntro = false;
  }
});

async function speakAdventureIntro() {
  if (!showAdventureIntro.value || introSpeakInFlight) return;
  if (selectedFriendClipSrc.value) return;
  introSpeakInFlight = true;
  try {
    void preloadEmberVoice();
    const line = `${store.selectedFriend?.name || 'Your guardian'} and the spark trail. ${selectedStory.value}`;
    await ember.speak(line, {
      priority: 'instruction',
      rate: 0.9,
      pitch: 1.08,
    });
  } finally {
    introSpeakInFlight = false;
  }
}

watch(showAdventureIntro, async (isOpen) => {
  if (!isOpen) {
    stopAdventureClip();
    return;
  }
  await nextTick();
  playAdventureClip();
  void speakAdventureIntro();
});

const storyBeatsByFriend = {
  Fox: [
    { title: 'Trail Clue Found', line: 'Fox spots glowing tracks in the grass.', hint: 'Your reading lights the next clue.' },
    { title: 'Lantern Bridge', line: 'A tiny lantern bridge wakes up ahead.', hint: 'One more session powers the bridge.' },
    { title: 'Campfire Near', line: 'Fox hears the big campfire crackle nearby.', hint: 'Keep going and we reach story night.' },
  ],
  Lion: [
    { title: 'Roar Echo', line: 'Lion hears a brave roar echo in the canyon.', hint: 'Your sounds make Lion stronger.' },
    { title: 'Golden Gate', line: 'A golden gate shimmers open step by step.', hint: 'Each session unlocks one more bar.' },
    { title: 'Summit Glow', line: 'The summit fire glows at the top ridge.', hint: 'Finish this trail and claim the glow.' },
  ],
  Panda: [
    { title: 'Bamboo Spark', line: 'Panda finds a bamboo spark map.', hint: 'Your reading fills in the path.' },
    { title: 'Moon Pond', line: 'The moon pond lights up with each win.', hint: 'One session adds one moon ripple.' },
    { title: 'Cozy Fire Ring', line: 'A cozy fire ring appears in the forest.', hint: 'Almost there. Keep the streak alive.' },
  ],
  Kangaroo: [
    { title: 'Jump Marker', line: 'Kangaroo sees bright jump markers ahead.', hint: 'Your session powers the next leap.' },
    { title: 'Sky Step', line: 'A sky step pops up over the creek.', hint: 'Read strong and jump farther.' },
    { title: 'Firelight Finish', line: 'The finish ring shines in firelight.', hint: 'One more session to land the finish.' },
  ],
};

function getStoryBeatsForFriend() {
  const name = store.selectedFriend?.name;
  return storyBeatsByFriend[name] || [
    { title: 'Trail Start', line: 'Your story trail is lighting up.', hint: 'Each session reveals the next scene.' },
  ];
}

function showStoryBeatCard(triggerLabel) {
  return new Promise((resolve) => {
    if (storyBeatResolve) {
      storyBeatResolve();
      storyBeatResolve = null;
    }
    if (storyBeatAutoDismissTimer) {
      window.clearTimeout(storyBeatAutoDismissTimer);
      storyBeatAutoDismissTimer = null;
    }

    const beats = getStoryBeatsForFriend();
    const index = storyBeatProgress.value % beats.length;
    const beat = beats[index];
    storyBeatProgress.value += 1;

    storyBeatData.value = {
      chapter: `Story Spark ${storyBeatProgress.value}`,
      title: `${beat.title} - ${triggerLabel}`,
      line: beat.line,
      hint: beat.hint,
    };
    showStoryBeat.value = true;
    storyBeatResolve = resolve;
    storyBeatAutoDismissTimer = window.setTimeout(() => {
      dismissStoryBeat();
    }, 9000);

    void ember.speak(`${storyBeatData.value.chapter}. ${beat.title}. ${beat.line} ${beat.hint}`, {
      priority: 'instruction',
      rate: 0.92,
      pitch: 1.06,
    });
  });
}

function dismissStoryBeat() {
  if (storyBeatAutoDismissTimer) {
    window.clearTimeout(storyBeatAutoDismissTimer);
    storyBeatAutoDismissTimer = null;
  }
  killAudio();
  showStoryBeat.value = false;
  if (storyBeatResolve) {
    storyBeatResolve();
    storyBeatResolve = null;
  }
}

function showCelebrationScreen(icon, title, message, sparks) {
  return new Promise((resolve) => {
    celebrationData.value = { icon, title, message, sparks };
    showCelebration.value = true;
    celebrationResolve = resolve;
  });
}

function dismissCelebration() {
  showCelebration.value = false;
  if (celebrationResolve) {
    celebrationResolve();
    celebrationResolve = null;
  }
}

const friendList = [
  { id: 'fox', name: 'Fox', file: 'fox_1984443.png' },
  { id: 'lion', name: 'Lion', file: 'lion_1817275.png' },
  { id: 'panda', name: 'Panda', file: 'panda_8493111.png' },
  { id: 'kangaroo', name: 'Kangaroo', file: 'kangaroo_1018379.png' },
];
const clipByFriend = {
  Fox: '/clips/fox.mp4',
  Lion: '/clips/lion.mp4',
  Panda: '/clips/panda.mp4',
  Kangaroo: '/clips/kangaroo.mp4',
};
const storyByFriend = {
  Fox: 'Fox found glow-tracks in Spark Meadow. Each sound you say lights another track. Help Fox reach the giant story campfire!',
  Lion: 'Lion heard tiny letters whispering in the wind. Each sound you say gives Lion a brave roar-boost toward the story campfire!',
  Panda: 'Panda discovered sleepy spark-bamboo. Each sound you say wakes the next spark and opens the path to the story campfire!',
  Kangaroo: 'Kangaroo spotted bouncing ember dots. Each sound you say launches the next leap toward the story campfire!',
};

const guardianLabel = computed(() => {
  const name = store.selectedFriend?.name;
  if (!name) return 'Guardian';
  return `${name} is with you`;
});
const selectedStory = computed(() => {
  const name = store.selectedFriend?.name;
  if (!name) return '';
  return storyByFriend[name] || 'Your guardian is ready. Each sound you say lights the path to tonight\'s story campfire!';
});
const selectedFriendClipSrc = computed(() => {
  const name = store.selectedFriend?.name;
  if (!name) return '';
  return clipByFriend[name] || '';
});

const PAGE_PERSIST_KEY = 'ember-current-page';
// Top-level pages we safely restore on refresh. Lesson/activity/story
// pages depend on activeLessonId and activeActivity which aren't persisted
// in the snapshot yet, so they're excluded to avoid restoring into a
// broken state.
const RESTORABLE_PAGES = new Set(['selection', 'campground', 'unit-hub', 'dashboard']);

function loadPersistedPage() {
  try {
    const raw = sessionStorage.getItem(PAGE_PERSIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.profileId !== store.activeProfileId) return null;
    if (!RESTORABLE_PAGES.has(parsed.page)) return null;
    return parsed.page;
  } catch {
    return null;
  }
}

function persistCurrentPage(page) {
  if (!RESTORABLE_PAGES.has(page) || !store.activeProfileId) return;
  try {
    sessionStorage.setItem(
      PAGE_PERSIST_KEY,
      JSON.stringify({ profileId: store.activeProfileId, page }),
    );
  } catch {
    // sessionStorage may be blocked; silently degrade to default entry page
  }
}

watch(
  () => store.currentPage,
  (page) => persistCurrentPage(page),
);

// Dismiss the pre-hydration #boot-splash from index.html only when Vue
// has something meaningful to show underneath: either the launch splash
// is about to play, or bootstrap + syncEntryPage have resolved. Hiding
// earlier would reveal the "Waking the Campground" card for a frame,
// producing a boot-splash → waking → content flash on refresh.
let bootSplashDismissed = false;
function dismissBootSplash() {
  if (bootSplashDismissed || typeof document === 'undefined') return;
  const el = document.getElementById('boot-splash');
  if (!el) {
    bootSplashDismissed = true;
    return;
  }
  bootSplashDismissed = true;
  el.classList.add('is-hidden');
  window.setTimeout(() => el.remove(), 450);
}

watchEffect(() => {
  if (showLaunchSplash.value || entryPageResolved.value) {
    dismissBootSplash();
  }
});

function syncEntryPage() {
  if (!store.activeProfileId) {
    store.currentPage = 'selection';
    return;
  }

  // Always return to guardian selection on boot so the demo flow
  // consistently starts from the chooser instead of restoring
  // directly into the map from a previous session.
  store.currentPage = 'selection';
}

async function runBootstrap() {
  // Reset so a retry shows the Waking card again instead of jumping
  // straight from the error card to the resolved page.
  entryPageResolved.value = false;
  try {
    await bootstrapApp();
    syncEntryPage();
  } finally {
    entryPageResolved.value = true;
  }
}

onMounted(() => {
  if (!userGestureWarmupAttached) {
    userGestureWarmupAttached = true;
    firstGestureWarmupHandler = () => {
      window.removeEventListener('pointerdown', firstGestureWarmupHandler);
      window.removeEventListener('keydown', firstGestureWarmupHandler);
      firstGestureWarmupHandler = null;
      void preloadEmberVoice();
    };
    window.addEventListener('pointerdown', firstGestureWarmupHandler, { once: true });
    window.addEventListener('keydown', firstGestureWarmupHandler, { once: true });
  }

  if (showLaunchSplash.value) {
    launchSplashTimer = window.setTimeout(() => {
      showLaunchSplash.value = false;
      try {
        sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
      } catch {
        // sessionStorage may be blocked (private mode, etc.); splash just shows next refresh
      }
    }, 10000);
  }

  streakResetTimer = window.setInterval(() => {
    if (!lastSparkAt) return;
    if (Date.now() - lastSparkAt > 12000 && streakCount.value > 0) {
      streakCount.value = 0;
    }
  }, 1000);

  runBootstrap().catch(() => {
    // bootstrapApp stores the error state for retryable failures.
  });
});

onUnmounted(() => {
  if (launchSplashTimer) {
    window.clearTimeout(launchSplashTimer);
  }
  if (streakResetTimer) {
    window.clearInterval(streakResetTimer);
  }
  if (storyBeatAutoDismissTimer) {
    window.clearTimeout(storyBeatAutoDismissTimer);
    storyBeatAutoDismissTimer = null;
  }
  if (firstGestureWarmupHandler) {
    window.removeEventListener('pointerdown', firstGestureWarmupHandler);
    window.removeEventListener('keydown', firstGestureWarmupHandler);
    firstGestureWarmupHandler = null;
  }
  userGestureWarmupAttached = false;
});

onErrorCaptured((error, instance, info) => {
  console.error('Recovered app render error:', error, info, instance);
  hadRuntimeError.value = true;
  showAdventureIntro.value = false;
  showLaunchSplash.value = false;
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
  } catch {
    // sessionStorage may be blocked; splash just shows next refresh
  }
  if (!store.activeLessonId) {
    store.activeLessonId = '001';
  }
  // Fallback to map first. Unit hub should only be entered from map stop select.
  store.currentPage = store.selectedFriend ? 'campground' : 'selection';
  return false;
});

async function selectFriend(friend) {
  const syncPromise = submitOperation('set_selected_friend', { selectedFriend: friend });
  showAdventureIntro.value = true;
  void nextTick().then(() => {
    playAdventureClip();
  });
  void speakAdventureIntro();
  syncPromise.catch(() => {
    // Keep the local choice active while the queued operation retries.
  });
}

async function handleProfileSelection(profileId) {
  profileActionBusy.value = true;
  try {
    await selectProfile(profileId);
    syncEntryPage();
  } finally {
    profileActionBusy.value = false;
  }
}

async function submitCreateProfile() {
  if (!newProfileName.value || profileActionBusy.value) {
    return;
  }

  profileActionBusy.value = true;
  try {
    await createProfile(newProfileName.value);
    newProfileName.value = '';
    syncEntryPage();
  } finally {
    profileActionBusy.value = false;
  }
}

function beginAdventure() {
  showAdventureIntro.value = false;
  if (!store.activeLessonId) {
    store.activeLessonId = '001';
  }
  store.currentPage = 'campground';
}

function goBack() {
  killAudio();
  const page = store.currentPage;
  if (page === 'lesson' || page === 'activity' || page === 'story') {
    store.currentPage = 'unit-hub';
  } else if (page === 'unit-hub' || page === 'dashboard') {
    store.currentPage = 'campground';
  } else {
    store.currentPage = 'selection';
  }
}

async function onLessonComplete() {
  if (completionFlowBusy) return;
  completionFlowBusy = true;
  killAudio();
  try {
    const syncPromise = completeUfliLesson(store.activeLessonId);
    celebrateComplete();
    await showCelebrationScreen('ðŸ“–', 'Lesson Complete!', 'You learned new sounds!', 100);
    await showCelebrationScreen('📖', 'Lesson Complete!', 'You learned new sounds!', 100);
    await syncPromise.catch(() => null);
    await showStoryBeatCard('Lesson Session');
    store.currentPage = 'unit-hub';
  } finally {
    completionFlowBusy = false;
  }
}

async function onActivityComplete() {
  if (completionFlowBusy) return;
  completionFlowBusy = true;
  killAudio();
  try {
    const wasLocked = !isConnectedTextUnlocked(store.activeLessonId);
    const syncPromise = completeUfliActivity(store.activeLessonId, store.activeActivity);

    const nowUnlocked = isConnectedTextUnlocked(store.activeLessonId);

    if (wasLocked && nowUnlocked) {
      celebrateFireLit();
      await showCelebrationScreen('ðŸ”¥', 'The Fire is Lit!', 'You completed all the games! Time for a campfire story!', 50);
      await showStoryBeatCard('Game Session');
    } else {
      celebrateComplete();
      await showCelebrationScreen('✨', 'Activity Complete!', 'You earned a spark!', 50);
      await showStoryBeatCard('Game Session');
    }

    await syncPromise.catch(() => null);
    store.currentPage = 'unit-hub';
  } finally {
    completionFlowBusy = false;
  }
}

async function onStoryComplete() {
  if (completionFlowBusy) return;
  completionFlowBusy = true;
  killAudio();
  try {
    const prevStatus = getUfliLessonStatus(store.activeLessonId);
    const syncPromise = completeUfliConnectedText(store.activeLessonId);

    if (prevStatus !== 'complete') {
      celebrateUnitComplete();
      await showCelebrationScreen('ðŸ•ï¸', 'Lesson Mastered!', 'You finished this lesson! A new one awaits!', 75);
      await showStoryBeatCard('Story Session');
    } else {
      celebrateStory();
      await showCelebrationScreen('ðŸ“•', 'Story Finished!', 'Great reading!', 0);
      await showStoryBeatCard('Story Session');
    }

    await syncPromise.catch(() => null);
    store.currentPage = 'unit-hub';
  } finally {
    completionFlowBusy = false;
  }
}
</script>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #05070A;
  color: #E0E0E0;
  font-family: 'Andika', 'OpenDyslexicRegular', system-ui, sans-serif;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 100vw;
  overflow: hidden;
}

.app-mayhem {
  background:
    radial-gradient(circle at 15% 20%, rgba(255, 109, 145, 0.18), transparent 45%),
    radial-gradient(circle at 85% 18%, rgba(57, 219, 255, 0.22), transparent 50%),
    radial-gradient(circle at 60% 80%, rgba(255, 220, 92, 0.2), transparent 55%),
    #070910;
  animation: mayhemSky 8s ease-in-out infinite alternate;
}

@keyframes mayhemSky {
  from { filter: saturate(1) brightness(1); }
  to { filter: saturate(1.18) brightness(1.06); }
}

.launch-splash {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: radial-gradient(circle at 50% 45%, rgba(255, 168, 58, 0.2), rgba(5, 7, 10, 0.98) 60%);
}

.launch-splash-text {
  margin: 0;
  max-width: 12ch;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: clamp(2rem, 9vw, 5.2rem);
  line-height: 1.05;
  font-weight: 800;
  color: transparent;
  text-shadow: none;
}

.launch-line {
  display: block;
}

.launch-word {
  display: inline-block;
  margin-right: 0.24em;
}

.launch-word:last-child {
  margin-right: 0;
}

.launch-letter {
  display: inline-block;
  opacity: 0;
  color: transparent;
  text-shadow: none;
  animation:
    lightLetter 0.7s ease-out forwards,
    emberGlow 1.8s ease-in-out infinite alternate;
  animation-delay: calc(var(--i) * 0.08s), calc(var(--i) * 0.08s + 0.7s);
  animation-fill-mode: both, both;
}

@keyframes emberGlow {
  from {
    filter: brightness(0.92) saturate(0.95);
    transform: scale(0.99);
  }
  to {
    filter: brightness(1.12) saturate(1.2);
    transform: scale(1.01);
  }
}

@keyframes lightLetter {
  from {
    opacity: 0;
    color: transparent;
    text-shadow: none;
    transform: translateY(5px) scale(0.95);
  }
  to {
    opacity: 1;
    color: #ffd18b;
    text-shadow:
      0 0 10px rgba(255, 150, 44, 0.95),
      0 0 24px rgba(255, 94, 0, 0.75),
      0 0 44px rgba(255, 77, 0, 0.55);
    transform: translateY(0) scale(1);
  }
}

.launch-splash-enter-active,
.launch-splash-leave-active {
  transition: opacity 0.5s ease;
}

.launch-splash-enter-from,
.launch-splash-leave-to {
  opacity: 0;
}

.top-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(90deg, rgba(255, 113, 176, 0.2), rgba(255, 188, 75, 0.2), rgba(92, 206, 255, 0.22));
  border-bottom: 1px solid rgba(255, 255, 255, 0.26);
  backdrop-filter: blur(8px);
}

.nav-btn {
  background: transparent;
  border: 1px solid rgba(100, 255, 218, 0.4);
  color: #64FFDA;
  padding: 0.4rem 0.8rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.nav-btn:hover {
  background: rgba(100, 255, 218, 0.1);
}

.back-arrow {
  font-size: 1.1rem;
}


.guardian-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.55rem 0.2rem 0.25rem;
  border-radius: 999px;
  border: 1px solid rgba(100, 255, 218, 0.35);
  background: rgba(100, 255, 218, 0.08);
  min-width: 0;
}

.guardian-pill-img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.guardian-pill-text {
  color: #bdfcf0;
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
.xp-display {
  color: #FFD93D;
  margin-left: auto;
  font-weight: bold;
  font-size: 1rem;
  transition: transform 0.3s;
}

.xp-display.pop {
  animation: xpBounce 0.5s ease;
}

@keyframes xpBounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.4); color: #FF8C00; }
  100% { transform: scale(1); }
}

.spark-emoji {
  display: inline-block;
  animation: sparkSpin 3s linear infinite;
}

@keyframes sparkSpin {
  0%, 100% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(180deg) scale(1.2); }
}

.main {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
}

.status-card,
.profile-flow {
  width: min(92vw, 420px);
}

.status-card {
  padding: 1.5rem;
  border: 1px solid rgba(100, 255, 218, 0.18);
  border-radius: 1rem;
  background: rgba(17, 17, 17, 0.82);
  text-align: center;
}

.sync-banner {
  margin: 0 0 0.75rem;
  padding: 0.65rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 140, 0, 0.12);
  border: 1px solid rgba(255, 140, 0, 0.28);
  color: #ffd7a1;
  font-size: 0.9rem;
}

.profile-grid {
  display: grid;
  gap: 0.75rem;
  width: 100%;
}

.profile-card,
.primary-btn {
  border: 1px solid rgba(100, 255, 218, 0.35);
  border-radius: 0.9rem;
  background: rgba(17, 17, 17, 0.82);
  color: #64FFDA;
  cursor: pointer;
  font: inherit;
}

.profile-card {
  padding: 1rem;
}

.primary-btn {
  padding: 0.8rem 1rem;
}

.primary-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.profile-name {
  font-size: 1rem;
  font-weight: 700;
}

.field-label {
  color: #aaa;
  font-size: 0.95rem;
}

.text-input {
  width: 100%;
  padding: 0.8rem 1rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(17, 17, 17, 0.82);
  color: #E0E0E0;
  font: inherit;
}

.selection-note {
  margin: 0;
  color: #888;
}

.streak-meter {
  position: fixed;
  top: 0.8rem;
  right: 0.8rem;
  z-index: 1700;
  width: min(48vw, 220px);
  padding: 0.45rem 0.55rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.45);
  background: linear-gradient(130deg, rgba(255, 111, 173, 0.9), rgba(255, 189, 86, 0.92));
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
}

.streak-label,
.streak-best {
  margin: 0;
  font-size: 0.74rem;
  font-weight: 800;
  color: #2f1100;
}

.streak-best {
  margin-top: 0.2rem;
  opacity: 0.9;
}

.streak-track {
  margin-top: 0.3rem;
  height: 9px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.28);
}

.streak-fill {
  height: 100%;
  background: linear-gradient(90deg, #fff4a8, #fff);
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.75);
  transition: width 0.25s ease;
}

.spark-burst-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 1650;
}

.spark-burst {
  position: absolute;
  left: var(--x);
  bottom: 20%;
  width: var(--size);
  height: var(--size);
  border-radius: 999px;
  background: hsl(var(--hue), 95%, 65%);
  box-shadow: 0 0 10px hsla(var(--hue), 95%, 65%, 0.85);
  animation: burstPop 1s ease-out forwards;
  animation-delay: var(--delay);
}

@keyframes burstPop {
  0% {
    transform: translateY(0) scale(0.5);
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    transform: translateY(-150px) scale(1.1);
    opacity: 0;
  }
}

/* Page transitions */
.page-enter-active { animation: pageIn 0.3s ease-out; }
.page-leave-active { animation: pageOut 0.2s ease-in; }

@keyframes pageIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pageOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-8px); }
}

/* Selection screen */
.selection {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  max-width: 90vw;
  gap: 0.5rem;
  overflow: hidden;
}

.selection-scene {
  position: relative;
  width: min(94vw, 390px);
  height: 92px;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: linear-gradient(140deg, rgba(255, 104, 166, 0.35), rgba(255, 177, 87, 0.34), rgba(88, 205, 255, 0.35));
  overflow: hidden;
  z-index: 2;
}

.scene-animal {
  position: absolute;
  bottom: 6px;
  width: 66px;
  height: 66px;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.35));
  animation: sceneBob 1.35s ease-in-out infinite;
}

.scene-animal.fox { left: 8%; animation-delay: 0s; }
.scene-animal.lion { left: 30%; animation-delay: 0.2s; }
.scene-animal.panda { left: 52%; animation-delay: 0.4s; }
.scene-animal.kangaroo { left: 74%; animation-delay: 0.6s; }

.scene-spark {
  position: absolute;
  font-size: 1.1rem;
  opacity: 0.78;
  animation: sceneTwinkle 1.2s ease-in-out infinite, sceneDrift 3.1s ease-in-out infinite;
  pointer-events: none;
}

.scene-spark.s1 { top: 10px; left: 16%; }
.scene-spark.s2 { top: 18px; left: 48%; animation-delay: 0.3s; }
.scene-spark.s3 { top: 9px; left: 79%; animation-delay: 0.5s; }


.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 0.5rem;
}

.hero-logo {
  width: clamp(144px, 34vw, 220px);
  height: auto;
  margin-bottom: 0.5rem;
  filter: drop-shadow(0 14px 28px rgba(16, 24, 40, 0.45));
  animation: logoGlow 2.6s ease-in-out infinite;
}

@keyframes logoGlow {
  0%, 100% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.02); filter: brightness(1.09); }
}

.app-title {
  font-size: 2rem;
  color: #FFD454;
  margin: 0;
  text-shadow:
    0 0 18px rgba(255, 140, 0, 0.5),
    0 0 34px rgba(255, 76, 131, 0.42);
}

.app-subtitle {
  font-size: 0.9rem;
  color: #c8f6ff;
  margin: 0.2rem 0 0;
}

.selection h2 {
  margin-bottom: 0.5rem;
  font-size: 1.3rem;
  color: #fff1d2;
  text-shadow: 0 0 10px rgba(255, 155, 84, 0.4);
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
  max-width: 350px;
}

.char-card {
  width: 100%;
  aspect-ratio: 1;
  border: 2px solid rgba(255, 255, 255, 0.26);
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(165deg, rgba(255, 129, 78, 0.28), rgba(103, 197, 255, 0.22), rgba(255, 90, 177, 0.2));
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.3s, filter 0.2s;
  gap: 0.3rem;
  animation: cardPulse 3.2s ease-in-out infinite, floatCard 1.7s ease-in-out infinite;
  isolation: isolate;
}

.char-card:nth-child(2) { animation-delay: 0.18s; }
.char-card:nth-child(3) { animation-delay: 0.34s; }
.char-card:nth-child(4) { animation-delay: 0.52s; }

.char-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(120deg, transparent 20%, rgba(255, 255, 255, 0.35) 40%, transparent 60%);
  transform: translateX(-120%);
  animation: cardShine 2.8s ease-in-out infinite;
  z-index: -1;
}

.char-card:hover {
  border-color: #ffeaa8;
  transform: translateY(-4px) scale(1.05);
  filter: saturate(1.15);
  box-shadow: 0 0 24px rgba(255, 144, 92, 0.45);
}

@keyframes cardShine {
  0%, 100% { transform: translateX(-120%); opacity: 0; }
  30% { opacity: 0.8; }
  60% { transform: translateX(120%); opacity: 0; }
}

@keyframes cardPulse {
  0%, 100% { box-shadow: 0 0 0 rgba(255, 167, 101, 0.18); }
  50% { box-shadow: 0 0 16px rgba(255, 167, 101, 0.24); }
}

@keyframes sceneBob {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-6px) rotate(-2deg); }
}

@keyframes sceneTwinkle {
  0%, 100% { opacity: 0.5; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1.15); }
}

@keyframes sceneDrift {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -5px; }
}

@keyframes floatCard {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.friend-img {
  width: 60%;
  height: 60%;
  object-fit: contain;
  filter: drop-shadow(0 8px 10px rgba(0, 0, 0, 0.35));
  animation: buddyWiggle 1.1s ease-in-out infinite;
}

@keyframes buddyWiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}

.friend-name {
  font-size: 0.9rem;
  color: #fff7dd;
  font-weight: 700;
  letter-spacing: 0.02em;
}

/* Story beat overlay */
.storybeat-overlay {
  position: fixed;
  inset: 0;
  z-index: 2300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: radial-gradient(circle at center, rgba(255, 188, 75, 0.22), rgba(7, 9, 16, 0.9) 62%);
}

.storybeat-card {
  width: min(92vw, 460px);
  border-radius: 1.1rem;
  border: 2px solid rgba(255, 236, 164, 0.7);
  background: linear-gradient(145deg, rgba(255, 104, 170, 0.9), rgba(255, 177, 87, 0.92), rgba(78, 203, 255, 0.88));
  color: #2f1100;
  padding: 1rem;
  text-align: center;
  box-shadow: 0 0 34px rgba(255, 145, 81, 0.45);
  animation: storyBeatPop 0.35s ease-out, storyBeatPulse 1.6s ease-in-out infinite;
}

.storybeat-kicker {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.storybeat-title {
  margin: 0.35rem 0 0;
  font-size: 1.35rem;
}

.storybeat-line {
  margin: 0.55rem 0 0;
  font-size: 0.98rem;
  line-height: 1.35;
}

.storybeat-hint {
  margin: 0.5rem 0 0.7rem;
  font-size: 0.85rem;
  font-weight: 700;
}

.storybeat-enter-active,
.storybeat-leave-active {
  transition: opacity 0.2s ease;
}

.storybeat-enter-from,
.storybeat-leave-to {
  opacity: 0;
}

@keyframes storyBeatPop {
  from { transform: scale(0.9) translateY(10px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes storyBeatPulse {
  0%, 100% { box-shadow: 0 0 34px rgba(255, 145, 81, 0.45); }
  50% { box-shadow: 0 0 46px rgba(103, 215, 255, 0.55); }
}

/* Celebration overlay */
.celebration-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.adventure-overlay {
  position: fixed;
  inset: 0;
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: radial-gradient(circle at center, rgba(255, 213, 109, 0.2), rgba(11, 6, 20, 0.92) 60%);
}

.adventure-card {
  width: min(92vw, 430px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  padding: 1.1rem 1rem 1.2rem;
  text-align: center;
  border-radius: 1.2rem;
  border: 2px solid rgba(255, 245, 185, 0.62);
  background: linear-gradient(160deg, rgba(255, 128, 151, 0.88), rgba(255, 181, 86, 0.9), rgba(78, 216, 255, 0.85));
  box-shadow: 0 0 34px rgba(255, 170, 88, 0.4);
  animation: storyPop 0.4s ease-out, adventurePulse 1.8s ease-in-out infinite;
}

.adventure-guardian {
  width: 94px;
  height: 94px;
  object-fit: contain;
  filter: drop-shadow(0 7px 12px rgba(0, 0, 0, 0.25));
  animation: mascotHop 1.4s ease-in-out infinite;
}

.adventure-clip {
  width: min(100%, 340px);
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: 0.95rem;
  border: 2px solid rgba(255, 245, 185, 0.75);
  background: rgba(13, 18, 29, 0.55);
  box-shadow: 0 8px 18px rgba(38, 13, 0, 0.28);
}

.adventure-kicker {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #3d1d00;
}

.adventure-title {
  margin: 0;
  font-size: 1.45rem;
  color: #2d1200;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.adventure-copy {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
  color: #32160b;
}

.adventure-btn {
  margin-top: 0.35rem;
  border: 0;
  border-radius: 999px;
  padding: 0.65rem 1.15rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(90deg, #ff4b84, #ff9b2f);
  box-shadow: 0 6px 14px rgba(79, 30, 0, 0.3);
  cursor: pointer;
  animation: btnPulse 1.2s ease-in-out infinite alternate;
}

.adventure-btn:hover {
  transform: scale(1.05);
}

.adventure-enter-active,
.adventure-leave-active {
  transition: opacity 0.2s ease;
}

.adventure-enter-from,
.adventure-leave-to {
  opacity: 0;
}

@keyframes mascotHop {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-7px) rotate(-2deg); }
}

@keyframes adventurePulse {
  0%, 100% { box-shadow: 0 0 34px rgba(255, 170, 88, 0.4); }
  50% { box-shadow: 0 0 42px rgba(92, 214, 255, 0.55); }
}

@keyframes storyPop {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

@keyframes btnPulse {
  from { transform: scale(1); }
  to { transform: scale(1.05); }
}

.celebration-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  background: rgba(30, 41, 59, 0.95);
  border: 2px solid rgba(255, 140, 0, 0.4);
  border-radius: 1.5rem;
  max-width: 320px;
  text-align: center;
  box-shadow: 0 0 40px rgba(255, 140, 0, 0.15);
}

.celebration-icon {
  font-size: 4rem;
  animation: celebBounce 0.6s ease;
}

@keyframes celebBounce {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.celebration-title {
  font-size: 1.5rem;
  color: #FF8C00;
  margin: 0;
}

.celebration-message {
  font-size: 1rem;
  color: #ccc;
  margin: 0;
}

.celebration-sparks {
  font-size: 1.2rem;
  color: #FFD93D;
  font-weight: bold;
}

.celebration-btn {
  background: rgba(255, 140, 0, 0.2);
  border: 2px solid #FF8C00;
  color: #FF8C00;
  padding: 0.6rem 2rem;
  border-radius: 2rem;
  font-size: 1rem;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.2s;
}

.celebration-btn:hover {
  background: rgba(255, 140, 0, 0.35);
}

.celebration-enter-active { animation: celebIn 0.3s ease; }
.celebration-leave-active { animation: celebOut 0.2s ease; }

@keyframes celebIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes celebOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

.runtime-banner {
  position: fixed;
  left: 50%;
  bottom: 1rem;
  transform: translateX(-50%);
  z-index: 50;
  background: rgba(15, 23, 42, 0.95);
  color: #fde68a;
  border: 1px solid rgba(253, 230, 138, 0.5);
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  font-size: 0.82rem;
}
</style>




