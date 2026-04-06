// ==================== STATE ====================
var running = false;
var activeStream = null;
var handsModel = null;
var animFrame = null;
var frameCount = 0;
var fpsTimer = 0;
var lastGesture = 'none';
var lastTriggerTime = 0;
var COOLDOWN_MS = 2000;

var canvasEl = document.getElementById('output-canvas');
var ctx = canvasEl.getContext('2d');
var videoEl = document.getElementById('input-video');
var particleCanvas = document.getElementById('particle-canvas');
var pCtx = particleCanvas.getContext('2d');
var particles = [];
var particleAnimFrame = null;
var effectTimeout = null;
var textTimeout = null;

// ==================== GESTURE DEFINITIONS ====================
var GESTURES = [
  {
    id: 'thumbs_up',
    label: 'Thumbs Up',
    icon: '&#128077;',
    desc: 'Originally triggered "Lights On" via Google Home webhook.',
    effect: { type: 'flash', color: 'rgba(255,220,50,0.18)', text: '👍 LIGHTS ON', textColor: '#FFD700', particles: '#FFD700' }
  },
  {
    id: 'peace',
    label: 'Peace Sign',
    icon: '&#9996;',
    desc: 'Originally set bedroom lights to a calm blue scene.',
    effect: { type: 'flash', color: 'rgba(79,196,160,0.15)', text: '✌️ SCENE: CHILL', textColor: '#4fc4a0', particles: '#4fc4a0' }
  },
  {
    id: 'pointing',
    label: 'Pointing Up',
    icon: '&#9757;',
    desc: 'Originally increased light brightness by 25%.',
    effect: { type: 'flash', color: 'rgba(240,240,100,0.12)', text: '☝️ BRIGHTNESS +25%', textColor: '#f0f064', particles: '#f0f064' }
  },
  {
    id: 'open_hand',
    label: 'Open Hand',
    icon: '&#9995;',
    desc: 'Originally triggered "Good Morning" routine across all devices.',
    effect: { type: 'burst', color: 'rgba(124,110,247,0.15)', text: '🖐 GOOD MORNING', textColor: '#7c6ef7', particles: '#7c6ef7' }
  },
  {
    id: 'fist',
    label: 'Fist',
    icon: '&#9994;',
    desc: 'Originally triggered "Lights Off" to turn off all room devices.',
    effect: { type: 'flash', color: 'rgba(232,88,88,0.15)', text: '✊ LIGHTS OFF', textColor: '#e85858', particles: '#e85858' }
  },
  {
    id: 'rock',
    label: 'Rock On',
    icon: '&#129304;',
    desc: 'Originally activated a "Party Mode" light sequence.',
    effect: { type: 'rainbow', color: 'rgba(180,80,255,0.15)', text: '🤘 PARTY MODE', textColor: '#c060ff', particles: '#c060ff' }
  }
];

// ==================== GESTURE DETECTION ====================
var TIP = [4, 8, 12, 16, 20];
var PIP = [3, 7, 11, 15, 19];

function isExtended(lm, finger) {
  if (finger === 0) return lm[4].x < lm[3].x;
  return lm[TIP[finger]].y < lm[PIP[finger]].y;
}

function detectGesture(lm) {
  var ext = [];
  for (var i = 0; i < 5; i++) ext.push(isExtended(lm, i));
  var thumb = ext[0], idx = ext[1], mid = ext[2], ring = ext[3], pinky = ext[4];
  if (thumb && !idx && !mid && !ring && !pinky && lm[4].y < lm[0].y) return 'thumbs_up';
  if (!thumb && idx && mid && !ring && !pinky) return 'peace';
  if (!thumb && idx && !mid && !ring && !pinky) return 'pointing';
  if (idx && mid && ring && pinky) return 'open_hand';
  if (!idx && !mid && !ring && !pinky && !thumb) return 'fist';
  if (!thumb && idx && !mid && !ring && pinky) return 'rock';
  return 'none';
}

// ==================== HAND DRAWING ====================
var CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17]
];

function drawHand(lm, w, h) {
  ctx.strokeStyle = 'rgba(124,110,247,0.7)';
  ctx.lineWidth = 2;
  CONNECTIONS.forEach(function(c) {
    ctx.beginPath();
    ctx.moveTo(lm[c[0]].x * w, lm[c[0]].y * h);
    ctx.lineTo(lm[c[1]].x * w, lm[c[1]].y * h);
    ctx.stroke();
  });
  lm.forEach(function(pt, i) {
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, 4, 0, Math.PI * 2);
    ctx.fillStyle = TIP.indexOf(i) !== -1 ? '#4fc4a0' : '#7c6ef7';
    ctx.fill();
  });
}

