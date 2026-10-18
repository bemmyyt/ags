import type { VehicleTelemetry } from '../physics/Vehicle';

export class Hud {
  private readonly speed: HTMLElement; private readonly gear: HTMLElement; private readonly rpm: HTMLElement; private readonly mode: HTMLElement; private readonly pause: HTMLElement;
  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <canvas id="game-canvas"></canvas>
      <section class="hud"><div class="brand">OPEN <span>ROAD</span><small>DRIVING PROTOTYPE</small></div><div class="status"><span id="camera-mode">CHASE</span><span>•</span><span id="surface">GRIP OK</span></div><div class="cluster"><div><b id="speed">000</b><em>KM/H</em></div><div class="gear"><b id="gear">N</b><em>GEAR</em></div><div class="rpm"><i></i><span id="rpm">900 RPM</span></div></div></section>
      <section id="menu" class="overlay"><div class="panel"><p class="eyebrow">COASTAL TEST ROUTE</p><h1>OPEN <span>ROAD</span></h1><p class="lead">A focused driving prototype built around weight, grip, and the pleasure of a clean corner.</p><button id="drive">DRIVE</button><button id="settings" class="ghost">SETTINGS</button><div id="settings-panel" class="settings hidden"><label>STEERING RESPONSE <input id="steering" type="range" min="0.6" max="1.45" step="0.05" value="1" /></label><label><input id="audio" type="checkbox" checked /> ENGINE AUDIO</label></div><p class="controls">WASD / ARROWS <span>DRIVE</span> &nbsp; SPACE <span>HANDBRAKE</span><br />R <span>RECOVER</span> &nbsp; C <span>CAMERA</span> &nbsp; ESC <span>PAUSE</span></p></div></section>
      <section id="pause" class="overlay hidden"><div class="panel compact"><p class="eyebrow">PAUSED</p><h2>TAKE A BREATH.</h2><button id="resume">RESUME DRIVE</button><p class="controls">ESC TO RESUME</p></div></section>`;
    this.speed = this.byId('speed'); this.gear = this.byId('gear'); this.rpm = this.byId('rpm'); this.mode = this.byId('camera-mode'); this.pause = this.byId('pause');
  }
  private byId(id: string) { const e = document.getElementById(id); if (!e) throw new Error(`Missing UI element ${id}`); return e; }
  update(data: VehicleTelemetry, cameraMode: string) { this.speed.textContent = String(Math.round(data.speedKph)).padStart(3, '0'); this.gear.textContent = data.gear; this.rpm.textContent = `${Math.round(data.rpm / 100) * 100} RPM`; this.mode.textContent = cameraMode; this.byId('surface').textContent = data.drifting ? 'DRIFT' : data.grounded ? 'GRIP OK' : 'AIRBORNE'; }
  setPaused(value: boolean) { this.pause.classList.toggle('hidden', !value); }
  hideMenu() { this.byId('menu').classList.add('hidden'); }
  on(id: string, listener: () => void) { this.byId(id).addEventListener('click', listener); }
  get steering() { return Number((this.byId('steering') as HTMLInputElement).value); }
  get audioEnabled() { return (this.byId('audio') as HTMLInputElement).checked; }
  toggleSettings() { this.byId('settings-panel').classList.toggle('hidden'); }
}
