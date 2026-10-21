// ══════════════════════════════════════
//   RPG Pixel — rpg_meta.js  (módulo ES6)
// ══════════════════════════════════════
// Clase RpgMejoras: Progreso permanente (oro y mejoras de la tienda) persistido en localStorage.
import { RpgModulo } from './rpg_modulo.js';
import { RpgConfig } from './rpg_config.js';
import { juego } from './rpg_juego.js';

export class RpgMejoras extends RpgModulo {
  constructor() {
    super();
    // El oro y las mejoras son por usuario: se cargan recién al usarlos
    // (ver el getter meta), no acá. Al crear este módulo todavía no existe
    // `juego` ni se sabe qué cuenta va a jugar.
    this._meta = null;
    this._metaClave = null; // de qué clave (usuario) salió _meta
    // ─── Ícono de oro (sprite de monedas de power_up.webp) ─────
    // En vez del emoji 🪙, cualquier lugar del HTML puede usar
    // rpgGoldIconHtml() → <span class="rpg-gold-icon">. El sprite se recorta
    // UNA vez a un data URL y se publica como variable CSS (--rpg-gold-icon),
    // así todos los íconos (los que ya están en pantalla y los que se armen
    // después por innerHTML) lo toman solos, sin re-recortar nada.
    this.goldIconState = 'idle';
  }

  claveMeta() {
    return juego.servicios.claveUsuario(RpgConfig.META_KEY);
  }

  // Progreso permanente del usuario actual. Si cambió la cuenta desde la
  // última lectura, se vuelve a leer: el que estaba en memoria era de otra.
  get meta() {
    const clave = this.claveMeta();
    if (!this._meta || this._metaClave !== clave) {
      this._meta = this.loadMeta();
      this._metaClave = clave;
    }
    return this._meta;
  }

  set meta(valor) {
    this._meta = valor;
    this._metaClave = this.claveMeta();
  }

  metaDefaults() {
    return {
      gold: 0,
      lifeLevel: 0,
      dmgLevel: 0,
      guaranteedFirstChest: false,
      extraChestChance: false,
      totem: false,
    };
  }

  loadMeta() {
    try {
      const raw = localStorage.getItem(this.claveMeta());
      if (!raw) return this.metaDefaults();
      const data = JSON.parse(raw);
      return Object.assign(this.metaDefaults(), data);
    } catch {
      return this.metaDefaults();
    }
  }

  saveMeta() {
    try {
      localStorage.setItem(this.claveMeta(), JSON.stringify(this.meta));
    } catch {}
  }

  // Costo del nivel `level` (1-indexado): nivel 1 = 50, nivel 2 = 100, etc.
  upgradeCost(level) {
    return level * RpgConfig.UPGRADE_COST_STEP;
  }

  addMetaGold(amount) {
    this.meta.gold += amount;
    this.saveMeta();
  }

  buyLifeUpgrade() {
    if (this.meta.lifeLevel >= RpgConfig.LIFE_UPGRADE_MAX) return;
    const cost = this.upgradeCost(this.meta.lifeLevel + 1);
    if (this.meta.gold < cost) return;
    this.meta.gold -= cost;
    this.meta.lifeLevel += 1;
    this.saveMeta();
    this.renderMejoras();
  }

  buyDmgUpgrade() {
    if (this.meta.dmgLevel >= RpgConfig.DMG_UPGRADE_MAX) return;
    const cost = this.upgradeCost(this.meta.dmgLevel + 1);
    if (this.meta.gold < cost) return;
    this.meta.gold -= cost;
    this.meta.dmgLevel += 1;
    this.saveMeta();
    this.renderMejoras();
  }

  buyGuaranteedChest() {
    if (this.meta.guaranteedFirstChest) return;
    if (this.meta.gold < RpgConfig.CHEST_GUARANTEED_COST) return;
    this.meta.gold -= RpgConfig.CHEST_GUARANTEED_COST;
    this.meta.guaranteedFirstChest = true;
    this.saveMeta();
    this.renderMejoras();
  }

  buyExtraChestChance() {
    if (this.meta.extraChestChance) return;
    if (this.meta.gold < RpgConfig.CHEST_EXTRA_COST) return;
    this.meta.gold -= RpgConfig.CHEST_EXTRA_COST;
    this.meta.extraChestChance = true;
    this.saveMeta();
    this.renderMejoras();
  }

  buyTotem() {
    if (this.meta.totem) return;
    if (this.meta.gold < RpgConfig.TOTEM_COST) return;
    this.meta.gold -= RpgConfig.TOTEM_COST;
    this.meta.totem = true;
    this.saveMeta();
    this.renderMejoras();
  }

  goldIconHtml() {
    this.ensureGoldIcon();
    return '<span class="rpg-gold-icon" aria-hidden="true"></span>';
  }

  ensureGoldIcon() {
    if (this.goldIconState !== 'idle') return;
    this.goldIconState = 'loading';
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
    if (typeof Engine2D === 'undefined') {
      this.goldIconState = 'idle';
      return;
    }
    Engine2D.loadImage(RpgConfig.POWERUP_SHEET)
      .then((img) => {
        const rect = RpgConfig.POWERUP_ICONS.coins;
        const h = 48;
        const w = Math.max(1, Math.round(h * (rect.w / rect.h)));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const cctx = c.getContext('2d');
        cctx.imageSmoothingEnabled = true; // achica mucho: sin suavizado queda ruidoso
        cctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
        document.documentElement.style.setProperty('--rpg-gold-icon', 'url("' + c.toDataURL() + '")');
        this.goldIconState = 'ready';
      })
      .catch(() => {
        this.goldIconState = 'idle'; // se reintenta la próxima vez que se abra la tienda
      });
  }

