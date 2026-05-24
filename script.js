import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";
import { getDatabase, ref, onValue, set, onDisconnect } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAPm8wSP2PMvEziYDqXa_kKw-lQ4Np5jGg",
    authDomain: "russian-roulette-af904.firebaseapp.com",
    databaseURL: "https://russian-roulette-af904-default-rtdb.firebaseio.com/",
    projectId: "russian-roulette-af904",
    storageBucket: "russian-roulette-af904.firebasestorage.app",
    messagingSenderId: "952272537002",
    appId: "1:952272537002:web:fdcc528fc30925519117d3",
    measurementId: "G-CY8KRDFELT"
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);
const db = getDatabase(app);

window.gameRef = ref(db, 'rooms/main_room/gameState');
window.dbSet = set;
window.activePresence = {};

window.setupPresence = function(uid) {
    const myPresenceRef = ref(db, 'rooms/main_room/presence/' + uid);
    set(myPresenceRef, true);
    onDisconnect(myPresenceRef).remove();
};

const ASSETS = {
    images: {
        gun: 'assets/images/gun.png',
        cylinder: 'assets/images/cylinder.png',
        aim: 'assets/images/aim.png',
        unaim: 'assets/images/unaim.png'
    },
    sounds: {
        cylinder_spin: 'assets/sounds/cylinder_spin.mp3',
        revolver_spin: 'assets/sounds/revolver_spin.mp3',
        cock: 'assets/sounds/cock.mp3',
        click: 'assets/sounds/click.mp3',
        bang: 'assets/sounds/bang.mp3',
        heartbeat: 'assets/sounds/heartbeat.mp3'
    }
};

let me = null;
let lastHandledDeathId = null;
let playerListCollapsed = false;
let spectatorListCollapsed = true;

window.gameState = {
    status: 'idle',
    players: [],
    spectators: [],
    currentPlayerIndex: 0,
    bulletPositions: [],
    currentChamber: 0,
    maxChambers: 6,
    bulletCount: 1,
    deathMessage: '',
    turnResult: null,
    lastSound: null,
    lastDeathAnnouncement: null
};

const audios = {};
Object.entries(ASSETS.sounds).forEach(([key, url]) => {
    audios[key] = new Audio(url);
});

window.playSound = function(type) {
    const sound = audios[type];
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
};

window.updateGame = function(newState) {
    if (window.dbSet && window.gameRef) {
        window.dbSet(window.gameRef, newState);
    } else {
        window.gameState = newState;
        window.render();
    }
};

window.handleJoin = function(role) {
    const nameInput = document.getElementById('nickname-input');
    const name = nameInput.value.trim();
    if (!name) return alert('닉네임을 입력해주세요.');

    const isSystem = name === 'SYSTEM';
    me = { id: Date.now().toString(), name, role, isSystem, joinTime: Date.now() };
    let newState = { ...window.gameState };

    if (role === 'player') {
        if (!newState.players) newState.players = [];
        if (isSystem) {
            newState.players.unshift({ ...me, isDead: false });
        } else {
            newState.players.push({ ...me, isDead: false });
        }
    } else {
        if (!newState.spectators) newState.spectators = [];
        newState.spectators.push({ ...me });
    }

    window.updateGame(newState);
    if (window.setupPresence) window.setupPresence(me.id);

    const loginScreen = document.getElementById('login-screen');
    loginScreen.style.opacity = '0';
    loginScreen.style.transition = 'opacity .5s ease';

    setTimeout(() => {
        loginScreen.classList.add('hidden');
        const gameScreen = document.getElementById('game-screen');
        gameScreen.classList.remove('hidden');
        gameScreen.style.opacity = '0';
        setTimeout(() => {
            gameScreen.style.transition = 'opacity .8s ease';
            gameScreen.style.opacity = '1';
        }, 50);
        window.render();
    }, 500);
};

window.saveAndStartGame = function() {
    const chambers = parseInt(document.getElementById('sys-chambers').value) || 6;
    const bullets = parseInt(document.getElementById('sys-bullets').value) || 1;
    const msg = document.getElementById('sys-msg').value || '';

    if (bullets >= chambers) {
        alert('실탄 수는 약실 수보다 적어야 합니다.');
        return;
    }

    let newState = { ...window.gameState };
    newState.maxChambers = chambers;
    newState.bulletCount = bullets;
    newState.deathMessage = msg;

    window.updateGame(newState);
    startGame();
};

