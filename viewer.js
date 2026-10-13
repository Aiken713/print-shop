import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let stop = null;
window.dispose3D = () => { if (stop) { stop(); stop = null; } };

window.show3D = async (box, url) => {
  window.dispose3D();
  box.innerHTML = '<div class="loading">Loading 3D…</div>';
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(3, 5, 4);
  scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, autoRotate: true, autoRotateSpeed: 2, enablePan: false });
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  let alive = true;
  const resize = () => {
    const w = box.clientWidth || 300, h = box.clientHeight || 300;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  let geometry = null;
  stop = () => { alive = false; ro.disconnect(); renderer.setAnimationLoop(null); renderer.dispose(); if (geometry) geometry.dispose(); box.innerHTML = ''; };

  try {
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    let obj;
    if (ext === 'glb' || ext === 'gltf') {
      obj = (await new GLTFLoader().loadAsync(url)).scene;
    } else {
      geometry = await new STLLoader().loadAsync(url);
      geometry.computeVertexNormals();
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#285CCC';
      obj = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: ink, roughness: 0.45, metalness: 0.08 }));
      obj.rotation.x = -Math.PI / 2; // most STL files are Z-up
    }
    if (!alive) return;
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj);
    const size = bb.getSize(new THREE.Vector3()), mid = bb.getCenter(new THREE.Vector3());
    obj.position.sub(mid);
    const m = Math.max(size.x, size.y, size.z) || 1;
    const d = (m / (2 * Math.tan(Math.PI * 40 / 360))) * 1.7;
    camera.near = m / 100; camera.far = m * 100;
    camera.position.set(d * 0.7, d * 0.5, d * 0.8);
    controls.update();
    box.innerHTML = '';
    box.appendChild(renderer.domElement);
    resize(); ro.observe(box);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  } catch (err) {
    if (alive) box.innerHTML = '<div class="loading">Could not load the 3D model.</div>';
  }
};
