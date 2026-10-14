/**
 * CoC7 Damage Immunity Module
 * ===========================
 * Nullifies damage and blocks downstream wound effects + con-check
 * for actors carrying a "Damage Immunity: <skill>" item effect.
 *
 * HOW TO CONFIGURE:
 *   Give an NPC an item with an Active Effect named e.g.:
 *     "Damage Immunity: firearms"
 *     "Damage Immunity: firearms, fighting, melee"
 *
 * DEBUG: run  CONFIG.coc7immunity = true  in the browser console.
 */

const EFFECT_PREFIX = "damage immunity:";

// Tracks actors currently being damage-nullified, with a short TTL
// so we don't accidentally block unrelated effects
const immuneActors = new Map(); // actorUuid → timestamp

function getImmunities(actor) {
  if (!actor) return [];
  const patterns = [];
  for (const item of actor.items ?? []) {
    for (const effect of item.effects ?? []) {
      if (effect.disabled) continue;
      const name = (effect.name ?? "").toLowerCase().trim();
      if (!name.startsWith(EFFECT_PREFIX)) continue;
      name.slice(EFFECT_PREFIX.length)
        .split(",").map(s => s.trim()).filter(Boolean)
        .forEach(s => patterns.push(s));
    }
  }
  for (const effect of actor.effects ?? []) {
    if (effect.disabled) continue;
    const name = (effect.name ?? "").toLowerCase().trim();
    if (!name.startsWith(EFFECT_PREFIX)) continue;
    name.slice(EFFECT_PREFIX.length)
      .split(",").map(s => s.trim()).filter(Boolean)
      .forEach(s => patterns.push(s));
  }
  return [...new Set(patterns)];
}

function isBlocked(skillName, immunities) {
  if (!skillName || !immunities.length) return false;
  const lower = skillName.toLowerCase();
  return immunities.some(p => lower.includes(p));
}

function findPendingCombatSkill(actorUuid) {
  const messages = game.messages.contents;
  for (let i = messages.length - 1; i >= 0; i--) {
    const load = messages[i].flags?.CoC7?.load;
    if (!load?.damageRolled || load?.damageDealt) continue;
    const shot = (load.shots ?? []).find(s => s.targetUuid === actorUuid);
    if (!shot) continue;
    return shot.skillName ?? null;
  }
  return null;
}

function isActorImmune(actorUuid) {
  const ts = immuneActors.get(actorUuid);
  if (!ts) return false;
  // TTL of 5 seconds — plenty for the async chain to complete
  if (Date.now() - ts > 5000) {
    immuneActors.delete(actorUuid);
    return false;
  }
  return true;
}

// ── 1. Nullify the HP change ────────────────────────────────────────────────

Hooks.on("preUpdateActor", (actor, changes) => {
  const newHp = foundry.utils.getProperty(changes, "system.attribs.hp.value");
  if (newHp === undefined) return;
  const currentHp = actor.system?.attribs?.hp?.value ?? 0;
  if (newHp >= currentHp) return;

  const immunities = getImmunities(actor);
  if (!immunities.length) return;

  const skillName = findPendingCombatSkill(actor.uuid);

  if (CONFIG.coc7immunity) {
    console.log(`[CoC7 Immunity] HP drop "${actor.name}": ${currentHp}→${newHp}, skill: ${skillName}, immunities: [${immunities}]`);
  }

  if (!skillName || !isBlocked(skillName, immunities)) return;

  // Zero out the damage by keeping HP at current value
  foundry.utils.setProperty(changes, "system.attribs.hp.value", currentHp);

  // Flag this actor as immune for the next 5 seconds
  immuneActors.set(actor.uuid, Date.now());

  if (game.user.isGM) {
    ui.notifications.info(`${actor.name}: immune to "${skillName}" — damage nullified.`);
  }

  if (CONFIG.coc7immunity) {
    console.log(`[CoC7 Immunity] HP overridden to ${currentHp}, actor flagged for 5s`);
  }
});

// ── 2. Block wound/prone/dying effects on immune actors ─────────────────────

// CoC7 wound statuses — block these, not general effects like Bless
const COC7_WOUND_STATUSES = new Set([
  "dying", "dead", "unconscious", "prone", "majorWound", "bleeding",
  "indefInsane", "tempoInsane", "criticalWound"
]);

Hooks.on("preCreateActiveEffect", (effect, data, options, userId) => {
  // Find which actor this effect is being added to
  const parent = effect.parent;
  if (!parent) return;

  const actorUuid = parent.uuid ?? parent.actor?.uuid;
  if (!actorUuid || !isActorImmune(actorUuid)) return;

  // Only block CoC7 wound/status effects, not arbitrary effects
  const statusId = data.statuses?.[0] ?? effect.statuses?.first() ?? "";
  const effectName = (data.name ?? effect.name ?? "").toLowerCase();

  const isWoundEffect =
    COC7_WOUND_STATUSES.has(statusId) ||
    [...COC7_WOUND_STATUSES].some(s => effectName.includes(s.toLowerCase()));

  if (!isWoundEffect) return;

  if (CONFIG.coc7immunity) {
    console.log(`[CoC7 Immunity] Blocked wound effect "${data.name ?? effect.name}" on ${parent.name}`);
  }

  return false; // Cancel the effect creation
});

// ── 3. Block the con-check chat message on immune actors ────────────────────

Hooks.on("preCreateChatMessage", (msg, data, options, userId) => {
  const load = data?.flags?.CoC7?.load ?? msg.flags?.CoC7?.load;
  if (load?.as !== "CoC7ConCheck") return;

  const actorUuid = load?.actorUuid;
  if (!actorUuid || !isActorImmune(actorUuid)) return;

  if (CONFIG.coc7immunity) {
    console.log(`[CoC7 Immunity] Blocked con-check for ${actorUuid}`);
  }

  return false; // Cancel the con-check message
});

console.log("[CoC7 Damage Immunity] Loaded — nullifies damage, wounds, and con-checks.");
