import { RPG_CHEST_EXTRA_CHANCE, RPG_CHEST_EXTRA_COST, RPG_CHEST_GUARANTEED_COST, RPG_DMG_UPGRADE_MAX, RPG_DMG_UPGRADE_STEP, RPG_EL, RPG_LIFE_UPGRADE_HP, RPG_LIFE_UPGRADE_MAX, RPG_META_KEY, RPG_POWERUP_ICONS, RPG_POWERUP_SHEET, RPG_TOTEM_COST, RPG_TOTEM_HEAL, RPG_TOTEM_INVULN_MS, RPG_UPGRADE_COST_STEP } from './rpg_config.js';

export function rpgMetaDefaults() {
  return {
    gold: 0,
    lifeLevel: 0,
    dmgLevel: 0,
    guaranteedFirstChest: false,
    extraChestChance: false,
    totem: false
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

export function rpgBuyTotem() {
  if (RPG_META.totem) return;
  if (RPG_META.gold < RPG_TOTEM_COST) return;
  RPG_META.gold -= RPG_TOTEM_COST;
  RPG_META.totem = true;
  rpgSaveMeta();
  rpgRenderMejoras();
}

// ─── Ícono de oro (sprite de monedas de power_up.webp) ─────
// En vez del emoji 🪙, cualquier lugar del HTML puede usar
// rpgGoldIconHtml() → <span class="rpg-gold-icon">. El sprite se recorta
// UNA vez a un data URL y se publica como variable CSS (--rpg-gold-icon),
// así todos los íconos (los que ya están en pantalla y los que se armen
// después por innerHTML) lo toman solos, sin re-recortar nada.
let rpgGoldIconState = 'idle'; // 'idle' | 'loading' | 'ready'

export function rpgGoldIconHtml() {
  rpgEnsureGoldIcon();
  return '<span class="rpg-gold-icon" aria-hidden="true"></span>';
}

export function rpgEnsureGoldIcon() {
  if (rpgGoldIconState !== 'idle') return;
  rpgGoldIconState = 'loading';

  // Estilo del ícono (inyectado acá para no depender de rpg.css).
  if (!document.getElementById('rpgGoldIconStyle')) {
    const st = document.createElement('style');
    st.id = 'rpgGoldIconStyle';
    st.textContent =
      '.rpg-gold-icon{display:inline-block;width:1.2em;height:1.2em;' +
      'margin-right:0.25em;vertical-align:-0.25em;' +
      'background:var(--rpg-gold-icon,none) center/contain no-repeat;}';
    document.head.appendChild(st);
  }

  if (typeof Engine2D === 'undefined') { rpgGoldIconState = 'idle'; return; }
  Engine2D.loadImage(RPG_POWERUP_SHEET).then(img => {
    const rect = RPG_POWERUP_ICONS.coins;
    const h = 48;
    const w = Math.max(1, Math.round(h * (rect.w / rect.h)));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cctx = c.getContext('2d');
    cctx.imageSmoothingEnabled = true; // achica mucho: sin suavizado queda ruidoso
    cctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
    document.documentElement.style.setProperty('--rpg-gold-icon', 'url("' + c.toDataURL() + '")');
    rpgGoldIconState = 'ready';
  }).catch(() => {
    rpgGoldIconState = 'idle'; // se reintenta la próxima vez que se abra la tienda
  });
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
  if (goldEl) goldEl.innerHTML = rpgGoldIconHtml() + RPG_META.gold;
  const gold = rpgGoldIconHtml();

  const wrap = RPG_EL.mejorasList;
  if (!wrap) return;

  const rows = [];

  const lifeMaxed = RPG_META.lifeLevel >= RPG_LIFE_UPGRADE_MAX;
  const lifeCost = lifeMaxed ? null : rpgUpgradeCost(RPG_META.lifeLevel + 1);
  rows.push(rpgMejoraRowHtml({
    title: '❤️ Vida máxima',
    desc: 'Nivel ' + RPG_META.lifeLevel + '/' + RPG_LIFE_UPGRADE_MAX + ' · +' + RPG_LIFE_UPGRADE_HP + ' HP máx. por nivel',
    costLabel: lifeMaxed ? 'Al máximo' : (gold + lifeCost),
    disabled: lifeMaxed || RPG_META.gold < lifeCost,
    onclick: 'rpgBuyLifeUpgrade()',
    btnLabel: lifeMaxed ? 'Máximo' : 'Mejorar'
  }));

  const dmgMaxed = RPG_META.dmgLevel >= RPG_DMG_UPGRADE_MAX;
  const dmgCost = dmgMaxed ? null : rpgUpgradeCost(RPG_META.dmgLevel + 1);
  rows.push(rpgMejoraRowHtml({
    title: '💥 Daño',
    desc: 'Nivel ' + RPG_META.dmgLevel + '/' + RPG_DMG_UPGRADE_MAX + ' · +' + RPG_DMG_UPGRADE_STEP + ' daño por nivel',
    costLabel: dmgMaxed ? 'Al máximo' : (gold + dmgCost),
    disabled: dmgMaxed || RPG_META.gold < dmgCost,
    onclick: 'rpgBuyDmgUpgrade()',
    btnLabel: dmgMaxed ? 'Máximo' : 'Mejorar'
  }));

  rows.push(rpgMejoraRowHtml({
    title: '✨ Cofre inicial garantizado',
    desc: 'El primer cofre del Capítulo 1 (habitación 1) sale siempre de oro.',
    costLabel: RPG_META.guaranteedFirstChest ? 'Comprado' : (gold + RPG_CHEST_GUARANTEED_COST),
    disabled: RPG_META.guaranteedFirstChest || RPG_META.gold < RPG_CHEST_GUARANTEED_COST,
    onclick: 'rpgBuyGuaranteedChest()',
    btnLabel: RPG_META.guaranteedFirstChest ? 'Comprado' : 'Comprar'
  }));

  rows.push(rpgMejoraRowHtml({
    title: '🍀 Suerte del cofre',
    desc: Math.round(RPG_CHEST_EXTRA_CHANCE * 100) + '% de chance de una recompensa extra en cada cofre.',
    costLabel: RPG_META.extraChestChance ? 'Comprado' : (gold + RPG_CHEST_EXTRA_COST),
    disabled: RPG_META.extraChestChance || RPG_META.gold < RPG_CHEST_EXTRA_COST,
    onclick: 'rpgBuyExtraChestChance()',
    btnLabel: RPG_META.extraChestChance ? 'Comprado' : 'Comprar'
  }));

  rows.push(rpgMejoraRowHtml({
    title: '🗿 Tótem',
    desc: 'Si un golpe te iba a matar, volvés con ' + RPG_TOTEM_HEAL + ' HP y sos inmune ' +
      Math.round(RPG_TOTEM_INVULN_MS / 1000) + ' seg. Una vez por capítulo.',
    costLabel: RPG_META.totem ? 'Comprado' : (gold + RPG_TOTEM_COST),
    disabled: RPG_META.totem || RPG_META.gold < RPG_TOTEM_COST,
    onclick: 'rpgBuyTotem()',
    btnLabel: RPG_META.totem ? 'Comprado' : 'Comprar'
  }));

  wrap.innerHTML = rows.join('');
}

