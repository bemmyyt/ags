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
  asphalt(0, 8, 13, 118); asphalt(42, -38, 13, 84, Math.PI / 2); asphalt(84, -5, 13, 68); asphalt(-40, 34, 12, 80, Math.PI / 2); asphalt(-75, 61, 11, 66, -Math.PI / 4); asphalt(22, 50, 11, 46, Math.PI / 4);
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#ffd45b', roughness: 0.75, emissive: '#5f4310', emissiveIntensity: 0.08 });
  for (let z = -32; z <= 45; z += 7) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 3.5), stripeMat); stripe.position.set(0, 0.06, z); scene.add(stripe); }
  for (let x = 12; x <= 70; x += 7) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.055, 0.2), stripeMat); stripe.position.set(x, 0.06, -38); scene.add(stripe); }
  for (let z = -24; z <= 15; z += 7) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 3.5), stripeMat); stripe.position.set(84, 0.06, z); scene.add(stripe); }
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: '#798188', roughness: 0.88 });
  const sidewalk = (x: number, z: number, width: number, length: number, rotation = 0) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, length), sidewalkMat); mesh.position.set(x, 0.035, z); mesh.rotation.y = rotation; mesh.receiveShadow = true; scene.add(mesh); };
  sidewalk(-9.1, 5, 1.8, 104); sidewalk(9.1, 5, 1.8, 104); sidewalk(-40, 26.5, 78, 1.8);
  const barrierMat = new THREE.MeshStandardMaterial({ color: '#dae1df', roughness: 0.55, metalness: 0.15 });
  const barrier = (x: number, z: number, width: number, depth: number) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.7, depth), barrierMat); mesh.position.set(x, 0.35, z); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, 0.35, depth / 2).setTranslation(x, 0.35, z).setFriction(0.72)); };
  barrier(-6.5, 59, 1, 18); barrier(6.5, 59, 1, 18); barrier(-6.5, -51, 1, 18); barrier(6.5, -51, 1, 18); barrier(84, 28, 18, 1); barrier(84, -39, 18, 1); barrier(-79, 58, 1, 18);
  const railMat = new THREE.MeshStandardMaterial({ color: '#b9c3c7', metalness: 0.7, roughness: 0.28 });
  const rail = (x: number, z: number, len: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, len), railMat); m.position.set(x, 0.55, z); m.castShadow = true; scene.add(m); };
  rail(-5.25, 14, 38); rail(5.25, 14, 38);
  // Reused low-poly flora keeps this visual density inexpensive.
  const trunk = new THREE.CylinderGeometry(0.18, 0.27, 2.3, 7); const crown = new THREE.SphereGeometry(1.25, 10, 8); const trees = new THREE.Group(); const trunkMat = new THREE.MeshStandardMaterial({ color: '#604638', roughness: 1 }); const leafMat = new THREE.MeshStandardMaterial({ color: '#244b35', roughness: 0.9 });
  for (let i = 0; i < 75; i++) { const a = i * 2.399; const r = 19 + (i % 8) * 4; const tree = new THREE.Group(); const t = new THREE.Mesh(trunk, trunkMat); t.position.y = 1.15; const c = new THREE.Mesh(crown, leafMat); c.position.y = 3.0; tree.add(t, c); tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); tree.scale.setScalar(0.7 + (i % 3) * 0.22); tree.castShadow = true; trees.add(tree); } scene.add(trees);
  const cityMaterials = ['#6b8190', '#7b7075', '#617989'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.08 }));
  const coastMaterials = ['#d0b784', '#a9c2c1', '#b8a0a0'].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03 }));
  const building = (x: number, z: number, w: number, h: number, d: number, material: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); b.position.set(x, h / 2, z); b.castShadow = b.receiveShadow = true; scene.add(b); world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, h / 2, z)); };
  for (let i = 0; i < 18; i++) { const h = 6 + (i % 5) * 3; building(-49 + (i % 6) * 8, -48 + Math.floor(i / 6) * 8, 5 + (i % 3), h, 5, cityMaterials[i % cityMaterials.length]); }
  for (let i = 0; i < 10; i++) building(18 + (i % 5) * 10, 21 + Math.floor(i / 5) * 12, 7, 5 + (i % 3) * 3, 7, coastMaterials[i % coastMaterials.length]);
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(45, 42, 7), new THREE.MeshStandardMaterial({ color: '#52626a', roughness: 1 })); mountain.position.set(60, 20, -105); scene.add(mountain);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(250, 160), new THREE.MeshStandardMaterial({ color: '#397f99', roughness: 0.32, metalness: 0.28 })); sea.rotation.x = -Math.PI / 2; sea.position.set(110, -0.08, 20); scene.add(sea);
  const streetlight = (x: number, z: number) => { const pole = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 5.6, 8), railMat); p.position.y = 2.8; const glow = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffe7ae', emissive: '#ffcc66', emissiveIntensity: 2 })); glow.position.y = 5.45; pole.add(p, glow); pole.position.set(x, 0, z); scene.add(pole); };
  for (let z = -45; z <= 55; z += 16) streetlight(-7.2, z); for (let x = 12; x <= 76; x += 16) streetlight(x, -45); for (let x = -72; x <= -12; x += 16) streetlight(x, 27);

  const signPost = (x: number, z: number, rotation: number, color: string) => { const group = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 2.2, 8), railMat); post.position.y = 1.1; const face = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.08), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.12, roughness: 0.55 })); face.position.y = 2.15; group.add(post, face); group.position.set(x, 0, z); group.rotation.y = rotation; scene.add(group); };
  signPost(-8.3, -21, Math.PI / 2, '#4d95b7'); signPost(12, -31.5, 0, '#c68542'); signPost(76.5, 13, Math.PI / 2, '#4d95b7'); signPost(-40, 24.5, Math.PI / 2, '#bd5750');
  const billboard = (x: number, z: number, rotation: number, color: string) => { const group = new THREE.Group(); const posts = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.4, 0.16), railMat); for (const offset of [-2, 2]) { const post = posts.clone(); post.position.set(offset, 2.2, 0); group.add(post); } const face = new THREE.Mesh(new THREE.BoxGeometry(5, 2.1, 0.15), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, roughness: 0.48 })); face.position.y = 4.15; group.add(face); group.position.set(x, 0, z); group.rotation.y = rotation; scene.add(group); };
  billboard(-18, -48, 0, '#315f86'); billboard(60, 27, Math.PI / 2, '#966d38'); billboard(-75, 43, Math.PI / 2, '#486f57');
}
