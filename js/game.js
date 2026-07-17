'use strict';
/* ============================================================
   THE SAB — deployed fighter pilot RPG
   ============================================================ */
(() => {
  const T = SPR.T, VW = 20, VH = 13, SCALE = 3;
  const FW = VW * T, FH = VH * T;                 // 320 x 208 internal frame
  const DEPLOY_DAYS = 180;          // 6-month rotation... officially
  const EXTEND_CHANCE = 0.3;        // there's ALWAYS a chance of an extension
  const EXTEND_DAYS = 30;
  const MAX_EXTENSIONS = 2;
  const MIN_PER_SEC = 2;                          // game minutes per real second
  const SAVE_KEY = 'sandbox_rpg_save_v1';

  /* ---------------- canvas / DOM ---------------- */
  const screen = document.getElementById('screen');
  const sctx = screen.getContext('2d');
  const frame = SPR.cv(FW, FH);
  const ctx = frame.getContext('2d');
  sctx.imageSmoothingEnabled = false;

  const el = id => document.getElementById(id);
  const ui = {
    hp: el('bar-hp'), sp: el('bar-sp'), en: el('bar-en'),
    day: el('day'), time: el('time'), sorties: el('sorties'),
    warn: el('warn'), prompt: el('prompt'),
    dialog: el('dialog'), dtext: el('dtext'), dchoices: el('dchoices'), dmore: el('dmore'),
    hud: el('hud'), clockbox: el('clockbox'),
    creator: el('creator'), cs: el('cs'), preview: el('preview')
  };

  /* ---------------- audio ---------------- */
  let AC = null;
  function audio() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    return AC;
  }
  function beep(f, d, type, v) {
    const a = audio();
    if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type || 'square';
      o.frequency.value = f || 660;
      g.gain.value = v || 0.035;
      o.connect(g); g.connect(a.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + (d || 0.05));
      o.stop(a.currentTime + (d || 0.05));
    } catch (e) {}
  }
  const blip = () => beep(700, 0.04);
  const okBeep = () => { beep(660, 0.06); setTimeout(() => beep(880, 0.09), 70); };
  const noBeep = () => beep(180, 0.12, 'sawtooth');
  const boomBeep = () => beep(90, 0.35, 'sawtooth', 0.08);

  /* ---------------- game state ---------------- */
  const G = {
    mode: 'title',            // title | create | play | dialog | choice | flight | gameover | victory
    map: null,
    timeMin: 6 * 60,
    day: 1,
    sorties: 0,
    hasMission: false,
    stats: { hp: 100, sp: 80, en: 90, hu: 20 },   // hu = hunger (hidden)
    fade: 0,
    flight: null,
    titleBlink: 0,
    callsign: 'VIPER',
    cfg: { role: 0, sex: 0, hair: 1, outfit: 0, shoes: 0, hat: 0 },
    bag: new Array(12).fill(null),      // slots: null or {id, n}
    bagSel: 0,
    groundItems: [],                    // daily field pickups on the exterior
    pillWeek: -5, goLeft: 5, nogoLeft: 5,
    alcDay: 0, alcToday: 0, lockerDay: 0, mreDay: 0, cigDay: 0,
    deployEnd: DEPLOY_DAYS, extensions: 0,
    built: {},                 // MWR projects: {couch:true, ...}
    questStage: 0,             // 0 = meet HARD, 1 = couch quest, 2 = build board open
    gather: {},                // gather spot key -> last day used
    junk: { day: 0, nodes: {} },   // junkyard salvage: 'x,y' -> hits used today
    swing: null, shake: 0,         // hammer swing state + screen shake (transient)
    callDay: 0, movieDay: 0,
    duty: null,                // ground duty: {type:'ops'|'vault', done:false}
    sortieDay: 0,              // one sortie per day
    photoDay: 0,               // looked at photos from home (1/day)
    morale: 40, moraleMaxed: false, moralePop: false, crackdowns: 0,  // squadron morale 0-100
    runNext: 0, runLock: 0, runsDone: 0, smugIntro: false,
    haul: [], drive: null, gate: null, scene: null,     // smuggling run state + cutscene backdrop
    attackAt: -1, alarm: null, sirenT: 0,               // Alarm Red rocket attacks
    profileId: null,                                    // active save profile
    placed: [],                                         // crafted objects placed in the world
    carrying: null                                      // placed object being moved
  };

  const player = {
    tx: 9, ty: 19, px: 9 * T, py: 19 * T,
    dir: 'down', moving: false, animT: 0,
    frames: SPR.buildCharFrames(G.cfg)
  };
  // generated sprite sheets (assets.js) replace procedural frames once loaded
  // (a sheet may beat this script's parse — refresh now AND on every load)
  function refreshPlayerFrames() {
    player.frames = ASSETS.playerFor(G.cfg) || SPR.buildCharFrames(G.cfg);
  }
  refreshPlayerFrames();
  ASSETS.onReady.push(refreshPlayerFrames);
  // tile assets arriving after boot: rebuild prerendered maps (and keep builds)
  ASSETS.onReady.push(() => {
    WORLD.invalidate();
    if (G.map) {
      G.map = WORLD.get(G.map.key);
      applyBuilds(G.map);
      applyBuilds(WORLD.get('exterior'));
    }
  });

  const maam = () => G.cfg.sex === 1 ? 'ma\'am' : 'sir';
  const roleName = () => G.cfg.role === 1 ? 'WSO' : 'fighter pilot';
  const medals = () => Math.floor(G.sorties / 20);
  const DUTY_NAMES = { ops: 'OPS SUPERVISOR', vault: 'VAULT OFFICER' };

  const DIRV = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- input ---------------- */
  const keys = {};
  window.addEventListener('keydown', e => {
    audio();
    if (e.target && e.target.id === 'cs') {           // typing the callsign
      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); ui.cs.blur(); crIdx = 1; updateCreator(); }
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key]) handleKey(e.key);
    keys[e.key] = true;
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  // left-click a salvage node next to you to swing the hammer at it
  let lastCam = { camX: 0, camY: 0, offX: 0, offY: 0 };
  el('screen').addEventListener('mousedown', e => {
    if (e.button !== 0 || G.mode !== 'play') return;
    audio();
    const r = e.target.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width * FW;
    const fy = (e.clientY - r.top) / r.height * FH;
    const tx = ((fx - lastCam.offX + lastCam.camX) / T) | 0;
    const ty = ((fy - lastCam.offY + lastCam.camY) / T) | 0;
    const h = G.map.hot[tx + ',' + ty];
    if (!h || h.action !== 'salvage') return;
    if (!G.bag.some(s => s && s.id === 'hammer')) {
      noBeep();
      toast('You need your hammer for that.');
      return;
    }
    if (Math.abs(tx - player.tx) > 1 || Math.abs(ty - player.ty) > 1) {
      blip();
      toast('Too far away — walk up to it and swing.');
      return;
    }
    const dx = tx - player.tx, dy = ty - player.ty;
    player.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    startSwing(h, tx, ty);
  });

  function dirFromKeys() {
    if (keys.ArrowUp || keys.w || keys.W) return 'up';
    if (keys.ArrowDown || keys.s || keys.S) return 'down';
    if (keys.ArrowLeft || keys.a || keys.A) return 'left';
    if (keys.ArrowRight || keys.d || keys.D) return 'right';
    return null;
  }

  const isAction = k => k === 'e' || k === 'E' || k === 'Enter' || k === ' ';

  function handleKey(k) {
    switch (G.mode) {
      case 'title':
        if (k === 'Enter' || k === ' ') openRoster();
        break;
      case 'roster':
        rosterKey(k);
        break;
      case 'create':
        creatorKey(k);
        break;
      case 'dialog':
        if (isAction(k)) advanceDialog();
        break;
      case 'choice':
        if (k === 'ArrowUp' || k === 'w' || k === 'W') { moveChoice(-1); }
        if (k === 'ArrowDown' || k === 's' || k === 'S') { moveChoice(1); }
        if (isAction(k)) pickChoice();
        if (k === 'Escape') cancelChoice();
        break;
      case 'play':
        if (isAction(k) && !player.moving) interact();
        if (k >= '1' && k <= '9') { G.bagSel = +k - 1; blip(); updateHotbar(); }
        if (k === '0') { G.bagSel = 9; blip(); updateHotbar(); }
        if (k === 'f' || k === 'F') useSelected();
        if (k === 'm' || k === 'M') openMenu();
        break;
      case 'menu':
        menuKey(k);
        break;
      case 'chest':
        chestKey(k);
        break;
      case 'flight':
        if (k === ' ') fireFlare();
        break;
      case 'gate':
        if (k === ' ' || k === 'Enter' || k === 'e' || k === 'E') judgeGate();
        break;
      case 'gameover':
      case 'victory':
        if (k === 'Enter') { G.mode = 'title'; }
        break;
    }
  }

  /* ---------------- dialog engine ---------------- */
  let dq = [], dcb = null, dline = '', dchar = 0;

  function say(lines, cb) {
    G.mode = 'dialog';
    dq = lines.slice();
    dcb = cb || null;
    ui.dialog.style.display = 'block';
    ui.dchoices.innerHTML = '';
    ui.prompt.style.display = 'none';
    nextLine();
  }
  function nextLine() {
    dline = dq.shift();
    dchar = 0;
    ui.dtext.textContent = '';
    ui.dmore.style.display = 'none';
  }
  function advanceDialog() {
    if (dchar < dline.length) { dchar = dline.length; ui.dtext.textContent = dline; ui.dmore.style.display = 'block'; return; }
    blip();
    if (dq.length) { nextLine(); return; }
    ui.dialog.style.display = 'none';
    G.mode = 'play';
    const cb = dcb; dcb = null;
    if (cb) cb();
  }

  /* ---------------- choice engine ---------------- */
  let chOpts = [], chSel = 0, chCb = null;

  function ask(prompt, options, cb) {
    G.mode = 'choice';
    chOpts = options; chSel = 0; chCb = cb;
    ui.dialog.style.display = 'block';
    ui.dtext.textContent = prompt;
    ui.dmore.style.display = 'none';
    ui.prompt.style.display = 'none';
    renderChoices();
  }
  function renderChoices() {
    ui.dchoices.innerHTML = '';
    chOpts.forEach((o, i) => {
      const d = document.createElement('div');
      d.className = 'choice' + (i === chSel ? ' sel' : '');
      d.textContent = o;
      ui.dchoices.appendChild(d);
    });
  }
  function moveChoice(dir) {
    chSel = (chSel + dir + chOpts.length) % chOpts.length;
    blip();
    renderChoices();
  }
  function closeChoice() {
    ui.dialog.style.display = 'none';
    ui.dchoices.innerHTML = '';
    G.mode = 'play';
  }
  function pickChoice() {
    okBeep();
    closeChoice();
    const cb = chCb; chCb = null;
    if (cb) cb(chSel);
  }
  function cancelChoice() {
    closeChoice();
    const cb = chCb; chCb = null;
    if (cb) cb(-1);
  }

  /* ---------------- character creator ---------------- */
  const ROLES = ['Pilot', 'WSO'];
  const CR_OPTS = [
    null,                                              // 0: callsign input
    { key: 'role',   vals: ROLES },
    { key: 'sex',    vals: SPR.SEXES },
    { key: 'hair',   vals: SPR.HAIRS.map(h => h[0]) },
    { key: 'outfit', vals: SPR.OUTFITS.map(o => o.name) },
    { key: 'shoes',  vals: SPR.SHOES.map(s => s[0]) },
    { key: 'hat',    vals: SPR.HATS }
  ];
  let crIdx = 0, crTimer = null, crAnim = 0;
  let crFrames = null;

  // with generated sheets, hair/outfit/shoes/hat (rows 3-6) no longer change
  // the sprite — hide them and skip them in navigation
  const crRows = () => ASSETS.playerM ? [0, 1, 2, 7] : [0, 1, 2, 3, 4, 5, 6, 7];

  function openCreator() {
    G.mode = 'create';
    crIdx = 0;
    ui.creator.style.display = 'flex';
    const gen = !!ASSETS.playerM;
    document.querySelectorAll('#creator .crow').forEach(r => {
      const row = +r.dataset.row;
      if (row >= 3 && row <= 6) r.style.display = gen ? 'none' : '';
    });
    ui.cs.value = G.callsign === 'VIPER' ? '' : G.callsign;
    updateCreator();
    setTimeout(() => ui.cs.focus(), 0);
    if (crTimer) clearInterval(crTimer);
    crTimer = setInterval(() => {
      crAnim++;
      drawPreview();
    }, 160);
    blip();
  }

  function updateCreator() {
    document.querySelectorAll('#creator .crow').forEach(r => {
      r.classList.toggle('sel', +r.dataset.row === crIdx);
    });
    el('v-role').textContent = ROLES[G.cfg.role];
    el('v-sex').textContent = SPR.SEXES[G.cfg.sex];
    el('v-hair').textContent = SPR.HAIRS[G.cfg.hair][0];
    el('v-outfit').textContent = SPR.OUTFITS[G.cfg.outfit].name;
    el('v-shoes').textContent = SPR.SHOES[G.cfg.shoes][0];
    el('v-hat').textContent = SPR.HATS[G.cfg.hat];
    crFrames = ASSETS.playerFor(G.cfg) || SPR.buildCharFrames(G.cfg);
    drawPreview();
  }

  function drawPreview() {
    if (!crFrames) return;
    const dirs = ['down', 'left', 'up', 'right'];
    const dir = dirs[Math.floor(crAnim / 8) % 4];
    const frame = crFrames[dir][crAnim % 4];
    const px = ui.preview.getContext('2d');
    px.clearRect(0, 0, 16, SPR.CHAR_H);
    px.drawImage(frame, 0, 0);
  }

  function cycleOpt(row, dir) {
    const opt = CR_OPTS[row];
    if (!opt) return;
    const n = opt.vals.length;
    G.cfg[opt.key] = (G.cfg[opt.key] + dir + n) % n;
    blip();
    updateCreator();
  }

  function creatorKey(k) {
    const rows = crRows();
    const step = d => {
      const i = Math.max(0, rows.indexOf(crIdx));
      crIdx = rows[(i + d + rows.length) % rows.length];
      if (crIdx === 0) { ui.cs.focus(); }
      blip(); updateCreator();
    };
    if (k === 'ArrowUp' || k === 'w' || k === 'W') {
      step(-1);
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      step(1);
    } else if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
      cycleOpt(crIdx, -1);
    } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
      cycleOpt(crIdx, 1);
    } else if (k === 'Enter' || k === 'e' || k === 'E' || k === ' ') {
      deploy();
    } else if (k === 'Escape') {
      closeCreator();
      openRoster();
    }
  }

  function closeCreator() {
    ui.creator.style.display = 'none';
    if (crTimer) { clearInterval(crTimer); crTimer = null; }
  }

  function deploy() {
    const cs = ui.cs.value.trim().toUpperCase().slice(0, 12);
    G.callsign = cs || 'VIPER';
    closeCreator();
    refreshPlayerFrames();
    G.profileId = newProfileId();   // fresh pilot, fresh save slot
    newGame();
  }

  /* ---------------- pilot roster (profile select) ---------------- */
  let rosterList = [], rosterSel = 0, rosterArm = -1;

  function openRoster() {
    rosterList = loadProfiles().sort((a, b) => b.updated - a.updated).slice(0, 7);
    rosterSel = 0; rosterArm = -1;
    G.mode = 'roster';
    blip();
  }

  function rosterKey(k) {
    const total = rosterList.length + 1;   // + NEW PILOT row
    if (k === 'ArrowUp' || k === 'w' || k === 'W') { rosterSel = (rosterSel - 1 + total) % total; rosterArm = -1; blip(); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') { rosterSel = (rosterSel + 1) % total; rosterArm = -1; blip(); }
    else if (k === 'Enter' || k === 'e' || k === 'E' || k === ' ') {
      rosterArm = -1;
      if (rosterSel < rosterList.length) loadGame(rosterList[rosterSel].id);
      else openCreator();
    }
    else if (k === 'x' || k === 'X' || k === 'Delete' || k === 'Backspace') {
      if (rosterSel < rosterList.length) {
        if (rosterArm === rosterSel) { deleteProfile(rosterList[rosterSel].id); openRoster(); }
        else { rosterArm = rosterSel; noBeep(); }
      }
    }
    else if (k === 'Escape') { G.mode = 'title'; blip(); }
  }

  // mouse support for the creator
  document.querySelectorAll('#creator .crow.opt').forEach(row => {
    row.querySelectorAll('.arr').forEach(btn => {
      btn.addEventListener('click', () => {
        crIdx = +row.dataset.row;
        cycleOpt(crIdx, +btn.dataset.d);
      });
    });
  });
  el('deployrow').addEventListener('click', () => { if (G.mode === 'create') deploy(); });
  ui.cs.addEventListener('focus', () => { crIdx = 0; updateCreator(); });

  /* ---------------- stats / time ---------------- */
  function addStats(d) {
    const s = G.stats;
    if (d.hp) s.hp = clamp(s.hp + d.hp, 0, 100);
    if (d.sp) s.sp = clamp(s.sp + d.sp, 0, 100);
    if (d.en) s.en = clamp(s.en + d.en, 0, 100);
    if (d.hu) s.hu = clamp(s.hu + d.hu, 0, 100);
  }
  function passTime(min) { G.timeMin += min; }

  function addMorale(n) {
    const was = G.morale;
    G.morale = clamp(G.morale + n, 0, 100);
    if (G.morale >= 100 && was < 100 && !G.moraleMaxed) {
      G.moraleMaxed = true;
      G.moralePop = true;   // celebration fires once we're back in play mode
    }
  }

  function tickStats(dtMin) {
    const s = G.stats;
    s.en -= 0.055 * dtMin * (player.moving ? 1.3 : 1);
    // spirit decay: finished MWR and high squadron morale both slow it; gutter morale speeds it up
    const spMult = (allBuilt() ? 0.5 : 1) * (G.morale >= 70 ? 0.5 : G.morale < 30 ? 1.5 : 1);
    s.sp -= 0.035 * dtMin * spMult;
    s.hu += 0.09 * dtMin;
    if (s.hu > 75) s.hp -= 0.1 * dtMin;
    if (s.en <= 0) s.hp -= 0.1 * dtMin;
    if (s.sp <= 0) s.en -= 0.03 * dtMin;
    s.hp = clamp(s.hp, 0, 100); s.sp = clamp(s.sp, 0, 100);
    s.en = clamp(s.en, 0, 100); s.hu = clamp(s.hu, 0, 100);
    if (s.hp <= 0) { G.mode = 'gameover'; noBeep(); saveClear(); }
  }

  function clockStr() {
    const h = Math.floor(G.timeMin / 60) % 24;
    const m = Math.floor(G.timeMin % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function rollDuty() {
    G.duty = Math.random() < 0.3
      ? { type: Math.random() < 0.5 ? 'ops' : 'vault', done: false }
      : null;
    return G.duty
      ? 'Roster news: you\'ve got ' + DUTY_NAMES[G.duty.type] + ' duty today. ' +
        (G.duty.type === 'ops' ? 'Report to the OPS desk.' : 'Report to the vault in OPS.')
      : null;
  }

  function rollAttack() {
    // ~20% of days after day 1: rockets sometime between 0900 and 2200
    G.attackAt = (G.day > 1 && Math.random() < 0.2)
      ? (9 * 60 + Math.floor(Math.random() * 13 * 60))
      : -1;
  }

  function doSleep(forced) {
    G.fade = 1;
    G.alarm = null;   // sleeping through Alarm Red is not a strategy, but the night resets it
    G.day++;
    if (G.day > G.deployEnd) {
      if (G.extensions < MAX_EXTENSIONS && Math.random() < EXTEND_CHANCE) {
        G.extensions++;
        G.deployEnd += EXTEND_DAYS;
        G.timeMin = 6 * 60;
        spawnGroundItems();
        G.duty = null;   // no duty on extension day — smallest of mercies
        addStats({ en: 95 - G.stats.en, sp: -20, hu: 25 });
        addMorale(-25);
        save();
        say(['You wake up on rotation day, bags packed, grinning like an idiot...',
             'RHINO is waiting with a printout and the face of a man delivering bad news.',
             '"Tasking order from higher. The squadron\'s been EXTENDED ' + EXTEND_DAYS + ' days."',
             'There\'s always a chance of an extension. There\'s ALWAYS a chance. (- -Spirit)',
             'The whole squadron takes it hard. (SQUADRON MORALE -25)',
             'New rotation date: Day ' + G.deployEnd + '. Back to work, ' + G.callsign + '.']);
        return;
      }
      G.mode = 'victory'; okBeep(); saveClear(); return;
    }
    G.timeMin = 6 * 60;
    spawnGroundItems();
    rollAttack();
    const dutyLine = rollDuty();
    if (forced) {
      addStats({ en: 60 - G.stats.en, sp: -10, hp: -5, hu: 25 });
      save();
      const lines = ['You pass out from exhaustion on the nearest cot...',
                     'Day ' + G.day + '. You feel like garbage. Pace yourself, ' + G.callsign + '.'];
      if (dutyLine) lines.push(dutyLine);
      say(lines);
    } else {
      const healthy = G.stats.hu < 70;
      addStats({ en: 95 - G.stats.en, sp: 5, hp: healthy ? 8 : 0, hu: 25 });
      save();
      const lines = ['You rack out for the night. The AC unit rattles you to sleep.',
                     'Day ' + G.day + ' in the sab. ' + (G.deployEnd - G.day + 1) + ' days until you rotate home.'];
      if (dutyLine) lines.push(dutyLine);
      say(lines);
    }
  }

  /* ---------------- actions ---------------- */
  const ACTIONS = {
    briefing() {
      if (G.duty && !G.duty.done && G.duty.type === 'ops') { ACTIONS.sitDuty(); return; }
      if (G.duty && !G.duty.done) {
        say(['RHINO: "Negative, ' + G.callsign + '. You\'re on ' + DUTY_NAMES[G.duty.type] + ' duty today."',
             '"The vault is the big gray door right there. Duty first, flying after."']);
        return;
      }
      if (G.sortieDay === G.day) {
        say(['RHINO: "You\'ve already flown today. Crew rest is a real thing."',
             '"Go eat. Lift. Bother HARD. I don\'t care — but you\'re done flying until tomorrow you dildo."']);
        return;
      }
      if (G.hasMission) {
        say(['RHINO: "You\'re already briefed, ' + G.callsign + '. Your jet\'s on the line — go fly."']);
        return;
      }
      say([
        'RHINO: "Morning, ' + G.callsign + '. Tasking just dropped from the dildos at the CAOC."',
        '"Deep strike mission in the AO. Expect heavy SAM activity — keep your flares handy."',
        '"Hit the flight line when you\'re rested and fed. Don\'t fly tired."',
        '* MISSION BRIEFED — head to your jet on the flight line. *'
      ], () => { G.hasMission = true; passTime(30); okBeep(); });
    },
    sitDuty() {
      // ops supervisor shift, taken at the ops desk
      ask('Sit your OPS SUPERVISOR shift? (4 hrs, -Spirit -Energy)', ['Take the desk', 'Not yet'], i => {
        if (i !== 0) return;
        G.duty.done = true;
        addStats({ sp: -10, en: -20, hu: 12 });
        passTime(240);
        const flavor = [
          'Four hours of radios, phone calls, and a lost fuel truck.',
          'You sign 47 forms. Two of them may have been important.',
          'A diverting jet, three weather updates, and one very confused contractor.'
        ];
        say([flavor[Math.floor(Math.random() * flavor.length)],
             'Shift complete. Your soul is slightly smaller. (-Spirit, -Energy)',
             'You\'re released to fly — get your brief.']);
      });
    },
    vault() {
      if (G.duty && !G.duty.done && G.duty.type === 'vault') {
        ask('Sit your VAULT OFFICER shift? (4 hrs, -Spirit -Energy)', ['Unlock it', 'Not yet'], i => {
          if (i !== 0) return;
          G.duty.done = true;
          addStats({ sp: -10, en: -20, hu: 12 });
          passTime(240);
          const flavor = [
            'Four hours guarding paperwork in a windowless steel box.',
            'You re-alphabetize the mission folders. Twice. Nobody visits.',
            'You inventory the safe. The safe contains another, smaller safe.'
          ];
          say([flavor[Math.floor(Math.random() * flavor.length)],
               'Vault secured, log signed. Your soul is slightly smaller. (-Spirit, -Energy)',
               'You\'re released to fly — get your brief.']);
        });
        return;
      }
      say(['The vault: a giant steel door guarding secrets and, allegedly, the good coffee.',
           'Locked. Only the duty Vault Officer gets the combo.']);
    },
    mapboard() {
      say(['The intel map is covered in red circles and coffee stains.',
           'Somebody drew a shark eating a SAM site. Morale is holding.']);
    },
    locker() {
      if (G.lockerDay !== G.day && addItem('seeds', 1) > 0) {
        G.lockerDay = G.day;
        say(['Your locker: a spare flight suit, sunflower seeds, and a photo from home.',
             'You pocket the seeds. You feel a little homesick... and a little motivated.',
             '* SUNFLOWER SEEDS added to your bag. *']);
      } else {
        say(['Your locker: a spare flight suit and a photo from home.',
             'You feel a little homesick... and a little motivated.']);
      }
    },
    eat() {
      const opts = ['Eat here (30 min)'];
      const canMre = G.mreDay !== G.day;
      if (canMre) opts.push('Grab an MRE to-go');
      opts.push('Not now');
      ask('Cheesy Habibi is working the grill, this food is going to be great.', opts, i => {
        if (i === 0) {
          addStats({ hu: -60, en: 15, hp: 5 });
          passTime(30);
          say(['You demolish a plate of four hard eggs, extra cheesy.',
               'Surprisingly solid today. (+Energy, +Health)']);
        } else if (canMre && i === 1) {
          if (addItem('mre', 1) < 1) { toast('Your pockets are full!'); noBeep(); return; }
          G.mreDay = G.day;
          passTime(5);
          say(['You pocket an MRE for later. The cook pretends not to see.',
               '* MRE SNACK added to your bag. *']);
        }
      });
    },
    cooler() {
      ask('The cooler hums invitingly. Grab a drink? (5 min)', [
        'Rip-It  (+Energy)',
        'Gatorade  (+Energy +Health)',
        'Water bottle  (+Health)',
        'Not now'
      ], i => {
        const ids = ['ripit', 'gatorade', 'water'];
        if (i < 0 || i > 2) return;
        if (addItem(ids[i], 1) < 1) { toast('Your pockets are full!'); noBeep(); return; }
        passTime(5);
        toast('Added to bag: ' + ITEMS[ids[i]].name);
        okBeep();
      });
    },
    table() {
      say(['You sit for a minute and people-watch.',
           'The DFAC drama never disappoints. Apparently someone took the last omelet.']);
    },
    cookTalk() {
      say(['Cheesy Habibi: "Hot chow at the line, cold soda in the cooler."',
           '"Eat before you fly. I\'m not scraping you off a runway on an empty stomach."']);
    },
    salvage(h) { doSalvage(h); },
    crocTalk() {
      const c = G.croc;
      if (!c.intro) {
        c.intro = true;
        c.stockDay = G.day;
        addItem('coffee', 3);
        say(['CROC: "Hey! New face. They call me CROC — backseater, coffee connoisseur, family man."',
             '"My wife and kids have never seen where I work. I\'m saving up to fly them out for a real vacation."',
             '"I import the best local coffee grounds on base. Problem is, I fly too much to sell it."',
             '"So here\'s the plan: a COFFEE STAND. I supply the grounds, you run the storefront."',
             '"Scrounge WOOD x8 and SCRAP x4, craft the stand (M menu), and set it up outside."',
             '"Stock it with my coffee and the customers will find YOU. This base runs on caffeine."',
             '* QUEST STARTED: Vacation Fund — build CROC\'s coffee stand *',
             '(CROC\'s Coffee x3 added. He restocks you every 2 days.)'], () => save());
        return;
      }
      if (c.fund >= 100) {
        if (!c.done) {
          c.done = true;
          addStats({ sp: 15 });
          addMorale(10);
          say(['CROC is holding a printout of flight confirmations, grinning like a madman.',
               '"THEY\'RE COMING! Flights booked — the beach resort, all of it. Because of you, habibi."',
               '"You ever need anything — coffee, intel, a backseater who owes you forever — you got it."',
               '* QUEST COMPLETE: Vacation Fund — CROC\'s family is coming! (+Spirit, +Morale) *'], () => save());
        } else {
          say(['CROC: "Family lands next rotation. My kid wants to see the jets. OBVIOUSLY."',
               '"Keep the stand running if you want, friend. The base needs you. CAFFEINE needs you."']);
        }
        return;
      }
      const lines = [];
      if (G.day >= c.stockDay + 2) {
        c.stockDay = G.day;
        addItem('coffee', 3);
        lines.push('CROC: "Fresh grounds just came in — three bags, top-shelf stuff."',
                   '(CROC\'s Coffee x3 added.)');
      } else {
        lines.push('CROC: "No fresh grounds today — supply flight comes every couple days."');
      }
      const stand = theStand();
      const hasStandItem = countItem('coffeestand') > 0 || (G.carrying && G.carrying.id === 'coffeestand');
      if (!stand && hasStandItem) {
        lines.push('"You BUILT it! Now set it up outside — somewhere with foot traffic, habibi."');
      } else if (!stand) {
        lines.push('"Still need that stand: WOOD x8, SCRAP x4, then craft it at the M menu."',
                   '"Pallet stacks for wood, junk piles for scrap. You know the drill."');
      } else if (!(stand.stock > 0)) {
        lines.push('"The stand\'s up but it\'s EMPTY. Stock it with my coffee — face it, press F."',
                   '"Fund\'s at ' + c.fund + '%. The ocean isn\'t going to smell itself."');
      } else {
        lines.push('"Stand\'s stocked with ' + stand.stock + ' bag' + (stand.stock > 1 ? 's' : '') + ' and word is spreading."',
                   '"Vacation fund: ' + c.fund + '%. I can almost smell the ocean, habibi."');
      }
      say(lines, () => save());
    },
    treadmill() {
      ask('Run on the treadmill? (45 min, -Energy)', ['Get after it', 'Skip it'], i => {
        if (i !== 0) return;
        if (G.stats.en < 15) { noBeep(); say(['You\'re too smoked to run. Eat or rest first.']); return; }
        addStats({ hp: 8, en: -12, sp: 4, hu: 10 });
        passTime(45);
        say(['Three miles in the desert heat... indoors, thankfully.',
             'You feel sharper already. (+Health, +Spirit, -Energy)']);
      });
    },
    weights() {
      ask('Lift weights? (60 min, -Energy)', ['Lift heavy', 'Skip it'], i => {
        if (i !== 0) return;
        if (G.stats.en < 20) { noBeep(); say(['Your arms are jello. Come back with more energy.']); return; }
        addStats({ hp: 12, en: -18, sp: 5, hu: 12 });
        passTime(60);
        say(['You hit a solid session. Creature nods with approval.',
             '(+Health, +Spirit, -Energy)']);
      });
    },
    tv() {
      const upgraded = G.built.couch;
      ask('Crash on the couch and watch TV? (60 min)', ['Veg out', 'Not now'], i => {
        if (i !== 0) return;
        addStats({ sp: upgraded ? 22 : 15, en: 5 });
        passTime(60);
        say(upgraded
          ? ['You sink into the NEW couch. It\'s so deep you may need rescue equipment.',
             'Best seat in the AOR. (+ +Spirit, +Energy)']
          : ['You watch half a movie you\'ve seen nine times. It still slaps.',
             '(+Spirit, +Energy)']);
      });
    },
    hardTalk() {
      if (G.questStage === 0) {
        const bond = G.cfg.role === 1
          ? '"A fellow back-seater! Finally — somebody on this base with actual situational awareness."'
          : '"A pilot, huh? Shit Hot!"';
        say([
          'A WSO looks up from a three-week-old magazine.',
          '"' + G.callsign + ', right? I\'m HARD. Don\'t ask. It\'s a long story."',
          bond,
          '"Look at this place. Dead cots, one sad TV, a fridge that sounds like a dying APU."',
          '"We\'re gonna fix it. You and me. Operation: MAKE MWR GREAT."',
          '"First job: real couches. Get me WOOD x6 and SCRAP x2."',
          '"Wood\'s easy — pallet stacks all over base. Scrap\'s in the junk piles."',
          '"And if supply won\'t part with the good stuff... well. You\'re aircrew. Improvise."',
          '* QUEST STARTED: New Couches — bring HARD wood x6, scrap x2 *'
        ], () => { G.questStage = 1; save(); });
        return;
      }
      if (G.questStage === 1) {
        const p = projByKey('couch');
        if (canAfford(p.cost)) {
          ask('HARD: "That the lumber? Let\'s build these couches!" (' + costText(p.cost) + ')', ['Build the couches', 'Not yet'], i => {
            if (i !== 0) return;
            completeBuild(p);
            G.questStage = 2;
            say([
              'Twenty minutes of hammering, three bent nails, and one heated argument about cushion angles later...',
              'NEW COUCHES. They\'re beautiful. HARD wipes away a tear.',
              '"Okay. Okay okay okay. We\'re just getting started."',
              '"I posted a BUILD BOARD by the TV — full list of projects. Bring materials, we build."',
              '* BUILD BOARD unlocked — 6 more projects to go. *'
            ]);
          });
        } else {
          say(['HARD: "Status: still couch-less. I need ' + costText(p.cost) + '."',
               '"Pallets for wood, junk piles for scrap. Get after it, ' + G.callsign + '."']);
        }
        return;
      }
      // stage 2+: HARD runs both operations
      ask('HARD grins. "What do you need?"', [
        'MWR project status',
        '"Supply run" off base...',
        'Nothing right now'
      ], i => {
        if (i === 0) {
          if (allBuilt()) {
            say(['HARD gestures at the MWR like a game show host.',
                 '"Look at it. LOOK at it. Best MWR in the entire AOR. Generals will weep."',
                 '"Squadron morale is unbreakable now. We did that."']);
          } else {
            say(['HARD: "' + builtCount() + ' of ' + PROJECTS.length + ' projects done. The dream lives."',
                 '"Check the build board by the TV when you\'ve got materials."']);
          }
        } else if (i === 1) {
          smuggleStart();
        }
      });
    },
    buildBoard() {
      if (G.questStage < 2) {
        say(['A hand-drawn poster in HARD\'s handwriting:',
             '"OPERATION: MAKE MWR GREAT — step one: COUCHES. Talk to me. — H"']);
        return;
      }
      const remaining = PROJECTS.filter(p => !G.built[p.key]);
      if (!remaining.length) {
        say(['The build board is covered in checkmarks and a crayon drawing of the squadron patch.',
             'OPERATION: MAKE MWR GREAT — COMPLETE.']);
        return;
      }
      const opts = remaining.map(p => p.name + '  (' + costText(p.cost) + ')');
      opts.push('Close');
      ask('BUILD BOARD — pick a project:', opts, i => {
        if (i < 0 || i >= remaining.length) return;
        const p = remaining[i];
        if (!canAfford(p.cost)) {
          say(['Not enough materials for ' + p.name + '.',
               'You need: ' + costText(p.cost) + '.']);
          return;
        }
        completeBuild(p);
        const done = builtCount();
        const lines = {
          computers: ['You and HARD wire up two humming morale machines.',
                      'Video calls home, movies, and a questionable amount of solitaire. (New: Computers)'],
          bar:       ['Plywood, scrap metal, and love: the bar is OPEN.',
                      'HARD polishes it with his sleeve. "Class. Pure class." (New: The Bar)'],
          kitchen:   ['A scavenged grill top, a sink, and a fridge that actually works.',
                      'The MWR smells like real food now. (New: Kitchen)'],
          movie:     ['A projector "from supply" and a bedsheet screen, cables run with military precision.',
                      'Movie nights are BACK. (New: Movie Screen)'],
          deck:      ['Two days of decking later, the MWR has a front porch.',
                      'Desert sunsets, now with seating. (New: Front Deck)'],
          firepit:   ['Scrap-metal ring, scavenged stones, one very illegal pallet fire.',
                      'The fire pit crackles to life. (New: Fire Pit)']
        };
        say((lines[p.key] || ['Built!']).concat(
          allBuilt()
            ? ['* ALL 7 PROJECTS COMPLETE — the squadron\'s spirit is unbreakable. (Spirit drains half as fast) *']
            : ['* ' + done + '/' + PROJECTS.length + ' projects complete *']
        ));
      });
    },
    scavPallet(h) {
      if (spotUsed(h.spot)) { say(['This pallet stack is picked clean. More shows up tomorrow.']); return; }
      G.gather[h.spot] = G.day;
      const n = 2 + (Math.random() < 0.5 ? 1 : 0);
      gatherResult({ wood: n }, 20, [
        'You pry planks loose and stack them like a professional lumber thief.',
        '* WOOD x' + n + ' added to your bag *'
      ]);
    },
    scavJunk(h) {
      if (spotUsed(h.spot)) { say(['You\'ve stripped this pile bare today. Junk regenerates. Somehow.']); return; }
      G.gather[h.spot] = G.day;
      const s = 1 + (Math.random() < 0.5 ? 1 : 0);
      const w = Math.random() < 0.3 ? 1 : 0;
      gatherResult({ scrap: s, wood: w }, 20, [
        'You dig through the junk pile, disturbing exactly one very indignant lizard.',
        '* SCRAP x' + s + (w ? ', WOOD x' + w : '') + ' added to your bag *'
      ]);
    },
    stealSupply(h) {
      theft(h.spot, { elec: () => 1 + (Math.random() < 0.4 ? 1 : 0), scrap: () => (Math.random() < 0.5 ? 1 : 0) },
        'The supply conex is unlocked. Electronics, probably. Nobody\'s watching...');
    },
    stealAvionics(h) {
      theft(h.spot, { cable: () => 1 + (Math.random() < 0.4 ? 1 : 0) },
        'The avionics cart has MILES of perfectly good cable. Maintenance won\'t miss a little...');
    },
    stealComms(h) {
      theft(h.spot, { cable: () => 1, elec: () => (Math.random() < 0.5 ? 1 : 0) },
        'The comm rack has spare cables and cards. The comm troops are at lunch...');
    },
    computers() {
      if (G.callDay === G.day) { say(['The connection is "down for maintenance" — the comm troops got wise.','One call home per day.']); return; }
      ask('Video call home? (30 min)', ['Call home', 'Not now'], i => {
        if (i !== 0) return;
        G.callDay = G.day;
        addStats({ sp: 25 });
        passTime(30);
        say(['The video stutters, freezes, and then — home.',
             'Thirty minutes goes by in about four seconds. (+ +Spirit)']);
      });
    },
    bar() {
      ask('Post up at the bar with the squadron? (45 min)', ['Pull up a stool', 'Not now'], i => {
        if (i !== 0) return;
        addStats({ sp: 18, en: -5 });
        passTime(45);
        say(['Someone re-tells the story of HARD\'s callsign. It gets worse every time.',
             'You laugh until your face hurts. (+Spirit)']);
      });
    },
    kitchen() {
      ask('Cook something real? (30 min)', ['Fire up the grill', 'Not now'], i => {
        if (i !== 0) return;
        addStats({ hu: -40, hp: 8, sp: 5 });
        passTime(30);
        say(['You grill mystery meat into certified delicious meat.',
             'The whole MWR drifts over, drawn by the smell. (+Health, +Spirit)']);
      });
    },
    movie() {
      if (G.movieDay === G.day) { say(['The projector needs to cool down. One feature per day.']); return; }
      ask('Movie night? (90 min)', ['Roll it', 'Not now'], i => {
        if (i !== 0) return;
        G.movieDay = G.day;
        addStats({ sp: 30, en: 5 });
        passTime(90);
        say(['Half the squadron piles in. Someone made popcorn in the new kitchen.',
             'For ninety minutes, you\'re not deployed at all. (+ +Spirit)']);
      });
    },
    deck() {
      ask('Sit on the deck a while? (20 min)', ['Take a seat', 'Not now'], i => {
        if (i !== 0) return;
        addStats({ sp: 10 });
        passTime(20);
        say(['You watch the jets come and go from the new deck.',
             'The desert is almost pretty from here. (+Spirit)']);
      });
    },
    firepit() {
      const hour = Math.floor(G.timeMin / 60);
      if (hour >= 19 || hour < 5) {
        ask('Fire pit with the squadron? (60 min)', ['Light it up', 'Not now'], i => {
          if (i !== 0) return;
          addStats({ sp: 18, en: -3 });
          passTime(60);
          say(['War stories, bad impressions of the squadron commander, and a sky full of stars.',
               'This is the stuff you\'ll actually remember. (+ +Spirit)']);
        });
      } else {
        addStats({ sp: 5 });
        say(['A fire pit in the desert heat is a nighttime instrument.',
             'You appreciate it aesthetically for now. Come back after 1900. (+Spirit)']);
      }
    },
    homeBed() {
      if (G.alarm) { say(['Your bed is wonderful. It is also not made of concrete. GET TO THE BUNKER.']); return; }
      ask('Your bed. The one thing on this base that\'s truly yours.', [
        'Take a nap (1 hr, +Energy)',
        'Sleep until morning',
        'Get up'
      ], i => {
        if (i === 0) {
          addStats({ en: 20, sp: 2 });
          passTime(60);
          say(['You crash face-first onto your own mattress for a glorious hour.',
               'Best nap in the AOR. (+Energy)']);
        } else if (i === 1) {
          doSleep(false);
        }
      });
    },
    homeLocker() {
      if (G.photoDay !== G.day) {
        G.photoDay = G.day;
        addStats({ sp: 5 });
        say(['Taped inside your wall locker: photos from home.',
             'You look at them for a minute. Okay. Back to it. (+Spirit)']);
      } else {
        say(['Your wall locker: uniforms, a spare towel, and the photos you already looked at today.',
             'They\'ll still be there tomorrow.']);
      }
    },
    homeDesk() {
      say(['Your desk: a half-written letter home, a dead pen, and a coffee ring shaped like Ohio.',
           'You\'ll finish the letter. Eventually. Definitely.']);
    },
    rlbLocked() {
      say(['Your neighbor\'s RLB. The door is locked, but the snoring is clearly audible.',
           'Day sleeper. Night shift. You leave them be.']);
    },
    bunker() {
      if (G.alarm) {
        G.alarm = null;
        addStats({ sp: 4 });
        passTime(60);
        okBeep();
        say(['You dive into the bunker as the whole neighborhood piles in behind you.',
             'CRUMP. CRUMP. The concrete shrugs it off. Somebody starts a headcount, somebody starts a card game.',
             'The all-clear sounds an hour later. Everybody out, single file, cracking jokes. (+Spirit)']);
        return;
      }
      addStats({ sp: 2 });
      say(['The concrete bunker squats between the RLBs, ugly and reassuring.',
           'You duck inside for a second. Cool, dark, quiet. Oddly peaceful. (+Spirit)']);
    },
    mwrFridge() {
      if (G.alcDay !== G.day) { G.alcDay = G.day; G.alcToday = 0; }
      if (G.alcToday >= 2) {
        say(['The MWR fridge is "closed" — the duty NCO taps the two-drink sign and stares at you.',
             'General Order 1 is watching. Come back tomorrow.']);
        return;
      }
      ask('MWR fridge — two-drink limit per day. (' + (2 - G.alcToday) + ' left)', [
        'Beer  (+Spirit -Energy)',
        'Red wine  (+Spirit -Energy)',
        'Not tonight'
      ], i => {
        const ids = ['beer', 'wine'];
        if (i < 0 || i > 1) return;
        if (addItem(ids[i], 1) < 1) { toast('Your pockets are full!'); noBeep(); return; }
        G.alcToday++;
        toast('Added to bag: ' + ITEMS[ids[i]].name);
        okBeep();
      });
    },
    foosball() {
      ask('Play foosball? (45 min)', ['Game on', 'Not now'], i => {
        if (i !== 0) return;
        addStats({ sp: 20, en: -5 });
        passTime(45);
        say(['You win two games and lose one on a very suspicious spin move.',
             'Good times at the MWR. (+Spirit)']);
      });
    },
    sleep() {
      if (G.alarm) { say(['Sleep? Through ALARM RED? The cot is not rocket-proof. GET TO THE BUNKER.']); return; }
      ask('Rack out for the night?', ['Sleep', 'Stay up'], i => {
        if (i === 0) doSleep(false);
      });
    },
    laundry() {
      ask('Wash your flight suits? (40 min)', ['Do laundry', 'Not now'], i => {
        if (i !== 0) return;
        addStats({ sp: 12 });
        passTime(40);
        say(['Clean uniforms. You smell like detergent instead of jet fuel.',
             'Quality of life: improved. (+Spirit)']);
      });
    },
    dryer() {
      addStats({ sp: 2 });
      say(['You pull a warm towel out of the dryer and hold it like a small blanket.',
           'No one saw that. (+Spirit)']);
    },
    foldtable() {
      say(['Someone left a single sock on the folding table.',
           'It has been there for three weeks. It is part of the base now.']);
    },
    shower() {
      ask('Take a shower? (20 min)', ['Get clean', 'Not now'], i => {
        if (i !== 0) return;
        addStats({ sp: 10, hp: 2 });
        passTime(20);
        say(['Water pressure: weak. Water temperature: roulette.',
             'Still the best 20 minutes of your day. (+Spirit, +Health)']);
      });
    },
    toilet() {
      addStats({ sp: 3 });
      passTime(5);
      say(['A moment of peace. The only quiet place on base. (+Spirit)']);
    },
    sink() {
      say(['You wash your hands and stare into the mirror.',
           '"You\'ve got this," you tell yourself. The mirror does not respond.']);
    },
    docTalk() {
      const week = Math.floor((G.day - 1) / 7);
      if (G.pillWeek !== week) { G.pillWeek = week; G.goLeft = 5; G.nogoLeft = 5; }
      if (G.goLeft <= 0 && G.nogoLeft <= 0) {
        say(['Doc Kessler: "You\'ve drawn your full ration for the week, ' + G.callsign + '."',
             '"New allotment when the new week starts. Until then: sleep. It\'s free and FDA approved."']);
        return;
      }
      say(['Doc Kessler: "Ah, my favorite patient. What do you need?"'], () => {
        ask('Weekly ration — GO: ' + G.goLeft + ' left, NO-GO: ' + G.nogoLeft + ' left.', [
          'Go pill  (+Energy +Spirit -Health)',
          'No-go pill  (+Health +Spirit -Energy)',
          'Just visiting'
        ], i => {
          if (i === 0) {
            if (G.goLeft <= 0) { say(['Doc Kessler: "Out of go pills until next week. Try coffee. Or standards."']); return; }
            if (addItem('gopill', 1) < 1) { say(['Doc Kessler: "Your pockets are full. Come back when you can actually carry it."']); return; }
            G.goLeft--;
            say(['Doc hands you a go pill in a tiny envelope.',
                 '"Take it when you need the edge. Don\'t make a habit of it."',
                 '* GO PILL added to your bag — select it and press [F]. *']);
          } else if (i === 1) {
            if (G.nogoLeft <= 0) { say(['Doc Kessler: "No-go pills are out until next week. A warm MRE cocoa works too."']); return; }
            if (addItem('nogopill', 1) < 1) { say(['Doc Kessler: "Your pockets are full. Come back when you can actually carry it."']); return; }
            G.nogoLeft--;
            say(['Doc hands you a no-go pill and a paper cup of water for later.',
                 '"Take it near a cot, not near a jet. Doctor\'s orders."',
                 '* NO-GO PILL added to your bag — select it and press [F]. *']);
          } else {
            say(['Doc Kessler: "Hydrate. Sleep. Stop skipping breakfast."',
                 '"I know you\'re skipping breakfast. I know everything."']);
          }
        });
      });
    },
    medcab() {
      say(['The medicine cabinet is locked. Doc keeps the good stuff on a tight leash.',
           'Through the glass you can see roughly nine thousand packets of ibuprofen.']);
    },
    exambed() {
      say(['You sit on the crinkly paper of the exam bed for a moment.',
           'It crinkles. Deeply satisfying. The paper is now ruined.']);
    },
    chiefTalk() {
      const lines = ['Crew Chief Diaz: "Jet\'s fueled and armed, ' + maam() + '."'];
      if (!G.hasMission) lines.push('"No tasking on the books though. Get a brief at OPS first."');
      else lines.push('"You\'re briefed and the jet\'s ready. Kick the tires and light the fires."');
      if (G.cigDay !== G.day && addItem('cigs', 3) > 0) {
        G.cigDay = G.day;
        lines.push('Diaz shakes three cigarettes out of a crumpled pack. "Don\'t tell Doc."');
        lines.push('* 3 CIGARETTES added to your bag. *');
      } else {
        lines.push('"And hey — eat something. You look like you\'ve been living on coffee."');
      }
      say(lines);
    },
    jetOther() {
      say(['Not your jet. The crew chief for this one guards it like a dragon.']);
    },
    jet() {
      if (G.alarm) {
        say(['Crew Chief Diaz, from under the jet: "ALARM RED, ' + maam() + '! Nobody\'s flying!"',
             '"BUNKER. NOW."']);
        return;
      }
      if (G.duty && !G.duty.done) {
        say(['Crew Chief Diaz: "Nice try, ' + maam() + '. Word is you\'ve got ' + DUTY_NAMES[G.duty.type] + ' duty today."',
             '"Jet\'s not going anywhere until that\'s done."']);
        return;
      }
      if (G.sortieDay === G.day) {
        say(['You\'ve already flown today. Crew rest: it\'s not optional.',
             'The jet gets a break. So do you.']);
        return;
      }
      if (!G.hasMission) {
        say(['Your jet is ready, but you have no tasking.',
             'Get a mission brief at the OPS building first.']);
        return;
      }
      if (G.stats.en < 35) {
        noBeep();
        say(['You\'re too exhausted to fly safely.',
             'Eat at the DFAC or rest at the MWR shack, then come back. (Need 35+ Energy)']);
        return;
      }
      ask('Launch on your sortie? (Energy -30)', ['Launch!', 'Hold off'], i => {
        if (i === 0) startFlight();
      });
    }
  };

  /* ---------------- items & inventory ---------------- */
  const ITEMS = {
    gopill:   { name: 'Go Pill',         fx: { en: 25,  sp: 8,  hp: -6 },          txt: 'The desert gets very crisp and very fast.' },
    nogopill: { name: 'No-Go Pill',      fx: { en: -20, sp: 10, hp: 12 },          txt: 'Everything goes soft and warm. Find a cot.' },
    ripit:    { name: 'Rip-It',          fx: { en: 15,  sp: 3,  hp: -2 },          txt: 'Your heartbeat is now audible from outside your body.' },
    gatorade: { name: 'Gatorade',        fx: { en: 8,   hp: 4,  hu: -5 },          txt: 'Electrolytes. The good kind of salt.' },
    water:    { name: 'Water Bottle',    fx: { en: 3,   hp: 4,  hu: -3 },          txt: 'Hydration is a force multiplier.' },
    mre:      { name: 'MRE Snack',       fx: { hu: -30, en: 6 },                   txt: 'Beef ravioli. Probably. The label is faded.' },
    seeds:    { name: 'Sunflower Seeds', fx: { hu: -10, sp: 5 },                   txt: 'Spit cup optional. Morale mandatory.' },
    beer:     { name: 'Beer',            fx: { sp: 12,  en: -8, hp: -2 },          txt: 'One warm beer. General Order 1 looks the other way.' },
    wine:     { name: 'Red Wine',        fx: { sp: 15,  en: -10, hp: -2 },         txt: 'A paper cup of merlot. Practically a bistro.' },
    cigs:     { name: 'Cigarette',       fx: { sp: 10,  hp: -5, hu: -5 },          txt: 'Terrible for you. Great for morale. Doc sighs somewhere.' },
    liquor:   { name: 'Whiskey',         fx: { sp: 18,  en: -12, hp: -3 },         txt: 'Local "whiskey." The label is just a picture of an eagle.' },
    kebab:    { name: 'Goat Kebab',      fx: { hu: -35, sp: 8, hp: 3 },            txt: 'Char-grilled by the roadside. Life-changing.' },
    coffee:   { name: 'CROC\'s Coffee',  txt: 'Premium local grounds. Stock the coffee stand with it — face the stand, press F.' },
    // tools — one per pilot, can't be trashed
    hammer:   { name: 'Hammer',      tool: true, stack: 1, txt: 'Your salvage hammer. Swing it at junkyard nodes (F or left-click).' },
    // building materials — no fx
    wood:     { name: 'Wood',        txt: 'Pallet lumber. The base runs on it.' },
    scrap:    { name: 'Scrap Metal', txt: 'One man\'s junk is another man\'s bar stool.' },
    elec:     { name: 'Electronics', txt: 'Circuit boards of questionable provenance.' },
    cable:    { name: 'Cables',      txt: 'Definitely not from the comm closet. Definitely.' },
    // craftables — place with F while selected
    chest:      { name: 'Storage Chest', place: true, txt: 'Face a clear tile and press F to place it.' },
    footlocker: { name: 'Footlocker',    place: true, txt: 'Face a clear tile and press F to place it.' },
    sign:       { name: 'Morale Sign',   place: true, txt: 'Face a clear tile and press F to place it.' },
    chair:      { name: 'Camp Chair',    place: true, txt: 'Face a clear tile and press F to place it.' },
    coffeestand: { name: 'Coffee Stand', place: true, txt: 'CROC\'s master plan. Face a clear tile OUTSIDE and press F to set up shop.' }
  };
  const STACK_MAX = 99;
  const stackOf = id => ITEMS[id].stack || STACK_MAX;

  let toastTimer = null;
  function toast(msg) {
    const t = el('toast');
    t.textContent = msg;
    t.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
  }

  function fxLabel(fx) {
    const parts = [];
    if (fx.en) parts.push((fx.en > 0 ? '+' : '') + 'EN');
    if (fx.sp) parts.push((fx.sp > 0 ? '+' : '') + 'SP');
    if (fx.hp) parts.push((fx.hp > 0 ? '+' : '') + 'HP');
    return parts.join(' ');
  }

  // generic stack-merge add for any container (bag, chest, ...)
  function addToContainer(arr, id, n) {
    const max = stackOf(id);
    let added = 0;
    for (let i = 0; i < arr.length && added < n; i++) {
      const s = arr[i];
      if (s && s.id === id && s.n < max) {
        const take = Math.min(n - added, max - s.n);
        s.n += take; added += take;
      }
    }
    for (let i = 0; i < arr.length && added < n; i++) {
      if (!arr[i]) {
        const take = Math.min(n - added, max);
        arr[i] = { id, n: take }; added += take;
      }
    }
    return added;   // how many actually fit
  }

  function addItem(id, n) {
    const added = addToContainer(G.bag, id, n || 1);
    if (added > 0) updateHotbar();
    return added;
  }

  function countItem(id) {
    return G.bag.reduce((t, s) => t + (s && s.id === id ? s.n : 0), 0);
  }

  function removeItem(id, n) {
    for (let i = 0; i < G.bag.length && n > 0; i++) {
      const s = G.bag[i];
      if (s && s.id === id) {
        const take = Math.min(n, s.n);
        s.n -= take; n -= take;
        if (s.n <= 0) G.bag[i] = null;
      }
    }
    updateHotbar();
  }

  function useSelected() {
    const s = G.bag[G.bagSel];
    if (!s) { noBeep(); return; }
    const it = ITEMS[s.id];
    if (it.place) {           // craftable: place it at the facing tile
      placeFromBag(s.id);
      return;
    }
    if (s.id === 'hammer') {  // tool: swing at a salvage node you're facing
      const [fx, fy] = facingTile();
      const h = G.map.hot[fx + ',' + fy];
      if (h && h.action === 'salvage') { doSalvage(h); return; }
      blip();
      toast('Nothing here worth hammering. The junkyard, on the other hand...');
      return;
    }
    if (s.id === 'coffee') {  // stock the coffee stand you're facing
      const [fx, fy] = facingTile();
      const po = placedAt(G.map.key, fx, fy);
      if (po && po.id === 'coffeestand') { stockStand(po, s.n); return; }
      const hasStandItem = countItem('coffeestand') > 0 || (G.carrying && G.carrying.id === 'coffeestand');
      blip();
      toast(theStand() ? 'Take it to the coffee stand — face it, press F.'
            : hasStandItem ? 'Set the coffee stand up outside first.'
            : 'CROC\'s plan needs a coffee stand — craft one at the M menu.');
      return;
    }
    if (!it.fx) {
      toast(it.name + ' — building material. Take it to the MWR build board.');
      blip();
      return;
    }
    s.n--;
    if (s.n <= 0) G.bag[G.bagSel] = null;
    addStats(it.fx);
    okBeep();
    toast(it.name + ' (' + fxLabel(it.fx) + ') — ' + it.txt);
    updateHotbar();
  }

  /* ---------------- hotbar UI ---------------- */
  const slotEls = [];
  let dragFrom = -1, dragGhost = null, didDrag = false, dragStart = null;

  // move/merge a stack between two hotbar slots
  function moveBagSlot(a, b) {
    const sa = G.bag[a], sb = G.bag[b];
    if (!sa || a === b) return;
    if (sb && sb.id === sa.id && !ITEMS[sa.id].tool) {
      const room = stackOf(sa.id) - sb.n;
      const take = Math.min(room, sa.n);
      sb.n += take; sa.n -= take;
      if (sa.n <= 0) G.bag[a] = null;
    } else {
      G.bag[a] = sb; G.bag[b] = sa;
    }
    blip();
    updateHotbar();
  }
  function killGhost() {
    if (dragGhost) { dragGhost.remove(); dragGhost = null; }
    dragFrom = -1; dragStart = null;
  }
  window.addEventListener('mousemove', e => {
    if (dragFrom < 0) return;
    if (!didDrag && dragStart && Math.hypot(e.clientX - dragStart[0], e.clientY - dragStart[1]) > 5) {
      didDrag = true;
      dragGhost = document.createElement('canvas');
      dragGhost.width = 16; dragGhost.height = 16;
      dragGhost.style.cssText = 'position:fixed;width:32px;height:32px;image-rendering:pixelated;pointer-events:none;z-index:99;opacity:0.85;';
      dragGhost.getContext('2d').drawImage(SPR.item(G.bag[dragFrom].id), 0, 0);
      document.body.appendChild(dragGhost);
    }
    if (dragGhost) {
      dragGhost.style.left = (e.clientX - 16) + 'px';
      dragGhost.style.top = (e.clientY - 16) + 'px';
    }
  });
  window.addEventListener('mouseup', e => {
    if (dragFrom < 0) return;
    const slot = e.target && e.target.closest ? e.target.closest('.slot') : null;
    if (didDrag && slot) moveBagSlot(dragFrom, +slot.dataset.slot);
    killGhost();
  });

  (function buildHotbar() {
    const bar = el('hotbar');
    for (let i = 0; i < 12; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.slot = i;
      const key = document.createElement('span');
      key.className = 'keyhint';
      key.textContent = i < 9 ? (i + 1) : (i === 9 ? '0' : '');
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const q = document.createElement('span');
      q.className = 'qty';
      d.appendChild(key); d.appendChild(c); d.appendChild(q);
      d.addEventListener('mousedown', e => {
        if (e.button !== 0 || !G.bag[i]) return;
        dragFrom = i; didDrag = false; dragStart = [e.clientX, e.clientY];
        e.preventDefault();
      });
      d.addEventListener('click', () => {
        if (didDrag) { didDrag = false; return; }    // a drag isn't a click
        if (G.mode !== 'play') return;
        if (G.bagSel === i && G.bag[i]) { useSelected(); }
        else { G.bagSel = i; blip(); updateHotbar(); }
      });
      bar.appendChild(d);
      slotEls.push({ div: d, ctx: c.getContext('2d'), qty: q });
    }
  })();

  // scroll wheel cycles the hotbar selection
  window.addEventListener('wheel', e => {
    if (G.mode !== 'play') return;
    G.bagSel = (G.bagSel + (e.deltaY > 0 ? 1 : 11)) % 12;
    blip();
    updateHotbar();
  }, { passive: true });

  function updateHotbar() {
    for (let i = 0; i < 12; i++) {
      const s = G.bag[i], e = slotEls[i];
      e.div.classList.toggle('sel', i === G.bagSel);
      e.ctx.clearRect(0, 0, 16, 16);
      if (s) e.ctx.drawImage(SPR.item(s.id), 0, 0);
      e.qty.textContent = s && s.n > 1 ? s.n : '';
    }
  }

  /* ---------------- M menu (gear / bag / craft) ---------------- */
  let menuTab = 0, menuSel = 0, menuArm = -1, mTimer = null, mAnim = 0;

  function openMenu() {
    G.mode = 'menu';
    menuTab = 0; menuSel = 0; menuArm = -1;
    el('menu').style.display = 'flex';
    if (mTimer) clearInterval(mTimer);
    mTimer = setInterval(() => { mAnim++; drawMenuPreview(); }, 160);
    refreshMenu();
    blip();
  }
  function closeMenu() {
    el('menu').style.display = 'none';
    if (mTimer) { clearInterval(mTimer); mTimer = null; }
    G.mode = 'play';
    blip();
  }
  function drawMenuPreview() {
    const dirs = ['down', 'left', 'up', 'right'];
    const f = player.frames[dirs[Math.floor(mAnim / 8) % 4]][mAnim % 4];
    const cvs = el('mpreview');
    if (cvs.width !== f.width || cvs.height !== f.height) {
      cvs.width = f.width; cvs.height = f.height;
      const z = Math.floor(128 / f.height);   // integer zoom that fits the 132px wrap
      cvs.style.width = (f.width * z) + 'px';
      cvs.style.height = (f.height * z) + 'px';
    }
    const c = cvs.getContext('2d');
    c.clearRect(0, 0, cvs.width, cvs.height);
    c.drawImage(f, 0, 0);
  }

  // draw a character frame at 2x in cutscenes; y is the top of a 24-tall
  // char, taller (generated) frames keep the feet on the same line
  function drawChar2x(ctx, f, x, y) {
    ctx.drawImage(f, 0, 0, f.width, f.height, x, y - (f.height - 24) * 2, f.width * 2, f.height * 2);
  }

  // NPC stand frame, preferring generated sheets (assets.js)
  const charStand = (pal, dir) => (ASSETS.npc[pal] || SPR.charFrames(pal))[dir][0];

  function refreshMenu() {
    document.querySelectorAll('.mtab').forEach((t, i) => t.classList.toggle('sel', i === menuTab));
    el('mgear').classList.toggle('sel', menuTab === 0);
    el('mbag').classList.toggle('sel', menuTab === 1);
    el('mcraft').classList.toggle('sel', menuTab === 2);
    if (menuTab === 0) refreshGear();
    if (menuTab === 1) refreshBag();
    if (menuTab === 2) refreshCraft();
    const hint = el('mhint');
    hint.classList.remove('warn');
    if (menuTab === 0) hint.textContent = '←→ TAB    M/ESC CLOSE';
    else if (menuTab === 1) {
      if (menuArm >= 0) { hint.textContent = 'PRESS X AGAIN TO TRASH THE WHOLE STACK'; hint.classList.add('warn'); }
      else hint.textContent = '↑↓ SELECT    X TRASH ITEM    ←→ TAB    M/ESC CLOSE';
    } else {
      hint.textContent = '↑↓ SELECT    ENTER CRAFT    ←→ TAB    M/ESC CLOSE';
    }
  }

  function refreshGear() {
    drawMenuPreview();
    const rows = [
      ['CALLSIGN', G.callsign],
      ['CREW', G.cfg.role === 1 ? 'WSO' : 'Pilot'],
      ['GENDER', SPR.SEXES[G.cfg.sex]],
      ['HAIR', SPR.HAIRS[G.cfg.hair][0]],
      ['WEARING', SPR.OUTFITS[G.cfg.outfit].name],
      ['SHOES', SPR.SHOES[G.cfg.shoes][0]],
      ['HAT', SPR.HATS[G.cfg.hat]],
      ['DAY', G.day + ' / ' + G.deployEnd],
      ['SORTIES', G.sorties + (medals() ? '  (AM x' + medals() + ')' : '')],
      ['SQDN MORALE', Math.round(G.morale) + ' / 100']
    ];
    const list = el('mgearlist');
    list.innerHTML = '';
    rows.forEach(r => {
      const d = document.createElement('div');
      d.className = 'grow';
      const l = document.createElement('span'); l.className = 'gl'; l.textContent = r[0];
      const v = document.createElement('span'); v.className = 'gv'; v.textContent = r[1];
      d.appendChild(l); d.appendChild(v);
      list.appendChild(d);
    });
  }

  function refreshBag() {
    const list = el('mbaglist');
    list.innerHTML = '';
    G.bag.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'mrow' + (i === menuSel ? ' sel' : '') + (s ? '' : ' dim');
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      if (s) c.getContext('2d').drawImage(SPR.item(s.id), 0, 0);
      d.appendChild(c);
      const nm = document.createElement('span'); nm.className = 'mname';
      nm.textContent = s ? ITEMS[s.id].name : '— empty —';
      d.appendChild(nm);
      if (s) {
        const q = document.createElement('span'); q.className = 'mqty'; q.textContent = 'x' + s.n;
        d.appendChild(q);
        const x = document.createElement('span'); x.className = 'mdel';
        x.textContent = (menuArm === i) ? 'SURE?' : 'X';
        x.addEventListener('click', ev => { ev.stopPropagation(); bagDelete(i); });
        d.appendChild(x);
      }
      d.addEventListener('click', () => { menuSel = i; menuArm = -1; refreshMenu(); });
      list.appendChild(d);
    });
  }

  function bagDelete(i) {
    if (!G.bag[i]) { noBeep(); return; }
    if (ITEMS[G.bag[i].id].tool) { noBeep(); toast('You\'re not trashing your tools.'); return; }
    if (menuArm === i) {
      toast('Trashed: ' + ITEMS[G.bag[i].id].name + ' x' + G.bag[i].n);
      G.bag[i] = null;
      menuArm = -1;
      updateHotbar();
      okBeep();
    } else {
      menuArm = i; menuSel = i;
      noBeep();
    }
    refreshMenu();
  }

  function refreshCraft() {
    const list = el('mcraftlist');
    list.innerHTML = '';
    craftList().forEach((r, i) => {
      const ok = canAfford(r.cost);
      const d = document.createElement('div');
      d.className = 'mrow' + (i === menuSel ? ' sel' : '') + (ok ? '' : ' dim');
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').drawImage(SPR.item(r.id), 0, 0);
      d.appendChild(c);
      const nm = document.createElement('span'); nm.className = 'mname';
      const t1 = document.createElement('div'); t1.textContent = ITEMS[r.id].name;
      const t2 = document.createElement('div'); t2.className = 'mdesc'; t2.textContent = r.desc;
      nm.appendChild(t1); nm.appendChild(t2);
      d.appendChild(nm);
      const cost = document.createElement('span'); cost.className = 'mcost';
      cost.textContent = costText(r.cost);
      d.appendChild(cost);
      d.addEventListener('click', () => {
        if (menuSel === i) craftSel();
        else { menuSel = i; refreshMenu(); }
      });
      list.appendChild(d);
    });
  }

  function craftSel() {
    const r = craftList()[menuSel];
    if (!r) return;
    if (r.unique && (G.bag.some(s => s && s.id === r.id) ||
                     (G.carrying && G.carrying.id === r.id) ||
                     G.placed.some(p => p.id === r.id))) {
      noBeep();
      toast('You\'ve already got one. CROC agrees: one stand is plenty.');
      return;
    }
    if (!canAfford(r.cost)) { noBeep(); toast('Not enough materials — need ' + costText(r.cost)); return; }
    spendCost(r.cost);
    if (addItem(r.id, 1) < 1) {
      Object.keys(r.cost).forEach(id => addItem(id, r.cost[id]));   // refund
      noBeep();
      toast('Your pockets are full!');
      return;
    }
    okBeep();
    toast('Crafted: ' + ITEMS[r.id].name + ' — select it in the hotbar, press F to place.');
    refreshMenu();
  }

  function moveMenuSel(d) {
    const n = menuTab === 1 ? G.bag.length : menuTab === 2 ? craftList().length : 0;
    if (!n) return;
    menuSel = (menuSel + d + n) % n;
    menuArm = -1;
    blip();
    refreshMenu();
  }

  function menuKey(k) {
    if (k === 'm' || k === 'M' || k === 'Escape') { closeMenu(); return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { menuTab = (menuTab + 2) % 3; menuSel = 0; menuArm = -1; blip(); refreshMenu(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { menuTab = (menuTab + 1) % 3; menuSel = 0; menuArm = -1; blip(); refreshMenu(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') moveMenuSel(-1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') moveMenuSel(1);
    else if ((k === 'x' || k === 'X' || k === 'Delete') && menuTab === 1) bagDelete(menuSel);
    else if ((k === 'Enter' || k === 'e' || k === 'E' || k === ' ') && menuTab === 2) craftSel();
  }

  document.querySelectorAll('.mtab').forEach((t, i) => {
    t.addEventListener('click', () => {
      if (G.mode !== 'menu') return;
      menuTab = i; menuSel = 0; menuArm = -1;
      refreshMenu();
    });
  });

  /* ---------------- chest / storage UI ---------------- */
  let chestObj = null, chestFocus = 0, chestSel = 0;
  const chestSlotEls = [], bagSlotEls2 = [];

  (function buildChestUI() {
    const mk = (parent, arr, count, row) => {
      for (let i = 0; i < count; i++) {
        const d = document.createElement('div');
        d.className = 'slot';
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        const q = document.createElement('span'); q.className = 'qty';
        d.appendChild(c); d.appendChild(q);
        const idx = i;
        d.addEventListener('click', () => {
          if (G.mode !== 'chest') return;
          if (chestFocus === row && chestSel === idx) chestTransfer();
          else { chestFocus = row; chestSel = idx; blip(); refreshChestUI(); }
        });
        parent.appendChild(d);
        arr.push({ div: d, ctx: c.getContext('2d'), qty: q });
      }
    };
    mk(el('chestslots'), chestSlotEls, 10, 0);
    mk(el('bagslots'), bagSlotEls2, 12, 1);
  })();

  function openChest(po) {
    chestObj = po; chestFocus = 0; chestSel = 0;
    G.mode = 'chest';
    el('chestname').textContent = ITEMS[po.id].name.toUpperCase();
    el('chestui').style.display = 'flex';
    refreshChestUI();
    blip();
  }
  function closeChest() {
    el('chestui').style.display = 'none';
    chestObj = null;
    G.mode = 'play';
    save();
    blip();
  }
  function refreshChestUI() {
    el('chestslots').classList.toggle('focus', chestFocus === 0);
    el('bagslots').classList.toggle('focus', chestFocus === 1);
    const paint = (els, arr, row) => {
      els.forEach((e, i) => {
        const s = arr[i];
        e.div.classList.toggle('sel', chestFocus === row && chestSel === i);
        e.ctx.clearRect(0, 0, 16, 16);
        if (s) e.ctx.drawImage(SPR.item(s.id), 0, 0);
        e.qty.textContent = s && s.n > 1 ? s.n : '';
      });
    };
    paint(chestSlotEls, chestObj.inv, 0);
    paint(bagSlotEls2, G.bag, 1);
  }
  function chestTransfer() {
    const fromArr = chestFocus === 0 ? chestObj.inv : G.bag;
    const toArr = chestFocus === 0 ? G.bag : chestObj.inv;
    const s = fromArr[chestSel];
    if (!s) { noBeep(); return; }
    const moved = addToContainer(toArr, s.id, s.n);
    if (moved <= 0) { noBeep(); toast('No room on the other side.'); return; }
    s.n -= moved;
    if (s.n <= 0) fromArr[chestSel] = null;
    blip();
    updateHotbar();
    refreshChestUI();
  }
  function chestKey(k) {
    if (k === 'Escape' || k === 'm' || k === 'M') { closeChest(); return; }
    const rowLen = chestFocus === 0 ? chestSlotEls.length : bagSlotEls2.length;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { chestSel = (chestSel - 1 + rowLen) % rowLen; blip(); refreshChestUI(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { chestSel = (chestSel + 1) % rowLen; blip(); refreshChestUI(); }
    else if (k === 'ArrowUp' || k === 'ArrowDown' || k === 'w' || k === 'W' || k === 's' || k === 'S') {
      chestFocus = 1 - chestFocus;
      chestSel = Math.min(chestSel, (chestFocus === 0 ? chestSlotEls.length : bagSlotEls2.length) - 1);
      blip(); refreshChestUI();
    }
    else if (k === 'Enter' || k === 'e' || k === 'E' || k === ' ' || k === 'f' || k === 'F') chestTransfer();
  }

  /* ---------------- crafting & placeable objects ---------------- */
  const PLACEABLES = {
    chest:      { furn: 'chest',      storage: 10, breakYield: { wood: 2, scrap: 1 } },
    footlocker: { furn: 'footlocker', storage: 10, breakYield: { wood: 3, scrap: 2 } },
    sign:       { furn: 'sign',       breakYield: { wood: 1 } },
    chair:      { furn: 'chair',      breakYield: { wood: 1 } },
    coffeestand: { furn: 'coffeestand', breakYield: { wood: 4, scrap: 2 } }
  };
  const RECIPES = [
    { id: 'chest',      cost: { wood: 4, scrap: 2 }, desc: '10-slot storage. Place anywhere, move anytime.' },
    { id: 'footlocker', cost: { wood: 6, scrap: 4 }, desc: 'Another 10-slot box. Olive drab. Sturdy.' },
    { id: 'sign',       cost: { wood: 2 },           desc: 'Hand-painted morale. Read it daily. (+Spirit)' },
    { id: 'chair',      cost: { wood: 3, scrap: 1 }, desc: 'A seat that isn\'t a hesco. (+Spirit +Energy)' },
    { id: 'coffeestand', cost: { wood: 8, scrap: 4 }, desc: 'CROC\'s coffee stand. Place it outside, stock it, and customers will come.',
      when: () => G.croc.intro, unique: true }
  ];
  // recipes currently visible in the craft tab (some unlock via quests)
  const craftList = () => RECIPES.filter(r => !r.when || r.when());
  const SLOGANS = [
    'HOME IS THAT WAY ->',
    'MANDATORY FUN AREA',
    'THE FUN POLICE CAN\'T CATCH US ALL',
    'DAYS OF SUNSHINE LEFT: ALL OF THEM',
    'IT\'S NOT A PHASE, IT\'S A DEPLOYMENT'
  ];

  function placedAt(mapKey, x, y) {
    return G.placed.find(p => p.map === mapKey && p.x === x && p.y === y) || null;
  }

  function canPlaceAt(m, x, y) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    if (m.solid[y][x]) return false;
    if (m.hot[x + ',' + y]) return false;                      // never block doors/exits/hotspots
    if (m.npcs.some(n => n.x === x && n.y === y)) return false;
    if (placedAt(m.key, x, y)) return false;
    if (m.key === 'exterior' && G.groundItems.some(g => g.x === x && g.y === y)) return false;
    if (player.tx === x && player.ty === y) return false;
    return true;
  }

  function makePlacedObj(id, mapKey, x, y) {
    const obj = { id, map: mapKey, x, y };
    if (PLACEABLES[id].storage) obj.inv = new Array(PLACEABLES[id].storage).fill(null);
    if (id === 'sign') { obj.slogan = SLOGANS[Math.floor(Math.random() * SLOGANS.length)]; obj.day = 0; }
    if (id === 'coffeestand') obj.stock = 0;
    return obj;
  }

  function placeFromBag(id) {
    const [fx, fy] = facingTile();
    if (id === 'coffeestand' && G.map.key !== 'exterior') {
      noBeep();
      toast('The stand needs foot traffic — set it up outside.');
      return;
    }
    if (!canPlaceAt(G.map, fx, fy)) { noBeep(); toast('Can\'t place it there.'); return; }
    removeItem(id, 1);
    G.placed.push(makePlacedObj(id, G.map.key, fx, fy));
    okBeep();
    if (id === 'coffeestand') {
      say(['The coffee stand is OPEN FOR BUSINESS.',
           'Stock it with CROC\'s coffee (face it, press F) and the base will do the rest.',
           'Word travels fast out here. Especially about caffeine.']);
    } else {
      toast(ITEMS[id].name + ' placed.');
    }
    save();
  }

  function placedMenu(po) {
    const name = ITEMS[po.id].name;
    const def = PLACEABLES[po.id];
    const opts = [], acts = [];
    if (def.storage) { opts.push('Open'); acts.push('open'); }
    if (po.id === 'sign') { opts.push('Read'); acts.push('read'); }
    if (po.id === 'chair') { opts.push('Sit a while (15 min)'); acts.push('sit'); }
    if (po.id === 'coffeestand') {
      opts.push('Stock coffee (' + (po.stock || 0) + ' in stand, ' + countItem('coffee') + ' on you)');
      acts.push('stock');
    }
    opts.push('Pick up / move', 'Break it down', 'Leave it');
    acts.push('move', 'break', 'cancel');
    ask(name, opts, i => {
      const a = acts[i < 0 ? acts.length - 1 : i];
      if (a === 'open') { openChest(po); }
      else if (a === 'stock') { stockStand(po, countItem('coffee')); }
      else if (a === 'read') {
        if (po.day === G.day) { say(['"' + po.slogan + '"', 'Still true. You already got your morale from it today.']); return; }
        po.day = G.day;
        addStats({ sp: 3 });
        say(['"' + po.slogan + '"', 'You know what? Yeah. (+Spirit)']);
      }
      else if (a === 'sit') {
        addStats({ sp: 5, en: 4 });
        passTime(15);
        say(['You sit in your own chair, in your own spot, on purpose.',
             'Fifteen minutes of absolutely nothing. Perfect. (+Spirit, +Energy)']);
      }
      else if (a === 'move') {
        G.placed = G.placed.filter(p => p !== po);
        G.carrying = po;
        blip();
        toast('Carrying ' + name + ' — face a clear tile, press E.');
      }
      else if (a === 'break') {
        if (po.inv && po.inv.some(Boolean)) { noBeep(); say(['It\'s still got stuff in it. Empty it out first.']); return; }
        if (po.id === 'coffeestand' && po.stock > 0) {
          noBeep();
          say(['There\'s still coffee in it. Sell out before you tear it down — CROC would cry.']);
          return;
        }
        G.placed = G.placed.filter(p => p !== po);
        const got = [];
        Object.keys(def.breakYield).forEach(id => {
          addItem(id, def.breakYield[id]);
          got.push(ITEMS[id].name + ' x' + def.breakYield[id]);
        });
        okBeep();
        toast('Broke down the ' + name.toLowerCase() + ' — recovered ' + got.join(', '));
        save();
      }
    });
  }

  /* ---------------- MWR build projects ---------------- */
  const PROJECTS = [
    { key: 'couch',     name: 'New Couches',     cost: { wood: 6,  scrap: 2 } },
    { key: 'computers', name: 'Computer Corner', cost: { elec: 4,  cable: 4, scrap: 2 } },
    { key: 'bar',       name: 'Bar Area',        cost: { wood: 10, scrap: 4 } },
    { key: 'kitchen',   name: 'Kitchen Area',    cost: { scrap: 6, elec: 2, cable: 1 } },
    { key: 'movie',     name: 'Movie Area',      cost: { elec: 3,  cable: 3, wood: 2 } },
    { key: 'deck',      name: 'Front Deck',      cost: { wood: 14 } },
    { key: 'firepit',   name: 'Fire Pit',        cost: { wood: 8,  scrap: 3 } }
  ];
  const projByKey = k => PROJECTS.find(p => p.key === k);
  const builtCount = () => PROJECTS.filter(p => G.built[p.key]).length;
  const allBuilt = () => builtCount() === PROJECTS.length;

  function costText(cost) {
    return Object.keys(cost).map(id => ITEMS[id].name + ' ' + countItem(id) + '/' + cost[id]).join(', ');
  }
  function canAfford(cost) {
    return Object.keys(cost).every(id => countItem(id) >= cost[id]);
  }
  function spendCost(cost) {
    Object.keys(cost).forEach(id => removeItem(id, cost[id]));
  }

  // stamp a completed build onto a live map (canvas + collision + hotspots)
  function stampFurn(m, x, y, furn, action, label) {
    m.canvas.getContext('2d').drawImage(SPR.furn(furn), x * T, y * T);
    m.solid[y][x] = true;
    if (action) m.hot[x + ',' + y] = { action, label };
  }

  const BUILD_STAMPS = {
    couch(m) {
      if (m.key !== 'shack') return;
      const c = m.canvas.getContext('2d');
      SPR.tile(c, 'floor', 1 * T, 2 * T, 1, 2);
      SPR.tile(c, 'floor', 2 * T, 2 * T, 2, 2);
      stampFurn(m, 1, 2, 'couch2', 'tv', 'New Couch');
      stampFurn(m, 2, 2, 'couch2', 'tv', 'New Couch');
      stampFurn(m, 3, 2, 'couch2', 'tv', 'New Couch');
    },
    computers(m) {
      if (m.key !== 'shack') return;
      stampFurn(m, 11, 4, 'computer', 'computers', 'Computers');
      stampFurn(m, 12, 4, 'computer', 'computers', 'Computers');
    },
    bar(m) {
      if (m.key !== 'shack') return;
      stampFurn(m, 10, 7, 'barcounter', 'bar', 'The Bar');
      stampFurn(m, 11, 7, 'barcounter', 'bar', 'The Bar');
      stampFurn(m, 12, 7, 'barcounter', 'bar', 'The Bar');
    },
    kitchen(m) {
      if (m.key !== 'shack') return;
      stampFurn(m, 1, 5, 'kitchenette', 'kitchen', 'Kitchen');
      stampFurn(m, 1, 6, 'kitchenette', 'kitchen', 'Kitchen');
    },
    movie(m) {
      if (m.key !== 'shack') return;
      stampFurn(m, 5, 1, 'moviescreen', 'movie', 'Movie Screen');
      stampFurn(m, 6, 1, 'moviescreen', 'movie', 'Movie Screen');
      stampFurn(m, 7, 1, 'moviescreen', 'movie', 'Movie Screen');
    },
    deck(m) {
      if (m.key !== 'exterior') return;
      const c = m.canvas.getContext('2d');
      for (let x = 28; x <= 34; x++) SPR.tile(c, 'deck', x * T, 26 * T, x, 26);
      stampFurn(m, 28, 26, 'bench', 'deck', 'Deck Bench');
      stampFurn(m, 34, 26, 'bench', 'deck', 'Deck Bench');
    },
    firepit(m) {
      if (m.key !== 'exterior') return;
      stampFurn(m, 37, 27, 'firepit', 'firepit', 'Fire Pit');
    }
  };

  function applyBuilds(m) {
    m._applied = m._applied || {};
    PROJECTS.forEach(p => {
      if (G.built[p.key] && !m._applied[p.key]) {
        BUILD_STAMPS[p.key](m);
        m._applied[p.key] = true;
      }
    });
  }

  function completeBuild(p) {
    spendCost(p.cost);
    G.built[p.key] = true;
    addMorale(5);
    applyBuilds(G.map);
    applyBuilds(WORLD.get('shack'));
    applyBuilds(WORLD.get('exterior'));
    save();
    okBeep();
  }

  /* ---------------- CROC's coffee stand: stock + walk-up customers ---------------- */
  const theStand = () => G.placed.find(p => p.id === 'coffeestand' && p.map === 'exterior') || null;

  function stockStand(po, n) {
    if (n <= 0) {
      noBeep();
      say(['No bags on you. CROC restocks every couple of days — go see him at OPS.']);
      return;
    }
    removeItem('coffee', n);
    po.stock = (po.stock || 0) + n;
    custT = Math.min(custT, 6);          // word gets around fast
    okBeep();
    toast('Stocked ' + n + ' bag' + (n > 1 ? 's' : '') + ' — stand holds ' + po.stock + '. Customers will come.');
    updateHotbar();
    save();
  }

  // wandering buyers (transient — not saved)
  const CUSTOMER_TYPES = [
    { pal: 'crew',       line: 'A crew dog slaps down cash. "Real coffee. REAL coffee."' },
    { pal: 'crew',       line: 'Two crew dogs split a bag. Cash, no questions.' },
    { pal: 'guard',      line: 'A gate guard buys a bag two hours into a twelve-hour shift.' },
    { pal: 'guard',      line: 'A gate guard mutters "finally" and takes a bag.' },
    { pal: 'contractor', line: 'A contractor pays double "for the good stuff."' },
    { pal: 'maint',      line: 'A maintainer pays exact change with a tired nod.' }
  ];
  const customers = [];
  let custT = 6;

  // BFS shortest path on the walkable grid; goals = list of [x,y] targets
  function custPath(m, sx, sy, goals) {
    const key = (x, y) => x + ',' + y;
    const goal = {};
    let any = false;
    goals.forEach(([x, y]) => { if (walkable(m, x, y)) { goal[key(x, y)] = true; any = true; } });
    if (!any) return null;
    const prev = {};
    prev[key(sx, sy)] = null;
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      if (goal[key(x, y)]) {
        const path = [];
        let k = [x, y];
        while (k) { path.unshift(k); k = prev[key(k[0], k[1])]; }
        return path;
      }
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (prev[key(nx, ny)] !== undefined || !walkable(m, nx, ny)) continue;
        prev[key(nx, ny)] = [x, y];
        q.push([nx, ny]);
      }
    }
    return null;
  }

  // customers appear at a building door and walk to the stand's counter
  function spawnCustomer(m, stand) {
    const doors = WORLD.BUILDINGS.map(b => WORLD.doorOf(b)).map(d => [d.x, d.y + 1])
      .filter(([x, y]) => walkable(m, x, y));
    if (!doors.length) return;
    const [sx, sy] = doors[(Math.random() * doors.length) | 0];
    const front = [[stand.x, stand.y + 1], [stand.x - 1, stand.y], [stand.x + 1, stand.y], [stand.x, stand.y - 1]];
    const path = custPath(m, sx, sy, front);
    if (!path || path.length < 2) return;
    const t = CUSTOMER_TYPES[(Math.random() * CUSTOMER_TYPES.length) | 0];
    customers.push({ pal: t.pal, line: t.line, path, i: 0, x: sx, y: sy,
                     px: sx * T, py: sy * T, dir: 'down', state: 'walk', t: 0, animT: 0 });
  }

  function faceStand(c) {
    const s = theStand();
    if (!s) return;
    const dx = s.x - c.x, dy = s.y - c.y;
    c.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  }

  function updateCustomers(dt) {
    const m = G.map;
    if (m.key !== 'exterior') return;
    const stand = theStand();
    const hour = G.timeMin / 60;
    if (stand && stand.stock > 0 && !G.alarm && hour >= 7 && hour < 20 && customers.length < 3) {
      custT -= dt;
      if (custT <= 0) {
        custT = 40 + Math.random() * 50;
        spawnCustomer(m, stand);
      }
    }
    const SPEED = 55;
    for (let i = customers.length - 1; i >= 0; i--) {
      const c = customers[i];
      if (c.state === 'buy') {
        c.t += dt;
        if (c.t < 1.5) continue;
        const s = theStand();
        if (s && s.stock > 0) {          // could've been picked up / sold out mid-visit
          s.stock--;
          G.croc.fund = Math.min(100, G.croc.fund + 10);
          addMorale(1);
          okBeep();
          toast(c.line + ' Vacation fund: ' + G.croc.fund + '%');
          save();
        }
        c.state = 'leave';
        c.path = c.path.slice(0, c.i + 1).reverse();
        c.i = 0;
        continue;
      }
      c.animT += dt;
      const [tx, ty] = c.path[c.i];
      const gx = tx * T, gy = ty * T;
      const step = SPEED * dt;
      const dx = gx - c.px, dy = gy - c.py;
      if (dx || dy) c.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      c.px += clamp(dx, -step, step);
      c.py += clamp(dy, -step, step);
      if (c.px === gx && c.py === gy) {
        c.x = tx; c.y = ty;
        if (c.i < c.path.length - 1) c.i++;
        else if (c.state === 'walk') { c.state = 'buy'; c.t = 0; c.animT = 0; faceStand(c); }
        else customers.splice(i, 1);     // walked off — despawn
      }
    }
  }

  /* ---------------- junkyard salvage (Stardew-style: hammer swings) ---------------- */
  const SALVAGE_HITS = 3, SALVAGE_EN = 4, SALVAGE_MIN = 8;
  let swingFx = [];                      // impact particles (transient)
  const FX_COLORS = {
    pallet:  ['#c9a26a', '#8a6b40', '#e2c088'],
    junk:    ['#9a9aa0', '#6f6f76', '#c9c9c9'],
    machine: ['#c9c9c9', '#e8a23c', '#8f8f96']
  };
  function salvageLoot(spot) {
    const r = Math.random();
    if (spot === 'pallet') return { wood: r > 0.5 ? 2 : 1 };
    if (spot === 'junk')   return r > 0.85 ? { scrap: 1, wood: 1 } : { scrap: r > 0.45 ? 2 : 1 };
    // old machine: the good stuff
    return r < 0.45 ? { scrap: 2 } : (r < 0.75 ? { cable: 1 } : { elec: 1 });
  }
  function startSwing(h, fx, fy) {
    if (G.swing) return;
    if (G.junk.day !== G.day) G.junk = { day: G.day, nodes: {} };   // fresh yard each day
    if ((G.junk.nodes[fx + ',' + fy] || 0) >= SALVAGE_HITS) {
      blip();
      say([h.label + ' — picked clean. The yard restocks overnight.']);
      return;
    }
    if (G.stats.en < SALVAGE_EN + 2) {
      noBeep();
      say(['You\'re too smoked to swing the hammer. Eat or rest first.']);
      return;
    }
    G.swing = { fx, fy, h, t: 0, hit: false };
    blip();
  }
  function swingImpact() {
    const s = G.swing;
    const key = s.fx + ',' + s.fy;
    G.junk.nodes[key] = (G.junk.nodes[key] || 0) + 1;
    addStats({ en: -SALVAGE_EN });
    passTime(SALVAGE_MIN);
    const gains = salvageLoot(s.h.spot);
    const parts = [];
    Object.keys(gains).forEach(id => { addItem(id, gains[id]); parts.push(ITEMS[id].name + ' x' + gains[id]); });
    okBeep();
    G.shake = 0.14;
    const cols = FX_COLORS[s.h.spot] || FX_COLORS.junk;
    for (let i = 0; i < 8; i++) {
      swingFx.push({
        x: s.fx * T + 8, y: s.fy * T + 8,
        vx: (Math.random() - 0.5) * 90, vy: -40 - Math.random() * 70,
        life: 0.35 + Math.random() * 0.2,
        c: cols[(Math.random() * cols.length) | 0]
      });
    }
    const left = SALVAGE_HITS - G.junk.nodes[key];
    toast('+' + parts.join(', +') + ' (-EN)' + (left ? '' : ' — picked clean'));
    updateHotbar();
  }
  function doSalvage(h) {
    const [fx, fy] = facingTile();
    startSwing(h, fx, fy);
  }

  /* ---------------- gathering & theft ---------------- */
  function spotUsed(spot) { return G.gather[spot] === G.day; }

  function gatherResult(gains, minutes, lines) {
    Object.keys(gains).forEach(id => {
      if (gains[id] > 0 && addItem(id, gains[id]) < gains[id]) toast('Your pockets are full!');
    });
    passTime(minutes);
    say(lines);
  }

  function theft(spot, loot, flavor) {
    if (spotUsed(spot)) { say(['You\'ve pushed your luck here today. Try again tomorrow.']); return; }
    ask(flavor + ' (risky)', ['Do it', 'Walk away'], i => {
      if (i !== 0) return;
      G.gather[spot] = G.day;
      if (Math.random() < 0.35) {
        addStats({ sp: -8 });
        passTime(30);
        noBeep();
        say(['A voice behind you: "THE HELL do you think you\'re doing, Lieutenant?"',
             'The First Sergeant materializes out of thin air and chews you out for a solid half hour.',
             'You slink away with nothing. (-Spirit)']);
        return;
      }
      const gained = [];
      Object.keys(loot).forEach(id => {
        const n = loot[id]();
        if (n > 0) { addItem(id, n); gained.push(ITEMS[id].name + ' x' + n); }
      });
      passTime(15);
      okBeep();
      say(['You look left. You look right. You "liberate" some supplies.',
           '* Acquired: ' + gained.join(', ') + ' *']);
    });
  }

  /* ---------------- field pickups ---------------- */
  const LOOT = ['ripit', 'ripit', 'water', 'water', 'gatorade', 'seeds', 'mre', 'beer', 'gopill', 'wood', 'wood', 'scrap'];

  function spawnGroundItems() {
    const m = WORLD.get('exterior');
    G.groundItems = [];
    let guard = 0;
    while (G.groundItems.length < 3 && guard++ < 200) {
      const x = 2 + Math.floor(Math.random() * (m.w - 4));
      const y = 2 + Math.floor(Math.random() * (m.h - 4));
      if (!walkable(m, x, y)) continue;
      if (m.hot[x + ',' + y]) continue;
      if (G.groundItems.some(g => g.x === x && g.y === y)) continue;
      G.groundItems.push({ x, y, id: LOOT[Math.floor(Math.random() * LOOT.length)] });
    }
  }

  function tryPickup() {
    if (G.map.key !== 'exterior') return;
    const i = G.groundItems.findIndex(g => g.x === player.tx && g.y === player.ty);
    if (i < 0) return;
    const g = G.groundItems[i];
    if (addItem(g.id, 1) > 0) {
      G.groundItems.splice(i, 1);
      okBeep();
      toast('Picked up: ' + ITEMS[g.id].name);
    } else {
      toast('Your pockets are full!');
      noBeep();
    }
  }

  /* ---------------- movement / world ---------------- */
  function walkable(m, x, y) {
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    if (m.solid[y][x]) return false;
    if (placedAt(m.key, x, y)) return false;
    for (const n of m.npcs) if (n.x === x && n.y === y) return false;
    return true;
  }

  function enterMap(key) {
    const m = WORLD.get(key);
    applyBuilds(m);
    G.map = m;
    player.tx = m.spawn.x; player.ty = m.spawn.y;
    player.px = player.tx * T; player.py = player.ty * T;
    player.dir = 'up'; player.moving = false;
    G.fade = 0.6;
    blip();
  }

  function exitBuilding() {
    const b = WORLD.BUILDINGS.find(b => b.key === G.map.key);
    const door = WORLD.doorOf(b);
    G.map = WORLD.get('exterior');
    applyBuilds(G.map);
    player.tx = door.x; player.ty = door.y + 1;
    player.px = player.tx * T; player.py = player.ty * T;
    player.dir = 'down'; player.moving = false;
    G.fade = 0.6;
    blip();
  }

  function onArrive() {
    tryPickup();
    const h = G.map.hot[player.tx + ',' + player.ty];
    if (!h) return;
    if (h.enter) enterMap(h.enter);
    else if (h.exit) exitBuilding();
  }

  function facingTile() {
    const [dx, dy] = DIRV[player.dir];
    return [player.tx + dx, player.ty + dy];
  }

  function interact() {
    const [fx, fy] = facingTile();
    if (G.carrying) {          // set the carried object down
      if (canPlaceAt(G.map, fx, fy)) {
        G.carrying.map = G.map.key;
        G.carrying.x = fx; G.carrying.y = fy;
        G.placed.push(G.carrying);
        G.carrying = null;
        okBeep();
        toast('Placed.');
        save();
      } else {
        noBeep();
        toast('Can\'t place it there.');
      }
      return;
    }
    const po = placedAt(G.map.key, fx, fy);
    if (po) { placedMenu(po); return; }
    const npc = G.map.npcs.find(n => n.x === fx && n.y === fy);
    if (npc) { ACTIONS[npc.action](npc); return; }
    const h = G.map.hot[fx + ',' + fy];
    if (h && h.action) { ACTIONS[h.action](h); return; }
    if (h && h.enter) { enterMap(h.enter); return; }
  }

  function updatePlay(dt) {
    // clock + decay
    const dtMin = dt * MIN_PER_SEC;
    G.timeMin += dtMin;
    tickStats(dtMin);
    if (G.mode !== 'play') return;
    if (G.timeMin >= 24 * 60) { doSleep(true); return; }

    // hammer swing + impact juice
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt);
    if (G.swing) {
      G.swing.t += dt;
      if (!G.swing.hit && G.swing.t >= 0.16) { G.swing.hit = true; swingImpact(); }
      if (G.swing.t >= 0.34) G.swing = null;
    }
    if (swingFx.length) {
      swingFx = swingFx.filter(p => (p.life -= dt) > 0);
      swingFx.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; });
    }

    // squadron morale hit 100 — the fun police take notice
    if (G.moralePop) {
      G.moralePop = false;
      G.crackdowns++;
      const crackdowns = [
        ['The Group Commander notices the squadron is... enjoying itself.',
         '"Morale this high means idle hands. New policy: every mustache shaved to standard by 0600."'],
        ['A base agency inspector materializes, clipboard drawn like a weapon.',
         '"Uniforms will be in regs AT ALL TIMES. Yes, in the MWR. Especially in the MWR."'],
        ['The Command Chief has decided the squadron\'s morale patches are "too fun."',
         '"Non-standard patches: confiscated. Reflective belts are now mandatory. Indoors."'],
        ['Higher HQ caught wind of the squadron having a good time.',
         '"Effective immediately: 0500 formation runs and a 90-minute mandatory resiliency briefing."'],
        ['The base commander launches a surprise health-and-comfort inspection.',
         '"That fridge is unauthorized. That fire pit is a hazard. That fun is unaccounted for."']
      ];
      const c = crackdowns[Math.floor(Math.random() * crackdowns.length)];
      addStats({ sp: -15 });
      addMorale(-35);
      G.moraleMaxed = false;   // re-arm: if morale climbs back, the fun police return
      noBeep();
      say(['Word travels up the chain: this squadron has the highest morale in the wing.',
           'This, it turns out, is a PROBLEM.',
           c[0], c[1],
           'HARD stares into the middle distance. "The fun police always find you." (- -Spirit, -Morale)']);
      return;
    }

    // Alarm Red — rockets inbound
    if (!G.alarm && G.attackAt > 0 && G.timeMin >= G.attackAt) {
      G.attackAt = -1;
      G.alarm = { deadline: G.timeMin + 100 };
      G.sirenT = 0;
      boomBeep();
      say(['*** ALARM RED! ALARM RED! ***',
           'The giant voice crackles: "INCOMING, INCOMING — SEEK IMMEDIATE SHELTER."',
           'Rockets inbound. GET TO THE BUNKER by the RLBs — MOVE!']);
      return;
    }
    if (G.alarm) {
      G.sirenT -= dt;
      if (G.sirenT <= 0) { G.sirenT = 1.1; beep(620, 0.35, 'sawtooth', 0.05); setTimeout(() => beep(440, 0.35, 'sawtooth', 0.05), 380); }
      if (G.timeMin >= G.alarm.deadline) {
        G.alarm = null;
        addStats({ hp: -15, sp: -10 });
        addMorale(-3);
        boomBeep();
        say(['CRUMP. CRUMP. Two impacts walk across the far side of base.',
             'You hit the deck in the open — way too close. Ears ringing, hands shaking.',
             'The all-clear sounds. Next time, GET TO THE BUNKER. (-Health, -Spirit, -Morale)']);
        return;
      }
    }

    // movement
    const SPEED = 85;
    if (!player.moving) {
      const d = dirFromKeys();
      if (d) {
        player.dir = d;
        const [dx, dy] = DIRV[d];
        if (walkable(G.map, player.tx + dx, player.ty + dy)) {
          player.tx += dx; player.ty += dy;
          player.moving = true;
        }
      }
    }
    if (player.moving) {
      player.animT += dt;
      const gx = player.tx * T, gy = player.ty * T;
      const step = SPEED * dt;
      player.px += clamp(gx - player.px, -step, step);
      player.py += clamp(gy - player.py, -step, step);
      if (player.px === gx && player.py === gy) {
        player.moving = false;
        onArrive();
      }
    } else {
      player.animT = 0;
    }

    // coffee stand walk-up customers
    updateCustomers(dt);
  }

  /* ---------------- flight minigame ---------------- */
  function startFlight() {
    G.mode = 'flight';
    G.flight = {
      t: 0, dur: 25,
      jx: 40, jy: 104,
      ms: [], flares: 3, spawnT: 1.4,
      hitT: 0, boomX: 0, boomY: 0, outcome: null,
      dust: []
    };
    beep(220, 0.4, 'sawtooth', 0.05);
  }

  function fireFlare() {
    const f = G.flight;
    if (!f || f.outcome || f.flares <= 0) return;
    f.flares--;
    beep(980, 0.15, 'triangle', 0.06);
    f.ms.forEach(m => { m.decoyed = true; m.vy = m.my < f.jy ? -90 : 90; });
  }

  function updateFlight(dt) {
    const f = G.flight;
    if (f.outcome) {
      f.hitT += dt;
      if (f.hitT > 1.6) endFlight(f.outcome === 'win');
      return;
    }
    f.t += dt;

    // jet control
    const V = 95;
    if (keys.ArrowUp || keys.w || keys.W) f.jy -= V * dt;
    if (keys.ArrowDown || keys.s || keys.S) f.jy += V * dt;
    if (keys.ArrowLeft || keys.a || keys.A) f.jx -= 60 * dt;
    if (keys.ArrowRight || keys.d || keys.D) f.jx += 60 * dt;
    f.jy = clamp(f.jy, 22, 178);
    f.jx = clamp(f.jx, 14, 150);

    // spawn missiles
    f.spawnT -= dt;
    if (f.spawnT <= 0) {
      f.spawnT = Math.max(0.7, 1.7 - f.t * 0.04);
      f.ms.push({ mx: FW + 10, my: clamp(f.jy + (Math.random() * 90 - 45), 20, 185), vy: 0, decoyed: false });
    }

    // move missiles
    const mvx = 85 + f.t * 2.2;
    for (let i = f.ms.length - 1; i >= 0; i--) {
      const m = f.ms[i];
      m.mx -= mvx * dt;
      if (!m.decoyed) m.vy = clamp((f.jy - m.my) * 1.4, -38, 38);
      m.my += m.vy * dt;
      if (m.mx < -12 || m.my < -10 || m.my > FH + 10) { f.ms.splice(i, 1); continue; }
      if (Math.abs(m.mx - f.jx - 10) < 11 && Math.abs(m.my - f.jy) < 7) {
        f.outcome = 'hit'; f.hitT = 0; f.boomX = f.jx + 10; f.boomY = f.jy;
        boomBeep();
        return;
      }
    }

    if (f.t >= f.dur) { f.outcome = 'win'; f.hitT = 0; okBeep(); }
  }

  function endFlight(success) {
    G.flight = null;
    G.mode = 'play';
    G.hasMission = false;
    G.sortieDay = G.day;
    passTime(90);
    // back on the flight line, beside your jet
    G.map = WORLD.get('exterior');
    applyBuilds(G.map);
    player.tx = 8; player.ty = 7;
    player.px = player.tx * T; player.py = player.ty * T;
    player.dir = 'up'; player.moving = false;
    G.fade = 0.8;
    if (success) {
      G.sorties++;
      addStats({ en: -30, sp: 18, hu: 15 });
      addMorale(1);
      const lines = ['You RTB with all your missiles gone and all your airframe intact.',
                     'The crew chief chalks another sortie on the jet. (+Spirit, -Energy)',
                     'Sorties flown: ' + G.sorties + '. Get some chow — you\'ve earned it.'];
      if (G.sorties % 20 === 0) {
        addStats({ sp: 20 });
        addMorale(5);
        lines.push('The squadron forms up outside OPS. RHINO reads the citation...',
                   '* AIR MEDAL AWARDED — ' + G.sorties + ' combat sorties! (' + medals() + ' total) (+ +Spirit, +Morale) *');
      }
      save();
      say(lines);
    } else {
      addStats({ hp: -25, sp: -10, en: -30 });
      addMorale(-2);
      say(['A SAM clips your jet — you limp home trailing smoke and land hot.',
           'The flight doc grounds you for the rest of the day. (-Health, -Spirit)',
           'Shake it off, get a new brief tomorrow.']);
    }
  }

  function renderFlight() {
    const f = G.flight;
    // sky bands
    const bands = ['#8fc4e8', '#a3cfec', '#bcd9ee', '#d8e2ea', '#e8ddc8'];
    bands.forEach((b, i) => {
      ctx.fillStyle = b;
      ctx.fillRect(0, i * 36, FW, 36);
    });
    // sun
    ctx.fillStyle = '#fff2c9';
    ctx.fillRect(268, 18, 18, 18);
    ctx.fillRect(272, 14, 10, 26);
    // dunes
    ctx.fillStyle = '#cfa75f';
    ctx.fillRect(0, 186, FW, 22);
    ctx.fillStyle = '#ba9450';
    for (let x = 0; x < FW; x += 40) {
      const off = ((f.t * 60 + x) % 80);
      ctx.fillRect(x - off / 2, 190, 26, 4);
    }

    if (f.outcome === 'hit') {
      // explosion
      const r = 4 + f.hitT * 26;
      ctx.fillStyle = '#ff8a3a';
      ctx.fillRect(f.boomX - r / 2, f.boomY - r / 2, r, r);
      ctx.fillStyle = '#ffd75e';
      ctx.fillRect(f.boomX - r / 4, f.boomY - r / 4, r / 2, r / 2);
    } else {
      SPR.drawJetSide(ctx, f.jx, f.jy - 4);
    }

    // missiles
    f.ms.forEach(m => {
      ctx.fillStyle = '#d8d8d8';
      ctx.fillRect(m.mx, m.my - 1, 9, 3);
      ctx.fillStyle = '#c23b2a';
      ctx.fillRect(m.mx - 1, m.my - 1, 2, 3);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(m.mx + 9, m.my, 4, 1);
    });

    // HUD
    ctx.fillStyle = 'rgba(20,16,10,0.75)';
    ctx.fillRect(6, 6, 150, 26);
    ctx.fillStyle = '#f4e9c8';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SURVIVE THE SAM RING', 10, 14);
    ctx.fillStyle = '#241d13';
    ctx.fillRect(10, 18, 100, 6);
    ctx.fillStyle = '#8fd48a';
    ctx.fillRect(10, 18, clamp(f.t / f.dur, 0, 1) * 100, 6);
    ctx.fillStyle = '#ffd75e';
    ctx.fillText('FLARES [SPACE]: ' + '*'.repeat(f.flares), 10, 30);

    if (f.outcome === 'win') {
      ctx.fillStyle = 'rgba(20,16,10,0.7)';
      ctx.fillRect(FW / 2 - 70, FH / 2 - 14, 140, 24);
      ctx.fillStyle = '#8fd48a';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MISSION COMPLETE — RTB', FW / 2, FH / 2);
    }
  }

  /* ---------------- smuggling run ---------------- */
  const GOODS = [
    ['cigs',   'Cigarettes (two cartons)'],
    ['beer',   'Beer (a case)'],
    ['liquor', 'Local whiskey (bottles)'],
    ['kebab',  'Goat kebabs (a full cooler)']
  ];
  const GATE_QS = [
    '"Purpose of your movement off base?"',
    '"Kind of late for a supply run, isn\'t it?"',
    '"What\'s under the tarp back there?"',
    '"You two smell like a barbecue. Explain."'
  ];

  function smuggleStart() {
    if (G.alarm) { say(['HARD: "Rockets are FALLING, ' + G.callsign + '. Bunker now, business later."']); return; }
    if (!G.smugIntro) {
      G.smugIntro = true;
      save();
      say([
        'HARD leans in and drops his voice.',
        '"Okay. So. The squadron runs on morale, and morale runs on things supply won\'t stock."',
        '"I know a guy off base. Locals sell everything — smokes, beer, the good whiskey, kebabs that\'ll change your life."',
        '"I \'borrowed\' a pickup. We drive out, load up, drive back, play it cool at the gate."',
        '"Every run lifts the whole squadron. Get SQUADRON MORALE maxed and we\'re legends."',
        '"Fair warning: hit a goat, lose the cargo. Get searched at the gate, lose everything."',
        '* SMUGGLING UNLOCKED — talk to HARD to roll out. *'
      ]);
      return;
    }
    if (G.runLock > G.day) {
      say(['HARD: "Too hot right now. SF is still doing \'random\' vehicle checks because of us."',
           '"Lay low. ' + (G.runLock - G.day) + ' more day(s)."']);
      return;
    }
    if (G.day < G.runNext) {
      say(['HARD: "My guy needs a day to restock. Patience, ' + G.callsign + '."',
           '"Next run: day ' + G.runNext + '."']);
      return;
    }
    if (G.stats.en < 25) {
      say(['HARD squints at you. "You look like a mishap report waiting to happen."',
           '"Eat something, take a nap. I need my driver sharp." (Need 25+ Energy)']);
      return;
    }
    ask('HARD: "Truck\'s fueled. My guy\'s expecting us." Roll out?', ['Roll out the gate', 'Not today'], i => {
      if (i === 0) startDrive(1);
    });
  }

  function startDrive(leg) {
    G.mode = 'drive';
    G.drive = { leg, t: 0, dur: 22, x: 160, hits: 0, obs: [], spawnT: 1, flash: 0, dist: 0 };
    beep(150, 0.4, 'sawtooth', 0.05);
  }

  function updateDrive(dt) {
    const d = G.drive;
    d.t += dt;
    d.flash = Math.max(0, d.flash - dt);
    const spd = (keys.ArrowUp || keys.w || keys.W) ? 175 : (keys.ArrowDown || keys.s || keys.S) ? 80 : 125;
    d.dist += spd * dt;
    if (keys.ArrowLeft || keys.a || keys.A) d.x -= 115 * dt;
    if (keys.ArrowRight || keys.d || keys.D) d.x += 115 * dt;
    d.x = clamp(d.x, 106, 214);

    // spawn obstacles
    d.spawnT -= dt * (spd / 125);
    if (d.spawnT <= 0) {
      d.spawnT = Math.max(0.5, 1.15 - d.t * 0.02);
      const r = Math.random();
      if (r < 0.4) {
        d.obs.push({ type: 'pot', x: 112 + Math.floor(Math.random() * 3) * 44 + (Math.random() * 12 - 6), y: -20, w: 14, h: 9 });
      } else if (r < 0.7) {
        const fromLeft = Math.random() < 0.5;
        d.obs.push({ type: 'goat', x: fromLeft ? 88 : 232, y: -14 - Math.random() * 30, cross: fromLeft ? 1 : -1, w: 12, h: 9 });
      } else {
        d.obs.push({ type: 'truck', x: 112 + (Math.random() < 0.5 ? 0 : 44), y: -46, w: 17, h: 29 });
      }
    }

    // move obstacles
    d.obs.forEach(o => {
      o.y += spd * dt * (o.type === 'truck' ? 1.85 : 1);
      if (o.type === 'goat') o.x += o.cross * 28 * dt;
    });
    d.obs = d.obs.filter(o => o.y < FH + 50 && o.x > 60 && o.x < 260);

    // collisions (player truck occupies x±8, y 148..172)
    for (let i = d.obs.length - 1; i >= 0; i--) {
      const o = d.obs[i];
      if (Math.abs(o.x - d.x) < (o.w + 15) / 2 && o.y + o.h / 2 > 148 && o.y - o.h / 2 < 172) {
        d.obs.splice(i, 1);
        d.hits++;
        d.flash = 0.35;
        boomBeep();
        if (d.leg === 2 && G.haul.length) {
          const lost = G.haul.splice(Math.floor(Math.random() * G.haul.length), 1)[0];
          toast('Cargo smashed: ' + ITEMS[lost].name + '!');
        }
        if (d.hits >= 3) { endDrive('breakdown'); return; }
      }
    }

    if (d.t >= d.dur) endDrive('done');
  }

  function endDrive(result) {
    const leg = G.drive.leg;
    G.drive = null;
    G.mode = 'play';
    if (result === 'breakdown') {
      G.haul = [];
      G.runNext = G.day + 2;
      addStats({ en: -25, sp: -5 });
      passTime(180);
      say(['The truck shudders, clanks, and dies ' + (leg === 1 ? 'halfway to the meet' : 'halfway home') + '.',
           'You and HARD push it three miles through the desert. In silence.',
           '"We speak of this to no one," HARD finally says. (-Energy, -Spirit)']);
      return;
    }
    if (leg === 1) market();
    else gateArrival();
  }

  function market() {
    passTime(30);
    G.scene = 'market';
    say(['The "market" is a tarp, a truck, and the best-smelling grill in the country.',
         'HARD\'s guy greets him like a brother. Negotiations are loud, fast, and mostly hand gestures.',
         '"Trunk fits two loads," HARD says. "Pick."'], () => {
      pickGood(1, () => pickGood(2, () => {
        say(['You wedge the goods under a tarp and cover it with the world\'s most innocent-looking tow strap.',
             'HARD: "Easy part\'s done. Drive casual."'], () => { G.scene = null; startDrive(2); });
      }));
    });
  }

  function pickGood(n, cb) {
    ask('Load #' + n + ' of 2 — what are we buying?', GOODS.map(g => g[1]), i => {
      G.haul.push(GOODS[i < 0 ? 0 : i][0]);
      cb();
    });
  }

  function gateArrival() {
    passTime(30);
    G.scene = 'gate';
    if (!G.haul.length) {
      say(['You roll up to the gate with an empty, dented truck.',
           'The guard looks at the fresh goat-shaped dent and decides he doesn\'t want to know.',
           'HARD stares out the window the whole way back. Nothing gained, nothing lost.'], () => {
        G.scene = null;
        G.runNext = G.day + 2;
        save();
      });
      return;
    }
    if (Math.random() < 0.3) {
      say(['At the gate: it\'s HARD\'s buddy from the card game. He leans in, sniffs the kebab air...',
           '...and waves you through with a fist bump. "Save me a plate."'], deliver);
      return;
    }
    say(['A bored gate guard raises a hand. Not the buddy. Mirrored sunglasses. Clipboard.',
         'HARD, through his teeth: "Play. It. Cool."',
         '(Hit SPACE when the needle is in the GREEN.)'], startGate);
  }

  function startGate() {
    G.mode = 'gate';
    G.gate = { round: 1, pos: 0, dir: 1, speed: 130, zone: 30, q: GATE_QS[Math.floor(Math.random() * GATE_QS.length)] };
  }

  function updateGate(dt) {
    const g = G.gate;
    g.pos += g.dir * g.speed * dt;
    if (g.pos >= 100) { g.pos = 100; g.dir = -1; }
    if (g.pos <= 0) { g.pos = 0; g.dir = 1; }
  }

  function judgeGate() {
    const g = G.gate;
    const inZone = Math.abs(g.pos - 50) <= g.zone / 2;
    if (!inZone) {
      G.gate = null;
      G.mode = 'play';
      gateCaught();
      return;
    }
    if (g.round >= 2) {
      G.gate = null;
      G.mode = 'play';
      okBeep();
      say(['The guard stares for one more eternity, then waves you through.',
           'HARD exhales a breath he\'s been holding since the market.'], deliver);
    } else {
      g.round = 2;
      g.speed = 200;
      g.zone = 22;
      g.q = GATE_QS[Math.floor(Math.random() * GATE_QS.length)];
      blip();
    }
  }

  function drawGateScene() {
    const t = performance.now() / 1000;
    // night sky + stars
    ctx.fillStyle = '#141830';
    ctx.fillRect(0, 0, FW, FH);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = i % 3 ? '#2c3358' : '#8892c4';
      ctx.fillRect((SPR.rnd(i + 7) * FW) | 0, (SPR.rnd(i + 55) * 90) | 0, 1, 1);
    }
    ctx.fillStyle = '#0e1122';
    ctx.fillRect(0, 150, FW, 58);
    // floodlight glow
    ctx.fillStyle = 'rgba(255,232,154,0.08)';
    ctx.fillRect(84, 40, 120, 110);
    // gate shack + arm
    ctx.fillStyle = '#3a3d40';
    ctx.fillRect(40, 96, 44, 54);
    ctx.fillStyle = '#2c2e30';
    ctx.fillRect(36, 90, 52, 8);
    ctx.fillStyle = '#ffd75e';
    ctx.fillRect(48, 108, 12, 10);
    ctx.fillStyle = '#c9cdd4';
    ctx.fillRect(84, 118, 150, 5);
    ctx.fillStyle = '#c23b2a';
    for (let i = 0; i < 5; i++) ctx.fillRect(84 + i * 30, 118, 15, 5);
    // hescos flanking the road
    ctx.fillStyle = '#8f7c4c';
    ctx.fillRect(0, 128, 36, 26);
    ctx.fillRect(284, 128, 36, 26);
    ctx.fillStyle = '#b8a26b';
    ctx.fillRect(0, 128, 36, 6);
    ctx.fillRect(284, 128, 36, 6);
    // your truck (side-on), headlights on
    ctx.fillStyle = 'rgba(255,232,154,0.15)';
    ctx.fillRect(150, 132, 60, 14);
    ctx.fillStyle = '#5a3226';
    ctx.fillRect(210, 128, 52, 20);
    ctx.fillRect(222, 118, 26, 12);
    ctx.fillStyle = '#7fb6d9';
    ctx.fillRect(226, 120, 12, 8);
    ctx.fillStyle = '#33291f';
    ctx.fillRect(216, 144, 10, 10);
    ctx.fillRect(246, 144, 10, 10);
    ctx.fillStyle = '#ffe89a';
    ctx.fillRect(208, 132, 3, 4);
    // gate guard walking a slow circuit by the truck
    const gx = 178 + Math.sin(t * 0.8) * 6;
    drawChar2x(ctx, charStand('officer', 'right'), gx, 106);
    // caption
    ctx.fillStyle = 'rgba(20,16,10,0.7)';
    ctx.fillRect(FW / 2 - 55, 4, 110, 14);
    ctx.fillStyle = '#ffe89a';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BASE GATE — 2330L', FW / 2, 13);
  }

  function drawMarketScene() {
    const t = performance.now() / 1000;
    // dusk sky
    const bands = ['#6a4a7a', '#a85a6a', '#d87a4a', '#e8955a'];
    bands.forEach((b, i) => { ctx.fillStyle = b; ctx.fillRect(0, i * 28, FW, 28); });
    // low sun
    ctx.fillStyle = '#ffcf7a';
    ctx.fillRect(252, 92, 22, 22);
    ctx.fillStyle = '#ffe89a';
    ctx.fillRect(257, 97, 12, 12);
    // distant dune line
    ctx.fillStyle = '#b8824a';
    ctx.fillRect(0, 106, FW, 16);
    // sand
    ctx.fillStyle = '#cfa75f';
    ctx.fillRect(0, 120, FW, 88);
    // the road you came in on
    ctx.fillStyle = '#5b6066';
    ctx.fillRect(0, 184, FW, 24);
    ctx.fillStyle = '#d9d9cf';
    for (let x = 8; x < FW; x += 40) ctx.fillRect(x, 194, 16, 3);
    // your pickup, parked (side view)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(18, 176, 70, 4);
    ctx.fillStyle = '#33291f';
    ctx.fillRect(28, 166, 12, 12);
    ctx.fillRect(64, 166, 12, 12);
    ctx.fillStyle = '#8a4a3a';
    ctx.fillRect(20, 150, 62, 20);
    ctx.fillRect(30, 138, 26, 14);
    ctx.fillStyle = '#7fb6d9';
    ctx.fillRect(34, 141, 18, 8);
    // stall: poles + striped canopy
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(150, 116, 4, 48);
    ctx.fillRect(238, 116, 4, 48);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#c23b2a' : '#e8e0c8';
      ctx.fillRect(144 + i * 17, 104, 17, 12);
    }
    // hanging kebabs under the canopy
    ctx.fillStyle = '#7a3a2a';
    for (let i = 0; i < 4; i++) ctx.fillRect(216 + i * 6, 116, 3, 9);
    // table + goods
    ctx.fillStyle = '#a8895a';
    ctx.fillRect(150, 150, 92, 8);
    ctx.fillStyle = '#7d6540';
    ctx.fillRect(154, 158, 6, 10);
    ctx.fillRect(232, 158, 6, 10);
    ctx.fillStyle = '#8a5a1a';
    ctx.fillRect(156, 140, 14, 10);    // whiskey crate
    ctx.fillStyle = '#c9a35a';
    ctx.fillRect(174, 142, 14, 8);     // beer case
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(192, 140, 12, 10);    // cigarette cartons
    ctx.fillStyle = '#d84a4a';
    ctx.fillRect(192, 140, 12, 4);
    // grill + drifting smoke
    ctx.fillStyle = '#33353a';
    ctx.fillRect(252, 144, 28, 12);
    ctx.fillRect(256, 156, 4, 12);
    ctx.fillRect(272, 156, 4, 12);
    ctx.fillStyle = '#e8862a';
    ctx.fillRect(255, 147, 22, 3);
    for (let i = 0; i < 4; i++) {
      const p = (t * 16 + i * 15) % 60;
      ctx.fillStyle = 'rgba(210,210,210,' + Math.max(0, 0.5 - p / 130) + ')';
      ctx.fillRect(262 + Math.sin((p + i * 9) / 7) * 5, 140 - p, 4, 4);
    }
    // the contact behind the table, you and HARD in front
    drawChar2x(ctx, charStand('chief', 'down'), 196, 102);
    drawChar2x(ctx, player.frames.right[0], 98, 126);
    drawChar2x(ctx, charStand('hard', 'right'), 126, 124);
    // a goat, supervising
    const gx = 40 + ((t * 9) % 190);
    SPR.drawGoat(ctx, gx, 126);
    // caption
    ctx.fillStyle = 'rgba(20,16,10,0.7)';
    ctx.fillRect(FW / 2 - 80, 4, 160, 14);
    ctx.fillStyle = '#ffe89a';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ROADSIDE MARKET — 12KM OFF BASE', FW / 2, 13);
  }

  function renderScene() {
    if (G.scene === 'market') drawMarketScene();
    else if (G.scene === 'gate') drawGateScene();
    else renderPlay();
  }

  function renderGate() {
    const g = G.gate;
    drawGateScene();
    // guard question
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4e9c8';
    ctx.font = '8px monospace';
    ctx.fillText('GATE GUARD ' + g.q, FW / 2, 34);
    ctx.fillStyle = '#9aa2c4';
    ctx.font = '7px monospace';
    ctx.fillText('ANSWER ' + g.round + '/2 — SPACE IN THE GREEN', FW / 2, 48);
    // keep-cool meter
    const bx = 60, bw = 200, by = 64, bh = 14;
    ctx.fillStyle = '#241d13';
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = '#7a3a2a';
    ctx.fillRect(bx, by, bw, bh);
    const zw = bw * g.zone / 100;
    ctx.fillStyle = '#2c9a68';
    ctx.fillRect(bx + bw / 2 - zw / 2, by, zw, bh);
    ctx.fillStyle = '#ffe89a';
    ctx.fillRect(bx + (g.pos / 100) * bw - 2, by - 4, 4, bh + 8);
  }

  function renderDrive() {
    const d = G.drive;
    // desert
    ctx.fillStyle = '#d7b271';
    ctx.fillRect(0, 0, FW, FH);
    // scrolling roadside rocks/scrub
    for (let i = 0; i < 9; i++) {
      const y = ((i * 66 + d.dist) % (FH + 40)) - 20;
      ctx.fillStyle = i % 2 ? '#c6a05e' : '#b8a26b';
      ctx.fillRect(30 + (i % 3) * 18, y, 10, 6);
      ctx.fillRect(244 + ((i + 1) % 3) * 16, y + 28, 12, 7);
      ctx.fillStyle = '#4f7a38';
      ctx.fillRect(70, ((i * 90 + d.dist * 0.9) % (FH + 40)) - 20, 4, 8);
    }
    // road
    ctx.fillStyle = '#5b6066';
    ctx.fillRect(100, 0, 120, FH);
    ctx.fillStyle = '#4f545a';
    ctx.fillRect(100, 0, 4, FH);
    ctx.fillRect(216, 0, 4, FH);
    // lane dashes
    ctx.fillStyle = '#d9d9cf';
    for (let i = 0; i < 8; i++) {
      const y = ((i * 40 + d.dist) % (FH + 40)) - 20;
      ctx.fillRect(139, y, 3, 14);
      ctx.fillRect(179, y, 3, 14);
    }
    // obstacles
    d.obs.forEach(o => {
      if (o.type === 'pot') {
        ctx.fillStyle = '#33353a';
        ctx.fillRect(o.x - 7, o.y - 4, 14, 9);
        ctx.fillStyle = '#26282c';
        ctx.fillRect(o.x - 5, o.y - 2, 10, 5);
      } else if (o.type === 'goat') {
        SPR.drawGoat(ctx, o.x - 6, o.y - 5);
      } else {
        SPR.drawJingleTruck(ctx, o.x - 9, o.y - 15);
      }
    });
    // player truck
    SPR.drawTruckTop(ctx, d.x - 8, 148);
    // collision flash
    if (d.flash > 0) {
      ctx.fillStyle = 'rgba(255,80,40,' + d.flash + ')';
      ctx.fillRect(0, 0, FW, FH);
    }
    // HUD
    ctx.fillStyle = 'rgba(20,16,10,0.75)';
    ctx.fillRect(6, 6, 160, 28);
    ctx.fillStyle = '#f4e9c8';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(d.leg === 1 ? 'OUTBOUND — DON\'T WRECK THE TRUCK' : 'RTB — CARGO ABOARD!', 10, 14);
    ctx.fillStyle = '#241d13';
    ctx.fillRect(10, 18, 100, 6);
    ctx.fillStyle = '#8fd48a';
    ctx.fillRect(10, 18, clamp(d.t / d.dur, 0, 1) * 100, 6);
    ctx.fillStyle = d.hits >= 2 ? '#ff6b5e' : '#ffd75e';
    ctx.fillText('DMG ' + d.hits + '/3' + (d.leg === 2 ? '   CARGO x' + G.haul.length : ''), 10, 32);
  }

  function deliver() {
    G.scene = null;   // back at the MWR for the hand-out
    G.runsDone++;
    G.runNext = G.day + 2;
    const got = G.haul.slice();
    G.haul = [];
    got.forEach(id => addItem(id, 2));
    addStats({ sp: 12 });
    addMorale(8);
    passTime(30);
    save();
    const names = got.map(id => ITEMS[id].name).join(', ');
    say(['Back at the MWR, HARD unloads the goods like a stage magician doing a reveal.',
         'The squadron descends. Someone fires up the grill. Someone starts a toast.',
         '"THIS is why we win wars," HARD announces, holding a kebab.',
         '* Delivered: ' + names + ' — you keep a share (x2 each). (+Spirit, SQUADRON MORALE +8) *']);
  }

  function gateCaught() {
    G.haul = [];
    G.runLock = G.day + 3;
    G.runNext = G.day + 3;
    addStats({ sp: -15 });
    addMorale(-5);
    passTime(60);
    save();
    noBeep();
    say(['"Step out of the vehicle, please."',
         'SF unpacks the truck with theatrical slowness, holding each item up like evidence. Because it is.',
         'Everything: confiscated. The First Sergeant gives a speech that could strip paint.',
         'HARD is "laying low" for 3 days. The squadron eats DFAC eggs. Again. (- -Spirit, -Morale)'],
      () => { G.scene = null; });
  }

  /* ---------------- ambient life & light ---------------- */
  function drawAmbient(m, camX, camY, offX, offY) {
    if (m.key !== 'exterior') return;
    const t = performance.now() / 1000;
    // palm fronds swaying
    WORLD.TREES.forEach(([tx, ty], i) => {
      const bx = tx * T - camX + offX, by = ty * T - camY + offY;
      if (bx < -T || bx > FW || by < -T || by > FH) return;
      const s = Math.round(Math.sin(t * 1.4 + i * 1.7));
      ctx.fillStyle = '#659448';
      ctx.fillRect(bx + 2 + s, by + 4, 3, 1);
      ctx.fillRect(bx + 11 + s, by + 4, 3, 1);
      ctx.fillStyle = '#7fae5a';
      ctx.fillRect(bx + 6 + s, by + 2, 4, 1);
    });
    // midday heat shimmer over the flight line
    const hr = G.timeMin / 60;
    if (hr >= 9 && hr <= 17) {
      for (let i = 0; i < 7; i++) {
        const wx = 60 + i * 115, wy = 30 + (i * 37) % 110;
        const sx = wx - camX + offX, sy = wy - camY + offY;
        if (sx < 0 || sx > FW - 2 || sy < 0 || sy > FH - 8) continue;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.05 + 0.04 * Math.sin(t * 6 + i * 2.1)) + ')';
        ctx.fillRect(sx + Math.sin(t * 3 + i) * 2, sy + Math.sin(t * 4 + i) * 2, 2, 7);
      }
    }
    // drifting dust
    for (let i = 0; i < 3; i++) {
      const wx = (t * 9 + i * 331) % (m.w * T);
      const wy = 170 + 60 * Math.sin(t * 0.25 + i * 2.1);
      const sx = wx - camX + offX, sy = wy - camY + offY;
      if (sx < 0 || sx > FW - 8 || sy < 0 || sy > FH - 4) continue;
      ctx.fillStyle = 'rgba(235,215,165,0.3)';
      ctx.fillRect(sx, sy, 3, 1);
      ctx.fillRect(sx + 4, sy + 1, 2, 1);
    }
  }

  function drawGlows(m, camX, camY, offX, offY) {
    if (m.key !== 'exterior') return;
    const t = performance.now() / 1000;
    const na = nightAlpha();
    // blinking jet beacons
    WORLD.JETS.forEach((j, i) => {
      if (Math.floor(t * 1.3 + i * 0.6) % 2 !== 0) return;
      const bx = j.x * T + 30 - camX + offX, by = j.y * T + 1 - camY + offY;
      if (bx < 0 || bx > FW || by < 0 || by > FH) return;
      ctx.fillStyle = '#ff4a3a';
      ctx.fillRect(bx, by, 2, 2);
      if (na > 0.2) {
        ctx.fillStyle = 'rgba(255,80,60,0.22)';
        ctx.fillRect(bx - 2, by - 2, 6, 6);
      }
    });
    // fire pit crackle (flame flicker always, glow at night)
    if (G.built.firepit) {
      const fx = 37 * T - camX + offX, fy = 27 * T - camY + offY;
      if (fx > -32 && fx < FW + 16 && fy > -32 && fy < FH + 16) {
        const f = 0.5 + 0.5 * Math.sin(t * 9);
        ctx.fillStyle = f > 0.5 ? '#ffd75e' : '#ff9a3a';
        ctx.fillRect(fx + 6 + (f > 0.5 ? 1 : 0), fy + 3, 3, 4);
        if (na > 0.2) {
          ctx.fillStyle = 'rgba(255,150,50,' + (0.18 + 0.12 * f) + ')';
          ctx.fillRect(fx - 8, fy - 8, 32, 32);
        }
      }
    }
    // warm window light after dark — lit glass + additive halo
    if (na > 0.25) {
      WORLD.BUILDINGS.forEach(b => {
        const door = WORLD.doorOf(b);
        const wy = (b.y + b.h - 1) * T - camY + offY;
        if (wy < -T || wy > FH) return;
        [door.x - 2, door.x + 2].forEach(wx => {
          const sx = wx * T - camX + offX;
          if (sx < -T || sx > FW) return;
          ctx.fillStyle = 'rgba(255,214,120,' + (0.8 * na) + ')';
          ctx.fillRect(sx + 3, wy + 4, 10, 7);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = 'rgba(255,170,70,0.12)';
          ctx.fillRect(sx - 2, wy + 1, 20, 14);
          ctx.globalCompositeOperation = 'source-over';
        });
      });
    }
  }

  /* ---------------- rendering ---------------- */
  function nightAlpha() {
    const h = G.timeMin / 60;
    if (h >= 6 && h < 17) return 0;
    if (h >= 17 && h < 21) return ((h - 17) / 4) * 0.55;
    return 0.55;
  }

  function renderPlay() {
    const m = G.map;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, FW, FH);

    const mw = m.w * T, mh = m.h * T;
    const offX = Math.max(0, (FW - mw) >> 1);
    const offY = Math.max(0, (FH - mh) >> 1);
    let camX = clamp(player.px - FW / 2 + T / 2, 0, Math.max(0, mw - FW));
    let camY = clamp(player.py - FH / 2 + T / 2, 0, Math.max(0, mh - FH));
    lastCam = { camX, camY, offX, offY };            // for click-to-tile mapping
    if (G.shake > 0) {                               // impact shake
      camX += (Math.random() * 4 - 2) | 0;
      camY += (Math.random() * 3 - 1.5) | 0;
    }

    ctx.drawImage(m.canvas, camX, camY, Math.min(FW, mw), Math.min(FH, mh),
                  offX, offY, Math.min(FW, mw), Math.min(FH, mh));

    // field pickups
    if (m.key === 'exterior') {
      G.groundItems.forEach(g => {
        ctx.drawImage(SPR.item(g.id), g.x * T + 2 - camX + offX, g.y * T + 2 - camY + offY, 12, 12);
      });
    }

    // crafted objects placed on this map
    G.placed.forEach(p => {
      if (p.map === m.key) {
        ctx.drawImage(SPR.furn(PLACEABLES[p.id].furn), p.x * T - camX + offX, p.y * T - camY + offY);
      }
    });

    // ambient life (palm sway, heat shimmer, dust)
    drawAmbient(m, camX, camY, offX, offY);

    // entities sorted by y — 16x24 sprites, feet on the tile, soft drop shadow
    const shadow = (sx, sy) => {
      ctx.fillStyle = 'rgba(20,14,8,0.28)';
      ctx.fillRect(sx + 3, sy + 13, 10, 3);
      ctx.fillRect(sx + 4, sy + 12, 8, 5);
    };
    const ents = m.npcs.map(n => ({
      py: n.y * T,
      draw: () => {
        const sx = n.x * T - camX + offX, sy = n.y * T - camY + offY;
        shadow(sx, sy);
        const nf = charStand(n.pal, n.dir);
        ctx.drawImage(nf, sx - ((nf.width - 16) >> 1), sy - (nf.height - 16));
      }
    }));
    // coffee stand customers (exterior only)
    if (m.key === 'exterior') customers.forEach(c => ents.push({
      py: c.py,
      draw: () => {
        const sx = Math.round(c.px) - camX + offX, sy = Math.round(c.py) - camY + offY;
        shadow(sx, sy);
        const fr = SPR.charFrames(c.pal);
        const f = fr[c.dir][c.state === 'buy' ? 0 : (Math.floor(c.animT / 0.15) % 4)];
        ctx.drawImage(f, sx, sy - (f.height - 16));
        if (c.state === 'buy' && c.t > 0.25) {       // little "coffee, please" bubble
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(sx + 2, sy - 21, 12, 11);
          ctx.fillRect(sx + 6, sy - 10, 2, 2);
          ctx.drawImage(SPR.item('coffee'), sx + 4, sy - 20, 9, 9);
        }
      }
    }));
    const pframe = player.frames[player.dir][player.moving ? (Math.floor(player.animT / 0.13) % 4) : 0];
    ents.push({
      py: player.py,
      draw: () => {
        const sx = Math.round(player.px) - camX + offX, sy = Math.round(player.py) - camY + offY;
        shadow(sx, sy);
        ctx.drawImage(pframe, sx, sy - (pframe.height - 16));
      }
    });
    ents.sort((a, b) => a.py - b.py).forEach(e => e.draw());

    // hammer swing (drawn over the player, toward the node)
    if (G.swing && ASSETS.hammer) {
      const f = ASSETS.hammer[G.swing.t < 0.16 ? 0 : 1];
      const psx = Math.round(player.px) - camX + offX, psy = Math.round(player.py) - camY + offY;
      const off = { up: [1, -16], down: [1, 2], left: [-11, -8], right: [11, -8] }[player.dir];
      if (player.dir === 'left') {
        ctx.save();
        ctx.translate(psx + off[0] + 16, psy + off[1]);
        ctx.scale(-1, 1);
        ctx.drawImage(f, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(f, psx + off[0], psy + off[1]);
      }
    }
    // impact particles (wood chips / sparks)
    swingFx.forEach(p => {
      ctx.fillStyle = p.c;
      ctx.fillRect(((p.x - camX + offX) | 0), ((p.y - camY + offY) | 0), 2, 2);
    });

    // night tint (exterior only)
    if (!m.isInterior) {
      const a = nightAlpha();
      if (a > 0) {
        ctx.fillStyle = 'rgba(12,16,44,' + a + ')';
        ctx.fillRect(0, 0, FW, FH);
      }
    }

    // lights that punch through the dark (windows, beacons, fire)
    drawGlows(m, camX, camY, offX, offY);

    // Alarm Red — pulsing warning
    if (G.alarm) {
      const pulse = 0.1 + 0.1 * Math.abs(Math.sin(performance.now() / 220));
      ctx.fillStyle = 'rgba(200,30,20,' + pulse + ')';
      ctx.fillRect(0, 0, FW, FH);
      ctx.fillStyle = Math.floor(performance.now() / 400) % 2 ? '#ff5e4a' : '#ffd75e';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('*** ALARM RED — GET TO THE BUNKER ***', FW / 2, 14);
    }

    // fade flash on map transitions
    if (G.fade > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + G.fade + ')';
      ctx.fillRect(0, 0, FW, FH);
    }
  }

  function renderTitle() {
    ctx.fillStyle = '#101426';
    ctx.fillRect(0, 0, FW, FH);
    // stars
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 3 ? '#3a4468' : '#8892c4';
      ctx.fillRect((SPR.rnd(i) * FW) | 0, (SPR.rnd(i + 99) * 120) | 0, 1, 1);
    }
    // dunes
    ctx.fillStyle = '#2a2438';
    ctx.fillRect(0, 150, FW, 58);
    ctx.fillStyle = '#3a3048';
    ctx.fillRect(0, 162, FW, 46);
    // jet
    SPR.drawJet(ctx, FW / 2 - 32, 96);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('THE SAB', FW / 2, 46);
    ctx.fillStyle = '#d8c9a3';
    ctx.font = '8px monospace';
    ctx.fillText('A DEPLOYED FIGHTER PILOT RPG', FW / 2, 62);

    ctx.fillStyle = '#9aa2c4';
    ctx.font = '7px monospace';
    ctx.fillText('ARROWS — MOVE   E — INTERACT   1-9 — SELECT   F — USE ITEM', FW / 2, 78);

    G.titleBlink += 0.02;
    if (Math.floor(G.titleBlink * 2) % 2 === 0) {
      ctx.fillStyle = '#f4e9c8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('PRESS ENTER', FW / 2, 196);
    }
  }

  function renderRoster() {
    ctx.fillStyle = '#101426';
    ctx.fillRect(0, 0, FW, FH);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = i % 3 ? '#2c3358' : '#8892c4';
      ctx.fillRect((SPR.rnd(i + 3) * FW) | 0, (SPR.rnd(i + 40) * 100) | 0, 1, 1);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('PILOT ROSTER', FW / 2, 24);
    ctx.fillStyle = '#9aa2c4';
    ctx.font = '7px monospace';
    ctx.fillText('WHO IS DEPLOYING TODAY?', FW / 2, 37);

    const x0 = 34, w = FW - 68, rowH = 19, y0 = 48;
    const total = rosterList.length + 1;
    for (let i = 0; i < total; i++) {
      const y = y0 + i * rowH;
      const sel = i === rosterSel;
      const isNew = i === rosterList.length;
      ctx.fillStyle = sel ? 'rgba(255,215,94,0.16)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(x0, y, w, rowH - 4);
      if (sel) {
        ctx.strokeStyle = '#ffd75e';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, y + 0.5, w - 1, rowH - 5);
      }
      if (isNew) {
        ctx.textAlign = 'center';
        ctx.fillStyle = sel ? '#8fd48a' : '#7fae6a';
        ctx.font = '9px monospace';
        ctx.fillText('+ NEW PILOT', FW / 2, y + 11);
      } else {
        const p = rosterList[i];
        ctx.textAlign = 'left';
        ctx.fillStyle = sel ? '#f4e9c8' : '#cfd6f4';
        ctx.font = '9px monospace';
        ctx.fillText(p.callsign, x0 + 8, y + 11);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#7fd4a8';
        ctx.font = '7px monospace';
        ctx.fillText((p.role === 1 ? 'WSO' : 'PILOT') + '  —  DAY ' + p.day, x0 + w - 8, y + 11);
      }
    }

    ctx.textAlign = 'center';
    ctx.font = '7px monospace';
    if (rosterArm >= 0 && rosterArm < rosterList.length) {
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2
        ? '#ff5e4a' : '#ffd75e';
      ctx.fillText('DELETE ' + rosterList[rosterArm].callsign + '? PRESS X AGAIN TO CONFIRM', FW / 2, FH - 10);
    } else {
      ctx.fillStyle = '#5a6288';
      ctx.fillText('↑↓ SELECT    ENTER CONFIRM    X DELETE    ESC BACK', FW / 2, FH - 10);
    }
  }

  function renderEnd(victory) {
    ctx.fillStyle = victory ? '#16261a' : '#261314';
    ctx.fillRect(0, 0, FW, FH);
    ctx.textAlign = 'center';
    ctx.fillStyle = victory ? '#8fd48a' : '#ff6b5e';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(victory ? 'DEPLOYMENT COMPLETE!' : 'MEDEVAC', FW / 2, 70);
    ctx.fillStyle = '#f4e9c8';
    ctx.font = '8px monospace';
    if (victory) {
      ctx.fillText('You survived ' + G.deployEnd + ' days in the sab' +
        (G.extensions ? ' (' + G.extensions + ' extension' + (G.extensions > 1 ? 's' : '') + '!)' : '.'), FW / 2, 90);
      ctx.fillText('Sorties flown: ' + G.sorties + '   Air Medals: ' + medals(), FW / 2, 104);
      ctx.fillText('MWR projects built: ' + builtCount() + '/' + PROJECTS.length +
        '   Smuggling runs: ' + G.runsDone, FW / 2, 118);
      ctx.fillText('Squadron morale: ' + Math.round(G.morale) + '/100' +
        (G.crackdowns ? '   (survived ' + G.crackdowns + ' fun-police crackdown' + (G.crackdowns > 1 ? 's' : '') + ')' : ''), FW / 2, 132);
      ctx.fillText('Time to go home, ' + G.callsign + '. Well done.', FW / 2, 146);
    } else {
      ctx.fillText('You ran yourself into the ground on day ' + G.day + '.', FW / 2, 96);
      ctx.fillText('Sorties flown: ' + G.sorties, FW / 2, 110);
      ctx.fillText('Eat. Sleep. Hit the gym. Call home.', FW / 2, 124);
    }
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      ctx.fillStyle = '#ffd75e';
      ctx.fillText('PRESS ENTER', FW / 2, 168);
    }
  }

  /* ---------------- HUD ---------------- */
  function updateHUD() {
    const inGame = ['play', 'dialog', 'choice', 'menu', 'chest'].includes(G.mode);
    ui.hud.style.display = inGame ? 'block' : 'none';
    ui.clockbox.style.display = inGame ? 'block' : 'none';
    el('hotbar').style.display = inGame ? 'flex' : 'none';
    if (!inGame) { ui.prompt.style.display = 'none'; el('toast').style.display = 'none'; return; }

    ui.hp.style.width = G.stats.hp + '%';
    ui.sp.style.width = G.stats.sp + '%';
    ui.en.style.width = G.stats.en + '%';
    el('bar-mo').style.width = G.morale + '%';
    ui.day.textContent = 'DAY ' + G.day + '/' + G.deployEnd;
    ui.time.textContent = clockStr();
    ui.sorties.textContent = 'SORTIES: ' + G.sorties +
      (medals() ? ' AM x' + medals() : '') + (G.hasMission ? ' [BRIEFED]' : '');
    if (G.alarm) el('quest').textContent = 'ALARM RED — GET TO THE BUNKER!';
    else if (G.duty && !G.duty.done) el('quest').textContent = 'DUTY: ' + DUTY_NAMES[G.duty.type];
    else if (G.questStage === 0) el('quest').textContent = 'MEET THE WSO AT THE MWR';
    else if (G.questStage === 1) el('quest').textContent = 'COUCHES: ' + costText(projByKey('couch').cost);
    else if (allBuilt()) el('quest').textContent = 'MWR COMPLETE!';
    else el('quest').textContent = 'MWR: ' + builtCount() + '/' + PROJECTS.length + ' BUILT';

    const warns = [];
    if (G.stats.hu > 70) warns.push('HUNGRY');
    if (G.stats.en < 20) warns.push('EXHAUSTED');
    if (G.stats.sp < 20) warns.push('LOW MORALE');
    ui.warn.textContent = warns.join('  ');

    // interact prompt
    if (G.mode === 'play') {
      const [fx, fy] = facingTile();
      const npc = G.map.npcs.find(n => n.x === fx && n.y === fy);
      const h = G.map.hot[fx + ',' + fy];
      let txt = null;
      if (G.carrying) txt = '[E] Place ' + ITEMS[G.carrying.id].name;
      else if (npc) txt = '[E] Talk to ' + npc.name;
      else if (placedAt(G.map.key, fx, fy)) txt = '[E] ' + ITEMS[placedAt(G.map.key, fx, fy).id].name;
      else if (h && h.action && h.label) txt = '[E] ' + h.label;
      else if (h && h.enter) {
        const b = WORLD.BUILDINGS.find(b => b.key === h.enter);
        txt = '[E] Enter ' + b.name;
      }
      ui.prompt.textContent = txt || '';
      ui.prompt.style.display = txt ? 'block' : 'none';
    } else {
      ui.prompt.style.display = 'none';
    }
  }

  /* ---------------- save / load ---------------- */
  /* ---------------- save profiles (multiple pilots per browser) ---------------- */
  const PROFILES_KEY = 'sab_profiles';
  const saveKeyFor = id => 'sab_save_' + id;

  function loadProfiles() {
    try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || []; } catch (e) { return []; }
  }
  function writeProfiles(list) {
    try { localStorage.setItem(PROFILES_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function upsertProfileMeta() {
    if (!G.profileId) return;
    const list = loadProfiles();
    const meta = { id: G.profileId, callsign: G.callsign, day: G.day, role: G.cfg.role, updated: Date.now() };
    const i = list.findIndex(p => p.id === G.profileId);
    if (i >= 0) list[i] = meta; else list.push(meta);
    writeProfiles(list);
  }
  function deleteProfile(id) {
    try { localStorage.removeItem(saveKeyFor(id)); } catch (e) {}
    writeProfiles(loadProfiles().filter(p => p.id !== id));
  }
  function newProfileId() {
    return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  }
  // one-time import of the old single-save format
  function migrateOldSave() {
    try {
      const old = localStorage.getItem(SAVE_KEY);
      if (old && !loadProfiles().length) {
        const s = JSON.parse(old);
        const id = newProfileId();
        localStorage.setItem(saveKeyFor(id), old);
        writeProfiles([{ id, callsign: (s && s.callsign) || 'VIPER', day: (s && s.day) || 1,
                         role: (s && s.cfg && s.cfg.role) || 0, updated: Date.now() }]);
      }
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
  }

  function save() {
    if (!G.profileId) return;
    try {
      localStorage.setItem(saveKeyFor(G.profileId), JSON.stringify({
        stats: G.stats, day: G.day, timeMin: G.timeMin, sorties: G.sorties,
        hasMission: G.hasMission, mapKey: G.map.key, tx: player.tx, ty: player.ty,
        callsign: G.callsign, cfg: G.cfg,
        bag: G.bag, groundItems: G.groundItems,
        pillWeek: G.pillWeek, goLeft: G.goLeft, nogoLeft: G.nogoLeft,
        alcDay: G.alcDay, alcToday: G.alcToday,
        lockerDay: G.lockerDay, mreDay: G.mreDay, cigDay: G.cigDay,
        deployEnd: G.deployEnd, extensions: G.extensions,
        built: G.built, questStage: G.questStage, gather: G.gather, junk: G.junk,
        callDay: G.callDay, movieDay: G.movieDay,
        duty: G.duty, sortieDay: G.sortieDay, photoDay: G.photoDay,
        morale: G.morale, moraleMaxed: G.moraleMaxed, crackdowns: G.crackdowns,
        croc: G.croc,
        runNext: G.runNext, runLock: G.runLock, runsDone: G.runsDone, smugIntro: G.smugIntro,
        attackAt: G.attackAt,
        placed: G.placed, carrying: G.carrying
      }));
      upsertProfileMeta();
    } catch (e) {}
  }
  // deployment over (complete or KIA): retire this pilot from the roster
  function saveClear() {
    if (G.profileId) deleteProfile(G.profileId);
    G.profileId = null;
  }

  function loadGame(id) {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(saveKeyFor(id))); } catch (e) {}
    G.profileId = id;
    if (!s) { newGame(); return; }
    Object.assign(G.stats, s.stats);
    G.day = s.day; G.timeMin = s.timeMin; G.sorties = s.sorties;
    G.hasMission = s.hasMission;
    if (s.callsign) G.callsign = s.callsign;
    if (s.cfg) Object.assign(G.cfg, s.cfg);
    G.bag = new Array(12).fill(null);
    if (s.bag) s.bag.forEach((slot, i) => { if (slot && i < 12) G.bag[i] = slot; });
    else if (s.inv) {                          // migrate pre-inventory saves
      if (s.inv.go) addItem('gopill', s.inv.go);
      if (s.inv.nogo) addItem('nogopill', s.inv.nogo);
    }
    if (!G.bag.some(sl => sl && sl.id === 'hammer')) addItem('hammer', 1);   // tool migration
    G.bagSel = 0;
    G.placed = Array.isArray(s.placed) ? s.placed : [];
    G.carrying = s.carrying || null;
    G.groundItems = Array.isArray(s.groundItems) ? s.groundItems : [];
    if (!G.groundItems.length) spawnGroundItems();
    G.pillWeek = (s.pillWeek !== undefined) ? s.pillWeek : -1;
    G.goLeft = (s.goLeft !== undefined) ? s.goLeft : 5;
    G.nogoLeft = (s.nogoLeft !== undefined) ? s.nogoLeft : 5;
    G.alcDay = s.alcDay || 0; G.alcToday = s.alcToday || 0;
    G.lockerDay = s.lockerDay || 0; G.mreDay = s.mreDay || 0; G.cigDay = s.cigDay || 0;
    G.deployEnd = s.deployEnd || DEPLOY_DAYS; G.extensions = s.extensions || 0;
    G.built = s.built || {}; G.questStage = s.questStage || 0; G.gather = s.gather || {};
    G.junk = s.junk || { day: 0, nodes: {} };
    G.callDay = s.callDay || 0; G.movieDay = s.movieDay || 0;
    G.duty = s.duty || null; G.sortieDay = s.sortieDay || 0;
    G.photoDay = s.photoDay || 0;
    G.morale = (s.morale !== undefined) ? s.morale : 40;
    G.moraleMaxed = !!s.moraleMaxed; G.moralePop = false; G.crackdowns = s.crackdowns || 0;
    G.croc = s.croc || { fund: 0, stockDay: 0, intro: false, done: false };
    G.runNext = s.runNext || 0; G.runLock = s.runLock || 0;
    G.runsDone = s.runsDone || 0; G.smugIntro = !!s.smugIntro;
    G.haul = []; G.drive = null; G.gate = null; G.scene = null;
    G.attackAt = (s.attackAt !== undefined) ? s.attackAt : -1;
    G.alarm = null;
    updateHotbar();
    refreshPlayerFrames();
    G.map = WORLD.get(s.mapKey);
    applyBuilds(G.map);
    applyBuilds(WORLD.get('exterior'));
    player.tx = s.tx; player.ty = s.ty;
    player.px = s.tx * T; player.py = s.ty * T;
    player.dir = 'down'; player.moving = false;
    G.mode = 'play';
    okBeep();
    say(['Welcome back, ' + G.callsign + '. Day ' + G.day + ' in the sab.']);
  }

  function newGame() {
    G.stats.hp = 100; G.stats.sp = 80; G.stats.en = 90; G.stats.hu = 20;
    G.day = 1; G.timeMin = 6 * 60; G.sorties = 0; G.hasMission = false;
    G.bag = new Array(12).fill(null); G.bagSel = 0;
    addItem('hammer', 1);
    G.pillWeek = -1; G.goLeft = 5; G.nogoLeft = 5;
    G.alcDay = 0; G.alcToday = 0; G.lockerDay = 0; G.mreDay = 0; G.cigDay = 0;
    G.deployEnd = DEPLOY_DAYS; G.extensions = 0;
    G.built = {}; G.questStage = 0; G.gather = {}; G.junk = { day: 0, nodes: {} };
    G.callDay = 0; G.movieDay = 0;
    G.duty = null; G.sortieDay = 0; G.photoDay = 0;
    G.morale = 40; G.moraleMaxed = false; G.moralePop = false; G.crackdowns = 0;
    G.croc = { fund: 0, stockDay: 0, intro: false, done: false };
    G.runNext = 0; G.runLock = 0; G.runsDone = 0; G.smugIntro = false;
    G.haul = []; G.drive = null; G.gate = null; G.scene = null;
    G.attackAt = -1; G.alarm = null;
    G.placed = []; G.carrying = null;
    if (!G.profileId) G.profileId = newProfileId();
    addItem('water', 1);
    addItem('seeds', 1);
    spawnGroundItems();
    updateHotbar();
    G.map = WORLD.get('exterior');
    player.tx = 9; player.ty = 19;
    player.px = player.tx * T; player.py = player.ty * T;
    player.dir = 'down'; player.moving = false;
    save();   // register the new pilot in the roster right away
    okBeep();
    say([
      'Day 1. Camp Sidewinder, somewhere in the sab.',
      'You\'re "' + G.callsign + '" — a ' + roleName() + ' on a ' + DEPLOY_DAYS + '-day rotation.',
      'Fly your sorties, but keep yourself together: HEALTH, SPIRIT, and ENERGY all matter.',
      'Eat at the DFAC. Lift at the GYM. Unwind at the MWR shack.',
      'Your RLB is in the housing row on the east side of base — your own bed, your own four walls.',
      'First stop: the OPS building for your mission brief. It\'s the big one right in front of you.',
      'Keep an eye on the ground — useful stuff turns up around base every day.',
      'Oh — and a WSO named HARD has been asking for you at the MWR shack. He has... plans.',
      '(ARROWS to move — E to interact — 1-9/0 select item — F to use it)'
    ]);
  }

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (G.fade > 0) G.fade = Math.max(0, G.fade - dt * 2.5);

    switch (G.mode) {
      case 'play':
        updatePlay(dt);
        renderPlay();
        break;
      case 'dialog': {
        if (dchar < dline.length) {
          dchar += dt * 55;
          ui.dtext.textContent = dline.slice(0, dchar | 0);
          if (dchar >= dline.length) { ui.dtext.textContent = dline; ui.dmore.style.display = 'block'; }
        }
        renderScene();
        break;
      }
      case 'choice':
        renderScene();
        break;
      case 'flight':
        updateFlight(dt);
        // endFlight may have closed the minigame this same frame
        if (G.mode === 'flight' && G.flight) renderFlight();
        else renderPlay();
        break;
      case 'drive':
        updateDrive(dt);
        if (G.mode === 'drive' && G.drive) renderDrive();
        else renderPlay();
        break;
      case 'gate':
        updateGate(dt);
        if (G.mode === 'gate' && G.gate) renderGate();
        else renderPlay();
        break;
      case 'title':
      case 'create':
        renderTitle();
        break;
      case 'roster':
        renderRoster();
        break;
      case 'menu':
      case 'chest':
        renderPlay();     // world stays visible (and paused) behind the panel
        break;
      case 'gameover':
        renderEnd(false);
        break;
      case 'victory':
        renderEnd(true);
        break;
    }

    updateHUD();
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(frame, 0, 0, FW, FH, 0, 0, FW * SCALE, FH * SCALE);
    requestAnimationFrame(loop);
  }

  migrateOldSave();
  requestAnimationFrame(loop);

  // debug/testing hook
  window.SANDBOX_DEBUG = {
    G, player, ACTIONS, loop,
    say, ask, enterMap, startFlight, updateFlight, endFlight, doSleep,
    openCreator, deploy, cycleOpt, updateCreator,
    ITEMS, addItem, useSelected, spawnGroundItems, tryPickup, updateHotbar,
    PROJECTS, countItem, removeItem, completeBuild, applyBuilds, builtCount,
    addMorale, smuggleStart, startDrive, updateDrive, endDrive, market,
    gateArrival, startGate, updateGate, judgeGate, deliver, gateCaught, rollAttack,
    drawMarketScene, drawGateScene, renderScene, frame,
    openRoster, rosterKey, loadProfiles, loadGame, newGame, saveClear, updatePlay,
    openMenu, closeMenu, menuKey, craftSel, RECIPES, PLACEABLES, craftList,
    placeFromBag, placedMenu, placedAt, canPlaceAt, addToContainer,
    theStand, customers, spawnCustomer, updateCustomers, custPath, stockStand,
    setCustT(v) { custT = v; },
    openChest, closeChest, chestKey, chestTransfer,
    teleport(mapKey, tx, ty) {
      G.map = WORLD.get(mapKey);
      player.tx = tx; player.ty = ty;
      player.px = tx * T; player.py = ty * T;
      player.moving = false;
    }
  };
})();
