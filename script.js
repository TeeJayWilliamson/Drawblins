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

const waitingMusic = document.getElementById('waiting-music');
const drawingMusic = document.getElementById('drawing-music');
const buzzer = document.getElementById('buzzer');

let viewTime = 20;
let describeTime = 2;
let currentRound = 1;
let currentTimer = null;
let totalDuration = 0;
let usedImages = [];
let audioInitialized = false;
let currentFadeInterval = null;
let targetVolume = 0.6; // Softer volume for music

function updateRoundDisplay() {
  roundDisplay.textContent = `Round ${currentRound}`;
}

function getRandomUnusedImage() {
  if (usedImages.length >= images.length) {
    usedImages = [];
  }
  let availableImages = images.filter(img => !usedImages.includes(img));
  let randomImage = availableImages[Math.floor(Math.random() * availableImages.length)];
  usedImages.push(randomImage);
  return randomImage;
}

// Initialize audio for iPad Safari on first interaction
function initializeAudio() {
  if (audioInitialized) return;
  
  const audioElements = [buzzer, waitingMusic, drawingMusic].filter(el => el);
  
  audioElements.forEach(audio => {
    if (audio) {
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
      }).catch(() => {});
    }
  });
  
  audioInitialized = true;
}

document.addEventListener('click', initializeAudio);
document.addEventListener('touchstart', initializeAudio);

startBtn.addEventListener('click', () => {
  viewTime = parseInt(document.getElementById('view-time').value);
  describeTime = parseInt(document.getElementById('describe-time').value);

  document.getElementById('start-screen').classList.add('hidden');
  resetGameUI();
  startGame();
});

restartBtn.addEventListener('click', () => {
  resetGameUI();
  currentRound = 1;
  usedImages = [];
  updateRoundDisplay();
  phaseIndicator.classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});

nextRoundBtn.addEventListener('click', () => {
  resetGameUI();
  currentRound++;
  updateRoundDisplay();
  phaseIndicator.classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});

resetRoundsBtn.addEventListener('click', () => {
  currentRound = 1;
  usedImages = [];
  updateRoundDisplay();
});

revealBtn.addEventListener('click', () => {
  stopAllMusic();

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

  playMusic('waiting');

  imageContainer.classList.remove('hidden');
  timerContainer.classList.remove('hidden');

  phaseIndicator.textContent = "Study the Monster!";
  phaseIndicator.style.backgroundColor = "#ecf0f1";
  phaseIndicator.style.color = "#34495e";
  phaseIndicator.style.display = "block";
  phaseIndicator.classList.remove('hidden');

  startTimer(viewTime, () => {
    playMusic('drawing');

    imageContainer.classList.add('hidden');
    thinkingScreen.classList.remove('hidden');

    phaseIndicator.textContent = "Drawing Phase!";
    phaseIndicator.style.backgroundColor = "#9b59b6";
    phaseIndicator.style.color = "white";
    phaseIndicator.classList.remove('hidden');

    startTimer(describeTime * 60, () => {
      stopAllMusic();
      thinkingScreen.classList.add('hidden');
      phaseIndicator.classList.add('hidden');
      phaseIndicator.textContent = "";

      revealContainer.classList.remove('hidden');
      endScreen.classList.remove('hidden');
    });
  });
}

function resetGameUI() {
  stopAllMusic();

  imageContainer.classList.add('hidden');
  thinkingScreen.classList.add('hidden');
  timerContainer.classList.add('hidden');
  revealContainer.classList.add('hidden');
  endScreen.classList.add('hidden');

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

      if (buzzer) {
        buzzer.currentTime = 0;
        buzzer.volume = 1;
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

function playMusic(phase) {
  if (phase === 'drawing' && drawingMusic) {
    // Crossfade from waiting to drawing
    if (waitingMusic && !waitingMusic.paused) {
      crossfadeAudio(waitingMusic, drawingMusic, 1500);
    } else {
      fadeInAudio(drawingMusic, 2000);
    }
  } else if (phase === 'waiting' && waitingMusic) {
    stopAllMusicImmediate(); // Stop any currently playing music immediately
    fadeInAudio(waitingMusic, 2000);
  }
}

function stopAllMusic() {
  // Clear any existing fade interval
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }

  // Fade out both music tracks
  if (waitingMusic && !waitingMusic.paused) {
    fadeOutAudio(waitingMusic, 2000);
  }
  if (drawingMusic && !drawingMusic.paused) {
    fadeOutAudio(drawingMusic, 2000);
  }
}

function stopAllMusicImmediate() {
  // Clear any existing fade interval
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }

  // Stop both music tracks immediately
  if (waitingMusic) {
    waitingMusic.pause();
    waitingMusic.currentTime = 0;
    waitingMusic.volume = 0;
  }
  if (drawingMusic) {
    drawingMusic.pause();
    drawingMusic.currentTime = 0;
    drawingMusic.volume = 0;
  }
}

function fadeInAudio(audio, duration = 2000) {
  if (!audio) return;
  
  // Clear any existing fade
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }
  
  // Ensure audio is reset
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0;
  
  // Start playing
  audio.play().catch((error) => {
    console.log('Audio play failed:', error);
    return;
  });
  
  const steps = 40; // Number of steps in the fade
  const stepSize = targetVolume / steps;
  const stepInterval = duration / steps;
  let currentStep = 0;
  
  currentFadeInterval = setInterval(() => {
    if (audio.paused) {
      // If audio stopped playing, clear the interval
      clearInterval(currentFadeInterval);
      currentFadeInterval = null;
      return;
    }
    
    currentStep++;
    audio.volume = Math.min(targetVolume, currentStep * stepSize);
    
    if (currentStep >= steps) {
      clearInterval(currentFadeInterval);
      currentFadeInterval = null;
      audio.volume = targetVolume;
    }
  }, stepInterval);
}

