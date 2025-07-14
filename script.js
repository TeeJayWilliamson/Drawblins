const totalImages = 158;
const images = Array.from({ length: totalImages }, (_, i) => `images/monster${i + 1}.png`);

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const nextRoundBtn = document.getElementById('next-round-btn');
const resetRoundsBtn = document.getElementById('reset-rounds-btn');
const revealBtn = document.getElementById('reveal-btn');
const monsterImage = document.getElementById('monster-image');
const imageContainer = document.getElementById('image-container');
const thinkingScreen = document.getElementById('thinking-screen');
const timerContainer = document.getElementById('timer-container');
const timerDisplay = document.getElementById('timer');
const progressBar = document.getElementById('progress-bar');
const phaseIndicator = document.getElementById('phase-indicator');
const endScreen = document.getElementById('end-screen');
const revealContainer = document.getElementById('reveal-container');
const roundDisplay = document.getElementById('round-display');

let viewTime = 20;
let describeTime = 2;
let currentRound = 1;
let currentTimer = null;
let totalDuration = 0;
let usedImages = [];

function updateRoundDisplay() {
  roundDisplay.textContent = `Round ${currentRound}`;
}

function getRandomUnusedImage() {
  if (usedImages.length >= images.length) {
    usedImages = []; // Reset if all images used
  }

  let availableImages = images.filter(img => !usedImages.includes(img));
  let randomImage = availableImages[Math.floor(Math.random() * availableImages.length)];
  usedImages.push(randomImage);
  return randomImage;
}

startBtn.addEventListener('click', () => {
  viewTime = parseInt(document.getElementById('view-time').value);
  describeTime = parseInt(document.getElementById('describe-time').value);

  document.getElementById('start-screen').classList.add('hidden');
  resetGameUI(); // Clear any lingering UI from previous round
  startGame();
});

restartBtn.addEventListener('click', () => {
  resetGameUI();
  currentRound = 1;
  usedImages = [];
  updateRoundDisplay();
  // Ensure phase indicator is hidden before showing start screen
  phaseIndicator.classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});

nextRoundBtn.addEventListener('click', () => {
  resetGameUI();
  currentRound++;
  updateRoundDisplay();
  // Ensure phase indicator is hidden before showing start screen
  phaseIndicator.classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});

resetRoundsBtn.addEventListener('click', () => {
  currentRound = 1;
  usedImages = [];
  updateRoundDisplay();
});

revealBtn.addEventListener('click', () => {
  revealContainer.classList.add('hidden');
  thinkingScreen.classList.add('hidden');
  imageContainer.classList.remove('hidden');

  phaseIndicator.textContent = "The Monster Revealed!";
  phaseIndicator.style.backgroundColor = "#e74c3c";
  phaseIndicator.style.color = "white";
  phaseIndicator.style.display = "block";
  phaseIndicator.classList.remove('hidden');
});

function startGame() {
  const randomImage = getRandomUnusedImage();
  monsterImage.src = randomImage;

  // Phase 1: Study the monster
  imageContainer.classList.remove('hidden');
  timerContainer.classList.remove('hidden');

  phaseIndicator.textContent = "Study the Monster!";
  phaseIndicator.style.backgroundColor = "#ecf0f1";
  phaseIndicator.style.color = "#34495e";
  phaseIndicator.style.display = "block";
  phaseIndicator.classList.remove('hidden');

  startTimer(viewTime, () => {
    // Transition to drawing phase
    imageContainer.classList.add('hidden');
    thinkingScreen.classList.remove('hidden');

    phaseIndicator.textContent = "Drawing Phase!";
    phaseIndicator.style.backgroundColor = "#9b59b6";
    phaseIndicator.style.color = "white";
    phaseIndicator.style.display = "block";
    phaseIndicator.classList.remove('hidden');

    startTimer(describeTime * 60, () => {
      thinkingScreen.classList.add('hidden');
      phaseIndicator.classList.add('hidden');
      phaseIndicator.textContent = "";

      revealContainer.classList.remove('hidden');
      endScreen.classList.remove('hidden');
    });
  });
}

function resetGameUI() {
  imageContainer.classList.add('hidden');
  thinkingScreen.classList.add('hidden');
  timerContainer.classList.add('hidden');
  revealContainer.classList.add('hidden');
  endScreen.classList.add('hidden');

  // Ensure phase indicator is properly reset
  phaseIndicator.classList.add('hidden');
  phaseIndicator.textContent = "";
  phaseIndicator.style.backgroundColor = "";
  phaseIndicator.style.color = "";
  phaseIndicator.style.display = "none";
  
  timerDisplay.classList.remove('timer-warning');

  if (currentTimer) {
    clearInterval(currentTimer);
    currentTimer = null;
  }

  // Reset progress bar just in case
  updateProgressBar(0);
  updateTimerDisplay(0);
}

function startTimer(duration, callback) {
  if (currentTimer) {
    clearInterval(currentTimer);
  }

  let time = duration;
  totalDuration = duration;
  updateTimerDisplay(time);
  updateProgressBar(time);

  currentTimer = setInterval(() => {
    time--;
    updateTimerDisplay(time);
    updateProgressBar(time);

    if (time <= 10 && time > 0) {
      timerDisplay.classList.add('timer-warning');
    } else {
      timerDisplay.classList.remove('timer-warning');
    }

    if (time <= 0) {
      clearInterval(currentTimer);
      currentTimer = null;
      timerDisplay.classList.remove('timer-warning');

      // Play buzzer sound
      const buzzer = document.getElementById('buzzer');
      if (buzzer) {
        buzzer.currentTime = 0;
        buzzer.play().catch(() => {});
      }

      callback();
    }
  }, 1000);
}

function updateTimerDisplay(seconds) {
  const min = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  timerDisplay.textContent = `${min}:${sec}`;
}

function updateProgressBar(timeLeft) {
  const percentage = (timeLeft / totalDuration) * 100;
  progressBar.style.width = percentage + '%';

  if (percentage > 50) {
    progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
  } else if (percentage > 25) {
    progressBar.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
  } else {
    progressBar.style.background = 'linear-gradient(90deg, #F44336, #FF5722)';
  }
}

// Initialize on page load
updateRoundDisplay();
// Ensure phase indicator is completely hidden and reset on page load
phaseIndicator.classList.add('hidden');
phaseIndicator.textContent = "";
phaseIndicator.style.backgroundColor = "";
phaseIndicator.style.color = "";
phaseIndicator.style.display = "none";