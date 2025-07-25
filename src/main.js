import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import gsap from "gsap";
import { Text } from 'troika-three-text';

// === Platform Detection ===
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isAndroid = /Android/i.test(navigator.userAgent);

  // Weather API
  const weatherText = document.getElementById("weatherText");
  const cityText = document.getElementById("cityText");

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
      weatherText.innerText = `🌦️ ${data.main.temp}°C`;
      cityText.innerText = `${data.name}`;
    } catch {
    const temp = Math.floor(Math.random() * 10) + 20;
    weatherText.innerText = `🌦️ ${temp}`;
      cityText.innerText = `Noida`;
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

  document.getElementById("findOut").addEventListener("click", () => {
    if (isIOS) {
    } else {
      loadModel();
    }
    
    gsap.to("#teaScreen", {
      opacity: 0,
      duration: 0.8,
      onComplete: () => {
        document.getElementById("teaScreen").style.display = "none";
        document.getElementById("instructions").style.display = "flex";
        gsap.from("#instructions", { opacity: 0, duration: 0.8 });
        if (isIOS) {
          document.getElementById("weatherScreen").style.display = "none";
          document.getElementById("iosAR").style.display = "block";
          setTimeout(() => {
              document.getElementById("instructions").style.display = "none";
            }, 3000);
        } else {
          arButton.click();
        }
      },
    });
  });

  let collectedCount = 0;
  let camera, scene, controller, reticle, model = null;
  const cups = [];
  let placed = false;

  const counterText = new Text();
  counterText.text = `Cups collected: 0/3`;
  counterText.fontSize = 0.025;
  counterText.position.set(-0.125, 0.2, -0.5);
  counterText.sync();

  const thankYouText = new Text();
  thankYouText.text = `🎉 Thank You!`;
  thankYouText.fontSize = 0.025;
  thankYouText.position.set(-0.125, 0, -0.5);

  const alertText = new Text();
  alertText.text = `🎉 Cup Collected!`;
  alertText.fontSize = 0.0125;
  alertText.position.set(-0.075, 0, -0.5);

  function updateCounter() {
    counterText.text = `Cups collected: ${collectedCount}/3`;
    counterText.sync();
  }

  function showAlert() {
    alertText.visible = true;
    gsap.fromTo(alertText.scale, { x: 0, y: 0, z: 0 }, {
      x: 1, y: 1, z: 1, duration: 0.1,
      onComplete: () => {
        gsap.to(alertText.scale, { x: 0, y: 0, z: 0, duration: 0.2, delay: 1 });
      }
    });
  }

  function loadModel() {
    const loader = new GLTFLoader();
    loader.load("models/tea-cup.glb", (gltf) => {
      model = gltf.scene;
      startAR();
    });
  }

  function startAR() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    scene.add(counterText);
    camera.add(counterText);
    scene.add(alertText);
    camera.add(alertText);
    scene.add(thankYouText);
    camera.add(thankYouText);
    scene.add(camera);

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    reticle = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    controller = renderer.xr.getController(0);
    controller.addEventListener("select", onSelect);
    scene.add(controller);

    renderer.setAnimationLoop(render);

    window.addEventListener("resize", onWindowResize, false);

  window.addEventListener("click", (event) => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cups, true);
    if (intersects.length) {
      const selected = intersects[0].object;
      gsap.to(selected.scale, {
        x: 0, y: 0, z: 0, duration: 0.5,
        onComplete: () => {
          const root = findRoot(selected);
          scene.remove(root);
          cups.splice(cups.indexOf(root), 1);
          collectedCount++;
          updateCounter();
          showAlert();
          if (collectedCount === 3) endAR();
        }, 
      });
    }
  });
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  let hitTestSource = null;
  let hitTestSourceRequested = false;

  function render(_, frame) {
    if (frame) {
      const refSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();
      if (!hitTestSourceRequested) {
        session.requestReferenceSpace("viewer").then((viewerSpace) => {
          session.requestHitTestSource({ space: viewerSpace }).then((source) => {
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
          const pose = hitTestResults[0].getPose(refSpace);
          reticle.visible = false;
          reticle.matrix.fromArray(pose.transform.matrix);
          if (!placed) {
            placeCups(pose);
            placed = true;
            setTimeout(() => {
              document.getElementById("instructions").style.display = "none";
            }, 3000);
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
    for (let i = 0; i < 3; i++) {
      const cup = model.clone();
      cup.position.set(
        basePosition.x + (Math.random() - 0.5) * 5.0,
        basePosition.y,
        basePosition.z + (Math.random() - 0.5) * 5.0
      );
      scene.add(cup);
      cups.push(cup);
    }
  }

  function onSelect() {
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersects = raycaster.intersectObjects(cups, true);
    if (intersects.length) {
      const selected = intersects[0].object;
      gsap.to(selected.scale, {
        x: 0, y: 0, z: 0, duration: 0.5,
        onComplete: () => {
          const root = findRoot(selected);
          scene.remove(root);
          cups.splice(cups.indexOf(root), 1);
          collectedCount++;
          updateCounter();
          showAlert();
          if (collectedCount === 3) endAR();
        },
         
      });
    }
  }

  function findRoot(obj) {
    while (obj.parent && obj.parent.type !== "Scene") obj = obj.parent;
    return obj;
  }

  function endAR() {
    const session = renderer.xr.getSession();
    gsap.fromTo(thankYouText.scale, { x: 0, y: 0, z: 0 }, {
      x: 1, y: 1, z: 1, duration: 0.3, delay: 0.3
    });
    setTimeout(() => {
      session.end().then(() => {
         // Show Thank You page
      document.body.innerHTML = `
        <div class="relative flex items-center justify-center h-screen text-black px-3" id="thank-you">
          <button id="closeBtn" class="absolute top-4 right-4 text-white rounded-full w-8 h-8 flex items-center justify-center shadow">
            ✕
          </button>
          <div class="flex items-center justify-center h-screen text-white text-2xl md:text-4xl font-bold">
              Thank you for playing! 🎉</br>
              You have collected 3 Plates
            </div>
        </div>  
      `;

      gsap.to("#thank-you", { opacity: 1, duration: 0.5, delay: 1.5 });

      document.getElementById('closeBtn').addEventListener('click', () => {
        location.reload();
      });
      });
    }, 3000);
  }

function showFallback() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("fallbackViewer").appendChild(renderer.domElement);
  const loader = new GLTFLoader();
  loader.load("models/tea-cup.glb", (gltf) => {
    scene.add(gltf.scene);
    animate();
  });
  camera.position.z = 2;
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
}
