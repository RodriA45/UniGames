import { RPG_CHEST_EXTRA_CHANCE, RPG_CHEST_EXTRA_COST, RPG_CHEST_GUARANTEED_COST, RPG_DMG_UPGRADE_MAX, RPG_DMG_UPGRADE_STEP, RPG_EL, RPG_LIFE_UPGRADE_HP, RPG_LIFE_UPGRADE_MAX, RPG_META_KEY, RPG_UPGRADE_COST_STEP } from './rpg_config.js';

export function rpgMetaDefaults() {
  return {
    gold: 0,
    lifeLevel: 0,
    dmgLevel: 0,
    guaranteedFirstChest: false,
    extraChestChance: false
  };
}

export function rpgLoadMeta() {
  try {
    const raw = localStorage.getItem(RPG_META_KEY);
    if (!raw) return rpgMetaDefaults();
    const data = JSON.parse(raw);
    return Object.assign(rpgMetaDefaults(), data);
  } catch {
    return rpgMetaDefaults();
  }
}

export function rpgSaveMeta() {
  try { localStorage.setItem(RPG_META_KEY, JSON.stringify(RPG_META)); } catch {}
}

export let RPG_META = rpgLoadMeta();

// Costo del nivel `level` (1-indexado): nivel 1 = 50, nivel 2 = 100, etc.
export function rpgUpgradeCost(level) {
  return level * RPG_UPGRADE_COST_STEP;
}

export function rpgAddMetaGold(amount) {
  RPG_META.gold += amount;
  rpgSaveMeta();
}

export function rpgBuyLifeUpgrade() {
  if (RPG_META.lifeLevel >= RPG_LIFE_UPGRADE_MAX) return;
  const cost = rpgUpgradeCost(RPG_META.lifeLevel + 1);
  if (RPG_META.gold < cost) return;
  RPG_META.gold -= cost;
  RPG_META.lifeLevel += 1;
  rpgSaveMeta();
  rpgRenderMejoras();
}

export function rpgBuyDmgUpgrade() {
  if (RPG_META.dmgLevel >= RPG_DMG_UPGRADE_MAX) return;
  const cost = rpgUpgradeCost(RPG_META.dmgLevel + 1);
  if (RPG_META.gold < cost) return;
  RPG_META.gold -= cost;
  RPG_META.dmgLevel += 1;
  rpgSaveMeta();
  rpgRenderMejoras();
}

export function rpgBuyGuaranteedChest() {
  if (RPG_META.guaranteedFirstChest) return;
  if (RPG_META.gold < RPG_CHEST_GUARANTEED_COST) return;
  RPG_META.gold -= RPG_CHEST_GUARANTEED_COST;
  RPG_META.guaranteedFirstChest = true;
  rpgSaveMeta();
  rpgRenderMejoras();
}

export function rpgBuyExtraChestChance() {
  if (RPG_META.extraChestChance) return;
  if (RPG_META.gold < RPG_CHEST_EXTRA_COST) return;
  RPG_META.gold -= RPG_CHEST_EXTRA_COST;
  RPG_META.extraChestChance = true;
  rpgSaveMeta();
  rpgRenderMejoras();
}

// ─── Vista "Mejoras" del menú ─────
export function rpgMejoraRowHtml(opts) {
  return '<div class="rpg-mejora-row">'
    + '<div class="rpg-mejora-info">'
    + '<p class="rpg-mejora-title">' + opts.title + '</p>'
    + '<p class="rpg-mejora-desc">' + opts.desc + '</p>'
    + '</div>'
    + '<div class="rpg-mejora-buy">'
    + '<span class="rpg-mejora-cost">' + opts.costLabel + '</span>'
    + '<button class="btn-play rpg-mejora-btn" ' + (opts.disabled ? 'disabled' : '') + ' onclick="' + opts.onclick + '">' + opts.btnLabel + '</button>'
    + '</div>'
    + '</div>';
}

export function rpgRenderMejoras() {
  const goldEl = RPG_EL.mejorasGold;
  if (goldEl) goldEl.textContent = RPG_META.gold;

  const wrap = RPG_EL.mejorasList;
  if (!wrap) return;

  const rows = [];

  const lifeMaxed = RPG_META.lifeLevel >= RPG_LIFE_UPGRADE_MAX;
  const lifeCost = lifeMaxed ? null : rpgUpgradeCost(RPG_META.lifeLevel + 1);
  rows.push(rpgMejoraRowHtml({
    title: '❤️ Vida máxima',
    desc: 'Nivel ' + RPG_META.lifeLevel + '/' + RPG_LIFE_UPGRADE_MAX + ' · +' + RPG_LIFE_UPGRADE_HP + ' HP máx. por nivel',
    costLabel: lifeMaxed ? 'Al máximo' : ('🪙 ' + lifeCost),
    disabled: lifeMaxed || RPG_META.gold < lifeCost,
    onclick: 'rpgBuyLifeUpgrade()',
    btnLabel: lifeMaxed ? 'Máximo' : 'Mejorar'
  }));

  const dmgMaxed = RPG_META.dmgLevel >= RPG_DMG_UPGRADE_MAX;
  const dmgCost = dmgMaxed ? null : rpgUpgradeCost(RPG_META.dmgLevel + 1);
  rows.push(rpgMejoraRowHtml({
    title: '💥 Daño',
    desc: 'Nivel ' + RPG_META.dmgLevel + '/' + RPG_DMG_UPGRADE_MAX + ' · +' + RPG_DMG_UPGRADE_STEP + ' daño por nivel',
    costLabel: dmgMaxed ? 'Al máximo' : ('🪙 ' + dmgCost),
    disabled: dmgMaxed || RPG_META.gold < dmgCost,
    onclick: 'rpgBuyDmgUpgrade()',
    btnLabel: dmgMaxed ? 'Máximo' : 'Mejorar'
  }));

  rows.push(rpgMejoraRowHtml({
    title: '✨ Cofre inicial garantizado',
    desc: 'El primer cofre del Capítulo 1 (habitación 1) sale siempre de oro.',
    costLabel: RPG_META.guaranteedFirstChest ? 'Comprado' : ('🪙 ' + RPG_CHEST_GUARANTEED_COST),
    disabled: RPG_META.guaranteedFirstChest || RPG_META.gold < RPG_CHEST_GUARANTEED_COST,
    onclick: 'rpgBuyGuaranteedChest()',
    btnLabel: RPG_META.guaranteedFirstChest ? 'Comprado' : 'Comprar'
  }));

  rows.push(rpgMejoraRowHtml({
    title: '🍀 Suerte del cofre',
    desc: Math.round(RPG_CHEST_EXTRA_CHANCE * 100) + '% de chance de una recompensa extra en cada cofre.',
    costLabel: RPG_META.extraChestChance ? 'Comprado' : ('🪙 ' + RPG_CHEST_EXTRA_COST),
    disabled: RPG_META.extraChestChance || RPG_META.gold < RPG_CHEST_EXTRA_COST,
    onclick: 'rpgBuyExtraChestChance()',
    btnLabel: RPG_META.extraChestChance ? 'Comprado' : 'Comprar'
  }));

  wrap.innerHTML = rows.join('');
}

