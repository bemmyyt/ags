import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Input } from '../core/Input';

export type VehicleTelemetry = { speedKph: number; rpm: number; gear: string; drifting: boolean; grounded: boolean };

const UP = new THREE.Vector3(0, 1, 0);

export class Vehicle {
  readonly body: RAPIER.RigidBody;
  readonly model = new THREE.Group();
  readonly wheels: { pivot: THREE.Group; mesh: THREE.Mesh }[] = [];
  private readonly spawn = new THREE.Vector3(0, 1.25, 25);
  private steering = 0;
  private wheelAngle = 0;
  private grounded = false;
  private telemetry: VehicleTelemetry = { speedKph: 0, rpm: 900, gear: 'N', drifting: false, grounded: false };

  constructor(private readonly world: RAPIER.World, scene: THREE.Scene) {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.spawn.x, this.spawn.y, this.spawn.z)
      .setLinearDamping(0.12)
      .setAngularDamping(2.4)
      .setAdditionalMass(980)
      .setCanSleep(false);
    this.body = world.createRigidBody(desc);
    const chassis = RAPIER.ColliderDesc.cuboid(0.91, 0.32, 1.98).setFriction(1.15).setRestitution(0.04);
    world.createCollider(chassis, this.body);
    this.createModel();
    scene.add(this.model);
  }

  private createModel() {
    const paint = new THREE.MeshStandardMaterial({ color: '#d83d39', metalness: 0.72, roughness: 0.23 });
    const darkPaint = new THREE.MeshStandardMaterial({ color: '#531016', metalness: 0.62, roughness: 0.28 });
    const glass = new THREE.MeshStandardMaterial({ color: '#102735', metalness: 0.25, roughness: 0.08, transparent: true, opacity: 0.82 });
    const black = new THREE.MeshStandardMaterial({ color: '#101215', roughness: 0.52, metalness: 0.12 });
    const lamp = new THREE.MeshStandardMaterial({ color: '#e8f4ff', emissive: '#8dbfff', emissiveIntensity: 1.8, roughness: 0.15 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.83, 0.48, 3.95, 3, 2, 5), paint);
    body.position.y = 0.1; body.castShadow = body.receiveShadow = true; this.model.add(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.18, 1.22, 3, 1, 2), darkPaint);
    hood.position.set(0, 0.39, 1.11); hood.rotation.x = -0.045; hood.castShadow = true; this.model.add(hood);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.51, 0.58, 1.63, 3, 2, 3), glass);
    cabin.position.set(0, 0.64, -0.26); cabin.rotation.x = -0.08; cabin.castShadow = true; this.model.add(cabin);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.05), black);
    grille.position.set(0, 0.15, 2.0); this.model.add(grille);
    for (const x of [-0.61, 0.61]) for (const z of [1.74, -1.74]) {
      const pivot = new THREE.Group(); pivot.position.set(x, -0.3, z); this.model.add(pivot);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.23, 18), black);
      tire.rotation.z = Math.PI / 2; tire.castShadow = true; pivot.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.245, 12), new THREE.MeshStandardMaterial({ color: '#b8bec6', metalness: 0.85, roughness: 0.25 }));
      rim.rotation.z = Math.PI / 2; pivot.add(rim); this.wheels.push({ pivot, mesh: tire });
    }
    for (const x of [-0.6, 0.6]) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), lamp);
      light.position.set(x, 0.38, 1.98); this.model.add(light);
    }
  }

  update(dt: number, input: Input, steeringSensitivity: number): VehicleTelemetry {
    const t = this.body.translation();
    this.grounded = false;
    for (const [x, z] of [[-0.68, -1.4], [0.68, -1.4], [-0.68, 1.4], [0.68, 1.4]]) {
      const hit = this.world.castRay(new RAPIER.Ray({ x: t.x + x, y: t.y - 0.34, z: t.z + z }, { x: 0, y: -1, z: 0 }), 0.55, true);
      if (hit) this.grounded = true;
    }
    const q = this.body.rotation();
    const rotation = new THREE.Quaternion(q.x, q.y, q.z, q.w);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).normalize();
    const velocity = this.body.linvel();
    const v = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const forwardSpeed = v.dot(forward); const lateralSpeed = v.dot(right);
    const speed = v.length();
    const accelerate = input.down('KeyW', 'ArrowUp'); const brake = input.down('KeyS', 'ArrowDown'); const handbrake = input.down('Space');
    const steerInput = (input.down('KeyA', 'ArrowLeft') ? 1 : 0) - (input.down('KeyD', 'ArrowRight') ? 1 : 0);
    const steerLimit = THREE.MathUtils.lerp(0.78, 0.23, THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 42, 0, 1));
    this.steering = THREE.MathUtils.damp(this.steering, steerInput * steerLimit * steeringSensitivity, 8, dt);
    const drive = accelerate ? 1 : brake && forwardSpeed < 1.2 ? -0.62 : 0;
    const braking = brake && forwardSpeed > 1.2;
    if (this.grounded) {
      const engine = drive * (Math.abs(forwardSpeed) < 25 ? 12800 : 6800);
      this.impulse(forward, engine * dt);
      if (braking) this.impulse(forward, -Math.sign(forwardSpeed) * 16000 * dt);
      const grip = handbrake ? 1.25 : 8.6;
      this.impulse(right, -lateralSpeed * 980 * grip * dt);
      this.impulse(forward, -forwardSpeed * Math.abs(forwardSpeed) * 5.2 * dt);
      const yawAuthority = THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 3.2, 0, 1) * (handbrake ? 1.4 : 1);
      this.body.applyTorqueImpulse({ x: 0, y: this.steering * 1300 * yawAuthority * dt, z: 0 }, true);
      this.impulse(UP, -Math.min(speed * speed * 0.48, 620) * dt);
    }
    const correcting = up.clone().cross(UP).multiplyScalar(580 * dt);
    this.body.applyTorqueImpulse({ x: correcting.x, y: 0, z: correcting.z }, true);
    this.syncVisual(rotation, speed, lateralSpeed);
    const kph = Math.abs(forwardSpeed) * 3.6;
    const gear = forwardSpeed < -1 ? 'R' : kph < 1 ? 'N' : String(Math.min(6, Math.floor(kph / 38) + 1));
    this.telemetry = { speedKph: kph, rpm: THREE.MathUtils.clamp(900 + Math.abs(forwardSpeed) * 190 + Math.abs(drive) * 1100, 850, 7200), gear, drifting: Math.abs(lateralSpeed) > 3.4 && speed > 7, grounded: this.grounded };
    return this.telemetry;
  }

  private impulse(direction: THREE.Vector3, magnitude: number) {
    this.body.applyImpulse({ x: direction.x * magnitude, y: direction.y * magnitude, z: direction.z * magnitude }, true);
  }
  private syncVisual(rotation: THREE.Quaternion, speed: number, lateral: number) {
    const p = this.body.translation(); this.model.position.set(p.x, p.y, p.z); this.model.quaternion.copy(rotation);
    this.wheelAngle += speed * 0.045;
    this.wheels.forEach(({ pivot, mesh }, index) => { if (index >= 2) pivot.rotation.y = this.steering; mesh.rotation.x = this.wheelAngle; });
    this.model.rotation.z += THREE.MathUtils.clamp(-lateral * 0.018, -0.08, 0.08);
  }
  reset() {
    this.body.setTranslation(this.spawn, true); this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  get position() { const p = this.body.translation(); return new THREE.Vector3(p.x, p.y, p.z); }
  get quaternion() { const q = this.body.rotation(); return new THREE.Quaternion(q.x, q.y, q.z, q.w); }
}
