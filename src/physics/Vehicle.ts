import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Input } from '../core/Input';

export type VehicleTelemetry = { speedKph: number; rpm: number; gear: string; drifting: boolean; grounded: boolean };

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

  update(dt: number, input: Input, steeringSensitivity: number): VehicleTelemetry {
    if (dt === 0) return this.telemetry;
    const q = this.body.rotation(); const rotation = new THREE.Quaternion(q.x, q.y, q.z, q.w); const bodyPosition = this.position;
    // A failed collision should never turn into an unrecoverable launch.
    if (bodyPosition.y > 12 || bodyPosition.y < -5) { this.reset(); return this.telemetry; }
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation).normalize();
    const bodyUp = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).normalize();
    const rawVelocity = this.body.linvel(); const velocity = new THREE.Vector3(rawVelocity.x, rawVelocity.y, rawVelocity.z); const forwardSpeed = velocity.dot(forward); const speed = velocity.length();
    const accelerate = input.down('KeyW', 'ArrowUp'); const brakeKey = input.down('KeyS', 'ArrowDown'); const handbrake = input.down('Space');
    // Positive yaw turns right with this model, so A must be negative and D positive.
    const steerInput = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
    const steeringLimit = THREE.MathUtils.lerp(0.7, 0.22, THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 40, 0, 1));
    this.steering = THREE.MathUtils.damp(this.steering, steerInput * steeringLimit * steeringSensitivity, 10, dt);
    const wantsReverse = brakeKey && forwardSpeed < 0.8;
    const throttleTarget = accelerate ? 1 : wantsReverse ? -0.58 : 0;
    this.throttle = THREE.MathUtils.damp(this.throttle, throttleTarget, 7.5, dt);
    this.brake = THREE.MathUtils.damp(this.brake, brakeKey && !wantsReverse ? 1 : 0, 12, dt);
    const engineFade = THREE.MathUtils.lerp(1, 0.42, THREE.MathUtils.clamp(Math.abs(forwardSpeed) / 58, 0, 1));
    const driveForce = this.throttle * 13800 * engineFade; const braking = this.brake > 0.02;
    let contacts = 0; let lateralVelocity = 0;
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
      const spring = THREE.MathUtils.clamp(compression * 18000 - verticalVelocity * 5200, 0, 5200); this.applyForce(UP, spring, contact, dt);
      const wheelForward = forward.clone(); if (wheel.front) wheelForward.applyAxisAngle(UP, this.steering);
      const wheelRight = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation); if (wheel.front) wheelRight.applyAxisAngle(UP, this.steering);
      const longitudinal = pointVelocity.dot(wheelForward); const lateral = pointVelocity.dot(wheelRight); lateralVelocity += lateral;
      const axleGrip = handbrake && !wheel.front ? 0.52 : 1; const peakGrip = spring * (1.23 * axleGrip);
      const lateralForce = THREE.MathUtils.clamp(-lateral * 12500, -peakGrip, peakGrip);
      let longitudinalForce = -longitudinal * 120; if (!wheel.front) longitudinalForce += driveForce * 0.5; if (braking) longitudinalForce += -Math.sign(longitudinal || forwardSpeed) * 7600 * this.brake;
      const availableLongitudinal = Math.sqrt(Math.max(0, peakGrip * peakGrip - lateralForce * lateralForce)); longitudinalForce = THREE.MathUtils.clamp(longitudinalForce, -availableLongitudinal, availableLongitudinal);
      const force = wheelForward.multiplyScalar(longitudinalForce).add(wheelRight.multiplyScalar(lateralForce)); this.body.applyImpulseAtPoint({ x: force.x * dt, y: force.y * dt, z: force.z * dt }, contact, true);
    }
    this.grounded = contacts > 0;
    if (contacts) { const drag = velocity.clone().multiplyScalar(-speed * 0.72); this.body.applyImpulse({ x: drag.x * dt, y: 0, z: drag.z * dt }, true); this.body.applyImpulse({ x: 0, y: -Math.min(speed * speed * 2.1, 2100) * dt, z: 0 }, true); }
    // Prevent unrecoverable flips while retaining visible pitch and roll from tire loads.
    const uprightError = bodyUp.clone().cross(UP).multiplyScalar(1300); const angular = this.body.angvel();
    const yawDamping = handbrake ? 180 : 720;
    this.body.applyTorqueImpulse({ x: uprightError.x * dt - angular.x * 65 * dt, y: -angular.y * yawDamping * dt, z: uprightError.z * dt - angular.z * 65 * dt }, true);
    const kph = Math.abs(forwardSpeed) * 3.6; const averageLateral = contacts ? lateralVelocity / contacts : 0; const drifting = Math.abs(averageLateral) > 2.8 && speed > 7 && (handbrake || Math.abs(this.steering) > 0.2);
    const gear = forwardSpeed < -1 ? 'R' : kph < 1 ? 'N' : String(Math.min(6, Math.floor(kph / 37) + 1));
    this.telemetry = { speedKph: kph, rpm: THREE.MathUtils.clamp(900 + Math.abs(forwardSpeed) * 180 + Math.abs(driveForce) * 0.075, 850, 7200), gear, drifting, grounded: this.grounded };
    this.syncVisual(rotation, speed, averageLateral, dt);
    return this.telemetry;
  }

  private velocityAtPoint(point: THREE.Vector3, bodyPosition: THREE.Vector3, linear: THREE.Vector3) { const angular = this.body.angvel(); return linear.clone().add(new THREE.Vector3(angular.x, angular.y, angular.z).cross(point.clone().sub(bodyPosition))); }
  private applyForce(direction: THREE.Vector3, magnitude: number, point: THREE.Vector3, dt: number) { this.body.applyImpulseAtPoint({ x: direction.x * magnitude * dt, y: direction.y * magnitude * dt, z: direction.z * magnitude * dt }, point, true); }
  private syncVisual(rotation: THREE.Quaternion, speed: number, lateral: number, dt: number) {
    const p = this.body.translation(); this.model.position.set(p.x, p.y, p.z); this.model.quaternion.copy(rotation); this.visualRoll = THREE.MathUtils.damp(this.visualRoll, THREE.MathUtils.clamp(-lateral * 0.018, -0.09, 0.09), 7, dt); this.model.rotateZ(this.visualRoll);
    this.wheelAngle += speed * dt / WHEEL_RADIUS;
    for (const wheel of this.wheels) { wheel.pivot.rotation.y = wheel.front ? this.steering : 0; wheel.pivot.position.y = -0.43 + wheel.compression; wheel.mesh.rotation.x = this.wheelAngle; }
  }
  reset() { this.body.setTranslation(this.spawn, true); this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  get position() { const p = this.body.translation(); return new THREE.Vector3(p.x, p.y, p.z); }
  get quaternion() { const q = this.body.rotation(); return new THREE.Quaternion(q.x, q.y, q.z, q.w); }
}
