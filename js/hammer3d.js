// CÓDIGO THREEJS
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const cena = new THREE.Scene();

// CAMERA
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  10000,
);
camera.position.z = 12;

// RENDERIZADOR
const renderizador = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderizador.setSize(window.innerWidth, window.innerHeight);

renderizador.physicallyCorrectLights = true;
renderizador.outputColorSpace = THREE.SRGBColorSpace;
renderizador.toneMapping = THREE.ACESFilmicToneMapping;
renderizador.toneMappingExposure = 1.2;
// Limita o pixel ratio: celulares com tela de alta densidade (3x+) renderizam
// pixels demais e o WebGL pode falhar/sumir por falta de GPU.
renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const div3d = document.querySelector(".div3d");
div3d.appendChild(renderizador.domElement);

// Mantém câmera e canvas coerentes quando a viewport muda de tamanho.
//
// PROBLEMA NO CELULAR: a barra de endereço aparecendo/sumindo durante o scroll
// muda SÓ a altura da viewport (a largura nunca muda nesse caso). Se reagirmos a
// isso, recalculamos camera.aspect e o tamanho do renderer a cada frame de
// scroll, e o ponto 3D do martelo é reprojetado numa tela de altura diferente
// — é isso que faz ele "dar pulinhos".
//
// SOLUÇÃO: no mobile só redimensionamos quando a LARGURA muda de verdade
// (rotação de tela). Mudanças puras de altura (barra de endereço) são ignoradas,
// então o martelo fica estável. Para o canvas não deixar um vão embaixo quando a
// barra some, travamos a altura no MAIOR valor possível da viewport.
const ehMobile = window.innerWidth <= 768;

function alturaEstavel() {
  // No mobile, usa a maior altura possível (barra de endereço escondida) para o
  // canvas cobrir a tela inteira mesmo quando a barra está visível.
  return ehMobile
    ? Math.max(window.innerHeight, document.documentElement.clientHeight)
    : window.innerHeight;
}

let larguraAnterior = window.innerWidth;
let rafResize = null;
function aoRedimensionar() {
  const largura = window.innerWidth;

  // Mobile: ignora resize que seja só de altura (barra de endereço).
  if (ehMobile && largura === larguraAnterior) return;

  if (rafResize) return;
  rafResize = requestAnimationFrame(() => {
    rafResize = null;
    larguraAnterior = largura;
    const altura = alturaEstavel();
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
    renderizador.setSize(largura, altura);
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}
window.addEventListener("resize", aoRedimensionar);

// Sizing inicial usando a altura estável (evita vão embaixo no primeiro load do
// celular, quando a barra de endereço ainda está visível).
{
  const altura = alturaEstavel();
  camera.aspect = window.innerWidth / altura;
  camera.updateProjectionMatrix();
  renderizador.setSize(window.innerWidth, altura);
}

// Evita que o ScrollTrigger recalcule (e faça o pin pular/sumir) toda vez que a
// barra de endereço do celular muda a altura da viewport durante o scroll.
if (typeof ScrollTrigger !== "undefined") {
  ScrollTrigger.config({ ignoreMobileResize: true });
}

const textureLoader = new THREE.TextureLoader();

textureLoader.load("assets/hdri.webp", function (texture) {
  texture.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderizador);
  const envMap = pmrem.fromEquirectangular(texture).texture;

  cena.environment = envMap;

  texture.dispose();
  pmrem.dispose();
});

// OBJETO3D
let objeto;
const loader = new GLTFLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/",
);
loader.setDRACOLoader(dracoLoader);

loader.load("assets/martelo.glb", (objetoCarregado) => {
  objeto = objetoCarregado.scene;

  objeto.rotation.x = 1;

  // Posições de início e fim da animação por scroll.
  // Ajuste estes números para reposicionar o martelo.
  let inicio, fim;

  if (window.innerWidth <= 768) {
    // MOBILE: trajeto vertical e centralizado, mantendo o tamanho constante
    // (z fixo). Começa embaixo do texto "THOR ODINSON...", sobe passando por
    // cima de "Quando a escuridão..." e para acima de "Há apenas ele...".
    inicio = { x:-2, y: -2, z: -18, ry: -1 };
    fim = { x: 3, y: -8, z: -12, ry: 1 };
  } else {
    // DESKTOP: mantém o comportamento original (não mexer).
    inicio = { x: 3, y: -3, z: -3, ry: -0.5 };
    fim = { x: 0, y: -3, z: 2, ry: 0.5 };
  }

  objeto.position.set(inicio.x, inicio.y, inicio.z);
  objeto.rotation.y = inicio.ry;

  const tl3d = gsap.timeline({
    scrollTrigger: {
      trigger: "#hammer-canvas",
      endTrigger: "#sobre",
      pin: true,
      pinSpacing: false,
      immediateRender: false,
      invalidateOnRefresh: true,
      start: "top 0%",
      end: "bottom bottom",
      scrub: 1,
    },
  });

  tl3d.to(objeto.position, {
    x: fim.x,
    y: fim.y,
    z: fim.z,
    duration: 1,
    ease: "none",
  });
  tl3d.to(
    objeto.rotation,
    {
      y: fim.ry,
      duration: 1,
      ease: "none",
    },
    "<",
  );

  cena.add(objeto);

  // O modelo carrega de forma assíncrona; recalcula as posições do ScrollTrigger
  // depois que ele entra na cena, corrigindo o bug de atualizar a página com a
  // barra de rolagem no meio (medidas defasadas do pin).
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.refresh();
  }
});

function animar() {
  if (objeto) {
    objeto.rotation.z += 0.01;
  }

  requestAnimationFrame(animar);
  renderizador.render(cena, camera);
}

animar();
