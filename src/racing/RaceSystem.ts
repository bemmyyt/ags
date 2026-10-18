import * as THREE from 'three';

export type RaceState = 'idle' | 'nearby' | 'countdown' | 'racing' | 'results';
export type RaceSnapshot = {
  state: RaceState;
  countdown?: string;
  checkpoint: number;
  totalCheckpoints: number;
  position: number;
  totalRacers: number;
  result?: 'WIN' | 'LOSE';
  reward?: number;
  prompt?: string;
};

class RaceOpponent {
  readonly group = new THREE.Group();
  private target = 0;
  private speed = 0;
  private finished = false;

  constructor(private readonly start: THREE.Vector3, private readonly course: THREE.Vector3[]) {
    const paint = new THREE.MeshStandardMaterial({ color: '#ffc14c', metalness: 0.7, roughness: 0.22 });
    const glass = new THREE.MeshStandardMaterial({ color: '#142835', metalness: 0.35, roughness: 0.12 });
    const rubber = new THREE.MeshStandardMaterial({ color: '#0d1014', roughness: 0.65 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.48, 3.68, 3, 2, 4), paint); body.position.y = 0.46; body.castShadow = true; this.group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.55, 1.42, 2, 2, 3), glass); cabin.position.set(0, 0.9, -0.2); cabin.castShadow = true; this.group.add(cabin);
    for (const x of [-0.64, 0.64]) for (const z of [-1.3, 1.3]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14), rubber); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.3, z); wheel.castShadow = true; this.group.add(wheel); }
    this.reset();
  }
  reset() { this.group.position.copy(this.start); this.target = 0; this.speed = 0; this.finished = false; this.group.visible = true; }
  update(dt: number) {
    if (this.finished) return;
    const destination = this.course[this.target]; const offset = destination.clone().sub(this.group.position); const distance = offset.length();
    if (distance < 2.2) { this.target += 1; if (this.target >= this.course.length) { this.finished = true; this.speed = 0; return; } }
    const target = this.course[Math.min(this.target, this.course.length - 1)]; const direction = target.clone().sub(this.group.position).normalize();
    const after = this.course[Math.min(this.target + 1, this.course.length - 1)].clone().sub(target).normalize();
    const corner = Math.acos(THREE.MathUtils.clamp(direction.dot(after), -1, 1));
    const desiredSpeed = THREE.MathUtils.lerp(16, 8, corner / Math.PI);
    this.speed = THREE.MathUtils.damp(this.speed, desiredSpeed, desiredSpeed < this.speed ? 5 : 1.6, dt);
    this.group.position.addScaledVector(direction, Math.min(this.speed * dt, distance));
    const goal = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    this.group.quaternion.slerp(goal, 1 - Math.exp(-dt * 7));
  }
  get progress() { return this.target; }
  get isFinished() { return this.finished; }
}

/** A compact, checkpoint-based challenge against a route-following rival. */
export class RaceSystem {
  private readonly start = new THREE.Vector3(2, 0, 40);
  private readonly checkpoints = [
    new THREE.Vector3(0, 0, -35), new THREE.Vector3(46, 0, -38), new THREE.Vector3(79, 0, -20),
    new THREE.Vector3(79, 0, 20), new THREE.Vector3(35, 0, 49), new THREE.Vector3(0, 0, 48),
  ];
  private readonly rival: RaceOpponent;
  private readonly gates: { group: THREE.Group; glow: THREE.MeshStandardMaterial }[] = [];
  private state: RaceState = 'idle';
  private countdown = 0;
  private playerCheckpoint = 0;
  private result?: 'WIN' | 'LOSE';
  private reward?: number;

  constructor(scene: THREE.Scene) {
    this.rival = new RaceOpponent(this.start, this.checkpoints);
    scene.add(this.rival.group);
    const line = new THREE.Mesh(new THREE.BoxGeometry(8, 0.03, 0.8), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.15 }));
    line.position.copy(this.start).add(new THREE.Vector3(0, 0.02, -1.2)); scene.add(line);
    this.checkpoints.forEach((point) => {
      const group = new THREE.Group(); const glow = new THREE.MeshStandardMaterial({ color: '#83dfff', emissive: '#16779e', emissiveIntensity: 0.65, metalness: 0.4, roughness: 0.28 });
      for (const x of [-4.5, 4.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 0.25), glow); post.position.set(x, 2.1, 0); group.add(post); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(9.25, 0.25, 0.25), glow); top.position.y = 4.2; group.add(top);
      group.position.copy(point); group.visible = false; scene.add(group); this.gates.push({ group, glow });
    });
  }

  update(dt: number, player: THREE.Vector3, requestStart: boolean, requestRetry: boolean): RaceSnapshot {
    const closeToStart = player.distanceTo(this.start) < 12;
    if ((this.state === 'idle' || this.state === 'nearby') && requestStart && closeToStart) this.begin();
    if (this.state === 'idle' || this.state === 'nearby') this.state = closeToStart ? 'nearby' : 'idle';
    if (this.state === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.state = 'racing'; this.countdown = 0; }
    } else if (this.state === 'racing') {
      this.rival.update(dt);
      if (player.distanceTo(this.checkpoints[this.playerCheckpoint]) < 11) this.playerCheckpoint += 1;
      if (this.rival.isFinished) this.finish('LOSE');
      else if (this.playerCheckpoint >= this.checkpoints.length) this.finish('WIN');
    } else if (this.state === 'results' && requestRetry) this.begin();
    this.updateGates();
    return this.snapshot(closeToStart);
  }

  private begin() { this.state = 'countdown'; this.countdown = 3; this.playerCheckpoint = 0; this.result = undefined; this.reward = undefined; this.rival.reset(); }
  private finish(result: 'WIN' | 'LOSE') {
    this.state = 'results'; this.result = result; this.reward = result === 'WIN' ? 500 : 75;
    try { const existing = Number(localStorage.getItem('open-road-credits') ?? 0); localStorage.setItem('open-road-credits', String(existing + this.reward)); } catch { /* saving is optional in private browser contexts */ }
  }
  private updateGates() {
    const visible = this.state === 'countdown' || this.state === 'racing';
    this.gates.forEach((gate, index) => {
      gate.group.visible = visible;
      gate.glow.emissiveIntensity = index === this.playerCheckpoint ? 2.3 : 0.22;
      gate.glow.emissive.set(index === this.playerCheckpoint ? '#42cfff' : '#14516b');
    });
  }
  private snapshot(closeToStart: boolean): RaceSnapshot {
    const npcAhead = this.rival.progress > this.playerCheckpoint || (this.rival.isFinished && this.playerCheckpoint < this.checkpoints.length);
    const resultText = this.state === 'nearby' ? 'PRESS E TO CHALLENGE RIVAL' : undefined;
    return {
      state: this.state, countdown: this.state === 'countdown' ? String(Math.max(1, Math.ceil(this.countdown))) : this.state === 'racing' ? 'GO!' : undefined,
      checkpoint: Math.min(this.playerCheckpoint + 1, this.checkpoints.length), totalCheckpoints: this.checkpoints.length,
      position: npcAhead ? 2 : 1, totalRacers: 2, result: this.result, reward: this.reward,
      prompt: closeToStart ? resultText : undefined,
    };
  }
}
