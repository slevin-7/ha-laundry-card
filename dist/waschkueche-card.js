// waschkueche-card.js — Bedienung für Waschmaschine und Trockner auf Basis der hOn-Integration.
// Liest und schreibt nur vorhandene Entitäten (select/number/switch/script/input_boolean), keine eigene Cloud-Logik.

const VERSION = '0.3.0';

// Entitäten je Gerät; {p} = Präfix aus der Konfiguration (z. B. "waschmaschine").
const ENTITIES = {
  washer: {
    program: 'select.{p}_programm', temp: 'select.{p}_temperatur', spin: 'select.{p}_schleudern',
    delay: 'number.{p}_einschaltverzogerung', delay_switch: 'switch.{p}_einschaltverzogerung',
    start: 'script.{p}_starten_mit_optionen', status: 'sensor.{p}_machine_status', phase: 'sensor.{p}_phase',
    remain: 'sensor.{p}_verbleibende_zeit', progress: 'sensor.{p}_fortschritt', finish: 'sensor.{p}_fertig_um',
    run: 'sensor.{p}_lauf', error: 'sensor.{p}_fehler', remote: 'binary_sensor.{p}_fernsteuerung',
    empty: 'input_boolean.{p}_auszuraumen', pause: 'switch.{p}_anhalten', power: 'switch.{p}_{p}',
    fresh: 'switch.{p}_keep_fresh',
  },
  dryer: {
    program: 'select.{p}_programm', level: 'select.{p}_trocknungsstufe', heat: 'number.{p}_temperature_level',
    delay: 'number.{p}_einschaltverzogerung',
    start: 'script.{p}_starten_mit_optionen', status: 'sensor.{p}_machine_status', phase: 'sensor.{p}_phase',
    remain: 'sensor.{p}_verbleibende_zeit', progress: 'sensor.{p}_fortschritt', finish: 'sensor.{p}_fertig_um',
    run: 'sensor.{p}_lauf', error: 'sensor.{p}_fehler', remote: 'binary_sensor.{p}_gerateverbindung',
    empty: 'input_boolean.{p}_auszuraumen', pause: 'switch.{p}_anhalten', power: 'switch.{p}_{p}',
    fresh: 'switch.{p}_keep_fresh',
  },
};

const DEFAULTS = {
  washer: 'waschmaschine', dryer: 'trockner',
  washer_name: 'Waschmaschine', dryer_name: 'Trockner',
  favorites_washer: ['hqd_eco_40_60_degrees', 'hqd_cottons', 'hqd_mix', 'hqd_quick_15', 'hqd_synthetic_and_coloured', 'hqd_smart'],
  favorites_dryer: ['hqd_cotton', 'hqd_mix', 'hqd_synthetics', 'hqd_quick_30', 'hqd_towel', 'hqd_bed_sheets'],
  delays: [0, 60, 180, 360], // Minuten; das Gerät nimmt 30-Minuten-Schritte
  remote_check: true, // Fernstart "aus" ist bei hOn oft veraltet: dann Integration neu laden und Auswahl wiederherstellen
  washer_entities: {}, dryer_entities: {},
};

const PROGRAMS = {
  hqd_20_degrees: '20°', hqd_allergy: 'Allergie', hqd_autoclean: 'Selbstreinigung', hqd_babycare: 'Baby',
  hqd_checkup: 'Selbsttest', hqd_cottons: 'Baumwolle', hqd_delicate_cradle: 'Feinwäsche', hqd_duvet: 'Bettdecke',
  hqd_eco_40_60_degrees: 'Eco 40–60', hqd_handwash_wool: 'Wolle & Hand', hqd_mix: 'Mix', hqd_quick_15: 'Schnell 15',
  hqd_quick_wash_57: 'Schnell 57', hqd_refresh: 'Auffrischen', hqd_rinse: 'Spülen', hqd_shirts: 'Hemden',
  hqd_smart: 'Smart', hqd_spin: 'Schleudern', hqd_sport: 'Sport', hqd_synthetic_and_coloured: 'Bunt & Synthetik',
  hqd_baby_care: 'Baby', hqd_bath_towel: 'Badetücher', hqd_bed_sheets: 'Bettwäsche', hqd_bulky: 'Großteile',
  hqd_casual: 'Alltag', hqd_cold_wind_timing: 'Kaltluft (Zeit)', hqd_cotton: 'Baumwolle', hqd_curtain: 'Gardinen',
  hqd_delicate: 'Feinwäsche', hqd_feather: 'Daunen', hqd_hot_wind_timing: 'Warmluft (Zeit)', hqd_hygienic: 'Hygiene',
  hqd_i_refresh: 'i-Refresh', hqd_jacket: 'Jacken', hqd_jeans: 'Jeans', hqd_night_dry: 'Nacht', hqd_outdoor: 'Outdoor',
  hqd_precious_cure: 'Edles', hqd_quick_30: 'Schnell 30', hqd_quick_dry: 'Schnelltrocknen', hqd_quilt: 'Steppdecke',
  hqd_shirt: 'Hemden', hqd_shoes: 'Schuhe', hqd_silk: 'Seide', hqd_sports: 'Sport', hqd_synthetics: 'Synthetik',
  hqd_timer: 'Zeitprogramm', hqd_towel: 'Handtücher', hqd_underwear: 'Unterwäsche', hqd_wool: 'Wolle',
  hqd_working_suit: 'Arbeitskleidung',
};

