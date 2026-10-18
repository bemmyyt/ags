import type { HandlingPreset, VehicleTelemetry } from '../physics/Vehicle';
import type { RaceDifficulty, RaceSnapshot } from '../racing/RaceSystem';
import type { ActivitySnapshot } from '../activities/ActivitySystem';

type NoticeTone = 'neutral' | 'warning' | 'success';
export type GraphicsQuality = 'high' | 'balanced' | 'performance';

/** Presentation-only UI state. Gameplay remains owned by the game and race systems. */
export class Hud {
  private readonly speed: HTMLElement;
  private readonly gear: HTMLElement;
  private readonly rpm: HTMLElement;
  private readonly mode: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly surfaceLabel: HTMLElement;
  private readonly tachometer: HTMLElement;
  private readonly pause: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly settingsPanel: HTMLElement;
  private readonly steeringInput: HTMLInputElement;
  private readonly steeringValue: HTMLElement;
  private readonly audioInput: HTMLInputElement;
  private readonly volumeInput: HTMLInputElement;
  private readonly volumeValue: HTMLElement;
  private readonly graphicsInput: HTMLSelectElement;
  private readonly handlingInput: HTMLSelectElement;
  private readonly raceDifficultyInput: HTMLSelectElement;
  private readonly notification: HTMLElement;
  private readonly raceHud: HTMLElement;
  private readonly racePrompt: HTMLElement;
  private readonly raceCountdown: HTMLElement;
  private readonly racePosition: HTMLElement;
  private readonly raceCheckpoint: HTMLElement;
  private readonly raceResults: HTMLElement;
  private readonly activityHud: HTMLElement;
  private readonly raceResultTitle: HTMLElement;
  private readonly raceResultDetail: HTMLElement;
  private notificationTimer?: number;
  private lastCountdown?: string;
  private lastRaceState?: RaceSnapshot['state'];
  private lastCameraMode?: string;
  private lastSurfaceState?: string;
  private lastRacePrompt?: string;
  private lastRacePosition?: string;
  private lastRaceCheckpoint?: string;
  private lastResult?: string;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <canvas id="game-canvas" aria-label="OPEN ROAD driving game"></canvas>

      <section class="hud" aria-label="Driving information">
        <div class="brand-lockup" aria-label="OPEN ROAD">
          <span class="brand">OPEN <i>ROAD</i></span>
          <span class="brand-subtitle">COASTAL FREE DRIVE</span>
        </div>

        <div class="drive-status" aria-label="Vehicle status">
          <span class="status-item"><span class="status-label">CAMERA</span><strong id="camera-mode">CHASE</strong></span>
          <span id="surface" class="surface-pill" data-state="grip"><i></i><span>GRIP READY</span></span>
        </div>

        <section id="race-hud" class="race-hud hidden" aria-live="polite" aria-atomic="true">
          <div class="race-metric"><span>POSITION</span><strong id="race-position">1<small>/ 2</small></strong></div>
          <div class="race-divider"></div>
          <div class="race-metric"><span>CHECKPOINT</span><strong id="race-checkpoint">1<small>/ 6</small></strong></div>
        </section>
        <section id="activity-hud" class="activity-hud hidden" aria-live="polite"></section>

        <div id="race-prompt" class="race-prompt" role="status" aria-live="polite"></div>
        <div id="race-countdown" class="race-countdown" aria-live="assertive"></div>
        <div id="notification" class="notification" role="status" aria-live="polite" data-tone="neutral"></div>

        <section class="speed-cluster" aria-label="Vehicle instruments">
          <div class="speed-readout"><b id="speed">000</b><span>KM/H</span></div>
          <div class="gear-readout"><b id="gear">N</b><span>GEAR</span></div>
          <div id="tachometer" class="tachometer" role="meter" aria-label="Engine RPM" aria-valuemin="0" aria-valuemax="7200" aria-valuenow="900" style="--rpm-level: .125">
            <div class="tach-track"><span></span></div>
            <div class="tach-labels" aria-hidden="true"><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i><i>7</i></div>
            <span id="rpm">900 RPM</span>
          </div>
        </section>
      </section>

