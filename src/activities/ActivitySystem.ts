import * as THREE from 'three';
import type { VehicleTelemetry } from '../physics/Vehicle';

export type ActivitySnapshot = {
  activeTrial: boolean;
  trialTime: number;
  trialCheckpoint: number;
  trialTotal: number;
  driftScore: number;
  notice?: { message: string; tone: 'neutral' | 'success' };
};

type ActivityRecords = { speedTrap?: number; timeTrial?: number; driftZone?: number };

/** Small free-roam challenges built from actual player movement and existing credits. */
export class ActivitySystem {
  private readonly speedTrap = new THREE.Vector3(0, 0, -18);
  private readonly trialStart = new THREE.Vector3(-72, 0, 34);
  private readonly trialCheckpoints = [new THREE.Vector3(-6, 0, 34), new THREE.Vector3(0, 0, -34), new THREE.Vector3(47, 0, -38), new THREE.Vector3(79, 0, 18)];
  private readonly driftCenter = new THREE.Vector3(42, 0, -38);
  private lastTrapDistance = Infinity;
  private trapCooldown = 0;
  private trialActive = false;
  private trialStartArmed = true;
  private trialTime = 0;
  private trialCheckpoint = 0;
  private driftScore = 0;
  private wasInDriftZone = false;
  private readonly records = this.loadRecords();

  update(dt: number, player: THREE.Vector3, telemetry: VehicleTelemetry): ActivitySnapshot {
    let notice: ActivitySnapshot['notice'];
    this.trapCooldown = Math.max(0, this.trapCooldown - dt);
    const trapDistance = player.distanceTo(this.speedTrap);
    if (trapDistance < 4 && this.lastTrapDistance >= 4 && this.trapCooldown === 0) {
      this.trapCooldown = 2;
      const speed = Math.round(telemetry.speedKph);
      if (speed > (this.records.speedTrap ?? 0)) {
        this.records.speedTrap = speed; this.saveRecords(); this.addCredits(75);
        notice = { message: `SPEED CAMERA: ${speed} KM/H — NEW RECORD +75`, tone: 'success' };
      } else notice = { message: `SPEED CAMERA: ${speed} KM/H`, tone: 'neutral' };
    }
    this.lastTrapDistance = trapDistance;

    const startDistance = player.distanceTo(this.trialStart);
    if (startDistance > 13) this.trialStartArmed = true;
    if (!this.trialActive && this.trialStartArmed && startDistance < 7) {
      this.trialActive = true; this.trialStartArmed = false; this.trialTime = 0; this.trialCheckpoint = 0;
      notice = { message: 'TIME TRIAL STARTED — FOLLOW THE COAST', tone: 'neutral' };
    }
    if (this.trialActive) {
      this.trialTime += dt;
      if (player.distanceTo(this.trialCheckpoints[this.trialCheckpoint]) < 10) {
        this.trialCheckpoint += 1;
        if (this.trialCheckpoint >= this.trialCheckpoints.length) {
          this.trialActive = false;
          const previous = this.records.timeTrial;
          if (previous === undefined || this.trialTime < previous) {
            this.records.timeTrial = this.trialTime; this.saveRecords(); this.addCredits(250);
            notice = { message: `TIME TRIAL RECORD: ${this.formatTime(this.trialTime)} +250`, tone: 'success' };
          } else notice = { message: `TIME TRIAL: ${this.formatTime(this.trialTime)} — BEAT ${this.formatTime(previous)}`, tone: 'neutral' };
        }
      }
    }

    const inDriftZone = player.distanceTo(this.driftCenter) < 29;
    if (inDriftZone && telemetry.drifting && telemetry.speedKph > 25) this.driftScore += dt * telemetry.speedKph * 0.85;
    if (this.wasInDriftZone && !inDriftZone && this.driftScore >= 100) {
      const score = Math.round(this.driftScore);
      if (score > (this.records.driftZone ?? 0)) {
        this.records.driftZone = score; this.saveRecords(); this.addCredits(100);
        notice = { message: `DRIFT ZONE: ${score} PTS — NEW RECORD +100`, tone: 'success' };
      } else notice = { message: `DRIFT ZONE: ${score} PTS`, tone: 'neutral' };
      this.driftScore = 0;
    }
    if (!inDriftZone && !this.wasInDriftZone) this.driftScore = 0;
    this.wasInDriftZone = inDriftZone;

    return { activeTrial: this.trialActive, trialTime: this.trialTime, trialCheckpoint: this.trialCheckpoint, trialTotal: this.trialCheckpoints.length, driftScore: Math.round(this.driftScore), notice };
  }

  private loadRecords(): ActivityRecords {
    try { return JSON.parse(localStorage.getItem('open-road-activity-records') ?? '{}') as ActivityRecords; } catch { return {}; }
  }
  private saveRecords() { try { localStorage.setItem('open-road-activity-records', JSON.stringify(this.records)); } catch { /* Optional in private contexts. */ } }
  private addCredits(amount: number) {
    try { const credits = Number(localStorage.getItem('open-road-credits') ?? 0); localStorage.setItem('open-road-credits', String(credits + amount)); } catch { /* Optional in private contexts. */ }
  }
  private formatTime(seconds: number) { const minutes = Math.floor(seconds / 60); return `${minutes}:${(seconds % 60).toFixed(2).padStart(5, '0')}`; }
}