// ==================== PARTICLE SYSTEM ====================
function spawnParticles(color, type) {
  var pw = particleCanvas.width;
  var ph = particleCanvas.height;
  var count = type === 'burst' ? 60 : type === 'rainbow' ? 80 : 40;
  var rainbowColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9a3c'];
  for (var i = 0; i < count; i++) {
    var angle = Math.random() * Math.PI * 2;
    var speed = 2 + Math.random() * 6;
    particles.push({
      x: pw / 2,
      y: ph / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (Math.random() * 3),
      life: 1,
      decay: 0.012 + Math.random() * 0.02,
      size: 3 + Math.random() * 6,
      color: type === 'rainbow' ? rainbowColors[Math.floor(Math.random() * rainbowColors.length)] : color
    });
  }
  if (!particleAnimFrame) animateParticles();
}

function animateParticles() {
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particles = particles.filter(function(p) { return p.life > 0; });
  particles.forEach(function(p) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= p.decay;
    pCtx.save();
    pCtx.globalAlpha = Math.max(0, p.life);
    pCtx.fillStyle = p.color;
    pCtx.shadowColor = p.color;
    pCtx.shadowBlur = 8;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    pCtx.fill();
    pCtx.restore();
  });
  if (particles.length > 0) {
    particleAnimFrame = requestAnimationFrame(animateParticles);
  } else {
    particleCanvas.style.opacity = '0';
    particleAnimFrame = null;
  }
}

// ==================== DEMO EFFECTS ====================
function triggerEffect(gesture) {
  var found = GESTURES.filter(function(g) { return g.id === gesture; });
  if (!found.length) return;
  var eff = found[0].effect;
  var overlay = document.getElementById('effect-overlay');
  var effectText = document.getElementById('effect-text');

  if (effectTimeout) clearTimeout(effectTimeout);
  if (textTimeout) clearTimeout(textTimeout);

  // Resize particle canvas to match video panel
  var panel = document.getElementById('video-panel');
  particleCanvas.width = panel.offsetWidth;
  particleCanvas.height = panel.offsetHeight;

  // Flash overlay
  overlay.style.background = eff.color;
  overlay.style.animation = 'none';
  overlay.offsetHeight; // force reflow to restart animation
  overlay.style.animation = 'flashIn 1.2s ease forwards';

  // Text pop
  effectText.textContent = eff.text;
  effectText.style.color = eff.textColor;
  effectText.style.animation = 'none';
  effectText.offsetHeight; // force reflow
  effectText.style.animation = 'textPop 1.4s ease forwards';

  // Particles
  particleCanvas.style.opacity = '1';
  spawnParticles(eff.particles, eff.type);

  // Extra: cycle overlay hue for rainbow mode
  if (eff.type === 'rainbow') {
    var hue = 0;
    var rainbowInterval = setInterval(function() {
      overlay.style.background = 'hsla(' + hue + ',80%,60%,0.1)';
      hue = (hue + 30) % 360;
    }, 80);
    effectTimeout = setTimeout(function() { clearInterval(rainbowInterval); }, 1200);
  }
}

// ==================== MEDIAPIPE ====================
function initHands() {
  handsModel = new Hands({
    locateFile: function(file) {
      return 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/' + file;
    }
  });
  handsModel.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6
  });
  handsModel.onResults(onResults);
}

function onResults(results) {
  var w = canvasEl.width;
  var h = canvasEl.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.scale(-1, 1);
  ctx.translate(-w, 0);
  ctx.drawImage(results.image, 0, 0, w, h);
  ctx.restore();

  var gesture = 'none';
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    var lm = results.multiHandLandmarks[0];
    var mirrored = lm.map(function(p) { return { x: 1 - p.x, y: p.y, z: p.z }; });
    drawHand(mirrored, w, h);
    gesture = detectGesture(lm);
  }

  updateGestureUI(gesture);
  frameCount++;
  var now = performance.now();
  if (now - fpsTimer > 1000) {
    document.getElementById('fps-counter').textContent = frameCount + ' fps';
    frameCount = 0;
    fpsTimer = now;
  }
}

// ==================== CAMERA ====================
async function populateCameras() {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    var devices = await navigator.mediaDevices.enumerateDevices();
    var cameras = devices.filter(function(d) { return d.kind === 'videoinput'; });
    var select = document.getElementById('cam-select');
    select.innerHTML = '';
    cameras.forEach(function(cam, i) {
      var opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label || ('Camera ' + (i + 1));
      select.appendChild(opt);
    });
    addLog('Found ' + cameras.length + ' camera(s)');
    onCamChange();
  } catch(err) {
    addLog('Camera error: ' + err.message);
  }
}

async function onCamChange() {
  var deviceId = document.getElementById('cam-select').value;
  if (!deviceId) return;
  try {
    var probe = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, width: { ideal: 9999 }, height: { ideal: 9999 } },
      audio: false
    });
    var track = probe.getVideoTracks()[0];
    var s = track.getSettings();
    document.getElementById('res-readout').textContent = 'native: ' + s.width + 'x' + s.height;
    addLog('Camera: ' + s.width + 'x' + s.height);
    probe.getTracks().forEach(function(t) { t.stop(); });
  } catch(err) {
    addLog('Probe: ' + err.message);
  }
}

