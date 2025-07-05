import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import gsap from "gsap";

// Weather API
const weatherText = document.getElementById("weatherText");

async function getWeather() {
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject)
    );
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const apiKey = "5e1c38f86fa5974c5dd63c0c929c71ed"; // Replace with your real key!
    const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    weatherText.innerText = `🌦️ ${data.main.temp}°C ${data.name}`;
  } catch {
    const temp = Math.floor(Math.random() * 10) + 20;
    weatherText.innerText = `🌦️ ${temp}°C Noida`;
  }
}

getWeather();

let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

let arButton = ARButton.createButton(renderer, {
  requiredFeatures: ["hit-test"],
});
document.getElementById("teaScreen").appendChild(arButton);
arButton.style.visibility = "hidden";

document.getElementById("next1").addEventListener("click", () => {
  gsap.to("#weatherScreen", {
    opacity: 0,
    duration: 0.8,
    onComplete: () => {
      document.getElementById("weatherScreen").style.display = "none";
      document.getElementById("teaScreen").style.display = "flex";
      gsap.from("#teaScreen", {
        opacity: 0,
        duration: 0.8,
        onComplete: () => {
          gsap.to("#tea-gif", { opacity: 1, duration: 0.8 });
          gsap.from("#tea-gif", {
            y: 50,
            duration: 1,
            ease: "power2.out",
          });
        },
      });
    },
  });
});

document.getElementById("findOut").addEventListener("click", async () => {
  // try {
  //   await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  // } catch (err) {
  //   alert("Camera permission denied!");
  // }
  gsap.to("#teaScreen", {
    opacity: 0,
    duration: 0.8,
    onComplete: () => {
      document.getElementById("teaScreen").style.display = "none";
      document.getElementById("instructions").style.display = "flex";
      gsap.from("#instructions", { opacity: 0, duration: 0.8 });
      loadModel();
      setTimeout(() => {
        document.getElementById("instructions").style.display = "none";
        arButton.click();
      }, 3000);
    },
  });
});

// WebXR AR
// Core
let camera, scene;
let controller;
let reticle;
let model = null;
const cups = []; // Active cups

let placed = false;

// Load tea cup model once

// === AR Setup ===
export function loadModel() {
  const loader = new GLTFLoader();
  loader.load("/models/tea-cup.glb", (gltf) => {
    model = gltf.scene;
    startAR();
  });
}

function startAR() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);

  const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  reticle = new THREE.Mesh(geometry, material);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  renderer.setAnimationLoop(render);

  window.addEventListener("resize", onWindowResize, false);

  window.addEventListener('click', (event) => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cups, true);
    
    if (intersects.length > 0) {
    const selected = intersects[0].object;

    gsap.to(selected.scale, {
        x: 0,
        y: 0,
        z: 0,
        duration: 0.5,
        onComplete: () => {
          // Remove full GLTF hierarchy if needed
          const root = findRoot(selected);
          scene.remove(root);
          cups.splice(cups.indexOf(root), 1);
        },
      });
    } else {
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Hit test source
let hitTestSource = null;
let hitTestSourceRequested = false;

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    session.addEventListener("end", () => {
      console.log("AR Session Ended");
    });

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace("viewer").then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((source) => {
          hitTestSource = source;
        });
      });
      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
        if (!placed) {
          placeCups(pose);
          placed = true;
        }
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}

function placeCups(pose) {
  const basePosition = new THREE.Vector3(
    pose.transform.position.x,
    pose.transform.position.y,
    pose.transform.position.z
  );

  for (let i = 0; i < 5; i++) {
    const cup = model.clone();

    // Scatter within a 1m radius
    const offsetX = (Math.random() - 0.5) * 2.0; // -1m to +1m
    const offsetZ = (Math.random() - 0.5) * 2.0;

    cup.position.set(
      basePosition.x + offsetX,
      basePosition.y,
      basePosition.z + offsetZ
    );

    scene.add(cup);
    cups.push(cup);
  }
}

function onSelect(event) {
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();

  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

  const intersects = raycaster.intersectObjects(cups, true);

  if (intersects.length > 0) {
    const selected = intersects[0].object;

    gsap.to(selected.scale, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.5,
      onComplete: () => {
        // Remove full GLTF hierarchy if needed
        const root = findRoot(selected);
        scene.remove(root);
        cups.splice(cups.indexOf(root), 1);
      },
    });
  } else {
  }
}

function findRoot(object) {
  while (object.parent && object.parent.type !== "Scene") {
    object = object.parent;
  }
  return object;
}
