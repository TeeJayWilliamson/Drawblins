let masterSoundEnabled = true;
let windowHasFocus = true;

const totalImages = 258;
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
const difficultySelect = document.getElementById('difficulty-select');
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
let targetVolume = 0.6;
let soundEnabled = true;
let gameVolume = 0.6;
let difficultyRange = { min: 159, max: 258 }; 
let currentViewTime = 20;
let currentDescribeTime = 2;
let currentMusicPhase = null;
let wasPlayingBeforePause = false;

function initializeUnifiedSoundSystem() {
  const soundToggle = document.getElementById('sound-toggle');
  const toggleLabel = soundToggle.nextElementSibling;
  const volumeSlider = document.getElementById('volume-slider');
  const volumeDisplay = document.getElementById('volume-display');
  
  // Set initial states
  soundToggle.checked = masterSoundEnabled;
  toggleLabel.classList.toggle('active', masterSoundEnabled);
  
  // Volume slider
  volumeSlider.addEventListener('input', (e) => {
    gameVolume = e.target.value / 100;
    volumeDisplay.textContent = `${e.target.value}%`;
    updateAudioVolumes();
  });
  
  // Sound toggle - this is the master control
  soundToggle.addEventListener('change', (e) => {
    masterSoundEnabled = e.target.checked;
    toggleLabel.classList.toggle('active', masterSoundEnabled);
    updateAudioVolumes();
  });

  // Window focus/blur handling
  window.addEventListener('blur', () => {
    windowHasFocus = false;
    updateSoundToggle();
    updateAudioVolumes();
  });

  window.addEventListener('focus', () => {
    windowHasFocus = true;
    updateSoundToggle();
    updateAudioVolumes();
  });

  // Visibility change (for mobile/tab switching)
  document.addEventListener('visibilitychange', () => {
    windowHasFocus = !document.hidden;
    updateSoundToggle();
    updateAudioVolumes();
  });
}

// Update the sound toggle to reflect current state
function updateSoundToggle() {
  const soundToggle = document.getElementById('sound-toggle');
  const toggleLabel = soundToggle.nextElementSibling;
  
  // Auto-disable sound when window loses focus
  if (!windowHasFocus) {
    soundToggle.checked = false;
    toggleLabel.classList.remove('active');
  } else {
    // Re-enable sound when window regains focus (if master sound is enabled)
    soundToggle.checked = masterSoundEnabled;
    toggleLabel.classList.toggle('active', masterSoundEnabled);
  }
}

// Determine if sound should actually play
function shouldPlaySound() {
  return masterSoundEnabled && windowHasFocus && audioInitialized;
}

// Update all audio volumes based on current state
function updateAudioVolumes() {
  const targetVol = shouldPlaySound() ? gameVolume : 0;
  
  if (waitingMusic && !waitingMusic.paused) {
    waitingMusic.volume = targetVol;
  }
  if (drawingMusic && !drawingMusic.paused) {
    drawingMusic.volume = targetVol;
  }
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

// Play music based on phase
function playMusic(phase) {
  if (!audioInitialized) return;

  currentMusicPhase = phase;
  
  if (!shouldPlaySound()) {
    // Still track the phase but don't play
    return;
  }

  if (phase === 'drawing' && drawingMusic) {
    if (waitingMusic && !waitingMusic.paused) {
      crossfadeAudio(waitingMusic, drawingMusic, 1500);
    } else {
      fadeInAudio(drawingMusic, 2000);
    }
  } else if (phase === 'waiting' && waitingMusic) {
    stopAllMusicImmediate();
    fadeInAudio(waitingMusic, 2000);
  }
}

// Stop all music
function stopAllMusic() {
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }

  if (waitingMusic && !waitingMusic.paused) {
    fadeOutAudio(waitingMusic, 2000);
  }
  if (drawingMusic && !drawingMusic.paused) {
    fadeOutAudio(drawingMusic, 2000);
  }
  
  currentMusicPhase = null;
}

// Immediate stop (for cleanup)
function stopAllMusicImmediate() {
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }

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

// Resume music if it should be playing
function resumeMusic() {
  if (currentMusicPhase && shouldPlaySound()) {
    playMusic(currentMusicPhase);
  }
}

