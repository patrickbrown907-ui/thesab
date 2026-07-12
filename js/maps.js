'use strict';
/* ============================================================
   WORLD — map data + prerendered map canvases
   ============================================================ */
const WORLD = (() => {
  const T = SPR.T;

  const BUILDINGS = [
    { key: 'ops',     name: 'OPS',     x: 4,  y: 12, w: 10, h: 6 },
    { key: 'clinic',  name: 'CLINIC',  x: 16, y: 12, w: 6,  h: 5 },
    { key: 'dfac',    name: 'DFAC',    x: 30, y: 12, w: 10, h: 6 },
    { key: 'gym',     name: 'GYM',     x: 6,  y: 21, w: 8,  h: 5 },
    { key: 'bath',    name: 'LATRINE', x: 16, y: 21, w: 6,  h: 5 },
    { key: 'shack',   name: 'MWR',     x: 27, y: 21, w: 8,  h: 5 },
    { key: 'laundry', name: 'LAUNDRY', x: 37, y: 21, w: 6,  h: 5 },
    // RLB village — east side communal living area
    { key: 'rlb',     name: 'RLB',     x: 48, y: 6,  w: 5,  h: 4 },
    { key: 'rlb2',    name: 'RLB',     x: 48, y: 11, w: 5,  h: 4, locked: true },
    { key: 'rlb3',    name: 'RLB',     x: 48, y: 16, w: 5,  h: 4, locked: true }
  ];
  const BUNKER = { x: 48, y: 22, w: 4, h: 3 };

  function doorOf(b) {
    return { x: b.x + (b.w >> 1), y: b.y + b.h - 1 };
  }

  /* ---------------- interiors ---------------- */
  const COMMON_LEGEND = {
    w: { tile: 'iwall', solid: true },
    f: { tile: 'floor' },
    d: { tile: 'door_in', exit: true }
  };

  const INTERIORS = {
    ops: {
      name: 'OPS BUILDING',
      grid: [
        'wwwwwwwwwwwwww',
        'wMMMMMvvLLLLLw',
        'wfffffffffffrw',
        'wffkkkfffffffw',
        'wffffffffffffw',
        'wffffffffffffw',
        'wffffffffffffw',
        'wffffffffffffw',
        'wffffffffffffw',
        'wwwwwwddwwwwww'
      ],
      legend: {
        M: { tile: 'floor', furn: 'mapboard', solid: true, action: 'mapboard', label: 'Intel Map' },
        L: { tile: 'floor', furn: 'locker',   solid: true, action: 'locker',   label: 'Lockers' },
        k: { tile: 'floor', furn: 'deskOps',  solid: true, action: 'briefing', label: 'Ops Desk' },
        r: { tile: 'floor', furn: 'servrack', solid: true, action: 'stealComms', label: 'Comm Rack', spot: 'comms' },
        v: { tile: 'floor', furn: 'vaultdoor', solid: true, action: 'vault', label: 'The Vault' }
      },
      npcs: [
        { x: 3, y: 2, pal: 'officer', name: 'RHINO', dir: 'down', action: 'briefing' }
      ]
    },
    dfac: {
      name: 'DFAC',
      grid: [
        'wwwwwwwwwwwwww',
        'wffffffffffFFw',
        'wSSSSSSffffffw',
        'wffffffffffffw',
        'wfttffttffttfw',
        'wfttffttffttfw',
        'wffffffffffffw',
        'wfttffttffttfw',
        'wffffffffffffw',
        'wwwwwwddwwwwww'
      ],
      legend: {
        S: { tile: 'floor', furn: 'servline', solid: true, action: 'eat',    label: 'Chow Line' },
        F: { tile: 'floor', furn: 'cooler',   solid: true, action: 'cooler', label: 'Drink Cooler' },
        t: { tile: 'floor', furn: 'table',    solid: true, action: 'table',  label: 'Table' }
      },
      npcs: [
        { x: 3, y: 1, pal: 'cook', name: 'SGT Cole', dir: 'down', action: 'cookTalk' }
      ]
    },
    gym: {
      name: 'GYM',
      grid: [
        'wwwwwwwwwwww',
        'wTTffffffBBw',
        'wTTffffffBBw',
        'wffffffffffw',
        'wffffffffffw',
        'wBBffffffTTw',
        'wffffffffffw',
        'wffffffffffw',
        'wwwwwddwwwww'
      ],
      legend: {
        T: { tile: 'floor', furn: 'treadmill', solid: true, action: 'treadmill', label: 'Treadmill' },
        B: { tile: 'floor', furn: 'weights',   solid: true, action: 'weights',   label: 'Weights' }
      },
      npcs: []
    },
    shack: {
      name: 'MWR SHACK',
      grid: [
        'wwwwwwwwwwwwww',
        'wVVfnfffFcfcfw',
        'wUUffffffcfcfw',
        'wffffffffffffw',
        'wffGGffffffffw',
        'wffGGffffffffw',
        'wffffffffffffw',
        'wffffffffffffw',
        'wffffffffffffw',
        'wwwwwwddwwwwww'
      ],
      legend: {
        V: { tile: 'floor', furn: 'tv',       solid: true, action: 'tv',         label: 'TV' },
        U: { tile: 'floor', furn: 'couch',    solid: true, action: 'tv',         label: 'Couch' },
        n: { tile: 'floor', furn: 'mapboard', solid: true, action: 'buildBoard', label: 'Build Board' },
        G: { tile: 'floor', furn: 'foosball', solid: true, action: 'foosball',   label: 'Foosball' },
        F: { tile: 'floor', furn: 'cooler',   solid: true, action: 'mwrFridge',  label: 'MWR Fridge' },
        c: { tile: 'floor', furn: 'cot',      solid: true, action: 'sleep',      label: 'Cot' }
      },
      npcs: [
        { x: 11, y: 6, pal: 'hard', name: 'HARD', dir: 'down', action: 'hardTalk' }
      ]
    },
    laundry: {
      name: 'LAUNDRY',
      grid: [
        'wwwwwwwwww',
        'wWWWfDDDfw',
        'wffffffffw',
        'wffttffffw',
        'wffffffffw',
        'wffffffffw',
        'wffffffffw',
        'wwwwddwwww'
      ],
      legend: {
        W: { tile: 'floor', furn: 'washer', solid: true, action: 'laundry',   label: 'Washer' },
        D: { tile: 'floor', furn: 'dryer',  solid: true, action: 'dryer',     label: 'Dryer' },
        t: { tile: 'floor', furn: 'table',  solid: true, action: 'foldtable', label: 'Folding Table' }
      },
      npcs: []
    },
    rlb: {
      name: 'YOUR RLB',
      grid: [
        'wwwwwwww',
        'wBBfffLw',
        'wffffffw',
        'wkfffffw',
        'wffffffw',
        'wffffffw',
        'wwwddwww'
      ],
      legend: {
        B: { tile: 'floor', furn: 'bed',     solid: true, action: 'homeBed',    label: 'Your Bed' },
        L: { tile: 'floor', furn: 'locker',  solid: true, action: 'homeLocker', label: 'Wall Locker' },
        k: { tile: 'floor', furn: 'deskOps', solid: true, action: 'homeDesk',   label: 'Desk' }
      },
      npcs: []
    },
    clinic: {
      name: 'FLIGHT MEDICINE',
      grid: [
        'wwwwwwwwww',
        'wCCCffbfbw',
        'wfffffbfbw',
        'wffffffffw',
        'wkkffffffw',
        'wffffffffw',
        'wffffffffw',
        'wwwwddwwww'
      ],
      legend: {
        C: { tile: 'floor', furn: 'medcab',  solid: true, action: 'medcab',  label: 'Medicine Cabinet' },
        b: { tile: 'floor', furn: 'exambed', solid: true, action: 'exambed', label: 'Exam Bed' },
        k: { tile: 'floor', furn: 'deskOps', solid: true, action: 'docTalk', label: 'Doc\'s Desk' }
      },
      npcs: [
        { x: 1, y: 3, pal: 'doc', name: 'Doc Kessler', dir: 'down', action: 'docTalk' }
      ]
    },
    bath: {
      name: 'LATRINE',
      grid: [
        'wwwwwwwwww',
        'wPfPfffHHw',
        'wffffffffw',
        'wKKffffHHw',
        'wffffffffw',
        'wffffffffw',
        'wffffffffw',
        'wwwwddwwww'
      ],
      legend: {
        P: { tile: 'floor', furn: 'toilet', solid: true, action: 'toilet', label: 'Toilet' },
        K: { tile: 'floor', furn: 'sink',   solid: true, action: 'sink',   label: 'Sink' },
        H: { tile: 'floor', furn: 'shower', solid: true, action: 'shower', label: 'Shower' }
      },
      npcs: []
    }
  };

  /* ---------------- exterior ---------------- */
  const JETS = [
    { x: 7,  y: 3, mine: true },
    { x: 19, y: 3, mine: false },
    { x: 31, y: 3, mine: false }
  ];
  const TREES = [
    [2, 11], [15, 12], [27, 11], [44, 13],
    [2, 24], [13, 28], [26, 28], [35, 28], [45, 24], [20, 28],
    [46, 5], [46, 20], [54, 9], [54, 26]
  ];
  const HESCO_CLUSTERS = [
    [26, 14], [26, 15], [43, 21], [2, 20], [2, 21], [45, 15],
    [47, 22], [53, 22], [47, 24], [53, 24]
  ];
  // scavenge (safe) and theft (risky) spots — furn drawn on the map, hot on the tile
  const GATHER_SPOTS = [
    { x: 5,  y: 28, furn: 'palletstack', action: 'scavPallet',    label: 'Pallet Stack',   spot: 'pal1' },
    { x: 43, y: 11, furn: 'palletstack', action: 'scavPallet',    label: 'Pallet Stack',   spot: 'pal2' },
    { x: 14, y: 16, furn: 'palletstack', action: 'scavPallet',    label: 'Pallet Stack',   spot: 'pal3' },
    { x: 20, y: 29, furn: 'junkpile',    action: 'scavJunk',      label: 'Junk Pile',      spot: 'junk1' },
    { x: 44, y: 17, furn: 'junkpile',    action: 'scavJunk',      label: 'Junk Pile',      spot: 'junk2' },
    { x: 2,  y: 13, furn: 'conex',       action: 'stealSupply',   label: 'Supply Conex',   spot: 'supply' },
    { x: 3,  y: 13, furn: 'conex',       action: 'stealSupply',   label: 'Supply Conex',   spot: 'supply' },
    { x: 16, y: 7,  furn: 'avcart',      action: 'stealAvionics', label: 'Avionics Cart',  spot: 'avcart' }
  ];

  function buildExterior() {
    const w = 56, h = 32;
    const tiles = [], solid = [], hot = {};
    for (let y = 0; y < h; y++) {
      tiles.push(new Array(w).fill('sand'));
      solid.push(new Array(w).fill(false));
    }
    const setT = (x, y, id, sol) => { tiles[y][x] = id; if (sol !== undefined) solid[y][x] = sol; };

    // flight line tarmac
    for (let y = 1; y <= 9; y++)
      for (let x = 1; x <= 46; x++) setT(x, y, 'tarmac');
    // taxiway edge stripes
    for (let x = 2; x <= 45; x += 2) setT(x, 1, 'stripe');
    // vertical road
    for (let y = 10; y <= 30; y++)
      for (let x = 22; x <= 24; x++) setT(x, y, 'tarmac');
    // horizontal road
    for (let y = 18; y <= 19; y++)
      for (let x = 1; x <= 46; x++) setT(x, y, 'tarmac');
    // perimeter hescos
    for (let x = 0; x < w; x++) { setT(x, 0, 'hesco', true); setT(x, h - 1, 'hesco', true); }
    for (let y = 0; y < h; y++) { setT(0, y, 'hesco', true); setT(w - 1, y, 'hesco', true); }
    HESCO_CLUSTERS.forEach(([x, y]) => setT(x, y, 'hesco', true));

    // buildings
    BUILDINGS.forEach(b => {
      const door = doorOf(b);
      for (let y = b.y; y < b.y + b.h; y++) {
        for (let x = b.x; x < b.x + b.w; x++) {
          if (y === b.y + b.h - 1) {
            // front wall row
            if (x === door.x) {
              if (b.locked) {
                setT(x, y, 'door', true);
                hot[x + ',' + y] = { action: 'rlbLocked', label: 'Neighbor\'s RLB' };
              } else {
                setT(x, y, 'door', false);
                hot[x + ',' + y] = { enter: b.key };
              }
            } else if (x === door.x - 2 || x === door.x + 2) {
              setT(x, y, 'window', true);
            } else {
              setT(x, y, 'wall', true);
            }
          } else if (y === b.y + b.h - 2) {
            setT(x, y, 'roofE', true);
          } else {
            setT(x, y, 'roof', true);
          }
        }
      }
    });

    // trees (solid)
    TREES.forEach(([x, y]) => { solid[y][x] = true; });

    // gather/theft spots (solid, interact by facing them)
    GATHER_SPOTS.forEach(g => {
      solid[g.y][g.x] = true;
      hot[g.x + ',' + g.y] = { action: g.action, label: g.label, spot: g.spot };
    });

    // bunker (solid block, interactable)
    for (let y = BUNKER.y; y < BUNKER.y + BUNKER.h; y++)
      for (let x = BUNKER.x; x < BUNKER.x + BUNKER.w; x++) {
        solid[y][x] = true;
        hot[x + ',' + y] = { action: 'bunker', label: 'Bunker' };
      }

    // jets: solid footprint 4x3, interact pads on the row below
    JETS.forEach(j => {
      for (let y = j.y; y < j.y + 3; y++)
        for (let x = j.x; x < j.x + 4; x++) solid[y][x] = true;
      for (let x = j.x; x < j.x + 4; x++) {
        hot[x + ',' + (j.y + 3)] = j.mine
          ? { action: 'jet', label: 'Your Jet' }
          : { action: 'jetOther', label: 'Parked Jet' };
      }
    });

    // prerender
    const canvas = SPR.cv(w * T, h * T);
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) SPR.tile(ctx, tiles[y][x], x * T, y * T, x, y);
    TREES.forEach(([x, y]) => SPR.drawTree(ctx, x * T, y * T));
    JETS.forEach(j => SPR.drawJet(ctx, j.x * T, j.y * T));
    GATHER_SPOTS.forEach(g => ctx.drawImage(SPR.furn(g.furn), g.x * T, g.y * T));
    SPR.drawBunker(ctx, BUNKER.x * T, BUNKER.y * T);
    // roof name stencils
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6d5c3d';
    BUILDINGS.forEach(b => {
      ctx.fillText(b.name, (b.x + b.w / 2) * T, (b.y + 1.6) * T);
    });

    return {
      key: 'exterior', name: 'CAMP SIDEWINDER', w, h,
      tiles, solid, hot, canvas, isInterior: false,
      npcs: [
        { x: 12, y: 7, pal: 'chief', name: 'Crew Chief Diaz', dir: 'down', action: 'chiefTalk' }
      ]
    };
  }

  function buildInterior(key) {
    const def = INTERIORS[key];
    const grid = def.grid;
    const h = grid.length, w = grid[0].length;
    grid.forEach((r, i) => {
      if (r.length !== w) console.error('Bad row width in map ' + key + ' row ' + i);
    });
    const tiles = [], solid = [], hot = {};
    const furns = [];
    let doorX = 0, doorY = 0;

    for (let y = 0; y < h; y++) {
      tiles.push([]);
      solid.push([]);
      for (let x = 0; x < w; x++) {
        const ch = grid[y][x];
        const leg = def.legend[ch] || COMMON_LEGEND[ch] || COMMON_LEGEND.f;
        tiles[y].push(leg.tile);
        solid[y].push(!!leg.solid);
        if (leg.furn) furns.push({ x, y, furn: leg.furn });
        if (leg.action) hot[x + ',' + y] = { action: leg.action, label: leg.label, spot: leg.spot };
        if (leg.exit) {
          hot[x + ',' + y] = { exit: true };
          doorX = x; doorY = y;
        }
      }
    }

    const canvas = SPR.cv(w * T, h * T);
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) SPR.tile(ctx, tiles[y][x], x * T, y * T, x, y);
    furns.forEach(f => ctx.drawImage(SPR.furn(f.furn), f.x * T, f.y * T));

    return {
      key, name: def.name, w, h, tiles, solid, hot, canvas,
      isInterior: true, npcs: def.npcs.map(n => Object.assign({}, n)),
      spawn: { x: doorX, y: doorY - 1 }
    };
  }

  const cache = {};
  function get(key) {
    if (!cache[key]) cache[key] = key === 'exterior' ? buildExterior() : buildInterior(key);
    return cache[key];
  }

  return { get, BUILDINGS, doorOf };
})();