// Wörter für unbekannte Kürzel (vor allem iot_wash_*/iot_dry_*); kleingeschriebene Werte werden ans Vorwort angehängt
const WORDS = {
  anti: 'Anti', mites: 'Milben', ariel: 'Ariel', dash: 'Dash', clean: 'Clean', cold: 'Kalt', fresh: 'Frisch', cycle: '',
  baby: 'Baby', sanitizer: 'Hygiene', backpacks: 'Rucksäcke', bathrobe: 'Bademäntel', bed: 'Bett', linen: 'wäsche',
  bleaching: 'Bleichen', blood: 'Blut', stains: 'flecken', cashmere: 'Kaschmir', chocolate: 'Schoko', wash: 'Wäsche',
  colored: 'Bunt', coloured: 'Bunt', stain: 'Flecken', delicate: 'Fein', cotton: 'Baumwolle', cuddly: 'Kuschel', toys: 'tiere',
  curtains: 'Gardinen', dark: 'Dunkel', antiallergy: 'Allergie', colors: 'Farben', tablecloths: 'Tischdecken',
  whites: 'Weiß', denim: '', jeans: 'Jeans', diving: 'Tauch', suits: 'anzüge', suit: 'anzug', down: 'Daunen', jackets: 'jacken',
  jacket: 'jacke', fruit: 'Obst', handwash: 'Handwäsche', lingerie: 'Dessous', masks: 'Masken', refresh: 'Auffrischen',
  sanification: 'Hygiene', mats: 'Matten', men: 'Herren', s: '', trousers: 'hosen', mixed: 'Mix', new: 'Neue', clothes: 'Kleidung',
  perfect: 'Perfekt', white: 'Weiß', pets: 'Haustier', pet: 'Haustier', hair: 'haare', removal: 'entfernen', odours: 'Gerüche',
  accessories: 'zubehör', rapid: 'Schnell', resistant: 'Robust', rinse: 'Spülen', silk: 'Seide', ski: 'Ski', spin: 'Schleudern',
  sport: 'Sport', odor: 'Geruch', swimsuits: 'Badesachen', and: '&', bikinis: '', synthetic: 'Synthetik', synthetics: 'Synthetik',
  technical: 'Funktions', fabrics: 'kleidung', tennis: 'Tennis', tie: '', break: '', trainers: 'Sneaker', wine: 'Wein',
  wool: 'Wolle', delicates: 'Fein', duvet: 'Bettdecke', gym: 'Sport', fit: '', shirts: 'Hemden',
};

