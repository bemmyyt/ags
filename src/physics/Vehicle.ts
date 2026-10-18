import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Input } from '../core/Input';

export type VehicleTelemetry = { speedKph: number; rpm: number; gear: string; drifting: boolean; grounded: boolean };
export type HandlingPreset = 'arcade' | 'balanced' | 'simulation';

type HandlingTuning = {
  maxSpeed: number; reverseSpeed: number; driveForce: number; reverseForce: number; brakeForce: number;
  lowSpeedSteer: number; highSpeedSteer: number; lateralStiffness: number; grip: number;
  handbrakeGrip: number; yawDamping: number; springRate: number; damperRate: number; downforce: number; roll: number;
};

export const HANDLING_PRESETS: Record<HandlingPreset, HandlingTuning> = {
  arcade: { maxSpeed: 78, reverseSpeed: 18, driveForce: 21000, reverseForce: 9000, brakeForce: 24500, lowSpeedSteer: 0.76, highSpeedSteer: 0.28, lateralStiffness: 15400, grip: 1.34, handbrakeGrip: 0.44, yawDamping: 570, springRate: 17200, damperRate: 5000, downforce: 2.6, roll: 0.075 },
  balanced: { maxSpeed: 70, reverseSpeed: 16, driveForce: 17500, reverseForce: 7600, brakeForce: 21500, lowSpeedSteer: 0.68, highSpeedSteer: 0.22, lateralStiffness: 13300, grip: 1.24, handbrakeGrip: 0.52, yawDamping: 720, springRate: 18000, damperRate: 5200, downforce: 2.1, roll: 0.09 },
  simulation: { maxSpeed: 63, reverseSpeed: 14, driveForce: 14500, reverseForce: 6500, brakeForce: 18800, lowSpeedSteer: 0.59, highSpeedSteer: 0.17, lateralStiffness: 11600, grip: 1.16, handbrakeGrip: 0.62, yawDamping: 880, springRate: 19000, damperRate: 5700, downforce: 1.65, roll: 0.11 },
};

type Wheel = { local: THREE.Vector3; front: boolean; pivot: THREE.Group; mesh: THREE.Mesh; compression: number; grounded: boolean };

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const WHEEL_RADIUS = 0.34;
const SPRING_REST = 0.34;
const MAX_RAY = 0.92;

/** A raycast-suspension arcade car with genuine Rapier chassis collisions. */
export class Vehicle {
  readonly body: RAPIER.RigidBody;
  readonly model = new THREE.Group();
  readonly wheels: Wheel[] = [];
  private readonly spawn = new THREE.Vector3(0, 0.82, 25);
  private steering = 0;
  private throttle = 0;
  private brake = 0;
  private gear = 1;
  private wheelAngle = 0;
  private grounded = false;
  private visualRoll = 0;
  private telemetry: VehicleTelemetry = { speedKph: 0, rpm: 900, gear: 'N', drifting: false, grounded: false };

