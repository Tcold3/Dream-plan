// src/lib/motion-core/album-cover-tunnel.mjs
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createSurface } from "./motion-runtime";

// src/lib/motion-core/album-cover-tunnel-assets.mjs
var DEFAULT_COVERS = [];

// src/lib/motion-core/album-cover-tunnel.mjs
function createAlbumCoverTunnel(target, initial = {}, CSS, MARKUP) {
  const optionsBase = { height: 675, paused: false, autoTravel: true, theme: "dark" };
  let options = { ...optionsBase, ...initial };
  const normalizeImages = (images) => Array.isArray(images) && images.length ? images.slice(0, 96).map((image, i) => typeof image === "string" ? { src: image, alt: "\u5C01\u9762 " + (i + 1) } : { src: image.src, alt: image.alt || "\u5C01\u9762 " + (i + 1) }) : DEFAULT_COVERS;
  let imageList = normalizeImages(initial.images), loadVersion = 0;
  const s = createSurface(target, { css: CSS, markup: MARKUP, width: 1200, height: 675, responsive: true }, options);
  const root = s.root, doc = target.ownerDocument, win = doc.defaultView, document = s.document, Image = win.Image, devicePixelRatio = win.devicePixelRatio || 1;
  const sceneEl = root.querySelector(".aw-scene"), errorEl = root.querySelector(".aw-error"), statusEl = root.querySelector(".aw-status");
  sceneEl.dataset.theme = options.theme;
  let dead = false, loaded = false, raf = 0, visible = true, inView = true;
  const stage = root.querySelector("#stage");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
  } catch {
    sceneEl.dataset.renderer = "unavailable";
    errorEl.hidden = false;
    errorEl.textContent = "\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301 WebGL2";
    options.onError?.(errorEl.textContent);
    return s.controller;
  }
  let PR = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(PR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  stage.appendChild(renderer.domElement);
  const el = renderer.domElement;
  el.tabIndex = 0;
  el.setAttribute("role", "region");
  el.setAttribute("aria-label", "\u4E13\u8F91\u5C01\u9762\u96A7\u9053\uFF1A\u6EDA\u8F6E\u6216\u4E0A\u4E0B\u62D6\u52A8\u7A7F\u884C\uFF0C\u70B9\u51FB\u9009\u62E9\uFF0C\u65B9\u5411\u952E\u5207\u6362\uFF0C\u7A7A\u683C\u6682\u505C");
  const addEventListener = (type, listener, settings) => s.on(type === "resize" ? win : el, type, listener, settings);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.5, 200);
  scene.add(camera);
  const BGF = `vec3 bgCol(vec2 p, float tt){
      vec2 q=(p-.5)/.382+.5;
      vec2 cq=(q-vec2(.52,.5))*vec2(1.65,1.);
      float r=length(cq);
      vec3 paper=vec3(1.55,1.56,1.57);
      paper-=vec3(.11,.11,.11)*smoothstep(.18,.95,r);
      return paper; }`;
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(160, 90), new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime;
    ${BGF}
    void main(){ gl_FragColor=vec4(bgCol(vUv,uTime),1.); }`
  }));
  bg.renderOrder = -1;
  camera.add(bg);
  bg.position.z = -60;
  let dustTexture;
  {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, "#fff");
    gr.addColorStop(0.35, "rgba(255,240,255,.5)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 32, 32);
    const n = 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 36;
      pos[i * 3 + 2] = -2 - Math.pow(Math.random(), 0.7) * 80;
    }
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    dustTexture = new THREE.CanvasTexture(c);
    var dust = new THREE.Points(geo2, new THREE.PointsMaterial({
      map: dustTexture,
      size: 0.09,
      color: 8947848,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.NormalBlending
    }));
    camera.add(dust);
  }
  const particleCount = 220;
  const particleX = new Float32Array(particleCount), particleY = new Float32Array(particleCount), particleZ = new Float32Array(particleCount);
  const streakPositions = new Float32Array(particleCount * 6), sparklePositions = new Float32Array(particleCount * 3);
  const streakGeometry = new THREE.BufferGeometry(), sparkleGeometry = new THREE.BufferGeometry();
  streakGeometry.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3).setUsage(THREE.DynamicDrawUsage));
  sparkleGeometry.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3).setUsage(THREE.DynamicDrawUsage));
  const streakMaterial = new THREE.LineBasicMaterial({ color: 0x80afe6, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const sparkleMaterial = new THREE.PointsMaterial({ map: dustTexture, color: 0x5696dc, size: 0.13, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
  const streaks = new THREE.LineSegments(streakGeometry, streakMaterial), sparkles = new THREE.Points(sparkleGeometry, sparkleMaterial);
  streaks.frustumCulled = sparkles.frustumCulled = false;
  streaks.renderOrder = sparkles.renderOrder = 3;
  camera.add(streaks, sparkles);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2, radius = 1.5 + Math.sqrt(Math.random()) * 13;
    particleX[i] = Math.cos(angle) * radius;
    particleY[i] = Math.sin(angle) * radius * 0.64;
    particleZ[i] = -2 - Math.random() * 37;
  }
  // Posters are portrait artwork. Keep their aspect ratio all the way from
  // the source image to the card face instead of padding a square texture.
  const TEX_W = 768, TEX_H = 1088;
  function createLayerCanvas() {
    const cv = document.createElement("canvas");
    cv.width = TEX_W;
    cv.height = TEX_H;
    return cv.getContext("2d", { willReadFrequently: true });
  }
  async function writeCoverLayer(g, data, index, src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    if (dead) throw new Error("destroyed");
    const frame = 16;
    const innerWidth = TEX_W - frame * 2, innerHeight = TEX_H - frame * 2;
    g.fillStyle = "#e5e8eb";
    g.fillRect(0, 0, TEX_W, TEX_H);
    const scale = Math.max(innerWidth / img.width, innerHeight / img.height);
    const width = img.width * scale, height = img.height * scale;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.save();
    g.beginPath();
    g.rect(frame, frame, innerWidth, innerHeight);
    g.clip();
    g.drawImage(img, (TEX_W - width) / 2, (TEX_H - height) / 2, width, height);
    g.restore();
    data.set(g.getImageData(0, 0, TEX_W, TEX_H).data, index * TEX_W * TEX_H * 4);
  }
  async function buildArray(images, report) {
    const g = createLayerCanvas();
    const data = new Uint8Array(TEX_W * TEX_H * 4 * images.length);
    for (let i = 0; i < images.length; i++) {
      await writeCoverLayer(g, data, i, images[i].src);
      report?.(Math.round((i + 1) / images.length * 90));
    }
    const t = new THREE.DataArrayTexture(data, TEX_W, TEX_H, images.length);
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.flipY = false;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }
  const S = 2.9, POSTER_W = S * TEX_W / TEX_H, G = 4.4, D = 5.5, NL = 14, FOCUS = 14;
  const covers = [], layers = [];
  const keyAt = (i, j, k) => imageList.length === 1 ? 0 : 1 + ((i * 3 + j * 5 + k * 2) % (imageList.length - 1) + imageList.length - 1) % (imageList.length - 1);
  for (let k = 0; k < NL; k++) {
    const L = { k, z: -k * D, items: [] };
    layers.push(L);
    for (let j = -5; j <= 5; j++) for (let i = -7; i <= 7; i++) {
      if (((i + j + k) % 2 + 2) % 2) continue;
      const hh = Math.abs(Math.sin(i * 12.9898 + j * 78.233 + k * 37.719) * 43758.5453) % 1;
      if (Math.max(Math.abs(i), Math.abs(j)) > 1 && hh < 0.42) continue;
      const c = {
        L,
        gridX: i,
        gridY: j,
        tex: i === 0 && j === 0 && k === 0 ? 0 : keyAt(i, j, k),
        hx: i * G,
        hy: j * G,
        x: i * G,
        y: j * G,
        z: 0,
        zo: 0,
        s: 1,
        b: 0.5,
        o: 1,
        lift: 0,
        rx: 0,
        ry: 0,
        ph: Math.random() * 6.28
      };
      covers.push(c);
      L.items.push(c);
    }
  }
  const N = covers.length;
  const TH = S * 0.12;
  const shadowG = new THREE.PlaneGeometry(POSTER_W * 1.6, S * 1.6);
  shadowG.translate(0.28, -0.42, -TH * 0.5 - 0.35);
  const boxG = new THREE.BoxGeometry(POSTER_W, S, TH, 1, 1, 1);
  const partOf = (g, v) => g.setAttribute("aPart", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(v), 1));
  partOf(shadowG, 0);
  partOf(boxG, 1);
  const geo = mergeGeometries([shadowG, boxG]);
  shadowG.dispose();
  boxG.dispose();
  const aTex = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const aLook = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
  const aPh = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const aFog = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  aFog.setUsage(THREE.DynamicDrawUsage);
  aLook.setUsage(THREE.DynamicDrawUsage);
  aTex.setUsage(THREE.DynamicDrawUsage);
  aPh.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aTex", aTex);
  geo.setAttribute("aLook", aLook);
  geo.setAttribute("aPh", aPh);
  geo.setAttribute("aFog", aFog);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { map: { value: null }, uRim: { value: new THREE.Color(11908533) }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `
    attribute float aTex, aPart, aPh, aFog; attribute vec4 aLook;
    varying vec2 vUv; varying float vTex, vPart, vPh; varying vec4 vLook; varying vec3 vN, vVN, vVP; varying float vFog;
    void main(){
      vFog = aFog; vUv = uv; vTex = aTex; vLook = aLook; vPart = aPart; vPh = aPh; vN = normal;
      vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.);
      vVP = mv.xyz; vVN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
      gl_Position = projectionMatrix * mv;
    }`,
    fragmentShader: `
    precision highp sampler2DArray;
    uniform sampler2DArray map; uniform vec3 uRim; uniform float uTime; uniform vec2 uRes;
    varying vec2 vUv; varying float vTex, vPart, vPh; varying vec4 vLook; varying vec3 vN, vVN, vVP; varying float vFog;
    ${BGF}
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 cover(vec2 uv, float bias){ return pow(texture(map, vec3(uv.x, 1. - uv.y, vTex), bias).rgb, vec3(2.2)); }
    void main(){
      if (vLook.y < .01 || vFog > .985) discard;
      // ---- \u8F6F\u6295\u5F71\uFF1A\u843D\u5728\u540E\u9762\u4E00\u5C42\u4E0A\u7684\u9634\u5F71 ----
      if (vPart < .5) {
        vec2 q = abs(vUv - .5) - .5 / 1.6 * .92;
        float d = length(max(q, 0.)) + min(max(q.x, q.y), 0.);
        if (vLook.y < .99) discard;                                     // \u6B63\u5728\u7A7F\u8FC7\u7684\u90A3\u5C42\u4E0D\u753B\u5F71\u5B50
        float a = (1. - smoothstep(-.02, .16, d)) * .18 * (1. - vFog);
        if (a < .004) discard;                                          // \u6295\u5F71\u5916\u5708\u4E0D\u5199\u6DF1\u5EA6\uFF0C\u4E0D\u4F1A\u6321\u4F4F\u540E\u9762
        gl_FragColor = vec4(vec3(.18, .19, .20), a); return;
      }
      if (vLook.y < .99 && abs(vN.z) < .5) discard;                    // \u534A\u900F\u660E\u65F6\u53EA\u7559\u6B63\u9762\uFF0C\u4E0D\u900F\u51FA\u76D2\u5B50\u5185\u58C1
      if (vLook.y < .99 && vN.z < -.5) discard;
      vec3 V = normalize(-vVP), N = normalize(vVN);
      float fres = pow(1. - abs(dot(N, V)), 3.);
      vec3 L = normalize(vec3(-.45, .75, .5));                         // \u5DE6\u4E0A\u65B9\u7684\u4E3B\u5149
      vec3 c;
      if (vN.z > .5) {
        // ---- \u6B63\u9762\uFF1A\u5C01\u9762 + \u5012\u89D2 + \u8986\u819C\u6D41\u5149 + \u7EB8\u5F20\u9897\u7C92 ----
        c = cover(vUv, vLook.z);
        vec2 e2 = min(vUv, 1. - vUv); float e = min(e2.x, e2.y);
        float lip = 1. - smoothstep(.0, .014, e);                       // \u5916\u6CBF\u5012\u89D2
        float tl = clamp(.5 + (vUv.y - vUv.x) * .9, 0., 1.);           // \u5DE6\u4E0A\u4EAE\u3001\u53F3\u4E0B\u6697
        c = mix(c, c * .55 + vec3(.59) * tl * .6, lip * .8);
        c *= 1. - .35 * smoothstep(.022, .014, e) * smoothstep(.010, .016, e);   // \u5012\u89D2\u91CC\u4FA7\u4E00\u6761\u7EC6\u9634\u5F71
        c *= .9 + .1 * smoothstep(.0, .35, e);                           // \u5370\u5237\u9762\u8FB9\u7F18\u5FAE\u6697
        c += (h21(floor(vUv * 700.)) - .5) * .018;                      // \u7EB8\u5F20\u9897\u7C92
        c += uRim * fres * .045;
        vec2 borderDistance = min(vUv, 1. - vUv) * vec2(768., 1088.);
        float border = min(borderDistance.x, borderDistance.y);
        c = mix(c, vec3(.78, .80, .83), 1. - smoothstep(14., 18., border));
        c = mix(c, vec3(.43, .47, .52), 1. - smoothstep(2., 5., border));
      } else if (vN.z < -.5) {
        c = vec3(.26, .27, .28);                                      // \u80CC\u677F
      } else {
        // ---- \u539A\u5EA6\uFF1A\u900F\u660E\u58F3\u8FB9 / \u5370\u5237\u5305\u8FB9 / \u7EB8\u82AF\u7EC6\u7EB9 / \u80CC\u677F ----
        float f = vN.x > .5 ? 1. - vUv.x : vN.x < -.5 ? vUv.x : vN.y > .5 ? 1. - vUv.y : vUv.y;   // 1 = \u6B63\u9762\u4E00\u4FA7
        float along = abs(vN.x) > .5 ? vUv.y : vUv.x;
        vec2 edgeUv = vN.x > .5 ? vec2(.985, along) : vN.x < -.5 ? vec2(.015, along) : vN.y > .5 ? vec2(along, .985) : vec2(along, .015);
        vec3 ink = cover(edgeUv, 2.);
        vec3 paper = vec3(.82, .82, .81) * (.91 + .09 * sin(f * 190.)) * (.96 + .04 * h21(vec2(floor(f * 60.), floor(along * 400.))));
        vec3 back = vec3(.26, .27, .28);
        c = back;
        c = mix(c, paper, smoothstep(.13, .16, f));
        c = mix(c, ink * .85, smoothstep(.74, .77, f));
        c = mix(c, ink * .5 + vec3(.58) * .45, smoothstep(.90, .92, f));   // \u900F\u660E\u58F3
        c += vec3(.9) * .07 * (smoothstep(.975, 1., f) + (1. - smoothstep(.0, .03, f)) * .4);  // \u4E24\u6761\u4EAE\u68F1
        c *= .55 + .55 * max(dot(vN, L), 0.);                            // \u671D\u5149\u7684\u4FA7\u9762\u66F4\u4EAE
        c += uRim * fres * .06;
      }
      c *= vLook.x;
      vec2 sp = .5 + (gl_FragCoord.xy / uRes - .5) * .382;            // \u8FDC\u5904\u878D\u8FDB\u540C\u4E00\u5F20\u80CC\u666F\u8272\u91CC\uFF08\u771F\u96FE\uFF0C\u4E0D\u662F\u534A\u900F\u660E\uFF09
      c = mix(c, bgCol(sp, uTime) * .92, vFog);
      gl_FragColor = vec4(c, vLook.y);
    }`
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const world = new THREE.Group();
  world.rotation.z = 0;
  world.add(mesh);
  scene.add(world);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uLight: { value: new THREE.Vector2(0.53, 0.47) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uLight; varying vec2 vUv;
    void main(){
      vec3 c=texture2D(tDiffuse,vUv).rgb;
      gl_FragColor=vec4(c,1.);
    }`
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  function resize() {
    const w = Math.max(1, stage.clientWidth), h = Math.max(1, stage.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    mat.uniforms.uRes.value.set(w * PR, h * PR);
    renderer.setPixelRatio(PR);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(PR);
    composer.setSize(w, h);
  }
  addEventListener("resize", resize);
  resize();
  const onCanvas = (type, listener, settings) => s.on(el, type, (event) => {
    listener(event);
    wake();
  }, settings);
  const pointer = new THREE.Vector2(), look = new THREE.Vector2();
  let inside = false, dragging = false, lastY = 0, moved = 0, dragV = 0, wheel = 0;
  onCanvas("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    inside = true;
    pointer.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (dragging) {
      dragV += e.clientY - lastY;
      moved += Math.abs(e.clientY - lastY);
      lastY = e.clientY;
    }
  });
  onCanvas("pointerdown", (e) => {
    dragging = true;
    lastY = e.clientY;
    moved = 0;
    el.focus({ preventScroll: true });
    el.setPointerCapture(e.pointerId);
  });
  onCanvas("pointerup", () => {
    dragging = false;
    if (moved < 6) {
      pick();
      onClick();
    }
  });
  onCanvas("pointerleave", () => {
    inside = false;
  });
  onCanvas("wheel", (e) => {
    e.preventDefault();
    wheel += e.deltaY;
  }, { passive: false });
  s.on(el, "keydown", (e) => {
    if (e.key === " ") {
      e.preventDefault();
      options.paused = !options.paused;
      syncVisibility();
      wake();
    }
  });
  const CAM0 = FOCUS;
  let travel = 0, vel = 0, idle = 0, goTo = null, heroAmt = 0, hovered = null, heroC = covers.find((c) => c.tex === 0);
  let particleImpulse = 0, particleDirection = 1;
  const smooth = (a, b, x) => {
    const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  };
  const damp = (a, b, k, dt) => instant() ? b : a + (b - a) * (1 - Math.exp(-k * dt));
  const centerOf = (L) => L.items.find((c) => c.hx === 0 && c.hy === 0);
  function fly(c, x1, y1, side) {
    if (instant()) {
      c.hx = c.x = x1;
      c.hy = c.y = y1;
      c.fl = null;
      return;
    }
    c.fl = { x0: c.x, y0: c.y, x1, y1, p: 0, dur: 1.15, side: side * (Math.random() < 0.5 ? 1 : -1) };
    c.hx = x1;
    c.hy = y1;
  }
  const ease = (p) => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  function onClick() {
    if (hovered) select(hovered);
  }
  function select(t, notify = true) {
    const L = t.L, occ = centerOf(L);
    if (occ && occ !== t) {
      fly(occ, t.hx, t.hy, -1);
    }
    fly(t, 0, 0, 1);
    goTo = travel + (camera.position.z - FOCUS - L.z);
    vel = 0;
    idle = 0;
    heroAmt = 0;
    if (instant()) {
      travel = goTo;
      goTo = null;
      heroC = t;
      heroAmt = 1;
    }
    if (notify) options.onSelect?.(t.tex);
    wake();
  }
  function pick() {
    hovered = null;
    if (!inside) return;
    let bestZ = -1e9;
    for (const c of covers) {
      if (c.o < 0.5 || c.fog > 0.6) continue;
      tmp.set(c.x, c.y, c.z).applyMatrix4(world.matrixWorld);
      const dist = camera.position.z - tmp.z;
      if (dist < 1) continue;
      tmp.project(camera);
      const halfX = POSTER_W * c.s * 0.5 / (dist * tanHalf);
      const halfY = S * c.s * 0.5 / (dist * tanHalf);
      if (Math.abs(tmp.x - pointer.x) * camera.aspect < halfX && Math.abs(tmp.y - pointer.y) < halfY && c.z > bestZ) {
        bestZ = c.z;
        hovered = c;
      }
    }
  }
  addEventListener("keydown", (e) => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!dir || !heroC) return;
    e.preventDefault();
    let best = null, bd = 1e9;
    for (const c of heroC.L.items) {
      if (c === heroC) continue;
      const dx = c.hx, dy = c.hy, along = dx * dir[0] + dy * dir[1];
      if (along <= 0.1) continue;
      const d = along + Math.abs(dx * dir[1] - dy * dir[0]) * 1.5;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best) select(best);
    wake();
  });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), SC = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(16));
  function updateParticles(input, dt) {
    if (instant()) {
      streakMaterial.opacity = sparkleMaterial.opacity = 0;
      return;
    }
    if (Math.abs(input) > 1e-4) {
      particleDirection = Math.sign(input);
      particleImpulse = Math.min(1, particleImpulse + Math.abs(input) * 1.8);
    }
    particleImpulse *= Math.exp(-dt * 1.3);
    streakMaterial.opacity = particleImpulse * 0.42;
    sparkleMaterial.opacity = particleImpulse * 0.6;
    if (particleImpulse < 0.01) return;
    const speed = dt * (5 + particleImpulse * 30) * particleDirection;
    const tail = particleDirection * (0.5 + particleImpulse * 2.2);
    for (let i = 0; i < particleCount; i++) {
      let z = particleZ[i] + speed;
      if (z > -1.4) z = -39;
      else if (z < -39) z = -1.4;
      particleZ[i] = z;
      const lineIndex = i * 6, pointIndex = i * 3, x = particleX[i], y = particleY[i];
      streakPositions[lineIndex] = streakPositions[lineIndex + 3] = sparklePositions[pointIndex] = x;
      streakPositions[lineIndex + 1] = streakPositions[lineIndex + 4] = sparklePositions[pointIndex + 1] = y;
      streakPositions[lineIndex + 2] = sparklePositions[pointIndex + 2] = z;
      streakPositions[lineIndex + 5] = z - tail;
    }
    streakGeometry.attributes.position.needsUpdate = true;
    sparkleGeometry.attributes.position.needsUpdate = true;
  }
  function update(dt, t) {
    const input = wheel * 4e-3 + dragV * 0.02;
    wheel = 0;
    dragV = 0;
    updateParticles(input, dt);
    if (Math.abs(input) > 1e-4) {
      vel += input;
      idle = 0;
      goTo = null;
    } else idle += dt;
    vel *= Math.pow(0.06, dt);
    travel += vel * (instant() ? 0.12 : dt) * 6;
    if (goTo !== null) {
      travel = damp(travel, goTo, 2.4, dt);
      if (Math.abs(travel - goTo) < 0.02) goTo = null;
    } else if (idle > 0.45 && Math.abs(vel) < 0.5) {
      const fz = CAM0 - travel - FOCUS;
      let best = null, bd = 1e9;
      for (const L of layers) if (centerOf(L)) {
        const d = L.z - fz;
        if (Math.abs(d) < Math.abs(bd)) {
          bd = d;
          best = L;
        }
      }
      if (best) travel = damp(travel, travel - bd, 3, dt);
    }
    if (options.autoTravel && !instant() && idle > 5 && !hovered && goTo === null) {
      vel += 5.6;
      idle = 0;
    }
    camera.position.z = CAM0 - travel;
    if (inside) look.copy(pointer);
    else look.multiplyScalar(Math.pow(0.1, dt));
    camera.position.x = damp(camera.position.x, Math.sin(t * 0.2) * 0.35 + look.x * 0.9, 2.5, dt);
    camera.position.y = damp(camera.position.y, Math.cos(t * 0.17) * 0.25 + look.y * 0.55, 2.5, dt);
    camera.lookAt(camera.position.x * 0.4, camera.position.y * 0.4, camera.position.z - 20);
    camera.updateMatrixWorld();
    const focusZ = camera.position.z - FOCUS;
    let heroL = null;
    for (const L of layers) {
      while (L.z > camera.position.z - 1) L.z -= NL * D;
      while (L.z < camera.position.z - 1 - NL * D) L.z += NL * D;
      if (Math.abs(L.z - focusZ) < 1.2 && centerOf(L)) heroL = L;
    }
    const newHero = heroL ? centerOf(heroL) : null;
    const settled = newHero && Math.abs(vel) < 0.6 && Math.abs(heroL.z - focusZ) < 0.25;
    if (newHero !== heroC && settled) {
      heroC = newHero;
      heroAmt = 0;
    }
    heroAmt = damp(heroAmt, settled && newHero === heroC ? 1 : 0, settled ? 2.8 : 7, dt);
    if (!dragging) pick();
    else hovered = null;
    el.style.cursor = dragging ? "grabbing" : hovered ? "pointer" : "grab";
    const order = covers.slice().sort((a, b) => a.L.z + a.zo - (b.L.z + b.zo));
    let n = 0;
    for (const c of order) {
      const L = c.L, dz = L.z - focusZ;
      const isHero = c === heroC ? heroAmt : 0;
      let lift = 0, px = 0, py = 0;
      if (hovered && hovered !== heroC) {
        if (c === hovered) lift = 1;
        else if (c.L === hovered.L) {
          const dx = c.hx - hovered.hx, dy = c.hy - hovered.hy, r2 = Math.hypot(dx, dy);
          if (r2 < 9) {
            const f = 1 - r2 / 9;
            px = dx / r2 * f * 0.7;
            py = dy / r2 * f * 0.7;
            lift = f * 0.2;
          }
        }
      }
      c.lift = damp(c.lift, lift, 8, dt);
      let arcZ = 0, rz = 0, ryF = 0;
      if (c.fl) {
        const F = c.fl;
        F.p = Math.min(1, F.p + dt / F.dur);
        const e = ease(F.p), bump = Math.sin(Math.PI * e);
        const dx = F.x1 - F.x0, dy = F.y1 - F.y0, len = Math.hypot(dx, dy) || 1;
        const amp = Math.min(3.2, len * 0.32) * F.side;
        c.x = F.x0 + dx * e + -dy / len * bump * amp;
        c.y = F.y0 + dy * e + dx / len * bump * amp;
        arcZ = bump * (F.side > 0 ? 2.6 : 1.2);
        rz = bump * 0.22 * F.side;
        ryF = bump * 0.35 * Math.sign(dx || 1);
        if (F.p >= 1) c.fl = null;
      } else {
        c.x = damp(c.x, c.hx + px, 4, dt);
        c.y = damp(c.y, c.hy + py, 4, dt);
      }
      const r = Math.hypot(c.x / 17, c.y / 10.5);
      const ahead = 1 - smooth(0.5, 2.4, dz);
      const fog = Math.min(1, (1 - Math.exp(-Math.max(0, -dz - 0.8 * D) / (4.6 * D))) / 0.96);
      const depth = dz < 0 ? 1 - 0.72 * smooth(0, 4 * D, -dz) : 1;
      let b = 0.86 * depth * (1 - 0.7 * smooth(0.15, 1, r));
      b = b + (1.02 - b) * isHero;
      b = b + (1 - b) * c.lift * 0.85;
      c.b = b;
      c.o = ahead;
      c.fog = fog;
      const s2 = 1 + 0.7 * isHero + 0.14 * c.lift;
      c.s = s2;
      c.z = L.z + 1.3 * isHero + 2 * c.lift + arcZ + Math.sin(t * 0.6 + c.ph) * 0.06;
      c.zo = c.z - L.z;
      const tgx = (c === hovered ? -look.y * 0.35 : 0) + c.y * 0.012, tgy = (c === hovered ? look.x * 0.35 : 0) - c.x * 0.012;
      c.rx = damp(c.rx, tgx * (1 - isHero), 6, dt);
      c.ry = damp(c.ry, tgy * (1 - isHero), 6, dt);
      const blur = Math.min(4.5, Math.abs(dz) * 0.3) * (1 - Math.max(isHero, c.lift));
      E.set(c.rx, c.ry + ryF, Math.sin(t * 0.3 + c.ph) * 0.012 * (1 - isHero) + rz);
      Q.setFromEuler(E);
      P.set(c.x, c.y, c.z);
      SC.setScalar(s2);
      M.compose(P, Q, SC);
      mesh.setMatrixAt(n, M);
      aLook.setXYZW(n, c.b, c.o, blur, Math.max(isHero, c.lift));
      aTex.setX(n, c.tex);
      aPh.setX(n, c.ph * 0.159);
      aFog.setX(n, c.fog);
      n++;
    }
    mesh.instanceMatrix.needsUpdate = true;
    aLook.needsUpdate = true;
    aTex.needsUpdate = true;
    aPh.needsUpdate = true;
    aFog.needsUpdate = true;
    mat.uniforms.uTime.value = t;
    bg.material.uniforms.uTime.value = t;
    grade.uniforms.uTime.value = t;
    dust.rotation.z = t * 0.01;
  }
  const fpsEl = document.getElementById("fps");
  let last = 0, T = 0, acc = 0, frames = 0, slow = 0, paintDue = 0, frameCount = 0;
  function render(now) {
    if (dead || !loaded) return;
    const dt = last ? Math.min(0.05, (now - last) / 1e3) : 1 / 60;
    last = now;
    T += dt;
    update(dt, T);
    composer.render();
    sceneEl.dataset.frame = String(++frameCount);
    sceneEl.dataset.active = String(heroC?.tex ?? 0);
    sceneEl.dataset.hovered = String(hovered?.tex ?? -1);
    sceneEl.dataset.activeLayer = String(heroC?.L.k ?? -1);
    sceneEl.dataset.hoveredLayer = String(hovered?.L.k ?? -1);
    sceneEl.dataset.travel = travel.toFixed(3);
    sceneEl.dataset.paused = String(!!options.paused);
    sceneEl.dataset.coverCount = String(imageList.length);
    if (heroC) {
      const label = imageList[heroC.tex]?.alt || "\u4E13\u8F91\u5C01\u9762";
      if (statusEl.textContent !== label) statusEl.textContent = label;
    }
    acc += dt;
    frames++;
    if (acc > 1) {
      const fps = frames / acc;
      fpsEl.textContent = fps.toFixed(0) + " fps \xB7 " + PR.toFixed(2) + "x";
      slow = fps < 45 ? slow + 1 : 0;
      if (slow >= 2 && PR > 0.76 && options.theme !== "light") {
        PR = Math.max(0.75, PR - 0.25);
        resize();
        slow = 0;
      }
      acc = 0;
      frames = 0;
    }
  }
  function loop(now) {
    raf = 0;
    if (dead || !visible || doc.hidden || !loaded) return;
    if (now >= paintDue || instant()) {
      render(now);
      paintDue = Math.max(paintDue + 1e3 / (options.theme === "light" ? 30 : 60), now);
    }
    if (!instant()) {
      sceneEl.dataset.running = "true";
      raf = win.requestAnimationFrame(loop);
    } else sceneEl.dataset.running = "false";
  }
  function instant() {
    return options.paused || s.reduced();
  }
  function wake() {
    if (!dead && visible && !doc.hidden && loaded && !raf) raf = win.requestAnimationFrame(loop);
  }
  function stop() {
    win.cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    sceneEl.dataset.running = "false";
  }
  function syncVisibility() {
    visible = inView && !doc.hidden;
    stop();
    wake();
  }
  const io = new win.IntersectionObserver((entries) => {
    inView = entries.at(-1).isIntersecting;
    syncVisibility();
  });
  io.observe(s.element);
  const ro = new win.ResizeObserver(() => {
    if (!dead) {
      resize();
      wake();
    }
  });
  ro.observe(stage);
  s.on(doc, "visibilitychange", syncVisibility);
  s.on(s.matchMedia("(prefers-reduced-motion: reduce)"), "change", () => {
    stop();
    wake();
  });
  s.on(el, "pointercancel", () => {
    dragging = false;
    inside = false;
    wake();
  });
  s.on(el, "blur", () => {
    inside = false;
    hovered = null;
    wake();
  });
  function applyActive(index) {
    if (!Number.isInteger(index) || index < 0 || index >= imageList.length) return;
    const candidates = covers.filter((c2) => c2.tex === index);
    const c = candidates.sort((a, b) => Math.abs(a.L.z - (camera.position.z - FOCUS)) - Math.abs(b.L.z - (camera.position.z - FOCUS)) || Math.hypot(a.hx, a.hy) - Math.hypot(b.hx, b.hy))[0];
    if (c) select(c, false);
  }
  function loadImages(images) {
    const version = ++loadVersion;
    const onProgress = options.onProgress, onReady = options.onReady, onError = options.onError;
    onProgress?.(0);
    return buildArray(images, (progress) => {
      if (dead || version !== loadVersion) throw new Error("cancelled");
      onProgress?.(progress);
    }).then((texture) => {
      if (dead || version !== loadVersion) {
        texture.dispose();
        return;
      }
      const previous = mat.uniforms.map.value;
      imageList = images;
      mat.uniforms.map.value = texture;
      previous?.dispose();
      covers.forEach((c) => {
        c.tex = c.gridX === 0 && c.gridY === 0 && c.L.k === 0 ? 0 : keyAt(c.gridX, c.gridY, c.L.k);
      });
      loaded = true;
      errorEl.hidden = true;
      delete sceneEl.dataset.error;
      if (options.theme === "light" && frameCount === 0) heroAmt = 1;
      resize();
      update(1 / 60, T);
      composer.render();
      sceneEl.dataset.renderer = "webgl2";
      sceneEl.dataset.ready = "true";
      s.body.dataset.motionReady = "true";
      s.ready();
      onProgress?.(100);
      onReady?.();
      if (options.active !== void 0) applyActive(options.active);
      wake();
    }).catch(() => {
      if (!dead && version === loadVersion) {
        sceneEl.dataset.error = "images";
        errorEl.hidden = false;
        errorEl.textContent = "\u5C01\u9762\u56FE\u7247\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u56FE\u7247\u5730\u5740";
        onError?.(errorEl.textContent);
      }
    });
  }
  async function upgradeCovers(batches) {
    const texture = mat.uniforms.map.value;
    if (!texture || dead) return;
    const g = createLayerCanvas();
    let upgraded = 0;
    for await (const batch of batches) {
      if (dead || mat.uniforms.map.value !== texture) return;
      for (const [index, src] of batch) {
        await writeCoverLayer(g, texture.image.data, index, src);
        if (dead || mat.uniforms.map.value !== texture) return;
        texture.addLayerUpdate(index);
      }
      texture.needsUpdate = true;
      upgraded += batch.length;
      sceneEl.dataset.detailCovers = String(upgraded);
      wake();
    }
  }
  const ready = loadImages(imageList);
  s.setTimeout(() => {
    root.querySelector("#hint").style.opacity = "0";
  }, 9e3);
  s.addCleanup(() => {
    dead = true;
    stop();
    io.disconnect();
    ro.disconnect();
    const geometries = /* @__PURE__ */ new Set(), materials = /* @__PURE__ */ new Set(), textures = /* @__PURE__ */ new Set();
    scene.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        for (const value of Object.values(material.uniforms || {})) if (value?.value?.isTexture) textures.add(value.value);
      }
    });
    textures.forEach((texture) => texture.dispose());
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    composer.passes.forEach((pass) => pass.dispose?.());
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  });
  return { ...s.controller, ready, upgradeCovers, update(next = {}) {
    if (dead) return;
    const activeChanged = next.active !== void 0 && next.active !== options.active, imagesChanged = Object.hasOwn(next, "images") && next.images !== options.images;
    options = { ...options, ...next };
    s.controller.update(next);
    sceneEl.dataset.theme = options.theme;
    resize();
    if (imagesChanged) void loadImages(normalizeImages(next.images));
    else if (activeChanged && loaded) applyActive(next.active);
    stop();
    wake();
  } };
}