  // ─── Vista "Mejoras" del menú ─────
  mejoraRowHtml(opts) {
    return (
      '<div class="rpg-mejora-row">' +
      '<div class="rpg-mejora-info">' +
      '<p class="rpg-mejora-title">' +
      opts.title +
      '</p>' +
      '<p class="rpg-mejora-desc">' +
      opts.desc +
      '</p>' +
      '</div>' +
      '<div class="rpg-mejora-buy">' +
      '<span class="rpg-mejora-cost">' +
      opts.costLabel +
      '</span>' +
      '<button class="btn-play rpg-mejora-btn" ' +
      (opts.disabled ? 'disabled' : '') +
      ' onclick="' +
      opts.onclick +
      '">' +
      opts.btnLabel +
      '</button>' +
      '</div>' +
      '</div>'
    );
  }

  renderMejoras() {
    const goldEl = RpgConfig.EL.mejorasGold;
    if (goldEl) goldEl.innerHTML = this.goldIconHtml() + this.meta.gold;
    const gold = this.goldIconHtml();
    const wrap = RpgConfig.EL.mejorasList;
    if (!wrap) return;
    const rows = [];
    const lifeMaxed = this.meta.lifeLevel >= RpgConfig.LIFE_UPGRADE_MAX;
    const lifeCost = lifeMaxed ? null : this.upgradeCost(this.meta.lifeLevel + 1);
    rows.push(
      this.mejoraRowHtml({
        title: (window.app && app.utils ? app.utils.uiIconSVG('heart', 16) + ' ' : '') + 'Vida máxima',
        desc:
          'Nivel ' +
          this.meta.lifeLevel +
          '/' +
          RpgConfig.LIFE_UPGRADE_MAX +
          ' · +' +
          RpgConfig.LIFE_UPGRADE_HP +
          ' HP máx. por nivel',
        costLabel: lifeMaxed ? 'Al máximo' : gold + lifeCost,
        disabled: lifeMaxed || this.meta.gold < lifeCost,
        onclick: 'rpgBuyLifeUpgrade()',
        btnLabel: lifeMaxed ? 'Máximo' : 'Mejorar',
      }),
    );
    const dmgMaxed = this.meta.dmgLevel >= RpgConfig.DMG_UPGRADE_MAX;
    const dmgCost = dmgMaxed ? null : this.upgradeCost(this.meta.dmgLevel + 1);
    rows.push(
      this.mejoraRowHtml({
        title: (window.app && app.utils ? app.utils.uiIconSVG('swords', 16) + ' ' : '') + 'Daño',
        desc:
          'Nivel ' +
          this.meta.dmgLevel +
          '/' +
          RpgConfig.DMG_UPGRADE_MAX +
          ' · +' +
          RpgConfig.DMG_UPGRADE_STEP +
          ' daño por nivel',
        costLabel: dmgMaxed ? 'Al máximo' : gold + dmgCost,
        disabled: dmgMaxed || this.meta.gold < dmgCost,
        onclick: 'rpgBuyDmgUpgrade()',
        btnLabel: dmgMaxed ? 'Máximo' : 'Mejorar',
      }),
    );
    rows.push(
      this.mejoraRowHtml({
        title: (window.app && app.utils ? app.utils.uiIconSVG('chest', 16) + ' ' : '') + 'Cofre inicial garantizado',
        desc: 'El primer cofre del Capítulo 1 (habitación 1) sale siempre de oro.',
        costLabel: this.meta.guaranteedFirstChest ? 'Comprado' : gold + RpgConfig.CHEST_GUARANTEED_COST,
        disabled: this.meta.guaranteedFirstChest || this.meta.gold < RpgConfig.CHEST_GUARANTEED_COST,
        onclick: 'rpgBuyGuaranteedChest()',
        btnLabel: this.meta.guaranteedFirstChest ? 'Comprado' : 'Comprar',
      }),
    );
    rows.push(
      this.mejoraRowHtml({
        title: (window.app && app.utils ? app.utils.uiIconSVG('clover', 16) + ' ' : '') + 'Suerte del cofre',
        desc: Math.round(RpgConfig.CHEST_EXTRA_CHANCE * 100) + '% de chance de una recompensa extra en cada cofre.',
        costLabel: this.meta.extraChestChance ? 'Comprado' : gold + RpgConfig.CHEST_EXTRA_COST,
        disabled: this.meta.extraChestChance || this.meta.gold < RpgConfig.CHEST_EXTRA_COST,
        onclick: 'rpgBuyExtraChestChance()',
        btnLabel: this.meta.extraChestChance ? 'Comprado' : 'Comprar',
      }),
    );
    rows.push(
      this.mejoraRowHtml({
        title: (window.app && app.utils ? app.utils.uiIconSVG('totem', 16) + ' ' : '') + 'Tótem',
        desc:
          'Si un golpe te iba a matar, volvés con ' +
          RpgConfig.TOTEM_HEAL +
          ' HP y sos inmune ' +
          Math.round(RpgConfig.TOTEM_INVULN_MS / 1000) +
          ' seg. Una vez por capítulo.',
        costLabel: this.meta.totem ? 'Comprado' : gold + RpgConfig.TOTEM_COST,
        disabled: this.meta.totem || this.meta.gold < RpgConfig.TOTEM_COST,
        onclick: 'rpgBuyTotem()',
        btnLabel: this.meta.totem ? 'Comprado' : 'Comprar',
      }),
    );
    wrap.innerHTML = rows.join('');
  }
}