async function startDetection() {
  var deviceId = document.getElementById('cam-select').value;
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-stop').disabled = false;
  document.getElementById('loading-bar').classList.add('active');
  setStatus('', 'loading...');
  addLog('Starting...');

  try {
    activeStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: deviceId ? { exact: deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });

    var track = activeStream.getVideoTracks()[0];
    var s = track.getSettings();
    canvasEl.width = s.width;
    canvasEl.height = s.height;
    document.getElementById('res-readout').textContent = 'cam: ' + s.width + 'x' + s.height;

    videoEl.srcObject = activeStream;
    videoEl.onloadedmetadata = function() { videoEl.play(); };

    initHands();

    document.getElementById('webcam-container').style.display = 'none';
    canvasEl.style.display = 'block';
    document.getElementById('top-label').style.display = 'block';
    document.getElementById('gesture-badge').style.display = 'block';
    document.getElementById('loading-bar').classList.remove('active');
    setStatus('live', 'live');
    running = true;
    fpsTimer = performance.now();
    addLog('Detection started — try a gesture!');
    processFrame();
  } catch(err) {
    addLog('Error: ' + err.message);
    setStatus('error', 'error');
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled = true;
    document.getElementById('loading-bar').classList.remove('active');
  }
}

async function processFrame() {
  if (!running) return;
  if (videoEl.readyState >= 2) {
    await handsModel.send({ image: videoEl });
  }
  animFrame = requestAnimationFrame(processFrame);
}

function stopDetection() {
  running = false;
  cancelAnimationFrame(animFrame);
  if (activeStream) {
    activeStream.getTracks().forEach(function(t) { t.stop(); });
    activeStream = null;
  }
  if (handsModel) { handsModel.close(); handsModel = null; }
  canvasEl.style.display = 'none';
  document.getElementById('webcam-container').style.display = 'flex';
  document.getElementById('webcam-container').innerHTML = '<div class="no-feed"><div class="icon">&#9672;</div><div>Feed stopped</div></div>';
  document.getElementById('top-label').style.display = 'none';
  document.getElementById('gesture-badge').style.display = 'none';
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-stop').disabled = true;
  setStatus('', 'stopped');
  addLog('Stopped');
  GESTURES.forEach(function(g) {
    var card = document.getElementById('card-' + g.id);
    if (card) {
      card.classList.remove('active');
      document.getElementById('status-' + g.id).className = 'gesture-status';
      document.getElementById('status-' + g.id).textContent = 'waiting';
    }
  });
}

// ==================== GESTURE UI ====================
function buildGestureList() {
  var list = document.getElementById('gesture-list');
  list.innerHTML = '';
  GESTURES.forEach(function(g) {
    var card = document.createElement('div');
    card.className = 'gesture-card';
    card.id = 'card-' + g.id;
    card.innerHTML =
      '<div class="gesture-top">' +
        '<span class="gesture-icon">' + g.icon + '</span>' +
        '<span class="gesture-name">' + g.label + '</span>' +
        '<span class="gesture-status" id="status-' + g.id + '">waiting</span>' +
      '</div>' +
      '<div class="gesture-desc">' + g.desc + '</div>';
    list.appendChild(card);
  });
}

function updateGestureUI(gesture) {
  var badge = document.getElementById('gesture-badge');

  GESTURES.forEach(function(g) {
    var card = document.getElementById('card-' + g.id);
    var statusEl = document.getElementById('status-' + g.id);
    if (!card) return;
    if (gesture === g.id) {
      card.classList.add('active');
      statusEl.className = 'gesture-status on';
      statusEl.textContent = 'detected';
    } else {
      card.classList.remove('active');
      statusEl.className = 'gesture-status';
      statusEl.textContent = 'waiting';
    }
  });

  if (gesture !== 'none') {
    var found = GESTURES.filter(function(g) { return g.id === gesture; });
    badge.textContent = found.length > 0 ? found[0].label : gesture;
    badge.style.display = 'block';
  } else {
    badge.textContent = '—';
  }

  // Fire effect on new gesture (with cooldown)
  if (gesture !== 'none' && gesture !== lastGesture) {
    var now = Date.now();
    if (now - lastTriggerTime > COOLDOWN_MS) {
      lastTriggerTime = now;
      triggerEffect(gesture);
      addLog('Gesture: ' + gesture.replace('_', ' '));
    }
  }
  lastGesture = gesture;
}

// ==================== HELPERS ====================
function addLog(msg) {
  var list = document.getElementById('log-list');
  var t = new Date().toTimeString().slice(0, 8);
  var entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = '<span class="log-time">' + t + '</span><span class="log-msg">' + msg + '</span>';
  list.insertBefore(entry, list.firstChild);
  while (list.children.length > 20) list.removeChild(list.lastChild);
}

function setStatus(state, text) {
  document.getElementById('status-dot').className = 'dot ' + state;
  document.getElementById('status-text').textContent = text;
}

// ==================== INIT ====================
buildGestureList();
populateCameras();