// src/lib/motion-core/album-cover-tunnel-entry.js
/*!
LeiShiFu original interaction, supplied by its author. Album artwork rights remain with the respective rights holders.
Three.js license:
The MIT License

Copyright © 2010-2026 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
function mountAlbumCoverTunnel(target, options = {}) {
  return createAlbumCoverTunnel(target, options, '.aw-scene{position:relative;width:100%;height:var(--motion-height,675px);min-height:180px;overflow:hidden;background:#05060f;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}\r\n.aw-scene #stage{position:absolute;inset:0;width:100%;height:100%;touch-action:none;overflow:hidden}\r\n.aw-scene canvas{display:block;width:100%!important;height:100%!important;outline:none}\r\n.aw-scene canvas:focus-visible{outline:2px solid #202327;outline-offset:-4px}\r\n.aw-scene #hint{position:absolute;bottom:16px;left:24px;right:24px;text-align:center;color:#ffffffa0;font-size:12px;line-height:1.6;letter-spacing:.03em;text-shadow:0 1px 8px #0008;transition:opacity 1.2s;pointer-events:none}\r\n.aw-scene #fps{display:none}\r\n.aw-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}\r\n.aw-error{position:absolute;inset:0;display:grid;place-items:center;color:#202327;font-size:14px}\r\n.aw-error[hidden]{display:none}\r\n.aw-scene[data-theme=light]{background:#fff}\r\n.aw-scene[data-theme=light] #stage{width:100%;height:100%;border-radius:0;box-shadow:none}\r\n.aw-scene[data-theme=light] #hint{display:none}\r\n@media(max-width:600px){.aw-scene #hint{bottom:12px;left:16px;right:16px;font-size:11px}}\r\n@media(prefers-reduced-motion:reduce){.aw-scene #hint{transition:none}}\r\n', '<section class="aw-scene notranslate" translate="no" aria-label="Album cover tunnel"><div id="stage"></div><p id="hint">\u6EDA\u8F6E / \u4E0A\u4E0B\u62D6\u52A8\uFF1A\u7A7F\u8FC7\u5C01\u9762\u96A7\u9053 \xB7 \u60AC\u505C\u5438\u8D77 \xB7 \u70B9\u51FB\u98DE\u5165\u4E2D\u592E \xB7 \u65B9\u5411\u952E\u5207\u6362 \xB7 \u7A7A\u683C\u6682\u505C</p><span id="fps"></span><p class="aw-status" aria-live="polite"></p><p class="aw-error" role="status" hidden></p></section>');
}
export {
  mountAlbumCoverTunnel
};
