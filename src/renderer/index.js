import * as THREE from 'three';
import { OrbitControls } from '../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '../../node_modules/@pixiv/three-vrm/lib/three-vrm.module.js';

const appEl = document.getElementById('app');
const fileInput = document.getElementById('fileInput');
const filePathEl = document.getElementById('filePath');
const resetBtn = document.getElementById('resetBtn');

let renderer, scene, camera, controls, currentVrm, clock;

init();
setupIpc();

function init() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  appEl.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1e1e1e);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
  hemiLight.position.set(0, 1, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(1, 1, 1);
  scene.add(dirLight);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 1.4, 2.2);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.4, 0);
  controls.enableDamping = true;

  const grid = new THREE.GridHelper(10, 10, 0x444444, 0x333333);
  grid.position.y = 0;
  scene.add(grid);

  clock = new THREE.Clock();
  animate();

  window.addEventListener('resize', onResize);
  fileInput.addEventListener('change', onFileInput);
  resetBtn.addEventListener('click', () => resetCamera());
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function resetCamera() {
  camera.position.set(0, 1.4, 2.2);
  controls.target.set(0, 1.4, 0);
  controls.update();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (currentVrm) {
    currentVrm.update(delta);
  }
  controls.update();
  renderer.render(scene, camera);
}

function disposeCurrentVrm() {
  if (!currentVrm) return;
  scene.remove(currentVrm.scene);
  VRMUtils.deepDispose(currentVrm.scene);
  currentVrm = null;
}

async function loadVrmFromArrayBuffer(arrayBuffer, srcName = 'buffer') {
  disposeCurrentVrm();

  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  const objectUrl = URL.createObjectURL(blob);

  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  const gltf = await loader.loadAsync(objectUrl);

  URL.revokeObjectURL(objectUrl);

  const vrm = gltf.userData.vrm;
  if (vrm) {
    VRMUtils.removeUnnecessaryJoints(gltf.scene);
    VRMUtils.rotateVRM0(vrm);
    scene.add(vrm.scene);
    currentVrm = vrm;
    fitCameraToObject(vrm.scene);
  } else {
    // Fallback: show as GLTF if no vrm meta
    scene.add(gltf.scene);
  }

  filePathEl.textContent = srcName;
}

function fitCameraToObject(object3D) {
  const box = new THREE.Box3().setFromObject(object3D);
  if (!box.isEmpty()) {
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / Math.tan(fov / 2));
    cameraZ *= 1.2;

    camera.position.set(center.x, center.y + size.y * 0.2, cameraZ);
    controls.target.copy(center);
    controls.update();
  }
}

async function onFileInput(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  await loadVrmFromArrayBuffer(arrayBuffer, file.name);
}

async function openLocalPath(filePath) {
  if (!filePath) return;
  try {
    const buf = await window.vrmApi.readFileBuffer(filePath);
    await loadVrmFromArrayBuffer(buf, filePath);
  } catch (err) {
    console.error('Failed to open file', err);
  }
}

function setupIpc() {
  if (window.vrmApi?.onOpenFile) {
    window.vrmApi.onOpenFile((filePath) => {
      openLocalPath(filePath);
    });
  }

  if (window.vrmApi?.getInitialOpenPath) {
    window.vrmApi.getInitialOpenPath().then((filePath) => {
      if (filePath) openLocalPath(filePath);
    });
  }

  // Drag and drop
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.path && /\.vrm$/i.test(file.path)) {
      openLocalPath(file.path);
    }
  });
}