function startGame() {
    if (window.gameState.status !== 'idle') return;

    const hasRealPlayer = window.gameState.players.some(p => !p.isSystem && !p.isDead);
    if (!hasRealPlayer) {
        alert('게임을 진행할 실제 플레이어가 없습니다.');
        return;
    }

    let newState = { ...window.gameState };
    newState.status = 'loading';
    newState.lastSound = { sound: 'cylinder_spin', timestamp: Date.now() };
    window.updateGame(newState);

    setTimeout(() => {
        newState.status = 'switching';
        window.updateGame(newState);
        setTimeout(() => {
            newState.status = 'waiting';
            let positions = [];
            while (positions.length < newState.bulletCount) {
                let r = Math.floor(Math.random() * newState.maxChambers);
                if (!positions.includes(r)) positions.push(r);
            }
            newState.bulletPositions = positions;
            newState.currentChamber = 0;
            newState.currentPlayerIndex = newState.players.findIndex(p => !p.isSystem && !p.isDead);
            window.updateGame(newState);
        }, 800);
    }, 3500);
}

window.pullTrigger = function() {
    if (window.gameState.status !== 'waiting') return;

    let newState = { ...window.gameState };
    newState.status = 'spinning';
    newState.lastSound = { sound: 'revolver_spin', timestamp: Date.now() };
    window.updateGame(newState);

    setTimeout(() => {
        newState.status = 'pre-zoom';
        window.updateGame(newState);
        setTimeout(() => {
            newState.status = 'zooming';
            newState.lastSound = { sound: 'heartbeat', timestamp: Date.now() };
            window.updateGame(newState);
            setTimeout(() => {
                newState.status = 'aiming';
                newState.lastSound = { sound: 'cock', timestamp: Date.now() };
                window.updateGame(newState);
                setTimeout(() => {
                    const isDead = newState.bulletPositions.includes(newState.currentChamber);
                    if (isDead) {
                        newState.players[newState.currentPlayerIndex].isDead = true;
                        newState.turnResult = 'dead';
                        newState.lastDeathAnnouncement = {
                            playerName: newState.players[newState.currentPlayerIndex].name,
                            timestamp: Date.now()
                        };
                        newState.lastSound = { sound: 'bang', timestamp: Date.now() };
                    } else {
                        newState.currentChamber++;
                        newState.turnResult = 'alive';
                        newState.lastSound = { sound: 'click', timestamp: Date.now() };
                    }

                    newState.status = 'resolved';
                    window.updateGame(newState);

                    if (newState.turnResult === 'alive') {
                        setTimeout(() => {
                            let activeState = { ...window.gameState };
                            let nextIndex = (activeState.currentPlayerIndex + 1) % activeState.players.length;
                            while (activeState.players[nextIndex].isDead || activeState.players[nextIndex].isSystem) {
                                nextIndex = (nextIndex + 1) % activeState.players.length;
                            }
                            activeState.currentPlayerIndex = nextIndex;
                            activeState.status = 'waiting';
                            activeState.turnResult = null;
                            window.updateGame(activeState);
                        }, 2000);
                    } else {
                        const remainingBullets = newState.bulletPositions.filter(pos => pos > newState.currentChamber).length;
                        if (remainingBullets > 0) {
                            setTimeout(() => {
                                let activeState = { ...window.gameState };
                                const aliveCount = activeState.players.filter(p => !p.isSystem && !p.isDead).length;
                                if (aliveCount > 0) {
                                    let nextIndex = (activeState.currentPlayerIndex + 1) % activeState.players.length;
                                    while (activeState.players[nextIndex].isDead || activeState.players[nextIndex].isSystem) {
                                        nextIndex = (nextIndex + 1) % activeState.players.length;
                                    }
                                    activeState.currentPlayerIndex = nextIndex;
                                    activeState.currentChamber++;
                                    activeState.status = 'waiting';
                                    activeState.turnResult = null;
                                    window.updateGame(activeState);
                                }
                            }, 4000);
                        }
                    }
                }, 5000);
            }, 3000);
        }, 1000);
    }, 3500);
};

