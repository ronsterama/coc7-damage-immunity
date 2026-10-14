# CoC7 Damage Immunity Module

A Foundry VTT v14 module for the CoC7 system that blocks damage by skill type
per-actor, controlled entirely by Active Effects.

## Installation

1. In Foundry's **Add-on Modules → Install Module**, paste this manifest URL
   and click **Install**:
   `https://github.com/ronsterama/coc7-damage-immunity/releases/latest/download/module.json`
2. In Foundry: **Settings → Manage Modules → enable "CoC7 Damage Immunity"**

Updates then appear under **Check for Update**.

## How to Mark an Actor as Immune

Open the actor sheet → **Effects tab** → **+ Add Effect**.

Set the **effect name** to:

```
Damage Immunity: firearms
```

That's it. No attribute key, no change mode — just the name.

### Multiple Immunities

Comma-separate skill name substrings in the same effect:

```
Damage Immunity: firearms, fighting, melee
```

Or add multiple separate effects if you prefer to toggle them individually:

```
Damage Immunity: firearms
Damage Immunity: fighting (brawl)
```

### How Matching Works

The module matches **case-insensitively** on skill name substrings. So:

| Effect value   | Blocks skill named...                              |
|----------------|----------------------------------------------------|
| `firearms`     | Firearms (Handgun), Firearms (Rifle), etc.         |
| `fighting`     | Fighting (Brawl), Fighting (Sword), etc.           |
| `handgun`      | Firearms (Handgun) only                            |
| `rifle`        | Firearms (Rifle/Shotgun) only                      |
| `fighting (brawl)` | Fighting (Brawl) only (exact substring)        |

### Disabling Temporarily

Tick **Disabled** on the Active Effect to suspend immunity without deleting it.

## Debugging

Open the browser console (F12) in Foundry and run:

```js
CONFIG.coc7immunity = true;
```

Every damage interception attempt will now log to the console with full details
of the skill name extracted, the target actor, and whether it was blocked.

To turn logging off:
```js
CONFIG.coc7immunity = false;
```

## Verifying Your Chat Card Flags

If blocking doesn't work, run this after a combat attack to inspect what CoC7
actually puts in its chat cards:

```js
game.messages.contents.slice(-5).forEach(m =>
  console.log("FLAGS:", m.flags, "\nCONTENT:", m.content.substring(0, 300))
);
```

The module reads `flags.CoC7.skillName` (and several fallbacks). If your version
of CoC7 uses a different key, the content is logged and can be used to update
the `extractSkillFromMessage` function in `immunity.js`.

## Caveats

- Works by intercepting the "Apply Damage" button click on CoC7 chat cards.
- Only runs on the GM client to prevent double-execution.
- If CoC7 is configured to **auto-apply** damage without a button click, the
  fallback `preUpdateActor` hook fires — it will log a warning but cannot block
  (skill context is lost at that point).
- Tested against CoC7 7.x / Foundry v14. Chat card structure may differ in
  major version updates.