// Fade in audio
function fadeInAudio(audio, duration = 2000) {
  if (!audio || !shouldPlaySound()) return;
  
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }
  
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 0;
  
  audio.play().catch((error) => {
    console.log('Audio play failed:', error);
    return;
  });
  
  const steps = 40;
  const stepSize = gameVolume / steps;
  const stepInterval = duration / steps;
  let currentStep = 0;
  
  currentFadeInterval = setInterval(() => {
    if (audio.paused || !shouldPlaySound()) {
      clearInterval(currentFadeInterval);
      currentFadeInterval = null;
      return;
    }
    
    currentStep++;
    audio.volume = Math.min(gameVolume, currentStep * stepSize);
    
    if (currentStep >= steps) {
      clearInterval(currentFadeInterval);
      currentFadeInterval = null;
      audio.volume = shouldPlaySound() ? gameVolume : 0;
    }
  }, stepInterval);
}

// Crossfade between two audio tracks
function crossfadeAudio(fadeOutAudio, fadeInAudio, duration = 1500) {
  if (!fadeOutAudio || !fadeInAudio) return;
  
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
    currentFadeInterval = null;
  }
  
  fadeInAudio.pause();
  fadeInAudio.currentTime = 0;
  fadeInAudio.volume = 0;
  
  if (shouldPlaySound()) {
    fadeInAudio.play().catch(() => {});
  }
  
  const steps = 30;
  const stepInterval = duration / steps;
  const fadeOutStart = fadeOutAudio.volume;
  const fadeOutStep = fadeOutStart / steps;
  const fadeInStep = gameVolume / steps;
  let currentStep = 0;
  
  currentFadeInterval = setInterval(() => {
    currentStep++;
    
    if (!fadeOutAudio.paused) {
      fadeOutAudio.volume = Math.max(0, fadeOutStart - (currentStep * fadeOutStep));
    }
    
    if (!fadeInAudio.paused && shouldPlaySound()) {
      fadeInAudio.volume = Math.min(gameVolume, currentStep * fadeInStep);
    }
    
    if (currentStep >= steps) {
      clearInterval(currentFadeInterval);
      currentFadeInterval = null;
      
      fadeOutAudio.pause();
      fadeOutAudio.currentTime = 0;
      fadeOutAudio.volume = 0;
      
      if (shouldPlaySound()) {
        fadeInAudio.volume = gameVolume;
      } else {
        fadeInAudio.pause();
        fadeInAudio.volume = 0;
      }
    }
  }, stepInterval);
}

// Fade out audio
function fadeOutAudio(audio, duration = 2000) {
  if (!audio || audio.paused) return;
  
  if (currentFadeInterval) {
    clearInterval(currentFadeInterval);
  }
  
  const startVolume = audio.volume;
  const steps = 40;
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

// Play buzzer sound
function playBuzzer() {
  if (!shouldPlaySound() || !buzzer) return;
  
  buzzer.currentTime = 0;
  buzzer.volume = gameVolume;
  buzzer.play().catch(() => {});
}

// Export functions for use in your main game logic
window.gameAudio = {
  playMusic,
  stopAllMusic,
  stopAllMusicImmediate,
  resumeMusic,
  playBuzzer,
  initializeAudio
};

// Initialize settings
function initializeSettings() {
  // Sound toggle
  const soundToggle = document.getElementById('sound-toggle');
  const toggleLabel = soundToggle.nextElementSibling;
  
  // Volume slider
  const volumeSlider = document.getElementById('volume-slider');
  const volumeDisplay = document.getElementById('volume-display');
  
  volumeSlider.addEventListener('input', (e) => {
    gameVolume = e.target.value / 100;
    targetVolume = gameVolume;
    volumeDisplay.textContent = `${e.target.value}%`;
    
    // Update current playing audio
    if (waitingMusic && !waitingMusic.paused) {
      waitingMusic.volume = gameVolume;
    }
    if (drawingMusic && !drawingMusic.paused) {
      drawingMusic.volume = gameVolume;
    }
  });

  // Difficulty selector
  difficultySelect.addEventListener('change', (e) => {
    switch(e.target.value) {
      case 'easy':
        difficultyRange = { min: 1, max: 158 };
        break;
      case 'all':
        difficultyRange = { min: 1, max: 258 };
        break;
      case 'standard':
        difficultyRange = { min: 159, max: 258 };
        break;
    }
    usedImages = [];
  });

  // Rule buttons
  const ruleButtons = document.querySelectorAll('.rule-btn');
  ruleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewTime = parseInt(btn.dataset.view);
      const drawTime = parseInt(btn.dataset.draw);
      
      if (viewTime) {
        currentViewTime = viewTime;
        // Update other view time buttons
        ruleButtons.forEach(b => {
          if (b.dataset.view) {
            b.classList.toggle('active', b.dataset.view === viewTime.toString());
          }
        });
      }
      
      if (drawTime) {
        currentDescribeTime = drawTime;
        // Update other draw time buttons
        ruleButtons.forEach(b => {
          if (b.dataset.draw) {
            b.classList.toggle('active', b.dataset.draw === drawTime.toString());
          }
        });
      }
      
      // Update the input fields if they exist
      const viewTimeInput = document.getElementById('view-time');
      const describeTimeInput = document.getElementById('describe-time');
      if (viewTimeInput) viewTimeInput.value = currentViewTime;
      if (describeTimeInput) describeTimeInput.value = currentDescribeTime;
    });
  });
  
  // Set initial active states
  if (toggleLabel) toggleLabel.classList.add('active');
  const defaultViewBtn = document.querySelector('[data-view="20"]');
  const defaultDrawBtn = document.querySelector('[data-draw="2"]');
  if (defaultViewBtn) defaultViewBtn.classList.add('active');
  if (defaultDrawBtn) defaultDrawBtn.classList.add('active');
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
  initializeUnifiedSoundSystem();
  initializeSettings();
});