      <section id="menu" class="overlay" aria-label="Main menu">
        <div class="panel menu-panel">
          <p class="eyebrow">COASTAL TEST ROUTE <span></span> V0.3</p>
          <h1>OPEN <em>ROAD</em></h1>
          <p class="lead">A compact driving world tuned for clean lines, late braking, and the long way home.</p>
          <div class="menu-actions">
            <button id="drive" type="button"><span>START DRIVE</span><small>ENTER THE COASTAL LOOP</small></button>
            <button id="settings" class="ghost" type="button" aria-expanded="false">SETTINGS <span aria-hidden="true">+</span></button>
          </div>
          <div id="settings-panel" class="settings hidden" aria-label="Driving settings" aria-hidden="true">
            <div class="setting-row">
              <label for="steering">STEERING RESPONSE <output id="steering-value" for="steering">100%</output></label>
              <input id="steering" type="range" min="0.6" max="1.45" step="0.05" value="1" aria-describedby="steering-help" />
              <small id="steering-help">Higher values react more quickly to key presses.</small>
            </div>
            <div class="setting-row audio-setting">
              <label for="master-volume">MASTER VOLUME <output id="volume-value" for="master-volume">70%</output></label>
              <input id="master-volume" type="range" min="0" max="100" step="1" value="70" />
            </div>
            <div class="setting-row graphics-setting">
              <label for="graphics">GRAPHICS QUALITY</label>
              <select id="graphics" aria-label="Graphics quality"><option value="high">HIGH — FULL SHADOWS</option><option value="balanced">BALANCED</option><option value="performance">PERFORMANCE — LOW GPU</option></select>
            </div>
            <div class="setting-row graphics-setting">
              <label for="handling">HANDLING PRESET</label>
              <select id="handling" aria-label="Vehicle handling preset"><option value="arcade">ARCADE — EASY DRIFTS</option><option value="balanced" selected>BALANCED — DEFAULT</option><option value="simulation">SIM-INSPIRED — PRECISE</option></select>
            </div>
            <div class="setting-row graphics-setting">
              <label for="race-difficulty">RACE DIFFICULTY</label>
              <select id="race-difficulty" aria-label="Race difficulty"><option value="easy">EASY — FORGIVING</option><option value="normal" selected>NORMAL — COMPETITIVE</option><option value="hard">HARD — NO GIFTS</option></select>
            </div>
            <label class="toggle-setting" for="audio"><input id="audio" type="checkbox" checked /> <span class="toggle-indicator" aria-hidden="true"></span><span>ENGINE &amp; TIRE AUDIO</span></label>
          </div>
          <div class="control-guide" aria-label="Keyboard controls">
            <div><span><kbd>W</kbd><kbd>↑</kbd></span><b>ACCELERATE</b></div>
            <div><span><kbd>S</kbd><kbd>↓</kbd></span><b>BRAKE / REVERSE</b></div>
            <div><span><kbd>A</kbd><kbd>D</kbd><kbd>←</kbd><kbd>→</kbd></span><b>STEER</b></div>
            <div><span><kbd>SPACE</kbd></span><b>HANDBRAKE</b></div>
          </div>
          <p class="utility-controls"><kbd>R</kbd> RECOVER <i></i> <kbd>C</kbd> CAMERA <i></i> <kbd>ESC</kbd> PAUSE</p>
        </div>
      </section>

      <section id="pause" class="overlay pause-overlay hidden" aria-label="Paused" aria-hidden="true">
        <div class="panel compact">
          <p class="eyebrow">DRIVE PAUSED</p>
          <h2>TAKE THE NEXT CORNER<br /><em>WHEN YOU'RE READY.</em></h2>
          <button id="resume" type="button"><span>RESUME DRIVE</span><small>ESC ALSO RESUMES</small></button>
          <p class="pause-tip">TIP <span>Ease off before turn-in for a cleaner line.</span></p>
        </div>
      </section>

