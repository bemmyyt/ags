import * as THREE from 'three';

type Route = { name: string; points: THREE.Vector3[]; speed: number };

class TrafficCar {
  readonly group = new THREE.Group();
  private routeIndex: number;
  private nextPoint: number;
  private speed = 0;
  private active = false;

  constructor(private readonly route: Route, startPoint: number, color: string) {
    this.routeIndex = startPoint % route.points.length;
    this.nextPoint = (this.routeIndex + 1) % route.points.length;
    this.group.position.copy(route.points[this.routeIndex]);
    const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: '#142834', metalness: 0.2, roughness: 0.15 });
    const tire = new THREE.MeshStandardMaterial({ color: '#111318', roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.46, 3.35, 2, 2, 3), paint); body.position.y = 0.45; body.castShadow = true; this.group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.46, 1.42, 2, 2, 2), glass); cabin.position.set(0, 0.86, -0.18); cabin.castShadow = true; this.group.add(cabin);
    for (const x of [-0.58, 0.58]) for (const z of [-1.15, 1.15]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 12), tire); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.27, z); wheel.castShadow = true; this.group.add(wheel); }
  }

  update(dt: number, player: THREE.Vector3, cars: TrafficCar[]) {
    const playerDistance = this.group.position.distanceTo(player);
    const shouldBeActive = playerDistance < 140;
    if (shouldBeActive !== this.active) { this.active = shouldBeActive; this.group.visible = shouldBeActive; }
    if (!this.active) return;
    const target = this.route.points[this.nextPoint];
    const toTarget = target.clone().sub(this.group.position); const distance = toTarget.length();
    if (distance < 1.2) { this.routeIndex = this.nextPoint; this.nextPoint = (this.nextPoint + 1) % this.route.points.length; return; }
    const forward = toTarget.multiplyScalar(1 / distance);
    let targetSpeed = this.route.speed;
    if (playerDistance < 16) targetSpeed *= THREE.MathUtils.smoothstep(playerDistance, 3, 16);
    for (const other of cars) {
      if (other === this || !other.active) continue;
      const offset = other.group.position.clone().sub(this.group.position); const ahead = offset.dot(forward); const gap = offset.length();
      if (ahead > 0 && ahead < 11 && gap < 7) targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 1.2));
    }
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, targetSpeed < this.speed ? 6 : 1.7, dt);
    this.group.position.addScaledVector(forward, this.speed * dt);
    this.group.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward), 1 - Math.exp(-dt * 8));
    // Route recovery prevents a nudge or large frame hitch from leaving traffic lost.
    if (distance > 55) { this.group.position.copy(this.route.points[this.routeIndex]); this.speed = 0; }
  }
}

/** Lightweight road-graph traffic for the compact Milestone 2 map. */
export class TrafficSystem {
  private readonly cars: TrafficCar[];
  constructor(scene: THREE.Scene) {
    const routes: Route[] = [
      { name: 'city boulevard', speed: 10, points: [[-2, 0, -48], [-2, 0, 54], [4, 0, 54], [4, 0, -48]].map(([x, y, z]) => new THREE.Vector3(x, y, z)) },
      { name: 'coast highway', speed: 15, points: [[6, 0, -34], [80, 0, -34], [80, 0, 24], [76, 0, 24], [76, 0, -42], [6, 0, -42]].map(([x, y, z]) => new THREE.Vector3(x, y, z)) },
      { name: 'suburban street', speed: 8, points: [[-76, 0, 30], [-6, 0, 30], [-6, 0, 38], [-76, 0, 38]].map(([x, y, z]) => new THREE.Vector3(x, y, z)) },
    ];
    const specs = [[0, 0, '#e7e4dd'], [0, 2, '#3f80b8'], [1, 0, '#d9a34a'], [1, 2, '#9b5b68'], [2, 0, '#7e9689'], [2, 2, '#d3d7dc']] as const;
    this.cars = specs.map(([route, point, color]) => new TrafficCar(routes[route], point, color));
    this.cars.forEach((car) => scene.add(car.group));
  }
  update(dt: number, player: THREE.Vector3) { this.cars.forEach((car) => car.update(dt, player, this.cars)); }
}
