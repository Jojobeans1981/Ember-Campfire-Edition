import confetti from 'canvas-confetti';

// Small burst for correct answers
export function celebrateCorrect() {
  confetti({
    particleCount: 25,
    spread: 50,
    origin: { y: 0.7 },
    colors: ['#FF8C00', '#FFD93D', '#64FFDA'],
    gravity: 1.2,
    ticks: 80,
  });
}

// Medium burst for completing a lesson step or activity
export function celebrateComplete() {
  confetti({
    particleCount: 60,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#FF8C00', '#FFD93D', '#64FFDA', '#FF6B6B'],
    gravity: 0.9,
    ticks: 120,
  });
}

// Big celebration for lighting the fire (all activities done)
export function celebrateFireLit() {
  const duration = 2000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors: ['#FF8C00', '#FF4500', '#FFD93D'],
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors: ['#FF8C00', '#FF4500', '#FFD93D'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
}

// Story completion — gentle falling sparks
export function celebrateStory() {
  confetti({
    particleCount: 80,
    spread: 120,
    origin: { y: 0.3 },
    colors: ['#64FFDA', '#FF8C00', '#FFD93D', '#E0E0E0'],
    gravity: 0.5,
    ticks: 200,
    shapes: ['star'],
    scalar: 1.2,
  });
}

// Unit fully complete — fireworks
export function celebrateUnitComplete() {
  const colors = ['#FF8C00', '#64FFDA', '#FFD93D', '#FF6B6B', '#9B59B6'];

  function fire(x) {
    confetti({
      particleCount: 40,
      angle: x < 0.5 ? 60 : 120,
      spread: 60,
      origin: { x, y: 0.8 },
      colors,
      gravity: 0.8,
      ticks: 150,
    });
  }

  fire(0.2);
  setTimeout(() => fire(0.8), 200);
  setTimeout(() => fire(0.5), 400);
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 160,
      origin: { y: 0.5 },
      colors,
      gravity: 0.6,
      ticks: 200,
    });
  }, 700);
}