      <section id="race-results" class="overlay results-overlay hidden" aria-label="Race results" aria-hidden="true">
        <div class="panel compact results-panel">
          <p class="eyebrow">COASTAL CHALLENGE</p>
          <h2 id="race-result-title">RACE WON</h2>
          <p id="race-result-detail" class="result-detail">+500 ROAD CREDITS</p>
          <p class="pause-tip"><kbd>ENTER</kbd> <span>RUN IT AGAIN</span></p>
        </div>
      </section>`;

    this.speed = this.byId('speed');
    this.gear = this.byId('gear');
    this.rpm = this.byId('rpm');
    this.mode = this.byId('camera-mode');
    this.surface = this.byId('surface');
    this.surfaceLabel = this.surface.lastElementChild as HTMLElement;
    this.tachometer = this.byId('tachometer');
    this.pause = this.byId('pause');
    this.menu = this.byId('menu');
    this.settingsPanel = this.byId('settings-panel');
    this.steeringInput = this.inputById('steering');
    this.steeringValue = this.byId('steering-value');
    this.audioInput = this.inputById('audio');
    this.volumeInput = this.inputById('master-volume');
    this.volumeValue = this.byId('volume-value');
    this.graphicsInput = this.selectById('graphics');
    this.handlingInput = this.selectById('handling');
    this.raceDifficultyInput = this.selectById('race-difficulty');
    this.notification = this.byId('notification');
    this.raceHud = this.byId('race-hud');
    this.racePrompt = this.byId('race-prompt');
    this.raceCountdown = this.byId('race-countdown');
    this.racePosition = this.byId('race-position');
    this.raceCheckpoint = this.byId('race-checkpoint');
    this.raceResults = this.byId('race-results');
    this.activityHud = this.byId('activity-hud');
    this.raceResultTitle = this.byId('race-result-title');
    this.raceResultDetail = this.byId('race-result-detail');
    this.restoreSettings();
    this.bindSettings();
  }

  private byId(id: string) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing UI element ${id}`);
    return element;
  }

  private inputById(id: string) {
    const element = this.byId(id);
    if (!(element instanceof HTMLInputElement)) throw new Error(`Expected input element ${id}`);
    return element;
  }
  private selectById(id: string) {
    const element = this.byId(id);
    if (!(element instanceof HTMLSelectElement)) throw new Error(`Expected select element ${id}`);
    return element;
  }

  private bindSettings() {
    const save = () => this.saveSettings();
    this.steeringInput.addEventListener('input', () => { this.updateSettingLabels(); save(); });
    this.volumeInput.addEventListener('input', () => { this.updateSettingLabels(); save(); });
    this.audioInput.addEventListener('change', save);
    this.graphicsInput.addEventListener('change', save);
    this.handlingInput.addEventListener('change', save);
    this.raceDifficultyInput.addEventListener('change', save);
    this.updateSettingLabels();
  }

  private restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('open-road-settings') ?? '{}') as { steering?: number; volume?: number; audio?: boolean; graphics?: GraphicsQuality; handling?: HandlingPreset; raceDifficulty?: RaceDifficulty };
      if (typeof saved.steering === 'number') this.steeringInput.value = String(Math.min(1.45, Math.max(0.6, saved.steering)));
      if (typeof saved.volume === 'number') this.volumeInput.value = String(Math.min(100, Math.max(0, saved.volume)));
      if (typeof saved.audio === 'boolean') this.audioInput.checked = saved.audio;
      if (saved.graphics === 'high' || saved.graphics === 'balanced' || saved.graphics === 'performance') this.graphicsInput.value = saved.graphics;
      if (saved.handling === 'arcade' || saved.handling === 'balanced' || saved.handling === 'simulation') this.handlingInput.value = saved.handling;
      if (saved.raceDifficulty === 'easy' || saved.raceDifficulty === 'normal' || saved.raceDifficulty === 'hard') this.raceDifficultyInput.value = saved.raceDifficulty;
    } catch { /* Storage is optional in private browser contexts. */ }
  }

  private saveSettings() {
    try {
      localStorage.setItem('open-road-settings', JSON.stringify({ steering: this.steering, volume: this.masterVolume, audio: this.audioEnabled, graphics: this.graphicsQuality, handling: this.handlingPreset, raceDifficulty: this.raceDifficulty }));
    } catch { /* Storage is optional in private browser contexts. */ }
  }

  private updateSettingLabels() {
    this.steeringValue.textContent = `${Math.round(this.steering * 100)}%`;
    this.volumeValue.textContent = `${this.masterVolume}%`;
  }

  update(data: VehicleTelemetry, cameraMode: string) {
    const roundedSpeed = Math.round(data.speedKph);
    const roundedRpm = Math.round(data.rpm / 100) * 100;
    this.speed.textContent = String(roundedSpeed).padStart(3, '0');
    this.gear.textContent = data.gear;
    this.rpm.textContent = `${roundedRpm} RPM`;
    const cameraLabel = `${cameraMode} CAM`;
    if (cameraLabel !== this.lastCameraMode) this.mode.textContent = cameraLabel;
    this.lastCameraMode = cameraLabel;
    const rpmLevel = Math.min(1, Math.max(0, data.rpm / 7200));
    this.tachometer.style.setProperty('--rpm-level', rpmLevel.toFixed(3));
    this.tachometer.setAttribute('aria-valuenow', String(Math.round(data.rpm)));

    const state = data.drifting ? 'drift' : data.grounded ? 'grip' : 'airborne';
    const label = data.drifting ? 'DRIFTING' : data.grounded ? 'GRIP READY' : 'AIRBORNE';
    if (state !== this.lastSurfaceState) {
      this.surface.dataset.state = state;
      this.surfaceLabel.textContent = label;
    }
    this.lastSurfaceState = state;
  }

  /** Receives the race layer's snapshot without owning race logic. */
  updateRace(race: RaceSnapshot) {
    const racing = race.state === 'countdown' || race.state === 'racing';
    this.setHidden(this.raceHud, !racing);
    const prompt = race.prompt ?? '';
    if (prompt !== this.lastRacePrompt) {
      this.racePrompt.textContent = prompt;
      this.racePrompt.classList.toggle('is-visible', Boolean(prompt));
    }
    this.lastRacePrompt = prompt;
    const position = `${race.position}/${race.totalRacers}`;
    if (position !== this.lastRacePosition) this.racePosition.innerHTML = `${race.position}<small>/ ${race.totalRacers}</small>`;
    this.lastRacePosition = position;
    const checkpoint = `${race.checkpoint}/${race.totalCheckpoints}`;
    if (checkpoint !== this.lastRaceCheckpoint) this.raceCheckpoint.innerHTML = `${race.checkpoint}<small>/ ${race.totalCheckpoints}</small>`;
    this.lastRaceCheckpoint = checkpoint;

    const countdown = race.countdown ?? '';
    this.raceCountdown.textContent = countdown;
    this.raceCountdown.classList.toggle('is-visible', Boolean(countdown));
    this.raceCountdown.classList.toggle('go', countdown === 'GO!');
    if (countdown && countdown !== this.lastCountdown) this.emitAudioCue('open-road:countdown', countdown);
    this.lastCountdown = countdown || undefined;

    const hasResults = race.state === 'results' && Boolean(race.result);
    this.setHidden(this.raceResults, !hasResults);
    if (hasResults) {
      const won = race.result === 'WIN';
      const result = `${race.result}:${race.reward ?? 0}`;
      if (result !== this.lastResult) {
        this.raceResultTitle.textContent = won ? 'RACE WON' : 'RIVAL TAKES IT';
        this.raceResultDetail.textContent = `+${race.reward ?? 0} ROAD CREDITS`;
      }
      this.lastResult = result;
      if (this.lastRaceState !== 'results') this.emitAudioCue('open-road:race-result', won ? 'win' : 'lose');
    }
    if (!hasResults) this.lastResult = undefined;
    this.lastRaceState = race.state;
  }

  updateActivities(activities: ActivitySnapshot) {
    const drift = activities.driftScore > 0 ? `DRIFT ZONE ${activities.driftScore} PTS` : '';
    const trial = activities.activeTrial ? `TIME TRIAL ${this.formatTime(activities.trialTime)}  ·  ${Math.min(activities.trialCheckpoint + 1, activities.trialTotal)}/${activities.trialTotal}` : '';
    const text = trial || drift;
    this.activityHud.textContent = text;
    this.setHidden(this.activityHud, !text);
  }

  setPaused(value: boolean) {
    this.setHidden(this.pause, !value);
    this.emitAudioCue('open-road:pause', value ? 'paused' : 'resumed');
  }

  hideMenu() { this.setHidden(this.menu, true); }

  on(id: string, listener: () => void) {
    this.byId(id).addEventListener('click', () => {
      listener();
      this.emitAudioCue('open-road:ui-confirm', id);
    });
  }

  get steering() { return Number(this.steeringInput.value); }
  get audioEnabled() { return this.audioInput.checked; }
  get masterVolume() { return Number(this.volumeInput.value); }
  get graphicsQuality() { return this.graphicsInput.value as GraphicsQuality; }
  get handlingPreset() { return this.handlingInput.value as HandlingPreset; }
  get raceDifficulty() { return this.raceDifficultyInput.value as RaceDifficulty; }

  toggleSettings() {
    const willOpen = this.settingsPanel.classList.contains('hidden');
    this.setHidden(this.settingsPanel, !willOpen);
    this.byId('settings').setAttribute('aria-expanded', String(willOpen));
  }

  notify(message: string, tone: NoticeTone = 'neutral') {
    this.notification.textContent = message;
    this.notification.dataset.tone = tone;
    this.notification.classList.add('is-visible');
    if (this.notificationTimer) window.clearTimeout(this.notificationTimer);
    this.notificationTimer = window.setTimeout(() => this.notification.classList.remove('is-visible'), 2600);
  }

  private setHidden(element: HTMLElement, hidden: boolean) {
    element.classList.toggle('hidden', hidden);
    element.setAttribute('aria-hidden', String(hidden));
  }

  private emitAudioCue(name: string, detail: string) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private formatTime(seconds: number) { const minutes = Math.floor(seconds / 60); return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, '0')}`; }
}