const LEVELS = { iron_dry: 'Bügel', cupboard_dry: 'Schrank', ready_to_wear: 'Anziehfertig', extra_dry: 'Extra' };
const HEAT = { 1: 'Kalt', 2: 'Sanft', 3: 'Mittel', 4: 'Normal', 5: 'Hoch' };
const PHASES = {
  ready: 'Bereit', washing: 'Waschen', spin: 'Schleudern', rinse: 'Spülen', drying: 'Trocknen', steam: 'Dampf',
  weighting: 'Wiegen', scheduled: 'Geplant', tumbling: 'Auflockern', refresh: 'Auffrischen', heating: 'Aufheizen',
  heat_stroke: 'Aufheizen', cooldown: 'Abkühlen', unknown: '',
};
const RUN_STATES = ['running', 'pause', 'scheduled', 'ending'];
const BAD = ['unavailable', 'unknown', undefined, null, ''];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function programLabel(key) {
  if (PROGRAMS[key]) return PROGRAMS[key];
  const m = String(key).match(/^(?:iot_wash_|iot_dry_|hqd_)?(.*)$/);
  const out = [];
  for (const w of m[1].split('_')) {
    if (/^\d+$/.test(w)) { out.push(w); continue; }
    const t = WORDS[w];
    if (t === undefined) out.push(w.charAt(0).toUpperCase() + w.slice(1));
    else if (t === '') continue;
    else if (/^[a-zäöü]/.test(t) && out.length) out[out.length - 1] += t; // "Bett" + "wäsche"
    else out.push(t);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim() || key;
}

export function fmtDuration(min) {
  min = Math.round(min);
  if (!(min > 0)) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

const hhmm = d => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const STYLE = `
  :host { display: block; --wk-washer: #5CC8FF; --wk-dryer: #FFB45C; --wk-washer-line: #1C8FD0; --wk-dryer-line: #C46A00; }
  :host([dark]) { --wk-washer-line: #5CC8FF; --wk-dryer-line: #FFB45C; }
  * { box-sizing: border-box; }
  .card { background: var(--ha-card-background, var(--card-background-color)); color: var(--primary-text-color); border-radius: var(--ha-card-border-radius, 16px);
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color)); box-shadow: var(--ha-card-box-shadow, none);
    padding: 16px; display: flex; flex-direction: column; gap: 16px; font-family: inherit; }
  h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -.3px; }
  .sub { margin: 2px 0 0; font-size: 14px; color: var(--secondary-text-color); }
  button { font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--primary-text-color); outline-offset: 2px; }
  button:disabled { cursor: default; opacity: .5; }
  .devices { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .dev { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 8px 14px; border-radius: 20px;
    background: var(--secondary-background-color); border: 1.5px solid transparent; }
  .dev[aria-pressed="true"] { border-color: var(--acc-line); background: var(--card-background-color); }
  .ring { position: relative; width: 80px; height: 80px; }
  .ring svg { position: absolute; left: 0; top: 0; }
  .ring svg.ico { left: 26px; top: 26px; }
  .dev .name { font-size: 15px; font-weight: 600; }
  .dev .st { font-size: 13px; color: var(--secondary-text-color); text-align: center; }
  .panel { display: flex; flex-direction: column; gap: 18px; padding: 18px; border-radius: 20px; background: var(--secondary-background-color); }
  .row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .muted { font-size: 13px; color: var(--secondary-text-color); }
  .link { border: 0; background: none; padding: 8px 0; font-size: 13px; color: var(--secondary-text-color); }
  .progs { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .prog { min-height: 52px; padding: 10px 12px; border-radius: 14px; text-align: left; font-size: 14px; font-weight: 600;
    background: var(--card-background-color); border: 1.5px solid var(--divider-color); }
  .prog[aria-pressed="true"] { border-color: var(--acc-line); box-shadow: inset 0 0 0 1px var(--acc-line); }
  .group-label { grid-column: 1 / -1; margin: 6px 0 0; font-size: 12px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .5px; }
  .search { width: 100%; font: inherit; font-size: 15px; padding: 10px 12px; margin: 0 0 8px; border-radius: 12px; border: 1px solid var(--divider-color);
    background: var(--card-background-color); color: var(--primary-text-color); }
  .seg { display: flex; gap: 4px; padding: 4px; border-radius: 14px; background: var(--card-background-color); }
  .seg button { flex: 1 1 0; min-width: 0; min-height: 44px; border: 0; border-radius: 11px; background: transparent; font-size: 14px; font-weight: 600;
    color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 4px; }
  .seg button[aria-pressed="true"] { background: var(--acc); color: #0B0D0F; }
  .go { width: 100%; min-height: 56px; border: 0; border-radius: 18px; background: var(--acc); color: #0B0D0F; font-size: 16px; font-weight: 700; }
  .hint { margin: 0; padding: 12px 14px; border-radius: 14px; font-size: 13px; line-height: 1.45;
    background: color-mix(in srgb, var(--wk-dryer) 18%, transparent); color: var(--primary-text-color); }
  .big { font-size: 48px; font-weight: 600; letter-spacing: -1px; line-height: 1; font-variant-numeric: tabular-nums; }
  .bar { height: 8px; border-radius: 4px; background: var(--divider-color); overflow: hidden; }
  .bar > div { height: 100%; border-radius: 4px; background: var(--acc-line); }
  .facts { display: flex; flex-wrap: wrap; gap: 8px; }
  .fact { padding: 6px 12px; border-radius: 999px; background: var(--card-background-color); font-size: 13px; }
  .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .ghost { min-height: 50px; border-radius: 16px; border: 1px solid var(--divider-color); background: transparent; font-size: 15px; font-weight: 600; }
  .danger { color: var(--error-color, #db4437); }
  .title2 { font-size: 24px; font-weight: 600; }
  .toast { padding: 10px 14px; border-radius: 12px; background: var(--primary-text-color); color: var(--card-background-color); font-size: 13px; }
  .warn { color: var(--error-color, #db4437); font-size: 14px; }
`;

const ICON_WASHER = '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><circle cx="12" cy="13.5" r="4.5"/><path d="M7.5 6h.01M10.5 6h3"/>';
const ICON_DRYER = '<rect x="4" y="2.5" width="16" height="19" rx="2.5"/><circle cx="12" cy="13.5" r="4.5"/><path d="M9.5 12.5c1 1 2 1 3 0s2-1 3 0M7.5 6h.01"/>';

class WaschkuecheCard extends HTMLElement {
  static getStubConfig() { return {}; }

  setConfig(config) {
    this._config = { ...DEFAULTS, ...(config || {}) };
    this._devs = [];
    for (const kind of ['washer', 'dryer']) {
      const p = this._config[kind];
      if (!p) continue;
      const map = {};
      for (const [k, tpl] of Object.entries(ENTITIES[kind])) map[k] = tpl.replaceAll('{p}', p);
      Object.assign(map, this._config[`${kind}_entities`] || {});
      this._devs.push({ kind, e: map, name: this._config[`${kind}_name`], favs: this._config[`favorites_${kind}`] || [] });
    }
    if (!this._devs.length) throw new Error('waschkueche-card: weder washer noch dryer konfiguriert');
    this._ui = this._ui || { sel: this._devs[0].kind, all: false, q: '', delay: 0, pending: {}, confirmStop: false, toast: '', checking: false };
    if (!this._devs.some(d => d.kind === this._ui.sel)) this._ui.sel = this._devs[0].kind;
    this._key = null;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this.toggleAttribute('dark', !!hass?.themes?.darkMode);
    this._render();
  }

  getCardSize() { return 8; }
  getGridOptions() { return { columns: 'full' }; }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.addEventListener('click', e => this._onClick(e));
      this.shadowRoot.addEventListener('input', e => {
        if (e.target.classList.contains('search')) { this._ui.q = e.target.value; this._renderList(); }
      });
    }
    this._key = null;
    this._render();
  }

  // ---- Zustand lesen ----
  _st(id) { return this._hass?.states?.[id]; }
  _val(id) { const s = this._st(id); return s ? s.state : undefined; }
  _ok(id) { return !BAD.includes(this._val(id)); }

  _mode(d) {
    const st = this._val(d.e.status);
    if (this._ui.pending[d.kind] && Date.now() - this._ui.pending[d.kind] > 95000) delete this._ui.pending[d.kind];
    if (RUN_STATES.includes(st)) { delete this._ui.pending[d.kind]; return 'run'; }
    if (st === 'error') return 'error';
    if (BAD.includes(st)) return 'offline';
    if (this._val(d.e.empty) === 'on') return 'done';
    return 'setup';
  }

  _remain(d) { const v = parseFloat(this._val(d.e.remain)); return v > 0 ? v : 0; }

  _finishTime(d) {
    const f = this._val(d.e.finish);
    if (/^\d{1,2}:\d{2}/.test(f || '')) return f.slice(0, 5);
    const r = this._remain(d);
    return r ? hhmm(new Date(Date.now() + r * 60000)) : '–';
  }

  _status(d, mode) {
    if (mode === 'run') {
      const st = this._val(d.e.status);
      if (st === 'pause') return 'Pausiert';
      if (st === 'scheduled') return `Geplant, fertig ${this._finishTime(d)}`;
      return `fertig ${this._finishTime(d)}`;
    }
    return { done: 'Ausräumen', error: 'Fehler', offline: 'Nicht erreichbar', setup: this._ui.pending[d.kind] ? 'Startet …' : 'Bereit' }[mode];
  }

  // ---- Rendern ----
  _render() {
    if (!this.shadowRoot || !this._config || !this._hass) return;
    const devs = this._devs.map(d => ({ d, mode: this._mode(d) }));
    const cur = devs.find(x => x.d.kind === this._ui.sel) || devs[0];
    // nur neu zeichnen, wenn sich etwas Sichtbares geändert hat (sonst springen Fokus und Scroll)
    const ids = this._devs.flatMap(d => Object.values(d.e));
    const key = JSON.stringify([ids.map(id => { const s = this._st(id); return s ? [s.state, s.attributes?.options?.length] : 0; }),
      { ...this._ui, q: undefined }, this.hasAttribute('dark'), Math.floor(Date.now() / 60000)]);
    if (key === this._key) return;
    this._key = key;

    const d = cur.d;
    const running = devs.filter(x => x.mode === 'run');
    const done = devs.filter(x => x.mode === 'done');
    const summary = running.length === devs.length && devs.length > 1 ? 'Beide laufen'
      : running.length ? `${running.map(x => x.d.name).join(', ')} läuft`
      : done.length ? `${done.map(x => x.d.name).join(' und ')}: ausräumen`
      : devs.length > 1 ? 'Beide bereit' : 'Bereit';

    const circ = 2 * Math.PI * 34;
    const cards = devs.map(({ d: x, mode }) => {
      let pct = mode === 'run' ? parseFloat(this._val(x.e.progress)) || 0 : mode === 'done' ? 100 : 0;
      pct = Math.max(0, Math.min(100, pct));
      return `<button class="dev" data-a="sel" data-k="${x.kind}" aria-pressed="${x.kind === d.kind}" style="--acc-line: var(--wk-${x.kind}-line)">
        <div class="ring">
          <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--divider-color)" stroke-width="7"/>
          ${pct > 0 ? `<circle cx="40" cy="40" r="34" fill="none" stroke="var(--wk-${x.kind}-line)" stroke-width="7" stroke-linecap="round"
            stroke-dasharray="${(circ * pct / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 40 40)"/>` : ''}</svg>
          <svg class="ico" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${x.kind === 'washer' ? ICON_WASHER : ICON_DRYER}</svg>
        </div>
        <span class="name">${esc(x.name)}</span><span class="st">${esc(this._status(x, mode))}</span></button>`;
    }).join('');

    const panel = {
      run: () => this._panelRun(d), done: () => this._panelDone(d), setup: () => this._panelSetup(d), error: () => this._panelError(d),
      offline: () => `<div class="panel"><span class="muted">${esc(d.name)} meldet sich gerade nicht. Die hOn-Cloud braucht manchmal ein paar Minuten.</span></div>`,
    }[cur.mode]();

    this.shadowRoot.innerHTML = `<style>${STYLE}</style>
      <div class="card" style="--acc: var(--wk-${d.kind}); --acc-line: var(--wk-${d.kind}-line)">
        <header><h1>${esc(this._config.title ?? 'Waschküche')}</h1><p class="sub">${esc(summary)}</p></header>
        ${devs.length > 1 ? `<div class="devices">${cards}</div>` : ''}
        ${panel}
        ${this._ui.toast ? `<div class="toast" role="status">${esc(this._ui.toast)}</div>` : ''}
      </div>`;
    const s = this.shadowRoot.querySelector('.search');
    if (s && this._ui.focusSearch) { s.focus(); this._ui.focusSearch = false; }
  }

  _seg(rows) {
    return rows.map(r => `<div><div class="row-head"><h2>${esc(r.title)}</h2></div>
      <div class="seg" role="group" aria-label="${esc(r.title)}">${r.opts.map(o =>
        `<button data-a="${r.action}" data-v="${esc(o.v)}" data-id="${esc(r.id)}" aria-pressed="${o.on}">${esc(o.label)}</button>`).join('')}</div></div>`).join('');
  }

  _selectRow(id, title, label) {
    const s = this._st(id);
    if (!s || BAD.includes(s.state)) return null;
    const opts = (s.attributes.options || []).filter(o => o !== '');
    if (opts.length < 2) return null;
    return { id, title, action: 'select', opts: opts.map(o => ({ v: o, label: label(o), on: o === s.state })) };
  }

  _numberRow(id, title, label) {
    const s = this._st(id);
    if (!s || BAD.includes(s.state)) return null;
    const { min = 0, max = 0, step = 1 } = s.attributes;
    const vals = [];
    for (let v = +min; v <= +max && vals.length < 6; v += +step || 1) vals.push(v);
    if (vals.length < 2) return null;
    return { id, title, action: 'number', opts: vals.map(v => ({ v, label: label(v), on: +s.state === v })) };
  }

  _programList(d) {
    const s = this._st(d.e.program);
    const opts = (s?.attributes?.options || []).filter(Boolean);
    const curP = s?.state;
    const btn = o => `<button class="prog" data-a="select" data-id="${esc(d.e.program)}" data-v="${esc(o)}" aria-pressed="${o === curP}">${esc(programLabel(o))}</button>`;
    if (!this._ui.all) {
      const favs = d.favs.filter(f => opts.includes(f));
      if (curP && opts.includes(curP) && !favs.includes(curP)) favs.unshift(curP);
      return (favs.length ? favs : opts.slice(0, 6)).map(btn).join('');
    }
    const q = this._ui.q.trim().toLowerCase();
    const hits = opts.filter(o => !q || programLabel(o).toLowerCase().includes(q) || o.includes(q))
      .sort((a, b) => programLabel(a).localeCompare(programLabel(b), 'de'));
    const base = hits.filter(o => !o.startsWith('iot_')), app = hits.filter(o => o.startsWith('iot_'));
    return (base.map(btn).join('') + (app.length ? `<p class="group-label">Programme aus der App</p>${app.map(btn).join('')}` : ''))
      || '<span class="muted">Kein Programm gefunden.</span>';
  }

  _renderList() {
    const el = this.shadowRoot?.querySelector('.progs');
    const d = this._devs.find(x => x.kind === this._ui.sel);
    if (el && d) el.innerHTML = this._programList(d);
  }

  _panelSetup(d) {
    const rows = d.kind === 'washer'
      ? [this._selectRow(d.e.temp, 'Temperatur', v => (v === '0' ? 'Kalt' : `${v}°`)),
         this._selectRow(d.e.spin, 'Schleudern', v => (v === '0' ? 'Aus' : v))]
      : [this._selectRow(d.e.level, 'Trocken', v => LEVELS[v] || programLabel(v)),
         this._numberRow(d.e.heat, 'Wärme', v => HEAT[v] || String(v))];
    if (this._ok(d.e.fresh)) rows.push({ id: d.e.fresh, title: 'Frischhalten', action: 'switch',
      opts: ['off', 'on'].map(v => ({ v, label: v === 'on' ? 'An' : 'Aus', on: this._val(d.e.fresh) === v })) });
    const remoteOk = this._val(d.e.remote) !== 'off';
    const checking = this._ui.checking;
    const pending = !!this._ui.pending[d.kind] || checking;
    const dur = this._remain(d);
    const hasDelay = this._ok(d.e.delay);
    const delay = hasDelay ? this._ui.delay : 0;
    const end = dur ? hhmm(new Date(Date.now() + (delay + dur) * 60000)) : '';
    const info = [dur ? `dauert ca. ${fmtDuration(dur)}` : '', end ? `fertig ca. ${end}` : ''].filter(Boolean).join(' · ');
    const hint = d.kind === 'washer'
      ? 'Fernstart ist am Gerät nicht freigegeben. WiFi-Taste an der Waschmaschine gedrückt halten, dann geht Start von hier.'
      : 'Fernstart ist am Gerät nicht freigegeben. Fernstart-Taste am Trockner gedrückt halten, dann geht Start von hier.';
    return `<div class="panel">
      <div><div class="row-head"><h2>Programm</h2>
        <button class="link" data-a="all">${this._ui.all ? 'Nur Favoriten' : 'Alle Programme'}</button></div>
        ${this._ui.all ? `<input class="search" type="search" placeholder="Programm suchen" aria-label="Programm suchen" value="${esc(this._ui.q)}">` : ''}
        <div class="progs">${this._programList(d)}</div></div>
      ${this._seg(rows.filter(Boolean))}
      ${hasDelay && this._config.delays.length > 1 ? this._seg([{ id: '', title: 'Start', action: 'delay',
        opts: this._config.delays.map(m => ({ v: m, label: m ? `in ${fmtDuration(m)}` : 'Jetzt', on: m === delay })) }]) : ''}
      ${checking ? '<p class="hint">Prüfe Fernstart …</p>'
        : remoteOk ? '' : `<p class="hint">${hint}${this._config.remote_check ? ' <button class="link" data-a="recheck" style="padding: 0; text-decoration: underline; color: inherit">Erneut prüfen</button>' : ''}</p>`}
      <div style="display: flex; flex-direction: column; gap: 8px">
        <button class="go" data-a="start" ${pending || (!remoteOk && !this._config.remote_check) ? 'disabled' : ''}>${checking ? 'Prüfe …' : pending ? 'Wird gestartet …' : `${esc(d.name)} ${delay ? 'planen' : 'starten'}`}</button>
        ${info ? `<span class="muted" style="text-align: center">${esc(info)}</span>` : ''}
      </div></div>`;
  }

  _panelRun(d) {
    const st = this._val(d.e.status);
    const ph = this._val(d.e.phase);
    const phase = PHASES[ph] ?? programLabel(ph || '');
    const pct = Math.max(0, Math.min(100, parseFloat(this._val(d.e.progress)) || 0));
    const facts = [programLabel(this._val(d.e.program) || '')];
    if (d.kind === 'washer') {
      if (this._ok(d.e.temp)) facts.push(this._val(d.e.temp) === '0' ? 'Kalt' : `${this._val(d.e.temp)}°`);
      if (this._ok(d.e.spin)) facts.push(`${this._val(d.e.spin)} U/min`);
    } else if (this._ok(d.e.level)) facts.push(LEVELS[this._val(d.e.level)] || this._val(d.e.level));
    const pauseOk = this._ok(d.e.pause);
    const paused = st === 'pause' || this._val(d.e.pause) === 'on';
    const rem = fmtDuration(this._remain(d));
    const stopBtn = this._ok(d.e.power)
      ? `<button class="ghost danger" data-a="stop" ${pauseOk ? '' : 'style="grid-column: 1 / -1"'}>${this._ui.confirmStop ? 'Wirklich abbrechen?' : 'Abbrechen'}</button>` : '';
    return `<div class="panel">
      <div class="row-head" style="margin: 0"><span class="muted">${esc(d.name)} ${st === 'scheduled' ? 'ist geplant' : paused ? 'pausiert' : 'läuft'}</span><span class="muted">${esc(phase)}</span></div>
      <div><div class="big">${esc(this._finishTime(d))}</div><div class="muted" style="margin-top: 4px">fertig${rem ? ` · noch ${esc(rem)}` : ''}</div></div>
      <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Fortschritt"><div style="width: ${pct}%"></div></div>
      <div class="facts">${facts.filter(Boolean).map(f => `<span class="fact">${esc(f)}</span>`).join('')}</div>
      ${pauseOk || stopBtn ? `<div class="two">${pauseOk ? `<button class="ghost" data-a="pause">${paused ? 'Fortsetzen' : 'Pause'}</button>` : ''}${stopBtn}</div>` : ''}
      </div>`;
  }

  _panelDone(d) {
    const end = this._st(d.e.run)?.attributes?.ende;
    const e = end && new Date(end);
    const today = e && e.toDateString() === new Date().toDateString();
    const since = e && !isNaN(e) ? `Fertig seit ${today ? '' : e.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ', '}${hhmm(e)}.` : '';
    return `<div class="panel"><span class="title2">Fertig – bitte ausräumen</span>
      ${since ? `<span class="muted">${esc(since)}</span>` : ''}
      <button class="go" data-a="emptied">Ausgeräumt</button></div>`;
  }

  _panelError(d) {
    const code = this._val(d.e.error);
    return `<div class="panel"><span class="title2">${esc(d.name)}: Fehler</span>
      <span class="warn">${code && code !== '0' ? `Fehlercode ${esc(code)}. ` : ''}Bitte am Gerät nachsehen.</span></div>`;
  }

  // ---- Aktionen ----
  async _call(domain, service, data) {
    try {
      await this._hass.callService(domain, service, data);
      return true;
    } catch (err) {
      this._toast(`Hat nicht geklappt: ${err?.message || err}`);
      return false;
    }
  }

  _toast(msg) {
    this._ui.toast = msg;
    this._key = null; this._render();
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { this._ui.toast = ''; this._key = null; this._render(); }, 5000);
  }

  // Fernstart neu einlesen: hOn liest die Freigabe nur beim Laden der Integration. Ein Reload verwirft
  // aber die gestagten Optionen beider Geräte, deshalb vorher merken und danach wieder setzen.
  async _refreshRemote(d, force = false) {
    if (!this._config.remote_check || this._ui.checking) return this._val(d.e.remote) !== 'off';
    if (!force && Date.now() - (this._lastCheck || 0) < 60000) return this._val(d.e.remote) !== 'off';
    this._lastCheck = Date.now();
    const keys = ['program', 'temp', 'spin', 'level', 'heat', 'fresh'];
    const snap = this._devs.map(x => ({ x, v: Object.fromEntries(keys.filter(k => this._ok(x.e[k])).map(k => [k, this._val(x.e[k])])) }));
    const before = this._st(d.e.remote)?.last_updated;
    this._ui.checking = true; this._key = null; this._render();
    try {
      await this._hass.callService('homeassistant', 'reload_config_entry', { entity_id: d.e.remote });
      for (let t = 0; t < 60 && !(this._st(d.e.remote)?.last_updated !== before && this._ok(d.e.remote) && this._ok(d.e.program)); t++)
        await new Promise(r => setTimeout(r, 500));
      for (const { x, v } of snap) for (const k of keys) {
        if (v[k] === undefined || this._val(x.e[k]) === v[k]) continue;
        if (k === 'fresh') await this._hass.callService('switch', `turn_${v[k]}`, { entity_id: x.e[k] });
        else if (k === 'heat') await this._hass.callService('number', 'set_value', { entity_id: x.e[k], value: +v[k] });
        else await this._hass.callService('select', 'select_option', { entity_id: x.e[k], option: v[k] });
      }
    } catch (err) {
      this._toast(`Fernstart konnte nicht geprüft werden: ${err?.message || err}`);
    } finally {
      this._ui.checking = false; this._key = null; this._render();
    }
    return this._val(d.e.remote) !== 'off';
  }

  async _onClick(e) {
    const b = e.composedPath().find(n => n instanceof HTMLElement && n.matches?.('button[data-a]'));
    if (!b || b.disabled) return;
    const a = b.dataset.a, v = b.dataset.v, id = b.dataset.id;
    const d = this._devs.find(x => x.kind === this._ui.sel);
    const redraw = () => { this._key = null; this._render(); };
    if (a !== 'stop') this._ui.confirmStop = false;
    switch (a) {
      case 'sel': this._ui.sel = b.dataset.k; this._ui.all = false; this._ui.q = ''; this._ui.delay = 0; redraw(); break;
      case 'all': this._ui.all = !this._ui.all; this._ui.q = ''; this._ui.focusSearch = this._ui.all; redraw(); break;
      case 'delay': this._ui.delay = +v; redraw(); break;
      case 'select':
        if (await this._call('select', 'select_option', { entity_id: id, option: v })
          && id === d.e.program && this._val(d.e.remote) === 'off') await this._refreshRemote(d);
        break;
      case 'recheck': await this._refreshRemote(d, true); break;
      case 'switch': await this._call('switch', `turn_${v}`, { entity_id: id }); break;
      case 'number': await this._call('number', 'set_value', { entity_id: id, value: +v }); break;
      case 'start': {
        if (this._val(d.e.remote) === 'off' && !(await this._refreshRemote(d, true))) {
          this._toast('Fernstart ist am Gerät noch nicht freigegeben.'); break;
        }
        const delay = this._ok(d.e.delay) ? this._ui.delay : 0;
        if (this._ok(d.e.delay) && +this._val(d.e.delay) !== delay
          && !(await this._call('number', 'set_value', { entity_id: d.e.delay, value: delay }))) break;
        if (this._ok(d.e.delay_switch)) {
          const want = delay ? 'on' : 'off';
          if (this._val(d.e.delay_switch) !== want && !(await this._call('switch', `turn_${want}`, { entity_id: d.e.delay_switch }))) break;
        }
        this._ui.pending[d.kind] = Date.now(); redraw();
        if (!(await this._call('script', 'turn_on', { entity_id: d.e.start }))) { delete this._ui.pending[d.kind]; redraw(); }
        else setTimeout(redraw, 96000);
        break;
      }
      case 'pause': await this._call('switch', this._val(d.e.pause) === 'on' ? 'turn_off' : 'turn_on', { entity_id: d.e.pause }); break;
      case 'stop':
        if (!this._ui.confirmStop) { this._ui.confirmStop = true; redraw(); setTimeout(() => { this._ui.confirmStop = false; redraw(); }, 4000); break; }
        this._ui.confirmStop = false;
        await this._call('switch', 'turn_off', { entity_id: d.e.power });
        break;
      case 'emptied': await this._call('input_boolean', 'turn_off', { entity_id: d.e.empty }); break;
    }
  }
}

customElements.define('waschkueche-card', WaschkuecheCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'waschkueche-card', name: 'Waschküche', description: 'Waschmaschine und Trockner (hOn) bedienen', preview: false });
console.info(`%c waschkueche-card ${VERSION} `, 'background:#5CC8FF;color:#0B0D0F;border-radius:4px');