// Initialize audio on first user interaction
document.addEventListener('click', initializeAudio);
document.addEventListener('touchstart', initializeAudio);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  stopAllMusicImmediate();
});

function updateRoundDisplay() {
  roundDisplay.textContent = `Round ${currentRound}`;
}

function getRandomUnusedImage() {
  // Filter images based on difficulty
  const availableImages = images.filter((img, index) => {
    const imageNum = index + 1;
    return imageNum >= difficultyRange.min && imageNum <= difficultyRange.max;
  });
  
  // Filter out used images
  const unusedImages = availableImages.filter(img => !usedImages.includes(img));
  
  // Reset if all images in range have been used
  if (unusedImages.length === 0) {
    usedImages = usedImages.filter(img => !availableImages.includes(img));
    return getRandomUnusedImage();
  }
  
  const randomImage = unusedImages[Math.floor(Math.random() * unusedImages.length)];
  usedImages.push(randomImage);
  return randomImage;
}

startBtn.addEventListener('click', () => {
  initializeAudio();
  
  viewTime = currentViewTime;
  describeTime = currentDescribeTime;

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

  currentMusicPhase = null;
  wasPlayingBeforePause = false;
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

      playBuzzer();

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

// Turn picker variables
let pickerActive = false;
let pickerHasWinner = false;
let pickerTimeout = null;
let countdownInterval = null;
let activeTouches = [];
let pickerReady = false;

document.getElementById('turn-picker-btn').addEventListener('click', () => {
  document.getElementById('mobile-turn-picker').classList.remove('hidden');
  activatePickerMode();
});

// Prevent context menu on touch area
document.getElementById('touch-area').addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

// Prevent context menu globally on mobile
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  return false;
});

function activatePickerMode() {
  pickerActive = true;
  pickerHasWinner = false;
  pickerReady = false;
  activeTouches = [];
  updatePickerStatus("Place fingers on the screen...");
  document.getElementById("touch-area").innerHTML = "";

  // Clean any old intervals
  if (pickerTimeout) clearTimeout(pickerTimeout);
  if (countdownInterval) clearInterval(countdownInterval);

  // Delay event binding until ready
  setTimeout(() => {
    pickerReady = true;
    document.addEventListener("touchstart", onTouchStart);
    document.addEventListener("touchend", onTouchEnd);
  }, 300);
}

