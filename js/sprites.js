'use strict';
/* ============================================================
   SPRITES — all pixel art generated in code (no image files)
   ============================================================ */
const SPR = (() => {
  const T = 16;

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // deterministic noise so terrain speckle is stable per tile
  function rnd(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /* ---------------- character sprites ----------------
     16x24 pixel grids (Stardew-style proportions). Palette chars:
     H hair   h long hair (female only)   S skin   E eye
     T top    A arms (skin when short-sleeved)
     P pants  B shoes   . transparent */
  const CHAR_H = 24;
  const GRIDS = {
    dn_stand: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHSSSSHH....',
      '...hHSSSSSSHh...',
      '...hHSESSESHh...',
      '...hHSSSSSSHh...',
      '...h.SSSSSS.h...',
      '...h..SSSS..h...',
      '...hTTTTTTTTh...',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..SSTTTTTTTTSS..',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....BBBBBBBB....',
      '....BBB..BBB....',
      '................'
    ],
    dn_step: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHSSSSHH....',
      '...hHSSSSSSHh...',
      '...hHSESSESHh...',
      '...hHSSSSSSHh...',
      '...h.SSSSSS.h...',
      '...h..SSSS..h...',
      '...hTTTTTTTTh...',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..SSTTTTTTTTSS..',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPP.PPPP....',
      '....BBB..PPP....',
      '.........PPP....',
      '.........BBB....',
      '.........BBB....',
      '................'
    ],
    up_stand: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '...hHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...h.HHHHHH.h...',
      '...h..SSSS..h...',
      '...hTTTTTTTTh...',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..SSTTTTTTTTSS..',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....BBBBBBBB....',
      '....BBB..BBB....',
      '................'
    ],
    up_step: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '...hHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...hHHHHHHHHh...',
      '...h.HHHHHH.h...',
      '...h..SSSS..h...',
      '...hTTTTTTTTh...',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..AATTTTTTTTAA..',
      '..SSTTTTTTTTSS..',
      '....PPPPPPPP....',
      '....PPPPPPPP....',
      '....PPP.PPPP....',
      '....BBB..PPP....',
      '.........PPP....',
      '.........BBB....',
      '.........BBB....',
      '................'
    ],
    lf_stand: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HSSSHHHH....',
      '....SSSSSHHHh...',
      '....SESSSHHHh...',
      '....SSSSSHHHh...',
      '.....SSSSHHh....',
      '......SSSS.h....',
      '....TTTTTTTTh...',
      '....AATTTTTTh...',
      '....AATTTTTT....',
      '....AATTTTTT....',
      '....AATTTTTT....',
      '....SSTTTTTT....',
      '.....PPPPPP.....',
      '.....PPPPPP.....',
      '.....PPPPPP.....',
      '.....PPPPPP.....',
      '.....PPPPPP.....',
      '.....BBBBB......',
      '....BBBBB.......',
      '................'
    ],
    lf_step: [
      '................',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '....HHHHHHHH....',
      '....HSSSHHHH....',
      '....SSSSSHHHh...',
      '....SESSSHHHh...',
      '....SSSSSHHHh...',
      '.....SSSSHHh....',
      '......SSSS.h....',
      '....TTTTTTTTh...',
      '....AATTTTTTh...',
      '....AATTTTTT....',
      '....AATTTTTT....',
      '....AATTTTTT....',
      '....SSTTTTTT....',
      '.....PPPPPP.....',
      '.....PPPPPP.....',
      '....PPP.PPP.....',
      '....PPP..PPP....',
      '...PPP....PPP...',
      '...BBB....BBB...',
      '................',
      '................'
    ]
  };

  // darken a hex color (arms are a shaded tone of the top so they read against the torso)
  function shade(hex, f) {
    return '#' + [1, 3, 5].map(i =>
      Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
  }

  // NPCs still use fixed palettes through the same grid system
  const PAL = {
    player:  { H: '#3a2a18', S: '#e0ac7e', E: '#1a1a1a', T: '#b49a66', A: shade('#b49a66', 0.78), P: '#b49a66', B: '#33291f' },
    officer: { H: '#55504a', S: '#d8a374', E: '#1a1a1a', T: '#8a7a55', A: shade('#8a7a55', 0.78), P: '#8a7a55', B: '#33291f' },
    cook:    { H: '#2a2a2a', S: '#b57c52', E: '#1a1a1a', T: '#c9c9c9', A: shade('#c9c9c9', 0.78), P: '#c9c9c9', B: '#33291f' },
    chief:   { H: '#7a4a20', S: '#e8bd93', E: '#1a1a1a', T: '#6b5a3f', A: shade('#6b5a3f', 0.78), P: '#6b5a3f', B: '#33291f' },
    doc:     { H: '#9a9aa0', S: '#d8a374', E: '#1a1a1a', T: '#7fb0a8', A: shade('#7fb0a8', 0.78), P: '#5f8a82', B: '#33291f' },
    hard:    { H: '#14100c', S: '#c98a5a', E: '#1a1a1a', T: '#b49a66', A: shade('#b49a66', 0.78), P: '#b49a66', B: '#33291f' },
    croc:    { H: '#1a1512', S: '#b57c52', E: '#1a1a1a', T: '#b49a66', A: shade('#b49a66', 0.78), P: '#b49a66', B: '#33291f' },
    // coffee stand customers
    crew:    { H: '#2a2a2a', S: '#d8a374', E: '#1a1a1a', T: '#5f7040', A: shade('#5f7040', 0.78), P: '#5f7040', B: '#33291f' },
    guard:   { H: '#4a3320', S: '#e0ac7e', E: '#1a1a1a', T: '#5a6470', A: shade('#5a6470', 0.78), P: '#5a6470', B: '#26282c' },
    contractor: { H: '#9a9aa0', S: '#d8a374', E: '#1a1a1a', T: '#c9a35a', A: shade('#c9a35a', 0.78), P: '#8a8a90', B: '#33291f' },
    maint:   { H: '#1e1a16', S: '#b57c52', E: '#1a1a1a', T: '#6a7178', A: shade('#6a7178', 0.78), P: '#6a7178', B: '#26282c' }
  };

  /* ---------------- customization options ---------------- */
  const SEXES = ['Male', 'Female'];
  const HAIRS = [
    ['Black',  '#1e1a16'],
    ['Brown',  '#4a3320'],
    ['Blonde', '#c9a35a'],
    ['Red',    '#8a3a22'],
    ['Gray',   '#9a9aa0']
  ];
  const OUTFITS = [
    { name: 'Tan Flight Suit',    T: '#b49a66', P: '#b49a66', A: '#b49a66' },
    { name: 'Quarter Zip + Sweats', T: '#d2bc94', P: '#8a8a90', A: '#d2bc94', zip: true },
    { name: 'White Tee + Sweats',   T: '#e8e8e8', P: '#8a8a90', A: 'skin' },
    { name: 'Hoodie + Sweats',      T: '#6a6a72', P: '#8a8a90', A: '#6a6a72', hood: true }
  ];
  const SHOES = [
    ['Boots',    '#33291f'],
    ['Sneakers', '#f0f0f0'],
    ['Crocs',    '#7fae5a']
  ];
  const HATS = ['No Hat', 'Black Beanie', 'Cowboy Hat'];

  function mirror(rows) {
    return rows.map(r => r.split('').reverse().join(''));
  }

  function drawGrid(rows, pal) {
    const c = cv(16, rows.length), x = c.getContext('2d');
    rows.forEach((r, y) => {
      for (let i = 0; i < 16; i++) {
        const ch = r[i];
        if (ch && ch !== '.' && pal[ch]) {
          x.fillStyle = pal[ch];
          x.fillRect(i, y, 1, 1);
        }
      }
    });
    return c;
  }

  /* ---------------- polish: outline + top-light + bottom-shade ----------------
     One consistent Stardew-style pass applied to every generated sprite:
     silhouette edges darken toward a hue-shifted outline, the row under a
     top edge gets a warm highlight, the row above a bottom edge cools off. */
  function polish(c) {
    const w = c.width, h = c.height;
    const x = c.getContext('2d');
    const img = x.getImageData(0, 0, w, h);
    const d = img.data;
    const alphaAt = (i, j) => (i < 0 || j < 0 || i >= w || j >= h) ? 0 : d[(j * w + i) * 4 + 3];
    const edge = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (d[k * 4 + 3] > 0 &&
            (alphaAt(i - 1, j) === 0 || alphaAt(i + 1, j) === 0 ||
             alphaAt(i, j - 1) === 0 || alphaAt(i, j + 1) === 0)) edge[k] = 1;
      }
    }
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i, p = k * 4;
        if (d[p + 3] === 0) continue;
        if (edge[k]) {
          // 1px-wide features (arms, hands, posts) keep their color — light touch only
          const thin = (alphaAt(i - 1, j) === 0 && alphaAt(i + 1, j) === 0) ||
                       (alphaAt(i, j - 1) === 0 && alphaAt(i, j + 1) === 0);
          const mix = thin ? 0.22 : 0.55;
          d[p]     = (d[p]     * (1 - mix) + 32 * mix) | 0;
          d[p + 1] = (d[p + 1] * (1 - mix) + 26 * mix) | 0;
          d[p + 2] = (d[p + 2] * (1 - mix) + 38 * mix) | 0;
        } else if (j > 0 && edge[k - w]) {      // warm top light
          d[p]     = Math.min(255, (d[p]     * 0.75 + 255 * 0.25) | 0);
          d[p + 1] = Math.min(255, (d[p + 1] * 0.75 + 238 * 0.25) | 0);
          d[p + 2] = Math.min(255, (d[p + 2] * 0.75 + 185 * 0.25) | 0);
        } else if (j < h - 1 && edge[k + w]) {  // cool bottom shade
          d[p]     = (d[p]     * 0.8 + 40 * 0.2) | 0;
          d[p + 1] = (d[p + 1] * 0.8 + 42 * 0.2) | 0;
          d[p + 2] = (d[p + 2] * 0.8 + 82 * 0.2) | 0;
        }
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // render a draw-function into a polished, cached-by-caller canvas
  function spriteCanvas(w, h, fn) {
    const c = cv(w, h);
    fn(c.getContext('2d'), 0, 0);
    return polish(c);
  }

  // hat / outfit details drawn on top of the finished frame (16x24 body)
  function decorator(cfg) {
    const o = OUTFITS[cfg.outfit];
    return (c, dir) => {
      const x = c.getContext('2d');
      if (o.zip && dir === 'down') {
        x.fillStyle = '#8a744e';
        x.fillRect(7, 10, 1, 5);
        x.fillStyle = '#5a4a30';
        x.fillRect(7, 10, 1, 1);
      }
      if (o.hood) {
        x.fillStyle = '#55555c';
        x.fillRect(5, 9, 6, 1);
        x.fillRect(4, 10, 1, 1);
        x.fillRect(11, 10, 1, 1);
        if (dir === 'down') {
          x.fillStyle = '#d8d8d8';
          x.fillRect(6, 11, 1, 1);
          x.fillRect(9, 11, 1, 1);
        }
      }
      if (cfg.hat === 1) {           // black watchcap beanie
        x.fillStyle = '#1c1c1e';
        x.fillRect(5, 1, 6, 1);
        x.fillRect(4, 2, 8, 2);
        x.fillStyle = '#33333a';
        x.fillRect(4, 3, 8, 1);
      }
      if (cfg.hat === 2) {           // cowboy hat
        x.fillStyle = '#6d4f28';
        x.fillRect(2, 3, 12, 1);
        x.fillStyle = '#8f6b3a';
        x.fillRect(5, 0, 6, 3);
        x.fillStyle = '#4f3819';
        x.fillRect(5, 2, 6, 1);
      }
    };
  }

  function assembleFrames(pal, dec) {
    const mk = (rows, dir) => {
      const c = drawGrid(rows, pal);
      if (dec) dec(c, dir);
      return polish(c);
    };
    const dnS = mk(GRIDS.dn_stand, 'down'), dn1 = mk(GRIDS.dn_step, 'down'), dn2 = mk(mirror(GRIDS.dn_step), 'down');
    const upS = mk(GRIDS.up_stand, 'up'),   up1 = mk(GRIDS.up_step, 'up'),   up2 = mk(mirror(GRIDS.up_step), 'up');
    const lfS = mk(GRIDS.lf_stand, 'left'), lf1 = mk(GRIDS.lf_step, 'left');
    const rtS = mk(mirror(GRIDS.lf_stand), 'right'), rt1 = mk(mirror(GRIDS.lf_step), 'right');
    return {
      down:  [dnS, dn1, dnS, dn2],
      up:    [upS, up1, upS, up2],
      left:  [lfS, lf1, lfS, lf1],
      right: [rtS, rt1, rtS, rt1]
    };
  }

  const frameCache = {};
  function charFrames(palName) {
    if (!frameCache[palName]) frameCache[palName] = assembleFrames(PAL[palName], null);
    return frameCache[palName];
  }

  // cfg: { sex: 0|1, hair: idx, outfit: idx, shoes: idx, hat: idx }
  function buildCharFrames(cfg) {
    const skin = '#e0ac7e';
    const hair = HAIRS[cfg.hair][1];
    const o = OUTFITS[cfg.outfit];
    const pal = {
      H: hair,
      h: cfg.sex === 1 ? hair : null,
      S: skin, E: '#1a1a1a',
      T: o.T, P: o.P,
      A: o.A === 'skin' ? skin : shade(o.A, 0.78),   // arms: shaded sleeve tone
      B: SHOES[cfg.shoes][1]
    };
    return assembleFrames(pal, decorator(cfg));
  }

  /* ---------------- terrain tiles ---------------- */
  function tile(ctx, id, px, py, tx, ty) {
    // asset override (assets.js): PNG tile strips beat the procedural draws
    if (typeof ASSETS !== 'undefined' && ASSETS.tiles && ASSETS.tiles[id]) {
      const v = ASSETS.tiles[id];
      ctx.drawImage(v[(rnd(tx * 61 + ty * 173) * v.length) | 0], px, py);
      return;
    }
    const seed = tx * 61 + ty * 173;
    switch (id) {
      case 'sand': {
        ctx.fillStyle = '#d7b271';
        ctx.fillRect(px, py, T, T);
        for (let i = 0; i < 5; i++) {
          const rx = (rnd(seed + i) * 14) | 0, ry = (rnd(seed + i + 9) * 14) | 0;
          ctx.fillStyle = rnd(seed + i + 40) > 0.5 ? '#c6a05e' : '#e2c088';
          ctx.fillRect(px + rx, py + ry, 2, 1);
        }
        break;
      }
      case 'tarmac': {
        ctx.fillStyle = '#5b6066';
        ctx.fillRect(px, py, T, T);
        for (let i = 0; i < 4; i++) {
          const rx = (rnd(seed + i) * 14) | 0, ry = (rnd(seed + i + 7) * 14) | 0;
          ctx.fillStyle = rnd(seed + i + 30) > 0.5 ? '#51565c' : '#666c73';
          ctx.fillRect(px + rx, py + ry, 2, 1);
        }
        break;
      }
      case 'stripe': {
        tile(ctx, 'tarmac', px, py, tx, ty);
        ctx.fillStyle = '#d9d9cf';
        ctx.fillRect(px + 2, py + 7, 12, 2);
        break;
      }
      case 'hesco': {
        ctx.fillStyle = '#b8a26b';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#cbb67e';
        ctx.fillRect(px, py, T, 3);
        ctx.fillStyle = '#8f7c4c';
        for (let i = 0; i <= T; i += 4) {
          ctx.fillRect(px + i, py, 1, T);
          ctx.fillRect(px, py + i, T, 1);
        }
        break;
      }
      case 'roof': {
        ctx.fillStyle = '#b3a58c';
        ctx.fillRect(px, py, T, T);
        for (let i = 0; i < 3; i++) {
          const rx = (rnd(seed + i) * 14) | 0, ry = (rnd(seed + i + 5) * 14) | 0;
          ctx.fillStyle = '#a89a80';
          ctx.fillRect(px + rx, py + ry, 2, 1);
        }
        break;
      }
      case 'roofE': {
        tile(ctx, 'roof', px, py, tx, ty);
        ctx.fillStyle = '#8f8268';
        ctx.fillRect(px, py + 12, T, 4);
        ctx.fillStyle = '#7a6e56';
        ctx.fillRect(px, py + 15, T, 1);
        break;
      }
      case 'wall': {
        ctx.fillStyle = '#c9b795';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#bba984';
        ctx.fillRect(px, py, T, 2);
        ctx.fillStyle = '#a08a5f';
        ctx.fillRect(px, py + 14, T, 2);
        break;
      }
      case 'window': {
        tile(ctx, 'wall', px, py, tx, ty);
        ctx.fillStyle = '#6d5c3d';
        ctx.fillRect(px + 2, py + 3, 12, 9);
        ctx.fillStyle = '#8fb6c9';
        ctx.fillRect(px + 3, py + 4, 10, 7);
        ctx.fillStyle = '#b8dcea';
        ctx.fillRect(px + 4, py + 5, 3, 2);
        break;
      }
      case 'door': {
        tile(ctx, 'wall', px, py, tx, ty);
        ctx.fillStyle = '#4c5760';
        ctx.fillRect(px + 2, py + 1, 12, 15);
        ctx.fillStyle = '#5f6d77';
        ctx.fillRect(px + 3, py + 2, 10, 14);
        ctx.fillStyle = '#8fb6c9';
        ctx.fillRect(px + 5, py + 3, 6, 3);
        ctx.fillStyle = '#d8c9a3';
        ctx.fillRect(px + 11, py + 9, 2, 2);
        break;
      }
      case 'floor': {
        ctx.fillStyle = '#a9a396';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#948e80';
        ctx.fillRect(px + 15, py, 1, T);
        ctx.fillRect(px, py + 15, T, 1);
        break;
      }
      case 'iwall': {
        ctx.fillStyle = '#8a8578';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#9b968a';
        ctx.fillRect(px, py, T, 5);
        ctx.fillStyle = '#6e6a5e';
        ctx.fillRect(px, py + 14, T, 2);
        break;
      }
      case 'door_in': {
        tile(ctx, 'floor', px, py, tx, ty);
        ctx.fillStyle = '#6e3b36';
        ctx.fillRect(px + 1, py + 3, 14, 11);
        ctx.fillStyle = '#7d4a42';
        ctx.fillRect(px + 2, py + 4, 12, 9);
        ctx.fillStyle = '#96605a';
        ctx.fillRect(px + 3, py + 5, 10, 2);
        break;
      }
      case 'deck': {
        ctx.fillStyle = '#a8895a';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#93794e';
        ctx.fillRect(px, py + 3, T, 1);
        ctx.fillRect(px, py + 7, T, 1);
        ctx.fillRect(px, py + 11, T, 1);
        ctx.fillRect(px, py + 15, T, 1);
        ctx.fillStyle = '#7d6540';
        ctx.fillRect(px + ((tx % 2) ? 4 : 10), py + 4, 1, 3);
        ctx.fillRect(px + ((tx % 2) ? 11 : 5), py + 12, 1, 3);
        break;
      }
      default: {
        ctx.fillStyle = '#f0f';
        ctx.fillRect(px, py, T, T);
      }
    }
  }

  /* ---------------- furniture (rect-list sprites) ----------------
     each entry: [x, y, w, h, color] in 16x16 space */
  const FURN_DEFS = {
    cot: [
      [2, 0, 12, 16, '#54452f'],
      [3, 1, 10, 14, '#5f7040'],
      [4, 2, 8, 3, '#ded7c3'],
      [4, 8, 8, 6, '#4c5a33']
    ],
    tv: [
      [3, 10, 10, 3, '#33302c'],
      [1, 2, 14, 9, '#242424'],
      [2, 3, 12, 7, '#3fb0c9'],
      [3, 4, 4, 2, '#8fe0ef']
    ],
    couch: [
      [1, 2, 14, 4, '#a05a45'],
      [1, 4, 14, 9, '#8a4a3a'],
      [1, 4, 2, 9, '#77402f'],
      [13, 4, 2, 9, '#77402f'],
      [4, 6, 8, 1, '#77402f']
    ],
    table: [
      [2, 4, 12, 8, '#a8895a'],
      [2, 10, 12, 2, '#7d6540'],
      [3, 5, 10, 1, '#bd9c6b']
    ],
    foosball: [
      [1, 3, 14, 11, '#7d6540'],
      [2, 4, 12, 9, '#3a6b4f'],
      [2, 6, 12, 1, '#c9c9c9'],
      [2, 9, 12, 1, '#c9c9c9'],
      [5, 5, 1, 7, '#d84a4a'],
      [10, 5, 1, 7, '#4a6ad8']
    ],
    treadmill: [
      [3, 2, 10, 13, '#44464a'],
      [5, 5, 6, 9, '#222426'],
      [5, 7, 6, 1, '#3a3d40'],
      [5, 10, 6, 1, '#3a3d40'],
      [4, 1, 8, 3, '#666a70'],
      [6, 2, 4, 1, '#8fd48a']
    ],
    weights: [
      [6, 4, 4, 11, '#8a3a3a'],
      [2, 3, 12, 2, '#9a9da3'],
      [2, 1, 2, 6, '#33353a'],
      [12, 1, 2, 6, '#33353a']
    ],
    washer: [
      [2, 2, 12, 13, '#dcdcdc'],
      [3, 3, 10, 2, '#aaaaaa'],
      [11, 3, 2, 1, '#d84a4a'],
      [5, 7, 6, 6, '#5b6066'],
      [6, 8, 4, 4, '#7fa8c0']
    ],
    dryer: [
      [2, 2, 12, 13, '#c9cdd4'],
      [3, 3, 10, 2, '#999da4'],
      [11, 3, 2, 1, '#4a6ad8'],
      [5, 7, 6, 6, '#5b6066'],
      [6, 8, 4, 4, '#3a3d40']
    ],
    toilet: [
      [5, 1, 6, 4, '#e8e8e8'],
      [4, 5, 8, 9, '#f2f2f2'],
      [6, 7, 4, 4, '#9fc4d8'],
      [5, 13, 6, 1, '#c9c9c9']
    ],
    sink: [
      [2, 4, 12, 9, '#cfcfcf'],
      [5, 6, 6, 5, '#9fc4d8'],
      [7, 2, 2, 4, '#888c92'],
      [2, 12, 12, 1, '#aaaaaa']
    ],
    shower: [
      [1, 1, 14, 14, '#8fa8b4'],
      [2, 2, 12, 12, '#bcd4de'],
      [3, 3, 2, 2, '#666a70'],
      [7, 8, 2, 2, '#556066'],
      [4, 5, 1, 6, '#a3c4d1'],
      [11, 4, 1, 7, '#a3c4d1']
    ],
    servline: [
      [1, 3, 14, 11, '#8f8f97'],
      [1, 3, 14, 1, '#c0d8e0'],
      [3, 5, 3, 3, '#c9a34a'],
      [8, 5, 3, 3, '#7fae5a'],
      [3, 10, 3, 3, '#c96a4a'],
      [8, 10, 3, 3, '#e8d9a0']
    ],
    cooler: [
      [3, 1, 10, 14, '#d84a4a'],
      [4, 2, 8, 12, '#c23b3b'],
      [4, 6, 8, 3, '#f2f2f2'],
      [5, 3, 6, 2, '#8fd8ef']
    ],
    deskOps: [
      [1, 3, 14, 10, '#7d6540'],
      [2, 4, 12, 8, '#93794e'],
      [3, 5, 4, 3, '#eeeeee'],
      [9, 5, 4, 4, '#7fae5a'],
      [9, 5, 4, 1, '#5a824a']
    ],
    mapboard: [
      [1, 2, 14, 12, '#6d5c3d'],
      [2, 3, 12, 10, '#c9b27a'],
      [4, 5, 3, 3, '#7fae5a'],
      [9, 6, 2, 2, '#d84a4a'],
      [5, 9, 5, 1, '#d84a4a'],
      [10, 9, 2, 3, '#4a6ad8']
    ],
    locker: [
      [2, 1, 12, 14, '#6b7f8a'],
      [7, 1, 1, 14, '#4c5b63'],
      [3, 3, 3, 1, '#4c5b63'],
      [9, 3, 3, 1, '#4c5b63'],
      [3, 5, 3, 1, '#4c5b63'],
      [9, 5, 3, 1, '#4c5b63'],
      [5, 8, 1, 2, '#d8c9a3'],
      [11, 8, 1, 2, '#d8c9a3']
    ],
    palletstack: [
      [1, 8, 14, 3, '#a8895a'],
      [1, 12, 14, 3, '#93794e'],
      [2, 4, 12, 3, '#b8996a'],
      [1, 8, 1, 7, '#7d6540'],
      [14, 8, 1, 7, '#7d6540'],
      [3, 5, 4, 1, '#c9a86a'],
      [7, 9, 4, 1, '#7d6540']
    ],
    junkpile: [
      [2, 8, 12, 6, '#6a7178'],
      [4, 5, 6, 4, '#7a8087'],
      [9, 6, 4, 3, '#5a4a30'],
      [3, 10, 3, 2, '#9aa2aa'],
      [10, 10, 3, 2, '#44464a'],
      [6, 3, 3, 3, '#8a6a38']
    ],
    conex: [
      [1, 3, 14, 11, '#5a6e5a'],
      [1, 3, 14, 2, '#6b806b'],
      [3, 5, 1, 9, '#4a5a4a'],
      [6, 5, 1, 9, '#4a5a4a'],
      [9, 5, 1, 9, '#4a5a4a'],
      [12, 5, 1, 9, '#4a5a4a'],
      [5, 8, 2, 3, '#c9a35a']
    ],
    servrack: [
      [3, 1, 10, 14, '#33353a'],
      [4, 2, 8, 2, '#44464a'],
      [4, 5, 8, 2, '#44464a'],
      [4, 8, 8, 2, '#44464a'],
      [5, 3, 1, 1, '#8fd48a'],
      [7, 3, 1, 1, '#d84a4a'],
      [5, 6, 1, 1, '#8fd48a'],
      [9, 6, 1, 1, '#e8d075'],
      [4, 11, 8, 3, '#2a2c30']
    ],
    avcart: [
      [2, 4, 12, 8, '#e8d075'],
      [3, 5, 10, 6, '#d4b84a'],
      [4, 6, 4, 3, '#33353a'],
      [9, 6, 3, 2, '#44464a'],
      [3, 12, 3, 3, '#33333a'],
      [10, 12, 3, 3, '#33333a']
    ],
    couch2: [
      [1, 2, 14, 4, '#4a6ad8'],
      [1, 4, 14, 9, '#3a55b0'],
      [1, 4, 2, 9, '#2f4590'],
      [13, 4, 2, 9, '#2f4590'],
      [4, 6, 8, 1, '#2f4590'],
      [3, 3, 4, 1, '#6a8ae8']
    ],
    computer: [
      [2, 8, 12, 5, '#7d6540'],
      [3, 2, 10, 7, '#33353a'],
      [4, 3, 8, 5, '#3f8fb0'],
      [5, 4, 3, 1, '#8fd8ef'],
      [6, 9, 4, 1, '#c9cdd4'],
      [4, 13, 8, 2, '#5a4a30']
    ],
    barcounter: [
      [1, 4, 14, 8, '#6d4f28'],
      [1, 4, 14, 2, '#8a6a38'],
      [2, 7, 12, 1, '#5a3f20'],
      [3, 9, 2, 2, '#c9a35a'],
      [7, 9, 2, 2, '#7a2a3a'],
      [11, 9, 2, 2, '#8fd48a'],
      [1, 12, 14, 2, '#4f3819']
    ],
    kitchenette: [
      [1, 2, 14, 12, '#c9cdd4'],
      [2, 3, 12, 3, '#33353a'],
      [3, 4, 3, 1, '#d84a4a'],
      [8, 4, 3, 1, '#e8862a'],
      [2, 8, 5, 4, '#9fc4d8'],
      [9, 8, 4, 4, '#7a8087'],
      [1, 13, 14, 1, '#8a8a90']
    ],
    moviescreen: [
      [1, 1, 14, 10, '#2c2620'],
      [2, 2, 12, 8, '#f2f2f2'],
      [3, 3, 10, 6, '#3f8fb0'],
      [4, 4, 4, 2, '#8fd8ef'],
      [6, 11, 4, 3, '#33353a']
    ],
    firepit: [
      [3, 6, 10, 8, '#7a8087'],
      [4, 7, 8, 6, '#5a4a30'],
      [6, 5, 4, 5, '#e8862a'],
      [7, 3, 2, 4, '#ffd75e'],
      [5, 8, 6, 3, '#c23b2a'],
      [2, 9, 3, 2, '#6a7178'],
      [11, 9, 3, 2, '#6a7178']
    ],
    coffeestand: [
      [1, 1, 14, 3, '#e8e0c8'],      // awning base
      [1, 1, 2, 3, '#c23b2a'],       // red stripes
      [5, 1, 2, 3, '#c23b2a'],
      [9, 1, 2, 3, '#c23b2a'],
      [13, 1, 2, 3, '#c23b2a'],
      [1, 4, 14, 1, '#8a3a2a'],      // awning edge
      [1, 5, 1, 8, '#7a5a30'],       // posts
      [14, 5, 1, 8, '#7a5a30'],
      [4, 6, 3, 3, '#33353a'],       // coffee pot
      [5, 5, 1, 1, '#9aa2aa'],
      [9, 7, 2, 2, '#e8e0c8'],       // cup
      [1, 9, 14, 5, '#8a6a38'],      // counter
      [1, 9, 14, 1, '#a8895a'],
      [1, 13, 14, 1, '#4f3819']
    ],
    bench: [
      [1, 6, 14, 4, '#a8895a'],
      [1, 6, 14, 1, '#c9a86a'],
      [2, 10, 2, 4, '#7d6540'],
      [12, 10, 2, 4, '#7d6540']
    ],
    chest: [
      [2, 4, 12, 10, '#8a6a38'],
      [2, 4, 12, 4, '#a8895a'],
      [2, 8, 12, 1, '#5a4530'],
      [2, 4, 1, 10, '#5a4530'],
      [13, 4, 1, 10, '#5a4530'],
      [7, 8, 2, 3, '#c9cdd4'],
      [2, 13, 12, 1, '#4f3819']
    ],
    footlocker: [
      [1, 5, 14, 9, '#5f7040'],
      [1, 5, 14, 3, '#6f8050'],
      [1, 8, 14, 1, '#3f4c2c'],
      [3, 9, 2, 3, '#9aa2aa'],
      [11, 9, 2, 3, '#9aa2aa'],
      [5, 6, 6, 1, '#e8e0c8'],
      [1, 13, 14, 1, '#33402a']
    ],
    sign: [
      [7, 8, 2, 7, '#7a5a30'],
      [2, 2, 12, 7, '#a8895a'],
      [3, 3, 10, 5, '#8a6a38'],
      [4, 4, 8, 1, '#e8e0c8'],
      [4, 6, 6, 1, '#e8e0c8'],
      [2, 2, 12, 1, '#c9a86a']
    ],
    chair: [
      [3, 2, 10, 7, '#3a6b4f'],
      [4, 3, 8, 5, '#4f7a5f'],
      [3, 9, 10, 3, '#3a6b4f'],
      [2, 12, 2, 4, '#33353a'],
      [12, 12, 2, 4, '#33353a'],
      [3, 9, 1, 4, '#26282c'],
      [12, 9, 1, 4, '#26282c']
    ],
    bed: [
      [2, 0, 12, 16, '#54452f'],
      [3, 1, 10, 14, '#e8e8e8'],
      [4, 2, 8, 3, '#bcd4de'],
      [4, 7, 8, 7, '#3a6b4f'],
      [4, 7, 8, 1, '#2f5540']
    ],
    vaultdoor: [
      [1, 0, 14, 15, '#5a6066'],
      [2, 1, 12, 13, '#6a7178'],
      [3, 2, 10, 11, '#7a8087'],
      [6, 5, 4, 4, '#4a4f55'],
      [7, 6, 2, 2, '#9aa2aa'],
      [4, 3, 2, 1, '#c9a35a'],
      [11, 10, 2, 2, '#33353a']
    ],
    medcab: [
      [2, 1, 12, 14, '#e8e8e8'],
      [3, 2, 10, 12, '#f4f4f4'],
      [7, 2, 1, 12, '#c9c9c9'],
      [6, 5, 4, 2, '#c23b2a'],
      [7, 4, 2, 4, '#c23b2a'],
      [4, 11, 2, 2, '#8a8a90'],
      [10, 11, 2, 2, '#8a8a90']
    ],
    exambed: [
      [2, 0, 12, 16, '#8a8a90'],
      [3, 1, 10, 14, '#e8e8e8'],
      [4, 2, 8, 3, '#bcd4de'],
      [4, 8, 8, 6, '#9fc4d8']
    ]
  };

  const furnCache = {};
  function furn(name) {
    // asset override (assets.js): PNG furniture beats the procedural draws
    if (typeof ASSETS !== 'undefined' && ASSETS.furn && ASSETS.furn[name]) return ASSETS.furn[name];
    if (furnCache[name]) return furnCache[name];
    const c = cv(16, 16), x = c.getContext('2d');
    (FURN_DEFS[name] || []).forEach(r => {
      x.fillStyle = r[4];
      x.fillRect(r[0], r[1], r[2], r[3]);
    });
    furnCache[name] = polish(c);
    return furnCache[name];
  }

  /* ---------------- item icons (16x16 rect sprites) ---------------- */
  const ITEM_DEFS = {
    hammer: [
      [3, 10, 8, 2, '#966a3c'],       // handle
      [9, 3, 5, 6, '#a8aeb6'],        // head
      [9, 3, 2, 2, '#d2d8e0'],        // shine
      [12, 8, 2, 1, '#787e86'],       // claw
      [3, 13, 10, 1, 'rgba(0,0,0,0.25)']
    ],
    coffeestand: [
      [2, 2, 12, 3, '#c23b2a'],
      [4, 2, 2, 3, '#e8e0c8'],
      [8, 2, 2, 3, '#e8e0c8'],
      [12, 2, 2, 3, '#e8e0c8'],
      [2, 5, 1, 7, '#7a5a30'],
      [13, 5, 1, 7, '#7a5a30'],
      [2, 8, 12, 5, '#8a6a38'],
      [2, 8, 12, 1, '#a8895a'],
      [3, 13, 10, 1, 'rgba(0,0,0,0.25)']
    ],
    coffee: [
      [5, 3, 6, 10, '#6d4f28'],
      [5, 3, 6, 2, '#4f3819'],
      [6, 7, 4, 4, '#e8dcc0'],
      [7, 8, 2, 2, '#7a4a20'],
      [4, 13, 9, 1, 'rgba(0,0,0,0.25)']
    ],
    gopill: [
      [3, 6, 5, 4, '#f2f2f2'],
      [8, 6, 5, 4, '#d84a4a'],
      [4, 7, 2, 1, '#ffffff'],
      [3, 10, 10, 1, 'rgba(0,0,0,0.25)']
    ],
    nogopill: [
      [3, 6, 5, 4, '#f2f2f2'],
      [8, 6, 5, 4, '#4a6ad8'],
      [4, 7, 2, 1, '#ffffff'],
      [3, 10, 10, 1, 'rgba(0,0,0,0.25)']
    ],
    ripit: [
      [5, 3, 6, 10, '#9aa2aa'],
      [5, 4, 6, 8, '#4a8a3a'],
      [6, 5, 4, 2, '#8fd48a'],
      [7, 8, 2, 3, '#e8d075'],
      [5, 3, 6, 1, '#c9cdd4'],
      [5, 12, 6, 1, '#6a7178']
    ],
    gatorade: [
      [6, 2, 4, 2, '#e8e8e8'],
      [5, 4, 6, 9, '#e8862a'],
      [6, 6, 4, 3, '#f4f4f4'],
      [6, 7, 4, 1, '#e8862a']
    ],
    water: [
      [6, 2, 4, 2, '#8fb6c9'],
      [5, 4, 6, 9, '#bcd4de'],
      [6, 6, 4, 4, '#dcecf2'],
      [6, 11, 4, 1, '#9fc4d8']
    ],
    mre: [
      [4, 3, 8, 10, '#7a6a4a'],
      [4, 3, 8, 2, '#93794e'],
      [5, 6, 6, 2, '#5a4a30'],
      [5, 9, 6, 1, '#93794e'],
      [5, 11, 6, 1, '#93794e']
    ],
    seeds: [
      [4, 4, 8, 9, '#e8d075'],
      [4, 4, 8, 3, '#33333a'],
      [6, 8, 2, 2, '#5a4a30'],
      [8, 9, 2, 2, '#5a4a30'],
      [5, 10, 2, 2, '#5a4a30']
    ],
    beer: [
      [6, 2, 3, 3, '#5a3a1a'],
      [5, 5, 5, 8, '#7a4a20'],
      [5, 7, 5, 3, '#c9a35a'],
      [6, 2, 1, 3, '#8f6b3a']
    ],
    wine: [
      [6, 1, 3, 4, '#2a1a1a'],
      [5, 5, 5, 9, '#4a1420'],
      [5, 8, 5, 3, '#e8e0c8'],
      [6, 9, 3, 1, '#7a2a3a']
    ],
    cigs: [
      [4, 3, 8, 10, '#f2f2f2'],
      [4, 3, 8, 4, '#d84a4a'],
      [5, 9, 2, 3, '#e0e0e0'],
      [8, 9, 2, 3, '#e0e0e0'],
      [5, 8, 5, 1, '#c9a35a']
    ],
    liquor: [
      [6, 1, 3, 4, '#2a1a1a'],
      [5, 5, 5, 9, '#8a5a1a'],
      [5, 8, 5, 3, '#e8e0c8'],
      [6, 9, 3, 1, '#5a3a10'],
      [6, 6, 1, 2, '#c9955a']
    ],
    kebab: [
      [2, 7, 12, 1, '#c9cdd4'],
      [13, 6, 2, 3, '#9aa2aa'],
      [3, 5, 3, 4, '#8a4a3a'],
      [7, 5, 3, 4, '#7a3a2a'],
      [10, 6, 2, 3, '#c96a4a'],
      [5, 4, 2, 1, '#4a7a3a'],
      [8, 9, 2, 1, '#4a7a3a']
    ],
    wood: [
      [2, 5, 12, 3, '#a8895a'],
      [2, 9, 12, 3, '#93794e'],
      [3, 6, 3, 1, '#c9a86a'],
      [9, 10, 3, 1, '#7d6540'],
      [2, 5, 1, 7, '#7d6540'],
      [13, 5, 1, 7, '#7d6540']
    ],
    scrap: [
      [3, 6, 6, 5, '#9aa2aa'],
      [8, 4, 5, 4, '#7a8087'],
      [5, 10, 7, 3, '#6a7178'],
      [4, 7, 2, 1, '#c9cdd4'],
      [9, 5, 2, 1, '#c9cdd4']
    ],
    elec: [
      [3, 4, 10, 9, '#2a5a2a'],
      [4, 5, 8, 7, '#3a6b3a'],
      [5, 6, 2, 2, '#c9a35a'],
      [9, 6, 2, 2, '#c9a35a'],
      [5, 9, 6, 1, '#9aa2aa'],
      [7, 10, 2, 2, '#33333a']
    ],
    cable: [
      [4, 4, 8, 2, '#33333a'],
      [3, 6, 10, 2, '#44464a'],
      [4, 8, 8, 2, '#33333a'],
      [5, 10, 6, 2, '#44464a'],
      [11, 5, 3, 2, '#c9a35a']
    ]
  };

  const itemCache = {};
  function item(id) {
    if (itemCache[id]) return itemCache[id];
    const c = cv(16, 16), x = c.getContext('2d');
    // placeables (chest, sign, ...) reuse their furniture sprite as the icon
    (ITEM_DEFS[id] || FURN_DEFS[id] || []).forEach(r => {
      x.fillStyle = r[4];
      x.fillRect(r[0], r[1], r[2], r[3]);
    });
    itemCache[id] = polish(c);
    return itemCache[id];
  }

  /* ---------------- decor: palm tree (16x16) ---------------- */
  function drawTree(ctx, px, py) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(px + 4, py + 13, 9, 2);
    ctx.fillStyle = '#7a5a30';
    ctx.fillRect(px + 7, py + 7, 2, 7);
    ctx.fillStyle = '#8f6b3a';
    ctx.fillRect(px + 7, py + 8, 1, 5);
    ctx.fillStyle = '#4f7a38';
    ctx.fillRect(px + 2, py + 4, 12, 2);
    ctx.fillRect(px + 4, py + 2, 8, 2);
    ctx.fillRect(px + 1, py + 6, 5, 2);
    ctx.fillRect(px + 10, py + 6, 5, 2);
    ctx.fillStyle = '#659448';
    ctx.fillRect(px + 5, py + 3, 6, 2);
    ctx.fillRect(px + 3, py + 5, 4, 1);
    ctx.fillRect(px + 9, py + 5, 4, 1);
  }

  /* ---------------- decor: parked jet, top-down, nose south (64x48) ---------------- */
  function drawJet(ctx, x, y) {
    const g = '#8b939b', d = '#6a7178', c = '#7fb6d9';
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x + 8, y + 16, 48, 4);
    ctx.fillRect(x + 26, y + 6, 12, 38);
    // vertical stabilizer
    ctx.fillStyle = d;
    ctx.fillRect(x + 30, y + 1, 4, 10);
    ctx.fillStyle = '#c23b2a';
    ctx.fillRect(x + 30, y + 1, 4, 2);
    // horizontal stabilizers
    ctx.fillStyle = g;
    ctx.fillRect(x + 18, y + 7, 28, 5);
    // delta wings — widen toward tail (up)
    for (let i = 0; i < 15; i++) {
      const w = 6 + i * 3;
      ctx.fillStyle = i % 4 === 0 ? d : g;
      ctx.fillRect(x + 32 - (w >> 1), y + 28 - i, w, 1);
    }
    // fuselage
    ctx.fillStyle = g;
    ctx.fillRect(x + 28, y + 3, 8, 40);
    ctx.fillStyle = d;
    ctx.fillRect(x + 28, y + 3, 1, 40);
    ctx.fillRect(x + 35, y + 3, 1, 40);
    // canopy near nose
    ctx.fillStyle = c;
    ctx.fillRect(x + 29, y + 30, 6, 7);
    ctx.fillStyle = '#b8dcea';
    ctx.fillRect(x + 30, y + 31, 2, 3);
    // nose cone
    ctx.fillStyle = d;
    ctx.fillRect(x + 29, y + 43, 6, 2);
    ctx.fillRect(x + 30, y + 45, 4, 2);
    ctx.fillStyle = '#3a3d40';
    ctx.fillRect(x + 31, y + 46, 2, 1);
  }

  /* ---------------- decor: concrete bunker (64x48, 4x3 tiles) ---------------- */
  function drawBunker(ctx, x, y) {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 2, y + 42, 62, 5);
    // stepped concrete arch
    ctx.fillStyle = '#7a7d80';
    ctx.fillRect(x + 1, y + 12, 62, 32);
    ctx.fillStyle = '#8a8d90';
    ctx.fillRect(x + 4, y + 6, 56, 12);
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(x + 10, y + 2, 44, 8);
    // panel seams
    ctx.fillStyle = '#6a6d70';
    ctx.fillRect(x + 16, y + 8, 1, 34);
    ctx.fillRect(x + 32, y + 4, 1, 38);
    ctx.fillRect(x + 48, y + 8, 1, 34);
    // entrance (south face)
    ctx.fillStyle = '#2c2e30';
    ctx.fillRect(x + 24, y + 26, 16, 18);
    ctx.fillStyle = '#44464a';
    ctx.fillRect(x + 26, y + 28, 12, 16);
    // sandbags along the base
    ctx.fillStyle = '#b8a26b';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 2 + i * 5, y + 38, 4, 5);
      ctx.fillRect(x + 42 + i * 5, y + 38, 4, 5);
    }
    ctx.fillStyle = '#cbb67e';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 2 + i * 5, y + 38, 4, 2);
      ctx.fillRect(x + 42 + i * 5, y + 38, 4, 2);
    }
  }

  /* ---------------- smuggling run: vehicles & obstacles ---------------- */
  function drawTruckTop(ctx, x, y) {   // 16x24, pointing up (player pickup)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 1, y + 22, 15, 3);
    ctx.fillStyle = '#33291f';         // wheels
    ctx.fillRect(x, y + 3, 2, 5); ctx.fillRect(x + 14, y + 3, 2, 5);
    ctx.fillRect(x, y + 16, 2, 5); ctx.fillRect(x + 14, y + 16, 2, 5);
    ctx.fillStyle = '#8a4a3a';         // body
    ctx.fillRect(x + 1, y, 14, 24);
    ctx.fillStyle = '#6d3a2c';
    ctx.fillRect(x + 1, y, 1, 24); ctx.fillRect(x + 14, y, 1, 24);
    ctx.fillStyle = '#7fb6d9';         // windshield
    ctx.fillRect(x + 3, y + 4, 10, 4);
    ctx.fillStyle = '#a0563f';         // bed
    ctx.fillRect(x + 3, y + 11, 10, 11);
    ctx.fillStyle = '#5a3226';
    ctx.fillRect(x + 3, y + 11, 10, 1);
    ctx.fillStyle = '#e8d075';         // headlights
    ctx.fillRect(x + 2, y, 2, 1); ctx.fillRect(x + 12, y, 2, 1);
  }

  function drawJingleTruck(ctx, x, y) {   // 18x30, pointing down (oncoming, decorated)
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 1, y + 28, 17, 3);
    ctx.fillStyle = '#33291f';
    ctx.fillRect(x - 1, y + 4, 2, 6); ctx.fillRect(x + 17, y + 4, 2, 6);
    ctx.fillRect(x - 1, y + 20, 2, 6); ctx.fillRect(x + 17, y + 20, 2, 6);
    ctx.fillStyle = '#c96a4a';          // cargo box
    ctx.fillRect(x, y, 18, 20);
    ctx.fillStyle = '#e8d075';
    ctx.fillRect(x, y + 3, 18, 2);
    ctx.fillStyle = '#7fae5a';
    ctx.fillRect(x, y + 8, 18, 2);
    ctx.fillStyle = '#4a6ad8';
    ctx.fillRect(x, y + 13, 18, 2);
    ctx.fillStyle = '#a0563f';          // cab (facing viewer)
    ctx.fillRect(x + 2, y + 20, 14, 9);
    ctx.fillStyle = '#7fb6d9';
    ctx.fillRect(x + 4, y + 22, 10, 4);
    ctx.fillStyle = '#e8d075';          // tassels
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 1 + i * 3, y + 29, 1, 2);
  }

  function drawGoat(ctx, x, y) {   // 12x10
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x + 1, y + 9, 10, 2);
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(x + 2, y + 2, 8, 5);       // body
    ctx.fillRect(x + 9, y, 3, 4);           // head
    ctx.fillStyle = '#c9c0a8';
    ctx.fillRect(x + 3, y + 7, 1, 3); ctx.fillRect(x + 6, y + 7, 1, 3); ctx.fillRect(x + 8, y + 7, 1, 3);
    ctx.fillStyle = '#8a7a55';
    ctx.fillRect(x + 10, y - 1, 2, 1);      // horns
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 10, y + 1, 1, 1);      // eye
  }

  /* ---------------- side-view jet for the sortie minigame (24x12) ---------------- */
  function drawJetSide(ctx, x, y) {
    const g = '#9aa2aa', d = '#6a7178';
    ctx.fillStyle = d;                      // tail fin
    ctx.fillRect(x, y - 4, 4, 6);
    ctx.fillStyle = g;                      // fuselage
    ctx.fillRect(x + 1, y + 2, 19, 4);
    ctx.fillRect(x + 20, y + 3, 3, 2);      // nose
    ctx.fillStyle = d;                      // wing
    ctx.fillRect(x + 7, y + 5, 8, 2);
    ctx.fillStyle = '#7fb6d9';              // canopy
    ctx.fillRect(x + 13, y, 5, 3);
    ctx.fillStyle = '#ffb347';              // exhaust
    ctx.fillRect(x - 3, y + 3, 3, 2);
  }

  return {
    T, cv, rnd, PAL, charFrames, buildCharFrames, CHAR_H,
    polish, spriteCanvas,
    SEXES, HAIRS, OUTFITS, SHOES, HATS,
    tile, furn, item, drawTree, drawJet, drawJetSide, drawBunker,
    drawTruckTop, drawJingleTruck, drawGoat
  };
})();
