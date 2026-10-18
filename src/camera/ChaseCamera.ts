import * as THREE from 'three';
import type { Vehicle } from '../physics/Vehicle';

export class ChaseCamera {
  private readonly desired = new THREE.Vector3();
  private readonly lookAt = new THREE.Vector3();
  private hood = false;
  constructor(readonly camera: THREE.PerspectiveCamera) {}

  toggleMode() { this.hood = !this.hood; }
  reset(vehicle: Vehicle) { this.camera.position.copy(vehicle.position).add(new THREE.Vector3(0, 3, -7)); }
  update(dt: number, vehicle: Vehicle, speedKph: number) {
    const pos = vehicle.position; const q = vehicle.quaternion;
    const back = new THREE.Vector3(0, 0, this.hood ? 0.9 : -7.8).applyQuaternion(q);
    const lift = new THREE.Vector3(0, this.hood ? 0.9 : 2.7, 0);
    this.desired.copy(pos).add(back).add(lift);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-dt * (this.hood ? 12 : 5.5)));
    this.lookAt.copy(pos).add(new THREE.Vector3(0, this.hood ? 0.65 : 0.5, this.hood ? 10 : 5.2).applyQuaternion(q));
    this.camera.lookAt(this.lookAt);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, this.hood ? 78 : 62 + Math.min(speedKph * 0.11, 13), 4, dt);
    this.camera.updateProjectionMatrix();
  }
  get mode() { return this.hood ? 'HOOD' : 'CHASE'; }
}
