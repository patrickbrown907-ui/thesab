'use strict';
/* ============================================================
   ASSETS — generated sprite sheets (PixelLab), optional layer.
   If a sheet is missing or fails to load, the game keeps the
   code-generated art from sprites.js.
   player.png: 4x4 grid of 16x32 cells, rows down/up/left/right,
   cols = walk frames [neutral, step, neutral, step].
   ============================================================ */
const ASSETS = (() => {
  const A = { playerM: null, playerF: null, npc: {}, onReady: [] };
  // frames for a creator cfg: female sheet when sex=1 (male sheet as fallback)
  A.playerFor = cfg => (cfg && cfg.sex === 1 && A.playerF) || A.playerM;

  function slice(img, fw, fh, dirs) {
    const out = {};
    dirs.forEach((d, r) => {
      out[d] = [];
      for (let c = 0; c < 4; c++) {
        const cv = document.createElement('canvas');
        cv.width = fw; cv.height = fh;
        cv.getContext('2d').drawImage(img, c * fw, r * fh, fw, fh, 0, 0, fw, fh);
        out[d].push(cv);
      }
    });
    return out;
  }

  const img = new Image();
  img.onload = () => {
    // cell size derives from the sheet: 4 cols (frames) x 4 rows (dirs)
    A.playerM = slice(img, img.width / 4, img.height / 4, ['down', 'up', 'left', 'right']);
    A.onReady.forEach(fn => fn());
  };
  img.src = 'assets/player.png';
  const imgF = new Image();
  imgF.onload = () => {
    A.playerF = slice(imgF, imgF.width / 4, imgF.height / 4, ['down', 'up', 'left', 'right']);
    A.onReady.forEach(fn => fn());
  };
  imgF.src = 'assets/player-f.png';

  // tile strips: a vertical stack of 16x16 variants per tile id; SPR.tile
  // prefers these over the procedural draws. Edit the PNGs in LibreSprite.
  A.tiles = {};
  const TILE_SHEETS = {
    floor: 'assets/tiles/floor.png',
    iwall: 'assets/tiles/iwall.png',
    door_in: 'assets/tiles/door_in.png',
    sand: 'assets/tiles/sand.png',
    tarmac: 'assets/tiles/tarmac.png'
  };
  Object.keys(TILE_SHEETS).forEach(id => {
    const ti = new Image();
    ti.onload = () => {
      const out = [];
      for (let y = 0; y < ti.height; y += 16) {
        const cv = document.createElement('canvas');
        cv.width = 16; cv.height = 16;
        cv.getContext('2d').drawImage(ti, 0, y, 16, 16, 0, 0, 16, 16);
        out.push(cv);
      }
      A.tiles[id] = out;
      A.onReady.forEach(fn => fn());
    };
    ti.src = TILE_SHEETS[id];
  });

  // furniture PNGs (any size, drawn at the tile's top-left); edit in LibreSprite
  A.furn = {};
  const FURN_PNGS = ['couch', 'tv', 'cot', 'foosball', 'cooler', 'locker',
                     'mapboard', 'table', 'servline', 'bed', 'rug', 'machine'];
  FURN_PNGS.forEach(id => {
    const fi = new Image();
    fi.onload = () => { A.furn[id] = fi; A.onReady.forEach(fn => fn()); };
    fi.onerror = () => {};          // missing piece: procedural art remains
    fi.src = 'assets/furn/' + id + '.png';
  });

  // hammer tool: 2 stacked 16x16 frames (raised, strike), right-facing
  const hi = new Image();
  hi.onload = () => {
    const out = [];
    for (let y = 0; y < 32; y += 16) {
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      cv.getContext('2d').drawImage(hi, 0, y, 16, 16, 0, 0, 16, 16);
      out.push(cv);
    }
    A.hammer = out;
  };
  hi.src = 'assets/hammer.png';

  // NPC stand sheets: one row of 4 cells (down/up/left/right), used as frames[dir][0]
  const NPC_SHEETS = {
    cook: 'assets/npc/cook.png',
    hard: 'assets/npc/hard.png',
    officer: 'assets/npc/rhino.png',
    chief: 'assets/npc/chief.png',
    doc: 'assets/npc/doc.png',
    croc: 'assets/npc/croc.png'
  };
  Object.keys(NPC_SHEETS).forEach(pal => {
    const ni = new Image();
    ni.onload = () => {
      const fw = ni.width / 4, out = {};
      ['down', 'up', 'left', 'right'].forEach((d, c) => {
        const cv = document.createElement('canvas');
        cv.width = fw; cv.height = ni.height;
        cv.getContext('2d').drawImage(ni, c * fw, 0, fw, ni.height, 0, 0, fw, ni.height);
        out[d] = [cv];
      });
      A.npc[pal] = out;
    };
    ni.src = NPC_SHEETS[pal];
  });
  return A;
})();
