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
  startGame();
});

restartBtn.addEventListener('click', () => {
  currentRound = 1;
  usedImages = [];
  updateRoundDisplay();
  endScreen.classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});

nextRoundBtn.addEventListener('click', () => {
  currentRound++;
  updateRoundDisplay();
  endScreen.classList.add('hidden');
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
  phaseIndicator.classList.remove('hidden');
  phaseIndicator.textContent = "The Monster Revealed!";
  phaseIndicator.style.backgroundColor = "#e74c3c";
  phaseIndicator.style.color = "white";
});

function startGame() {
  const randomImage = getRandomUnusedImage();
  monsterImage.src = randomImage;

  // Reset phase indicator
  phaseIndicator.textContent = "Study the Monster!";
  phaseIndicator.style.backgroundColor = "#ecf0f1";
  phaseIndicator.style.color = "#34495e";

  imageContainer.classList.remove('hidden');
  phaseIndicator.classList.remove('hidden');
  timerContainer.classList.remove('hidden');

  // Phase 1: View the monster
  startTimer(viewTime, () => {
    imageContainer.classList.add('hidden');
    phaseIndicator.classList.add('hidden');
    thinkingScreen.classList.remove('hidden');
    phaseIndicator.textContent = "Drawing Phase!";
    phaseIndicator.style.backgroundColor = "#9b59b6";
    phaseIndicator.style.color = "white";
    
startTimer(describeTime * 60, () => {
  thinkingScreen.classList.add('hidden');
  phaseIndicator.classList.add('hidden');
  revealContainer.classList.remove('hidden');
  endScreen.classList.remove('hidden');
});

  });
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
      timerDisplay.classList.remove('timer-warning');
      
      // Play buzzer
      const buzzer = document.getElementById('buzzer');
      if (buzzer) {
        buzzer.currentTime = 0;
        buzzer.play().catch(() => {
          // Handle play promise rejection (user hasn't interacted)
          // Just ignore or log if needed
        });
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
  
  // Change color based on time remaining
  if (percentage > 50) {
    progressBar.style.background = 'linear-gradient(90deg, #4CAF50, #8BC34A)';
  } else if (percentage > 25) {
    progressBar.style.background = 'linear-gradient(90deg, #FF9800, #FFC107)';
  } else {
    progressBar.style.background = 'linear-gradient(90deg, #F44336, #FF5722)';
  }
}

// Initialize round display
updateRoundDisplay();