function deactivatePickerMode() {
  pickerActive = false;
  pickerReady = false;
  pickerHasWinner = false;
  activeTouches = [];

  if (pickerTimeout) {
    clearTimeout(pickerTimeout);
    pickerTimeout = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  document.getElementById("touch-area").innerHTML = "";
  updatePickerStatus("Waiting for touches...");

  // Remove touch event listeners to prevent leftover triggers
  document.removeEventListener("touchstart", onTouchStart);
  document.removeEventListener("touchend", onTouchEnd);
}

function updatePickerStatus(message) {
  document.getElementById("picker-status").textContent = message;
}

function startPickerCountdown() {
  if ((pickerTimeout || countdownInterval) || pickerHasWinner) return;

  let countdown = 3;
  updatePickerStatus(`Selecting in ${countdown}...`);

  countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      updatePickerStatus(`Selecting in ${countdown}...`);
    } else {
      clearInterval(countdownInterval);
      countdownInterval = null;
      selectRandomPlayer();
    }
  }, 1000);

  pickerTimeout = setTimeout(() => {
    clearInterval(countdownInterval);
    countdownInterval = null;
    selectRandomPlayer();
  }, 3000);
}

function selectRandomPlayer() {
  if (activeTouches.length === 0 || pickerHasWinner) return;

  pickerHasWinner = true;

  const selectedIndex = Math.floor(Math.random() * activeTouches.length);
  updatePickerStatus(`🎯 Player ${selectedIndex + 1} goes first!`);

  const dots = document.querySelectorAll('.finger-dot');
  dots.forEach((dot, index) => {
    if (index === selectedIndex) {
      dot.classList.add('winner');
    } else {
      dot.style.opacity = '0.3';
    }
  });

  // Cleanup countdowns
  if (pickerTimeout) {
    clearTimeout(pickerTimeout);
    pickerTimeout = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  // Allow player to view for a few seconds before closing
  setTimeout(() => {
    document.getElementById('mobile-turn-picker').classList.add('hidden');
    deactivatePickerMode();
  }, 4000);
}

function drawTouches(touches) {
  if (pickerHasWinner) return;

  const container = document.getElementById("touch-area");
  container.innerHTML = "";

  touches.forEach((touch, index) => {
    const rect = container.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      const dot = document.createElement("div");
      dot.className = "finger-dot";
      dot.style.left = `${x - 35}px`;
      dot.style.top = `${y - 35}px`;
      dot.innerText = index + 1;
      container.appendChild(dot);
    }
  });
}

// Touch event listeners for the picker
function onTouchStart(e) {
  if (!pickerActive || pickerHasWinner || !pickerReady) return;

  activeTouches = Array.from(e.touches);
  drawTouches(activeTouches);

  if (activeTouches.length > 0) {
    startPickerCountdown();
  }
}

function onTouchEnd(e) {
  if (!pickerActive || pickerHasWinner || !pickerReady) return;

  activeTouches = Array.from(e.touches);
  drawTouches(activeTouches);

  if (activeTouches.length > 0) {
    startPickerCountdown();
  } else {
    if (pickerTimeout) {
      clearTimeout(pickerTimeout);
      pickerTimeout = null;
    }

    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    updatePickerStatus("Place fingers on the screen...");
  }
}

document.getElementById("touch-area").addEventListener("mousedown", (e) => {
  if (!pickerActive || pickerHasWinner || !pickerReady) return;

  const rect = e.target.getBoundingClientRect();
  const mockTouch = {
    clientX: e.clientX,
    clientY: e.clientY
  };

  activeTouches = [mockTouch];
  drawTouches(activeTouches);
  startPickerCountdown();
});

// SETTINGS MODAL TOGGLE
document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('hidden');
});

document.getElementById('close-settings').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.add('hidden');
});

// How to Play modal logic
const infoBtn = document.getElementById('info-btn');
const infoModal = document.getElementById('info-modal');
const closeInfo = document.getElementById('close-info');
const closeInfoBottom = document.getElementById('close-info-bottom');

infoBtn.addEventListener('click', () => {
  infoModal.classList.remove('hidden');
});

closeInfo.addEventListener('click', () => {
  infoModal.classList.add('hidden');
});

closeInfoBottom.addEventListener('click', () => {
  infoModal.classList.add('hidden');
});

// Init
updateRoundDisplay();
phaseIndicator.classList.add('hidden');
phaseIndicator.textContent = "";
phaseIndicator.style.backgroundColor = "";
phaseIndicator.style.color = "";
phaseIndicator.style.display = "none";

window.addEventListener('load', () => {
  window.scrollTo(0, 0);
});

window.addEventListener('beforeunload', () => {
  window.scrollTo(0, 0);
});