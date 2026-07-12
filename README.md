# THE SANDBOX — A Deployed Fighter Pilot RPG

A retro pixel-art RPG in the style of Game Boy Pokemon / Stardew Valley.
You're **"Viper"**, a fighter pilot on a 14-day rotation at Camp Sidewinder,
somewhere in the Middle East. Fly your sorties — but keep your **Health**,
**Spirit**, and **Energy** up, or the deployment will chew you up first.

## How to play

Just open `index.html` in any modern browser (double-click it). No install,
no build step, no internet needed.

### Multiple players / multiple characters

Press ENTER at the title to open the **PILOT ROSTER**. Each pilot is its own
save (callsign, day, and crew position shown); pick one to continue, choose
**+ NEW PILOT** to create another, or highlight one and press **X** twice to
retire it. Everyone who plays on the same computer keeps their own character
here. When a deployment is completed (or a pilot is MEDEVAC'd out), that pilot
rotates off the roster.

### Playing on GitHub (hosting)

The whole game is static files (HTML/JS/CSS), so the simplest way to let
people play is **GitHub Pages**: push the repo, then in the repo's
Settings → Pages, set the source to your `main` branch / root. GitHub gives
you a public `https://<user>.github.io/<repo>/` link that anyone can open —
no server, no build. Because saves live in each visitor's own browser
(`localStorage`), every person on their own device automatically gets their
own separate characters; the roster above handles multiple characters on a
shared device. (Saves don't follow you between devices — that would require a
backend with accounts, which this game deliberately avoids.)

### Build your pilot

Choosing **+ NEW PILOT** opens the **PILOT RECORD** screen: pick a callsign (used in all
dialog), crew position (**Pilot or WSO**), male or female, hair color
(black/brown/blonde/red/gray), clothes
(tan flight suit, or quarter zip / white tee / hoodie worn with gray
sweatpants), shoes (boots/sneakers/crocs), and hat (none/black watchcap
beanie/cowboy hat) — with a live animated preview. Navigate with arrows,
change options with left/right or the ◀ ▶ buttons, Enter to deploy.

### Controls

| Key | Action |
| --- | --- |
| Arrow keys / WASD | Move |
| E / Space / Enter | Interact, advance dialog |
| Up/Down + E | Pick a choice |
| Space (in flight) | Pop flares |
| 1-9 / 0 | Select hotbar slot |
| F | Use selected item |

### The daily loop

1. **OPS building** — get your mission brief from RHINO.
2. **DFAC** — eat before you fly (hunger silently drains health if ignored).
3. **Flight line** — board your jet and fly the sortie: dodge SAMs for 25
   seconds, pop flares when you're cornered. Needs 35+ energy, and **one
   sortie per day** (crew rest). Every **20 sorties earns an Air Medal**
   (+Spirit, shown in the HUD).
4. **Ground duty** — some mornings (~30%) you're assigned **Ops Supervisor**
   (the OPS desk) or **Vault Officer** (the vault in OPS). The 4-hour shift
   drains Spirit and Energy, and you can't fly until it's done.
5. **Gym** — treadmill and weights raise Health.
6. **MWR shack** — TV and foosball raise Spirit. Cots work in a pinch.
7. **Your RLB** — the housing row on the east side of base. Your own room:
   nap for an hour (+Energy), sleep until morning, or look at the photos from
   home in your wall locker (+Spirit, once a day). Two neighbor RLBs and a
   concrete bunker round out the communal living area.
7. **Laundry / Latrine** — small Spirit boosts to keep morale off the floor.
8. **Clinic** — Doc Kessler issues **5 go pills and 5 no-go pills per 7-day
   week**. Go pills: +Energy +Spirit, -Health. No-go pills: +Health +Spirit,
   -Energy — best taken near a cot.

### Inventory

A Stardew-style 12-slot hotbar sits at the bottom of the screen. Items stack
(x9); select with `1-9`/`0` or by clicking, then press `F` (or click the
selected slot) to use. Sources: pills at the clinic, Rip-Its/Gatorade/water
at the DFAC cooler, an MRE to-go from the chow line (1/day), sunflower seeds
from your OPS locker (1/day), cigarettes from the crew chief (3/day), and
beer or red wine from the MWR fridge (two-drink limit per day). A few items
also spawn around the base every morning — walk over them to pick them up.

Time passes as you play; if you're still awake at midnight you pass out with
penalties. Health hitting zero = MEDEVAC (game over). Survive the 180-day
rotation to complete the deployment — but watch out: when your rotation date
arrives, there's always a chance of an extension. Progress saves
automatically when you sleep.

### Quests: Operation MAKE MWR GREAT

HARD, a fellow fighter pilot at the MWR shack, wants to turn the dump into
the best MWR in the AOR. Talk to him to start the couch quest; finishing it
unlocks the **build board** with six more projects: computer corner, bar,
kitchen, movie area, front deck, and fire pit. Each build changes the map
and adds a new activity (video calls home, movie nights, cooking, fire pit
hangs after 1900). Finish all 7 and squadron morale becomes unbreakable —
Spirit drains half as fast.

Materials go in your hotbar (stacks of 50): **wood** from pallet stacks,
**scrap** from junk piles — both respawn daily — and **electronics/cables**
from the supply conex, avionics cart, and OPS comm rack... which is stealing,
with a 35% chance the First Sergeant catches you.

### Smuggling runs

Once the build board is open, HARD offers "supply runs" off base: drive the
borrowed pickup down a scrolling desert road (dodge potholes, goats, and
jingle trucks — 3 hits and the truck dies), pick two loads at the roadside
market (cigarettes, beer, whiskey, goat kebabs), then drive back — collisions
on the return leg smash cargo. At the gate, HARD's buddy sometimes waves you
through; otherwise play it cool: hit SPACE in the green zone twice. Deliver
the haul for +Spirit, **Squadron Morale +8**, and a personal share. Get
caught: everything confiscated, morale down, HARD lays low for 3 days.

### Squadron Morale

The green SQDN bar is a squadron-wide quest goal. It rises with smuggling
runs, MWR builds, sorties, and Air Medals — and drops hard (-25) when the
deployment gets extended. At 70+ your Spirit drains half as fast; below 30 it
drains faster. But watch out at 100: the higher-ups notice the squadron
having *too much* fun, and the **fun police** strike — the Group Commander or
a base agency invents a reason (shave your mustache, uniforms in regs at all
times, mandatory 0500 formation run) and knocks morale back down. Push it to
100 again and they'll find a new one. The victory screen counts how many
crackdowns you survived.

### Alarm Red

Some days (~20%) rockets come in: sirens, red flashing, and a countdown.
Sprint to the **bunker by the RLBs** and shelter with the squadron (+Spirit);
get caught in the open and you take real damage. No flying or sleeping until
the all-clear.

## Files

- `index.html` — page shell, HUD and dialog DOM
- `css/style.css` — retro UI styling
- `js/sprites.js` — all pixel art, generated in code (characters, tiles, furniture, jets)
- `js/maps.js` — the base exterior + six building interiors
- `js/game.js` — engine: movement, time/stats, dialog, actions, flight minigame, save/load
