import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export function createTestWorld(scene: THREE.Scene, world: RAPIER.World) {
  scene.background = new THREE.Color('#8db8ca');
  scene.fog = new THREE.Fog('#9ac0ca', 55, 210);
  const hemi = new THREE.HemisphereLight('#c5edff', '#34544d', 2.3); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff2d8', 3.7); sun.position.set(-45, 65, 30); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: '#456750', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  world.createCollider(RAPIER.ColliderDesc.cuboid(150, 0.12, 150).setTranslation(0, -0.12, 0).setFriction(1.25));
  const roadMat = new THREE.MeshStandardMaterial({ color: '#1e2830', roughness: 0.82, metalness: 0.05 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#e7e1cc', roughness: 0.7 });
  const asphalt = (x: number, z: number, width: number, length: number, rotation = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.045, length), roadMat); mesh.position.set(x, 0.025, z); mesh.rotation.y = rotation; mesh.receiveShadow = true; scene.add(mesh);
    for (const side of [-1, 1]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.052, length), edgeMat); edge.position.set(x + Math.cos(rotation) * side * (width / 2 - 0.25), 0.055, z - Math.sin(rotation) * side * (width / 2 - 0.25)); edge.rotation.y = rotation; scene.add(edge); }
  };
  asphalt(0, 8, 11, 94); asphalt(21, -31, 11, 50, Math.PI / 2); asphalt(-22, 29, 11, 50, Math.PI / 2);
  asphalt(20, 42, 11, 39, Math.PI / 4); asphalt(-20, -39, 11, 40, -Math.PI / 4);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd45b', roughness: 0.75, emissive: '#5f4310', emissiveIntensity: 0.08 });
  for (let z = -32; z <= 45; z += 7) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 3.5), stripeMat); stripe.position.set(0, 0.06, z); scene.add(stripe); }
  const barrierMat = new THREE.MeshStandardMaterial({ color: '#dae1df', roughness: 0.55, metalness: 0.15 });
  const barrier = (x: number, z: number, width: number, depth: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.7, depth), barrierMat); mesh.position.set(x, 0.35, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, 0.35, depth / 2).setTranslation(x, 0.35, z).setFriction(0.72));
  };
  barrier(-5.5, 54, 1, 24); barrier(5.5, 54, 1, 24); barrier(-5.5, -39, 1, 22); barrier(5.5, -39, 1, 22);
  const railMat = new THREE.MeshStandardMaterial({ color: '#b9c3c7', metalness: 0.7, roughness: 0.28 });
  const rail = (x: number, z: number, len: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, len), railMat); m.position.set(x, 0.55, z); m.castShadow = true; scene.add(m); };
  rail(-5.25, 14, 38); rail(5.25, 14, 38);
  const trunk = new THREE.CylinderGeometry(0.18, 0.27, 2.3, 7); const crown = new THREE.SphereGeometry(1.25, 10, 8);
  const trees = new THREE.Group(); const trunkMat = new THREE.MeshStandardMaterial({ color: '#604638', roughness: 1 }); const leafMat = new THREE.MeshStandardMaterial({ color: '#244b35', roughness: 0.9 });
  for (let i = 0; i < 75; i++) { const a = i * 2.399; const r = 19 + (i % 8) * 4; const tree = new THREE.Group(); const t = new THREE.Mesh(trunk, trunkMat); t.position.y = 1.15; const c = new THREE.Mesh(crown, leafMat); c.position.y = 3.0; tree.add(t, c); tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); tree.scale.setScalar(0.7 + (i % 3) * 0.22); tree.castShadow = true; trees.add(tree); } scene.add(trees);
  const skylineMat = new THREE.MeshStandardMaterial({ color: '#6b8190', roughness: 0.75, metalness: 0.08 });
  for (let i = 0; i < 18; i++) { const h = 6 + (i % 5) * 3; const b = new THREE.Mesh(new THREE.BoxGeometry(5 + (i % 3), h, 5), skylineMat); b.position.set(-49 + (i % 6) * 8, h / 2, -48 + Math.floor(i / 6) * 8); b.castShadow = true; scene.add(b); }
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(45, 42, 7), new THREE.MeshStandardMaterial({ color: '#52626a', roughness: 1 })); mountain.position.set(60, 20, -105); scene.add(mountain);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(250, 160), new THREE.MeshStandardMaterial({ color: '#397f99', roughness: 0.32, metalness: 0.28 })); sea.rotation.x = -Math.PI / 2; sea.position.set(110, -0.08, 20); scene.add(sea);
  for (let z = -30; z <= 45; z += 16) { const pole = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 5.6, 8), railMat); p.position.y = 2.8; const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffe7ae', emissive: '#ffcc66', emissiveIntensity: 2 })); glow.position.y = 5.45; pole.add(p, glow); pole.position.set(-6.3, 0, z); scene.add(pole); }
}
