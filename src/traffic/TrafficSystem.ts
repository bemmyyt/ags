import * as THREE from 'three';

type Route = { name: string; points: THREE.Vector3[]; speed: number };

class TrafficCar {
  readonly group = new THREE.Group();
  private routeIndex: number;
  private nextPoint: number;
  private speed = 0;
  private readonly wheels: THREE.Mesh[] = [];
  private readonly brakeLights: THREE.MeshStandardMaterial[] = [];
  private readonly cruisingSpeed: number;

  constructor(private readonly route: Route, startPoint: number, color: string, pace = 1) {
    this.routeIndex = startPoint % route.points.length;
    this.nextPoint = (this.routeIndex + 1) % route.points.length;
    this.cruisingSpeed = route.speed * pace;
    this.group.position.copy(route.points[this.routeIndex]);
    const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: '#142834', metalness: 0.2, roughness: 0.15 });
    const tire = new THREE.MeshStandardMaterial({ color: '#111318', roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.46, 3.35, 2, 2, 3), paint); body.position.y = 0.45; body.castShadow = true; this.group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.46, 1.42, 2, 2, 2), glass); cabin.position.set(0, 0.86, -0.18); cabin.castShadow = true; this.group.add(cabin);
    for (const x of [-0.58, 0.58]) for (const z of [-1.15, 1.15]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 12), tire); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.27, z); wheel.castShadow = true; this.wheels.push(wheel); this.group.add(wheel); }
    for (const x of [-0.54, 0.54]) { const material = new THREE.MeshStandardMaterial({ color: '#7b1718', emissive: '#480001', emissiveIntensity: 0.25 }); const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.06), material); lamp.position.set(x, 0.54, -1.71); this.group.add(lamp); this.brakeLights.push(material); }
  }

  update(dt: number, player: THREE.Vector3, cars: TrafficCar[]) {
    const target = this.route.points[this.nextPoint];
    const toTarget = target.clone().sub(this.group.position); const distance = toTarget.length();
    if (distance < 1.2) { this.routeIndex = this.nextPoint; this.nextPoint = (this.nextPoint + 1) % this.route.points.length; return; }
    const forward = toTarget.multiplyScalar(1 / distance);
    let targetSpeed = this.cruisingSpeed;
    const playerOffset = player.clone().sub(this.group.position);
    const playerDistance = playerOffset.length();
    const playerAhead = playerOffset.dot(forward) > 0;
    if (playerAhead && playerDistance < 12) targetSpeed *= THREE.MathUtils.smoothstep(playerDistance, 2.5, 12);
    for (const other of cars) {
      if (other === this) continue;
      const offset = other.group.position.clone().sub(this.group.position); const ahead = offset.dot(forward); const gap = offset.length();
      if (ahead > 0 && ahead < 11 && gap < 7) targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 1.2));
    }
    const braking = targetSpeed + 0.25 < this.speed;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, targetSpeed < this.speed ? 6 : 1.7, dt);
    this.group.position.addScaledVector(forward, this.speed * dt);
    this.group.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward), 1 - Math.exp(-dt * 8));
    this.wheels.forEach((wheel) => { wheel.rotation.x -= this.speed * dt / 0.27; });
    this.brakeLights.forEach((light) => { light.emissiveIntensity = braking ? 2.1 : 0.25; });
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
    // These cars are always present in this small world; keeping them alive
    // avoids the distracting pop-in that comes from proximity spawning.
    const specs = [[0, 0, '#e7e4dd', 0.92], [0, 1, '#3f80b8', 1.06], [0, 2, '#9c5a66', 0.98], [0, 3, '#4e8b79', 1.12], [1, 0, '#d9a34a', 1.08], [1, 1, '#d3d7dc', 0.94], [1, 2, '#9b5b68', 1.02], [1, 4, '#5789a8', 0.9], [2, 0, '#7e9689', 1.05], [2, 1, '#eee0cc', 0.91], [2, 2, '#8c6ca4', 1.0], [2, 3, '#c67f55', 1.1]] as const;
    this.cars = specs.map(([route, point, color, pace]) => new TrafficCar(routes[route], point, color, pace));
    this.cars.forEach((car) => scene.add(car.group));
  }
  update(dt: number, player: THREE.Vector3) { this.cars.forEach((car) => car.update(dt, player, this.cars)); }
}
