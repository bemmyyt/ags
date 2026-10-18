import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { EngineAudio } from '../audio/EngineAudio';
import { ChaseCamera } from '../camera/ChaseCamera';
import { Input } from '../core/Input';
import { Vehicle } from '../physics/Vehicle';
import { Hud } from '../ui/Hud';
import { TrafficSystem } from '../traffic/TrafficSystem';
import { RaceSystem } from '../racing/RaceSystem';
import { createTestWorld } from '../world/TestWorld';

export class Game {
  private readonly renderer: THREE.WebGLRenderer; private readonly scene = new THREE.Scene(); private readonly camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 500);
  private readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); private readonly input = new Input(); private readonly vehicle: Vehicle; private readonly chase: ChaseCamera; private readonly audio = new EngineAudio(); private readonly traffic: TrafficSystem; private readonly race: RaceSystem;
  private running = false; private paused = false; private accumulator = 0; private last = performance.now();
  constructor(private readonly hud: Hud) {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas'); if (!canvas) throw new Error('Game canvas missing');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(innerWidth, innerHeight); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    createTestWorld(this.scene, this.world); this.vehicle = new Vehicle(this.world, this.scene); this.traffic = new TrafficSystem(this.scene); this.race = new RaceSystem(this.scene); this.chase = new ChaseCamera(this.camera); this.chase.reset(this.vehicle);
    addEventListener('resize', () => this.resize()); this.bindUi(); requestAnimationFrame((time) => this.frame(time));
  }
  private bindUi() {
    this.hud.on('drive', () => this.start()); this.hud.on('resume', () => this.setPaused(false)); this.hud.on('settings', () => this.hud.toggleSettings());
  }
  private start() { this.running = true; this.hud.hideMenu(); this.audio.start(); }
  private setPaused(value: boolean) { this.paused = value; this.hud.setPaused(value); }
  private resize() { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); }
  private frame(now: number) {
    const delta = Math.min((now - this.last) / 1000, 0.08); this.last = now;
    if (this.running && !this.paused) {
      if (this.input.take('KeyR')) { this.vehicle.reset(); this.hud.notify('VEHICLE RECOVERED', 'success'); }
      if (this.input.take('KeyC')) { this.chase.toggleMode(); this.hud.notify(`${this.chase.mode} CAMERA`, 'neutral'); }
      if (this.input.take('Escape')) this.setPaused(true);
      this.accumulator += delta; let telemetry = this.vehicle.update(0, this.input, this.hud.steering);
      while (this.accumulator >= 1 / 60) { telemetry = this.vehicle.update(1 / 60, this.input, this.hud.steering); this.world.step(); this.accumulator -= 1 / 60; }
      this.traffic.update(delta, this.vehicle.position); const race = this.race.update(delta, this.vehicle.position, this.input.take('KeyE'), this.input.take('Enter'));
      this.chase.update(delta, this.vehicle, telemetry.speedKph); this.audio.enabled = this.hud.audioEnabled; this.audio.update(telemetry.rpm, telemetry.drifting); this.hud.update(telemetry, this.chase.mode); this.hud.updateRace(race);
    } else if (this.running && this.input.take('Escape')) this.setPaused(false);
    this.renderer.render(this.scene, this.camera); requestAnimationFrame((time) => this.frame(time));
  }
}
