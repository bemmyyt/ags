import * as THREE from 'three';
import type { Vehicle } from '../physics/Vehicle';

export class ChaseCamera {
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private hood = false;
  private lastSpeed = 0;
  private shakeTime = 0;
  constructor(readonly camera: THREE.PerspectiveCamera) {}

  toggleMode() { this.hood = !this.hood; }
  reset(vehicle: Vehicle) { this.camera.position.copy(vehicle.position).add(new THREE.Vector3(0, 3, -7)); }
  update(dt: number, vehicle: Vehicle, speedKph: number) {
    const pos = vehicle.position; const q = vehicle.quaternion;
    const speedFactor = THREE.MathUtils.smoothstep(speedKph, 25, 220);
    const acceleration = THREE.MathUtils.clamp((speedKph - this.lastSpeed) / Math.max(dt, 0.001), -80, 80);
    this.lastSpeed = speedKph;
    const followDistance = this.hood ? 0.9 : 7.8 + speedFactor * 2.65 + THREE.MathUtils.clamp(acceleration * 0.018, -0.35, 0.9);
    const back = new THREE.Vector3(0, 0, -followDistance).applyQuaternion(q);
    const lift = new THREE.Vector3(0, this.hood ? 0.9 : 2.7 + speedFactor * 0.38, 0);
    this.desired.copy(pos).add(back).add(lift);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * (this.hood ? 12 : 5.1)));
    this.shakeTime += dt * (14 + speedFactor * 22);
    const shake = this.hood ? 0 : speedFactor * 0.024;
    this.camera.position.add(new THREE.Vector3(Math.sin(this.shakeTime * 1.7) * shake, Math.sin(this.shakeTime * 2.3) * shake * 0.55, 0).applyQuaternion(q));
    this.lookAt.copy(pos).add(new THREE.Vector3(0, this.hood ? 0.65 : 0.5, this.hood ? 10 : 5.2 + speedFactor * 1.1).applyQuaternion(q));
    this.camera.lookAt(this.lookAt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.hood ? 78 : 62 + speedFactor * 18, 4.5, dt);
    this.camera.updateProjectionMatrix();
  }
  get mode() { return this.hood ? 'HOOD' : 'CHASE'; }
}
