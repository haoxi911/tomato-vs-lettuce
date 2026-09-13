# Tomato Kingdom vs Lettuce Kingdom — The Game

A first-person shooter built from William's five-scene war story. You play **Tom**, the soldier with the yellow scarf — and the story's twist is yours to live through.

Open `index.html` from any static web server (it uses ES modules, so a plain `file://` open won't work):

```bash
python3 -m http.server 8080      # then http://localhost:8080
```

No build step. Three.js is vendored under `vendor/`, so the game runs offline.

## How it plays

| Scene | Level | You have to… |
|---|---|---|
| 1 · Two Kingdoms, One Sky | field | shoot down drones and the helicopter — and follow orders: fire at the Lettuce wall |
| 2 · First Missile | field | shoot incoming missiles out of the sky before they hit the roof gun; stop the drone-dropped soldiers |
| 3 · The Counterstrike | field | destroy the two laser guns on the Lettuce roof — step out of the sight line when it locks, take cover, or raise the shield |
| 4 · The Tomato Bomb | *cutscene* | Tom is exposed, hung upside down, and watches the bomb land. Then: Tom's Choice. |
| 4 · Across the Field | crater | with Ryley, destroy the machines that rose from the ground and reach the silo hatch |
| 5 · Shut It Down | underground | get past the one guard who still has his wits, shoot the launcher console, put out the fire with the CO₂ bottle, then ride the bottle up the vent |

Keys: **WASD** move · mouse look · click shoot · **R** reload · **1**/**2** weapons · **F** shield / rifle · **H** med kit · **Shift** run · **Space** jump · **E** use · **Esc** pause. Cutscenes can be skipped with the button or **Esc**.

Health regenerates after a few seconds without damage. **H** uses Tom's own med kit (+45, then a 10-second restock), and red health boxes on the field heal on the spot. The shield (**F**) blocks the laser and most bullets from the front, but you cannot shoot while it is up. Going down restarts the current scene. Progress is saved in the browser, so the title screen offers **Continue**.

## Battle mode

The title screen also has **BATTLE**: one open fight on the field with everything at once, and a **rank** that is saved in the browser and grows every battle.

1. Clear every Lettuce soldier and every aircraft (drones, the helicopter, two jets). Keep **our generator** running — if their bombs take it out there is no missile and no jet until you repair it (hold **E** beside it). Their generator works the same way: shoot it and they lose their jets and missiles for a while.
2. The silo missile (**E** at the red button by our silo) recharges every 3 minutes. The **nuke** does not: it is one shot, and the silo only accepts it once the field is clear. It flattens the Lettuce base.
3. Under their silo is a hatch. From rank 10 you carry **C4**: plant it, run, drop in.
4. Underground the guards are armed and awake. The one in the glass box can only be hit when he steps out. Find the reactor panel on B2, cross the wrong wires, short-circuit the reactor, put the fire out with the CO₂ and ride it up the vent.

| Rank | Unlock |
|---|---|
| 1 | ground soldier: rifle, shield, silo missile, the nuke |
| 5 | **parachute** — the yellow pad by our base lifts you up for a drop anywhere on the field (roofs included) |
| 10 | **jet** — take off from the red pad, fly where you look, click for rockets, Shift to boost; and **C4** for the hatch |
| 20 | **spy** — **G** puts on a Lettuce uniform; they ignore you until you shoot or get within arm's reach |

XP comes from everything you knock down. Dying costs nothing but the restart.

## Super points and the supply depot

Finishing the story, or winning a battle all the way through, earns one **super point**. The **SUPPLY DEPOT** on the title screen spends them: a **rocket launcher** or a **laser rifle** as a second weapon (**2** to switch, **1** for the rifle), or a new character to play as — **Ryley** (tougher, faster) or **the Tomato King** (an unbreakable shield and a royal med kit).

## What's in here

```
index.html          HUD, menus, subtitles
src/main.js         game flow: title → intro → scenes 1-3 → scene 4 cutscene → scenes 4-5 → ending
src/engine.js       renderer, first-person controller, hitscan shooting, effects, HUD helpers
src/art.js          procedural low-poly models in the storybook palette (bases, silos, missiles, drones, soldiers…)
src/actors.js       enemies and friends: drones, paratroopers, the helicopter, laser pods, rocket pods, irradiated guards, Ryley
src/field.js        the battlefield shared by scenes 1-4
src/levels.js       the five levels, the scene-4 cutscene and the ending
src/battle.js       battle mode: rank/XP, the open field fight, the underground finale
src/cutscenes.js    a small director: camera moves, subtitles, narration, skip
src/cues.js         subtitle timings for William's narration
src/audio.js        synthesised sound effects + narration playback
audio/              William reading the story, one clip per chapter
vendor/             three.js
```

## Credits

Story, drawings and narration by William. Game by his dad, with Claude. Art direction follows the [storybook](https://github.com/haoxi911/tomato-vs-lettuce) built from the same drawings.