  constructor(private readonly world: RAPIER.World, scene: THREE.Scene) {
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(this.spawn.x, this.spawn.y, this.spawn.z)
      .setLinearDamping(0.03).setAngularDamping(1.35).setAdditionalMass(980).setCanSleep(false);
    this.body = world.createRigidBody(desc);
    // Underbody collider supplies stable real collisions; tires carry the car normally.
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.84, 0.36, 1.82).setFriction(0.55).setRestitution(0.03), this.body);
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
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.18, 0.05), black); grille.position.set(0, 0.15, 2.0); this.model.add(grille);
    const layout = [{ x: -0.72, z: 1.36, front: true }, { x: 0.72, z: 1.36, front: true }, { x: -0.72, z: -1.36, front: false }, { x: 0.72, z: -1.36, front: false }];
    for (const spec of layout) {
      const pivot = new THREE.Group(); pivot.position.set(spec.x, -0.43, spec.z); this.model.add(pivot);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.23, 18), black); tire.rotation.z = Math.PI / 2; tire.castShadow = true; pivot.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.245, 12), new THREE.MeshStandardMaterial({ color: '#b8bec6', metalness: 0.85, roughness: 0.25 })); rim.rotation.z = Math.PI / 2; pivot.add(rim);
      this.wheels.push({ local: new THREE.Vector3(spec.x, -0.1, spec.z), front: spec.front, pivot, mesh: tire, compression: 0, grounded: false });
    }
    for (const x of [-0.6, 0.6]) { const light = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.06), lamp); light.position.set(x, 0.38, 1.98); this.model.add(light); }
  }

  update(dt: number, input: Input, steeringSensitivity: number, preset: HandlingPreset = 'balanced'): VehicleTelemetry {
    if (dt === 0) return this.telemetry;
    const tuning = HANDLING_PRESETS[preset];
    const q = this.body.rotation(); const rotation = new THREE.Quaternion(q.x, q.y, q.z, q.w); const bodyPosition = this.position;
    // A failed collision should never turn into an unrecoverable launch.
    if (bodyPosition.y > 12 || bodyPosition.y < -5) { this.reset(); return this.telemetry; }
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).normalize();
    const bodyUp = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).normalize();
    const rawVelocity = this.body.linvel(); const velocity = new THREE.Vector3(rawVelocity.x, rawVelocity.y, rawVelocity.z); const forwardSpeed = velocity.dot(forward); const speed = velocity.length();
    const accelerate = input.down('KeyW', 'ArrowUp'); const brakeKey = input.down('KeyS', 'ArrowDown'); const handbrake = input.down('Space');
    // Forward is +Z and positive yaw turns toward +X, so left input must be negative.
    const steerInput = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const steeringLimit = THREE.MathUtils.lerp(tuning.lowSpeedSteer, tuning.highSpeedSteer, THREE.MathUtils.smoothstep(Math.abs(forwardSpeed), 5, 42));
    this.steering = THREE.MathUtils.damp(this.steering, steerInput * steeringLimit * steeringSensitivity, 13, dt);
    const wantsReverse = brakeKey && forwardSpeed < 0.8;
    const throttleTarget = accelerate ? 1 : wantsReverse ? -0.62 : 0;
    this.throttle = THREE.MathUtils.damp(this.throttle, throttleTarget, accelerate ? 11 : 8, dt);
    this.brake = THREE.MathUtils.damp(this.brake, brakeKey && !wantsReverse ? 1 : 0, 12, dt);
    const speedLimit = this.throttle < 0 ? tuning.reverseSpeed : tuning.maxSpeed;
    const normalizedSpeed = THREE.MathUtils.clamp(Math.abs(forwardSpeed) / speedLimit, 0, 1);
    const powerBand = 0.62 + 0.38 * Math.sin(Math.min(1, normalizedSpeed * 1.08) * Math.PI * 0.5);
    const fadeAtLimit = 1 - THREE.MathUtils.smoothstep(normalizedSpeed, 0.82, 1);
    const rawDriveForce = this.throttle * (this.throttle < 0 ? tuning.reverseForce : tuning.driveForce) * powerBand * fadeAtLimit;
    const braking = this.brake > 0.02;
    let contacts = 0; let lateralVelocity = 0; let rearTraction = 0; const rearContacts: THREE.Vector3[] = [];
    for (const wheel of this.wheels) {
      const mount = bodyPosition.clone().add(wheel.local.clone().applyQuaternion(rotation));
      const hit = this.world.castRay(new RAPIER.Ray(mount, DOWN), MAX_RAY, true, undefined, undefined, undefined, this.body);
      wheel.grounded = Boolean(hit); wheel.compression = 0;
      if (!hit) continue;
      contacts += 1;
      const suspensionLength = Math.max(0, hit.timeOfImpact - WHEEL_RADIUS); const compression = THREE.MathUtils.clamp(SPRING_REST - suspensionLength, -0.18, 0.24); wheel.compression = compression;
      const contact = mount.clone().addScaledVector(DOWN, hit.timeOfImpact); const pointVelocity = this.velocityAtPoint(contact, bodyPosition, velocity); const verticalVelocity = pointVelocity.dot(UP);
      // Conservative, overdamped suspension: enough travel to show weight transfer
      // without the energy gain that can launch a light browser physics chassis.
      const spring = THREE.MathUtils.clamp(compression * tuning.springRate - verticalVelocity * tuning.damperRate, 0, 5600); this.applyForce(UP, spring, contact, dt);
      const wheelForward = forward.clone(); if (wheel.front) wheelForward.applyAxisAngle(UP, this.steering);
      const wheelRight = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation); if (wheel.front) wheelRight.applyAxisAngle(UP, this.steering);
      const longitudinal = pointVelocity.dot(wheelForward); const lateral = pointVelocity.dot(wheelRight); lateralVelocity += lateral;
      const axleGrip = handbrake && !wheel.front ? tuning.handbrakeGrip : 1;
      const slipLoss = THREE.MathUtils.lerp(1, 0.72, THREE.MathUtils.smoothstep(Math.abs(lateral), 3, 12));
      const peakGrip = spring * tuning.grip * axleGrip * slipLoss;
      const lateralForce = THREE.MathUtils.clamp(-lateral * tuning.lateralStiffness, -peakGrip, peakGrip);
      let longitudinalForce = -longitudinal * 145; if (braking) longitudinalForce += -Math.sign(longitudinal || forwardSpeed) * tuning.brakeForce * this.brake * 0.25;
      const availableLongitudinal = Math.sqrt(Math.max(0, peakGrip * peakGrip - lateralForce * lateralForce)); longitudinalForce = THREE.MathUtils.clamp(longitudinalForce, -availableLongitudinal, availableLongitudinal);
      const force = wheelForward.multiplyScalar(longitudinalForce).add(wheelRight.multiplyScalar(lateralForce)); this.body.applyImpulseAtPoint({ x: force.x * dt, y: force.y * dt, z: force.z * dt }, contact, true);
      if (!wheel.front) { rearTraction += peakGrip; rearContacts.push(contact); }
    }
    this.grounded = contacts > 0;
    if (rearContacts.length) {
      // Drive force is applied at the rear tire contacts, producing real squat and
      // chassis response while preventing airborne acceleration.
      const driveForce = THREE.MathUtils.clamp(rawDriveForce, -rearTraction * 2.45, rearTraction * 2.45);
      const impulse = forward.multiplyScalar(driveForce * dt / rearContacts.length);
      for (const contact of rearContacts) this.body.applyImpulseAtPoint({ x: impulse.x, y: impulse.y, z: impulse.z }, contact, true);
    }
    if (contacts) { const drag = velocity.clone().multiplyScalar(-speed * 0.42); this.body.applyImpulse({ x: drag.x * dt, y: 0, z: drag.z * dt }, true); this.body.applyImpulse({ x: 0, y: -Math.min(speed * speed * tuning.downforce, 2500) * dt, z: 0 }, true); }
    // Prevent unrecoverable flips while retaining visible pitch and roll from tire loads.
    const uprightError = bodyUp.clone().cross(UP).multiplyScalar(1300); const angular = this.body.angvel();
    const yawDamping = handbrake ? tuning.yawDamping * 0.23 : tuning.yawDamping;
    this.body.applyTorqueImpulse({ x: uprightError.x * dt - angular.x * 65 * dt, y: -angular.y * yawDamping * dt, z: uprightError.z * dt - angular.z * 65 * dt }, true);
    const kph = Math.abs(forwardSpeed) * 3.6; const averageLateral = contacts ? lateralVelocity / contacts : 0; const drifting = Math.abs(averageLateral) > 2.4 && speed > 6 && (handbrake || Math.abs(this.steering) > 0.17);
    if (forwardSpeed > 1) this.gear = THREE.MathUtils.clamp(Math.floor(kph / 34) + 1, 1, 6);
    const gearTopSpeed = [14, 23, 34, 46, 59, 72][this.gear - 1];
    const gear = forwardSpeed < -1 ? 'R' : kph < 1 ? 'N' : String(this.gear);
    this.telemetry = { speedKph: kph, rpm: THREE.MathUtils.clamp(900 + (Math.abs(forwardSpeed) / gearTopSpeed) * 5900, 850, 7200), gear, drifting, grounded: this.grounded };
    this.syncVisual(rotation, speed, averageLateral, dt, tuning.roll);
    return this.telemetry;
  }

  private velocityAtPoint(point: THREE.Vector3, bodyPosition: THREE.Vector3, linear: THREE.Vector3) { const angular = this.body.angvel(); return linear.clone().add(new THREE.Vector3(angular.x, angular.y, angular.z).cross(point.clone().sub(bodyPosition))); }
  private applyForce(direction: THREE.Vector3, magnitude: number, point: THREE.Vector3, dt: number) { this.body.applyImpulseAtPoint({ x: direction.x * magnitude * dt, y: direction.y * magnitude * dt, z: direction.z * magnitude * dt }, point, true); }
  private syncVisual(rotation: THREE.Quaternion, speed: number, lateral: number, dt: number, maximumRoll: number) {
    const p = this.body.translation(); this.model.position.set(p.x, p.y, p.z); this.model.quaternion.copy(rotation); this.visualRoll = THREE.MathUtils.damp(this.visualRoll, THREE.MathUtils.clamp(-lateral * 0.018, -maximumRoll, maximumRoll), 7, dt); this.model.rotateZ(this.visualRoll);
    this.wheelAngle += speed * dt / WHEEL_RADIUS;
    for (const wheel of this.wheels) { wheel.pivot.rotation.y = wheel.front ? this.steering : 0; wheel.pivot.position.y = -0.43 + wheel.compression; wheel.mesh.rotation.x = this.wheelAngle; }
  }
  reset() { this.body.setTranslation(this.spawn, true); this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  get position() { const p = this.body.translation(); return new THREE.Vector3(p.x, p.y, p.z); }
  get quaternion() { const q = this.body.rotation(); return new THREE.Quaternion(q.x, q.y, q.z, q.w); }
}