function crossfadeAudio(fadeOutAudio, fadeInAudio, duration = 1500) {
  if (!fadeOutAudio || !fadeInAudio) return;
  
  // Clear any existing fade
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }
  
  // Start the new audio
  fadeInAudio.pause();
  fadeInAudio.currentTime = 0;
  fadeInAudio.volume = 0;
  fadeInAudio.play().catch(() => {});
  
  const steps = 30; // Number of steps in the crossfade
  const stepInterval = duration / steps;
  const fadeOutStart = fadeOutAudio.volume;
  const fadeOutStep = fadeOutStart / steps;
  const fadeInStep = targetVolume / steps;
  let currentStep = 0;
  
  currentFadeInterval = setInterval(() => {
    currentStep++;
    
    // Fade out the old audio
    if (!fadeOutAudio.paused) {
      fadeOutAudio.volume = Math.max(0, fadeOutStart - (currentStep * fadeOutStep));
    }
    
    // Fade in the new audio
    if (!fadeInAudio.paused) {
      fadeInAudio.volume = Math.min(targetVolume, currentStep * fadeInStep);
    }
    
    if (currentStep >= steps) {
      clearInterval(currentFadeInterval);
      currentFadeInterval = null;
      
      // Finalize volumes
      fadeOutAudio.pause();
      fadeOutAudio.currentTime = 0;
      fadeOutAudio.volume = 0;
      fadeInAudio.volume = targetVolume;
    }
  }, stepInterval);
}

function fadeOutAudio(audio, duration = 2000) {
  if (!audio || audio.paused) return;
  
  // Clear any existing fade
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
  }
  
  const startVolume = audio.volume;
  const steps = 40; // Number of steps in the fade
  const stepSize = startVolume / steps;
  const stepInterval = duration / steps;
  let currentStep = 0;
  
  currentFadeInterval = setInterval(() => {
    currentStep++;
    audio.volume = Math.max(0, startVolume - (currentStep * stepSize));
    
    if (currentStep >= steps || audio.volume <= 0) {
      clearInterval(currentFadeInterval);
      currentFadeInterval = null;
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
    }
  }, stepInterval);
}

// Mobile touch picker code (unchanged)
function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

if (isMobile()) {
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("mobile-turn-picker").style.display = "block";
  });

  let activeTouches = [];

  document.addEventListener("touchstart", (e) => {
    activeTouches = Array.from(e.touches);
    drawTouches(activeTouches);
  });

  document.addEventListener("touchend", (e) => {
    activeTouches = Array.from(e.touches);
    drawTouches(activeTouches);
  });

  function drawTouches(touches) {
    const container = document.getElementById("touch-area");
    container.innerHTML = "";
    touches.forEach((touch, index) => {
      const dot = document.createElement("div");
      dot.className = "finger-dot";
      dot.style.left = `${touch.clientX - 25}px`;
      dot.style.top = `${touch.clientY - 25}px`;
      dot.innerText = index + 1;
      container.appendChild(dot);
    });
  }

  window.chooseRandomFinger = function () {
    if (activeTouches.length === 0) return alert("No fingers on screen!");
    const index = Math.floor(Math.random() * activeTouches.length);
    alert(`🎯 Player ${index + 1} goes first!`);
  };

  window.shuffleOrder = function () {
    if (activeTouches.length === 0) return alert("No fingers on screen!");
    const order = [...Array(activeTouches.length).keys()].map(i => i + 1);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    alert(`🔄 Turn Order: ${order.join(", ")}`);
  };
}

// Init
updateRoundDisplay();
phaseIndicator.classList.add('hidden');
phaseIndicator.textContent = "";
phaseIndicator.style.backgroundColor = "";
phaseIndicator.style.color = "";
phaseIndicator.style.display = "none";