function playEliminatedGlitch() {
    const el = document.getElementById('eliminated-text');
    const original = 'GOOD BYE';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
    let frame = 0;
    el.innerText = '';

    const interval = setInterval(() => {
        const newText = original.split('').map((char, i) => {
            if (char === ' ') return ' ';
            if (Math.random() < frame / 20) return original[i];
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        el.innerText = newText;
        frame++;
        if (frame > 20) {
            clearInterval(interval);
            el.innerText = original;
        }
    }, 60);
}

function createBloodSplatter() {
    const container = document.getElementById('blood-splatter');
    container.innerHTML = '';
    for (let i = 0; i < 15; i++) {
        const size = Math.random() * 200 + 50;
        const drop = document.createElement('div');
        drop.style.position = 'absolute';
        drop.style.backgroundColor = '#4a0404';
        drop.style.top = `${Math.random() * 100}%`;
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.width = `${size}px`;
        drop.style.height = `${size}px`;
        drop.style.opacity = Math.random() * .4 + .1;
        drop.style.borderRadius = '50%';
        drop.style.filter = `blur(${Math.random() * 15 + 10}px)`;
        container.appendChild(drop);
    }
}

window.render = function() {
    const statusContainer = document.getElementById('status-container');
    const gunImage = document.getElementById('gun-image');
    const controlArea = document.getElementById('control-area');
    const playerList = document.getElementById('player-list');
    const spectatorList = document.getElementById('spectator-list');
    const spectatorCount = document.getElementById('spectator-count');
    const deathOverlay = document.getElementById('death-overlay');
    const aimingImage = document.getElementById('aiming-image');
    const deathAnnouncement = document.getElementById('death-announcement');
    const state = window.gameState;
    const currentPlayer = state.players[state.currentPlayerIndex];
    const isMyTurn = me && me.role === 'player' && currentPlayer && currentPlayer.id === me.id;

    const visiblePlayers = playerListCollapsed
        ? state.players.filter((p, idx) => idx === state.currentPlayerIndex && !p.isDead && !p.isSystem)
        : state.players;

    playerList.innerHTML = visiblePlayers.map((p) => {
        const realIndex = state.players.findIndex(x => x.id === p.id);
        const isCurrent = realIndex === state.currentPlayerIndex && !p.isDead && !p.isSystem;
        const systemTag = p.isSystem ? `<span class="text-[9px] text-red-500 ml-2 border border-red-500/30 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">SYSTEM</span>` : '';
        const meTag = p.id === me?.id && !p.isSystem ? `<span class="text-[9px] text-[#d4af37] ml-2 border border-[#d4af37]/30 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Me</span>` : '';
        const statusLight = p.isSystem ? '' : (p.isDead ? '<div class="w-1.5 h-1.5 rounded-full bg-red-600 ml-2 shrink-0"></div>' : '<div class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-2 shrink-0"></div>');

        return `
        <li class="flex items-center px-[clamp(6px,0.7vw,16px)] py-[clamp(4px,0.55vw,10px)] rounded-md transition-all overflow-hidden whitespace-nowrap min-w-0 ${isCurrent ? 'bg-white/5 border border-white/5' : ''}" style="margin-bottom: 10px;">
            <span class="font-light flex-1 truncate min-w-0 text-[clamp(11px,0.6vw,16px)] ${p.isDead ? 'text-white/20 line-through' : (isCurrent ? 'text-white' : 'text-white/50')}" style="font-size: 13px;">${p.name}</span>
            ${statusLight}${systemTag}${meTag}
            ${me?.isSystem && p.id !== me.id ? `<button onclick="kickUser('${p.id}','player')" class="ml-2 text-[9px] px-1.5 py-0.5 rounded-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all shrink-0">추방</button>` : ''}
        </li>`;
    }).join('');

    const specs = state.spectators || [];
    spectatorCount.innerText = specs.length;

    spectatorList.innerHTML = specs.map(s => {
        const meTag = s.id === me?.id ? `<span class="text-[9px] text-[#d4af37] ml-2 border border-[#d4af37]/30 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Me</span>` : '';
        return `
        <li class="flex items-center px-2 py-1 rounded-md overflow-hidden whitespace-nowrap min-w-0">
            <div class="w-1 h-1 rounded-full bg-white/30 mr-2 shrink-0"></div>
            <span class="font-light flex-1 truncate min-w-0 text-white/40 text-[clamp(8px,0.62vw,12px)]">${s.name}</span>
            ${meTag}
            ${me?.isSystem && s.id !== me.id ? `<button onclick="kickUser('${s.id}','spectator')" class="ml-2 text-[9px] px-1.5 py-0.5 rounded-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all shrink-0">추방</button>` : ''}
        </li>`;
    }).join('');

    const playerToggleBtn = document.getElementById('toggle-player-list');
    const spectatorToggleBtn = document.getElementById('toggle-spectator-list');

    if (playerToggleBtn) {
        playerToggleBtn.innerText = playerListCollapsed ? '∧' : '∨';
        playerToggleBtn.onclick = () => {
            playerListCollapsed = !playerListCollapsed;
            window.render();
        };
    }

    if (spectatorToggleBtn) {
        spectatorToggleBtn.innerText = spectatorListCollapsed ? '∧' : '∨';
        spectatorToggleBtn.onclick = () => {
            spectatorListCollapsed = !spectatorListCollapsed;
            spectatorList.classList.toggle('hidden', spectatorListCollapsed);
            spectatorList.classList.toggle('flex', !spectatorListCollapsed);
            window.render();
        };
    }

    spectatorList.classList.toggle('hidden', spectatorListCollapsed);
    spectatorList.classList.toggle('flex', !spectatorListCollapsed);

    gunImage.classList.remove('animate-spin-decelerate', 'zoom-in', 'zoom-out', 'cylinder-idle', 'cylinder-active', 'fade-out', 'gun-dimmed');
    gunImage.offsetHeight;
    aimingImage.classList.remove('aiming-show');
    aimingImage.src = isMyTurn ? ASSETS.images.aim : ASSETS.images.unaim;

    let statusHtml = '';
    switch (state.status) {
        case 'idle':
            statusHtml = `<h2 class="text-sm font-light text-white/40 tracking-[0.5em] uppercase">Standby</h2>`;
            gunImage.classList.add('cylinder-idle');
            gunImage.src = ASSETS.images.cylinder;
            break;
        case 'loading':
            statusHtml = `<h2 class="text-lg text-white/80 font-light tracking-[0.4em] uppercase animate-pulse">Chambering</h2>`;
            gunImage.classList.add('cylinder-active', 'animate-spin-decelerate');
            gunImage.src = ASSETS.images.cylinder;
            break;
        case 'switching':
            gunImage.classList.add('fade-out');
            break;
        case 'waiting':
            statusHtml = `
            <div class="flex flex-col items-center opacity-0 animate-[fadeIn_0.5s_ease_forwards]">
                <span class="text-[9px] text-[#d4af37] tracking-[0.3em] uppercase mb-2 font-light">Current Turn</span>
                <h2 class="text-2xl font-light tracking-[0.2em] text-white">${currentPlayer?.name || ''}</h2>
            </div>`;
            gunImage.src = ASSETS.images.gun;
            gunImage.classList.add('cylinder-active', 'zoom-out');
            break;
        case 'spinning':
            statusHtml = `<h2 class="text-xl font-light text-white/60 tracking-[0.4em] animate-pulse">Spinning</h2>`;
            gunImage.src = ASSETS.images.gun;
            gunImage.classList.add('cylinder-active', 'animate-spin-decelerate');
            break;
        case 'zooming':
            statusHtml = `<div class="w-1.5 h-1.5 bg-white/50 rounded-full animate-ping"></div>`;
            gunImage.src = ASSETS.images.gun;
            gunImage.classList.add('cylinder-active', 'zoom-in');
            break;
        case 'aiming':
            statusHtml = `<h2 class="text-sm font-light text-red-500/80 tracking-[0.6em] uppercase">Target Locked</h2>`;
            gunImage.src = ASSETS.images.gun;
            gunImage.classList.add('cylinder-active', 'zoom-in', 'gun-dimmed');
            aimingImage.classList.add('aiming-show');
            break;
        case 'resolved':
            if (state.turnResult === 'alive') {
                statusHtml = `<h2 class="text-2xl font-light text-white/50 tracking-[0.4em] uppercase">Clear</h2>`;
                gunImage.src = ASSETS.images.gun;
                gunImage.classList.add('cylinder-active', 'zoom-out');
            }
            break;
    }

    statusContainer.innerHTML = statusHtml;
    const bulletIndicator = document.getElementById('bullet-indicator');
    let dotsHtml = '';

    for (let i = 0; i < state.maxChambers; i++) {
        if (state.status === 'resolved' && state.turnResult === 'dead' && i === state.currentChamber) {
            dotsHtml += '<div class="w-2.5 h-2.5 rounded-full bg-red-600"></div>';
        } else if (i < state.currentChamber) {
            dotsHtml += '<div class="w-2.5 h-2.5 rounded-full border border-white/20 bg-transparent"></div>';
        } else {
            dotsHtml += '<div class="w-2.5 h-2.5 rounded-full bg-white/60"></div>';
        }
    }
    bulletIndicator.innerHTML = dotsHtml;
    controlArea.innerHTML = '';

    if (me && me.role === 'player') {
        if (state.status === 'idle') {
            if (me.isSystem) {
                controlArea.innerHTML = `
                <div class="flex flex-col gap-4 w-full max-w-sm text-left bg-white/[0.02] p-5 rounded-xl border border-white/10">
                    <div class="flex gap-4">
                        <div class="flex-1">
                            <label class="text-[10px] text-white/50 tracking-widest uppercase mb-1 block text-center">Chambers</label>
                            <input type="number" id="sys-chambers" value="${state.maxChambers}" min="2" max="20" class="w-full bg-white/5 border border-white/20 rounded text-white px-3 py-2 outline-none text-center font-light">
                        </div>
                        <div class="flex-1">
                            <label class="text-[10px] text-white/50 tracking-widest uppercase mb-1 block text-center">Bullets</label>
                            <input type="number" id="sys-bullets" value="${state.bulletCount}" min="1" max="19" class="w-full bg-white/5 border border-white/20 rounded text-white px-3 py-2 outline-none text-center font-light">
                        </div>
                    </div>
                    <div>
                        <label class="text-[10px] text-white/50 tracking-widest uppercase mb-1 block text-center">Death Message</label>
                        <input type="text" id="sys-msg" value="${state.deathMessage}" placeholder="Enter Custom Message" class="w-full bg-white/5 border border-white/20 rounded text-white px-3 py-2 outline-none text-center text-sm font-light">
                    </div>
                    <button onclick="window.saveAndStartGame()" class="mt-2 bg-white text-black font-semibold py-3 px-10 rounded-lg tracking-[0.2em] text-xs uppercase hover:bg-gray-200 transition-all">Apply & Start</button>
                </div>`;
            } else {
                controlArea.innerHTML = `<span class="text-xs font-light text-white/40 tracking-[0.2em] uppercase">Waiting for System to start...</span>`;
            }
        } else if (state.status === 'waiting' && isMyTurn && !me.isSystem) {
            const btn = document.createElement('button');
            btn.className = 'bg-red-900/20 text-red-500 border border-red-900/50 font-light text-lg tracking-[0.4em] py-4 px-14 rounded-lg hover:bg-red-900/40 hover:text-white transition-all backdrop-blur-sm';
            btn.innerText = 'FIRE';
            btn.onclick = window.pullTrigger;
            controlArea.appendChild(btn);
        }
    }

    if (state.lastDeathAnnouncement && me && currentPlayer && me.id !== currentPlayer.id) {
        const diff = Date.now() - state.lastDeathAnnouncement.timestamp;
        if (diff < 4000) {
            deathAnnouncement.innerText = `${state.lastDeathAnnouncement.playerName}님이 사망하셨습니다`;
            deathAnnouncement.style.opacity = '1';
        } else {
            deathAnnouncement.style.opacity = '0';
        }
    } else {
        deathAnnouncement.style.opacity = '0';
    }

    if (state.status === 'resolved' && state.turnResult === 'dead') {
        deathOverlay.classList.remove('hidden');
        const textContainer = document.getElementById('eliminated-text-container');
        const customTextEl = document.getElementById('custom-death-text');
        const amIDeadPlayer = me && me.id === currentPlayer?.id;

        if (amIDeadPlayer) {
            deathOverlay.style.backgroundColor = 'rgba(3,3,3,.95)';
            textContainer.classList.remove('hidden');
            customTextEl.innerText = state.deathMessage || '';
            const currentDeathId = `${state.currentPlayerIndex}-${state.currentChamber}`;
            if (lastHandledDeathId !== currentDeathId) {
                createBloodSplatter();
                playEliminatedGlitch();
                lastHandledDeathId = currentDeathId;
            }
        } else {
            textContainer.classList.add('hidden');
        }
    } else {
        deathOverlay.classList.add('hidden');
        lastHandledDeathId = null;
    }
};

let isFirstLoad = true;

onValue(window.gameRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const prevSoundTime = window.gameState.lastSound?.timestamp;
        window.gameState = data;
        if (!window.gameState.players) window.gameState.players = [];
        if (!window.gameState.spectators) window.gameState.spectators = [];

        if (!isFirstLoad && window.gameState.lastSound && window.gameState.lastSound.timestamp !== prevSoundTime) {
            window.playSound(window.gameState.lastSound.sound);
        }
        window.render();
        isFirstLoad = false;
    }
});
