/**
 * 云栖智慧牧场 · Three.js 微缩生态场景
 * ------------------------------------------------------------------
 * 等距微距视角 / 昼夜光照 / 体积光 / 飘云薄雾 / 移轴景深 / 黏土玻璃材质
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { getBarnState, HEALTH_STATUS, daylightLabel, fmtClock } from './data.js';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const DAY_SECONDS = 0.021; // 每个真实秒推进的模拟小时数

/* ------------------------------------------------------------------ */
/* 画质档位                                                            */
/* ------------------------------------------------------------------ */
/**
 * 从「极致」到「极简」逐级关掉最贵的环节：
 *  - dpr              渲染倍率，像素量按平方增长
 *  - msaa             后处理 RT 的多重采样数
 *  - shadow           阴影贴图边长，0 = 整个阴影通道关闭
 *  - transmission     玻璃/水体透射，> 0 时每帧会多渲一遍全场景
 *  - tiltShift/bloom  两遍全屏移轴模糊 / 泛光金字塔
 *  - volumetric       体积光面片
 *  - shadowEveryFrame 阴影是否每帧刷新（false = 隔帧刷新）
 */
const QUALITY_PRESETS = {
  ultra: {
    label: '极致', dpr: 2, budget: 6.0e6, msaa: 4, shadow: 2048, tiltShift: true, bloom: true,
    transmission: 0.62, transmissionScale: 0.75, volumetric: true, shadowEveryFrame: true,
  },
  high: {
    label: '高', dpr: 1.6, budget: 4.0e6, msaa: 2, shadow: 2048, tiltShift: true, bloom: true,
    transmission: 0.62, transmissionScale: 0.55, volumetric: true, shadowEveryFrame: true,
  },
  balanced: {
    label: '均衡', dpr: 1.25, budget: 2.6e6, msaa: 2, shadow: 1024, tiltShift: true, bloom: true,
    transmission: 0, transmissionScale: 0, volumetric: true, shadowEveryFrame: false,
  },
  smooth: {
    label: '流畅', dpr: 1, budget: 1.8e6, msaa: 0, shadow: 768, tiltShift: true, bloom: true,
    transmission: 0, transmissionScale: 0, volumetric: true, shadowEveryFrame: false,
  },
  minimal: {
    label: '极简', dpr: 0.8, budget: 1.1e6, msaa: 0, shadow: 0, tiltShift: false, bloom: false,
    transmission: 0, transmissionScale: 0, volumetric: false, shadowEveryFrame: false,
  },
};
const QUALITY_ORDER = ['ultra', 'high', 'balanced', 'smooth', 'minimal'];

const C = {
  grass: '#728c5f',
  grassLight: '#89a171',
  grassDark: '#56724f',
  soil: '#705942',
  soilDark: '#43352a',
  rock: '#333b37',
  woodDark: '#46362b',
  wood: '#8b674b',
  woodLight: '#c1a076',
  cream: '#e2d2b9',
  plaster: '#d8c7ac',
  roof: '#2f4e4a',
  roofEdge: '#3d6158',
  metal: '#8b9994',
  hay: '#d4ae68',
  pink: '#e6b3a3',
  water: '#3f7f78',
  stone: '#8c9488',
  leaf: '#5d815e',
  leafLight: '#7d9c6d',
  leafDark: '#405f4e',
  blossom: '#e7aaa2',
  glow: '#ffd393',
  warm: '#ffbe7a',
  danger: '#f08f7d',
  watch: '#f0c77e',
  healthy: '#86dfc2',
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function makeRng(seed = 20261107) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stdMat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.82,
    metalness: 0.02,
    envMapIntensity: 0.65,
    ...options,
  });
}

function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function radialTexture(stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], size = 128) {
  return makeCanvasTexture(size, size, (ctx) => {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, color] of stops) gradient.addColorStop(at, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

function signTexture({ title, sub, accent = '#e8dcc6', ink = '#263c33', border = '#8ea38b' }) {
  return makeCanvasTexture(1024, 320, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = 54;
    ctx.beginPath();
    ctx.roundRect(24, 24, w - 48, h - 48, r);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = border;
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(47, 47, w - 94, h - 94, r - 18);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(38,60,51,.3)';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = ink;
    ctx.font = '700 102px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(title, w / 2, 162);
    ctx.font = '500 35px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillStyle = 'rgba(38,60,51,.68)';
    ctx.fillText(sub, w / 2, 225);
  });
}

function cowTexture(variant = 0) {
  const variants = [
    { base: '#efe2cc', spot: '#625044', dark: '#3f3530', accent: '#f5ead8' },
    { base: '#a9764f', spot: '#f1e2ca', dark: '#523a2d', accent: '#f7ead7' },
    { base: '#403c38', spot: '#e9dcc7', dark: '#272522', accent: '#f3e7d4' },
    { base: '#d2b18c', spot: '#7b5842', dark: '#4d362a', accent: '#f2e2ca' },
    { base: '#b9b3a6', spot: '#f0e8da', dark: '#4a4740', accent: '#f5efe2' },
  ];
  const v = variants[variant % variants.length];
  const tex = makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = v.base;
    ctx.fillRect(0, 0, w, h);
    const rng = makeRng(1000 + variant * 97);
    // 柔软笔触 / 毛发颗粒
    for (let i = 0; i < 280; i++) {
      ctx.globalAlpha = 0.05 + rng() * 0.05;
      ctx.strokeStyle = rng() > 0.5 ? '#fff8e9' : v.dark;
      ctx.lineWidth = 1 + rng() * 2;
      const x = rng() * w;
      const y = rng() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 10 - rng() * 20, y + 14, x + 8 - rng() * 16, y + 28 + rng() * 20);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 有机斑块
    const blobs = 6 + variant;
    for (let i = 0; i < blobs; i++) {
      const cx = 40 + rng() * (w - 80);
      const cy = 50 + rng() * (h - 100);
      const rx = 30 + rng() * 85;
      const ry = 25 + rng() * 65;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rng() * TAU);
      ctx.beginPath();
      const points = 13;
      for (let p = 0; p <= points; p++) {
        const a = (p / points) * TAU;
        const noise = 0.82 + rng() * 0.3;
        const x = Math.cos(a) * rx * noise;
        const y = Math.sin(a) * ry * noise;
        if (p === 0) ctx.moveTo(x, y);
        else ctx.quadraticCurveTo(x * 1.06, y * 1.06, x, y);
      }
      ctx.closePath();
      ctx.fillStyle = i % 4 === 0 ? v.dark : v.spot;
      ctx.fill();
      ctx.restore();
      // 左右包裹，避免接缝
      for (const dx of [-w, w]) {
        ctx.save();
        ctx.translate(cx + dx, cy);
        ctx.rotate(0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.8, ry * 0.8, 0, 0, TAU);
        ctx.fillStyle = v.spot;
        ctx.fill();
        ctx.restore();
      }
    }
    // 柔和云状高光
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(255,255,255,.14)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(255,255,255,.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return { texture: tex, colors: v };
}

/* ------------------------------------------------------------------ */
/* 后处理：移轴模糊 + 暗角 + 轻微辉光                                   */
/* ------------------------------------------------------------------ */

const BokehGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    direction: { value: new THREE.Vector2(1, 0) },
    focus: { value: 0.54 },
    band: { value: 0.16 },
    strength: { value: 1 },
    vignette: { value: 0.32 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform vec2 direction;
    uniform float focus;
    uniform float band;
    uniform float strength;
    uniform float vignette;
    varying vec2 vUv;

    void main() {
      float dist = abs(vUv.y - focus);
      float mask = smoothstep(band, band + 0.22, dist) * strength;
      vec2 px = direction / resolution;

      vec4 color = texture2D(tDiffuse, vUv) * 0.24;
      color += texture2D(tDiffuse, vUv + px * 1.2) * 0.19;
      color += texture2D(tDiffuse, vUv - px * 1.2) * 0.19;
      color += texture2D(tDiffuse, vUv + px * 2.5) * 0.12;
      color += texture2D(tDiffuse, vUv - px * 2.5) * 0.12;
      color += texture2D(tDiffuse, vUv + px * 4.1) * 0.07;
      color += texture2D(tDiffuse, vUv - px * 4.1) * 0.07;

      vec4 sharp = texture2D(tDiffuse, vUv);
      vec4 result = mix(sharp, color, clamp(mask, 0.0, 0.86));

      float luma = dot(result.rgb, vec3(0.2126, 0.7152, 0.0722));
      result.rgb = mix(vec3(luma), result.rgb, 1.06);
      result.rgb *= 1.015;

      vec2 centered = vUv - 0.5;
      float vig = smoothstep(0.18, 0.82, length(centered * vec2(1.04, 0.92)));
      result.rgb *= 1.0 - vig * vignette;

      // 细微暖色边缘，模拟微距镜头的空气感
      result.rgb += vec3(0.008, 0.004, 0.0) * smoothstep(0.45, 1.0, dist);
      gl_FragColor = result;
    }
  `,
};

/* ------------------------------------------------------------------ */

export class PastureScene {
  constructor({ canvas, labelsEl, state, onSelect, onTime, onReady }) {
    this.canvas = canvas;
    this.labelsEl = labelsEl;
    this.state = state;
    this.onSelect = onSelect || (() => {});
    this.onTime = onTime || (() => {});
    this.onReady = onReady || (() => {});
    this.container = canvas.parentElement;
    this.clockTime = 0;
    this.hour = state.settings?.simHour ?? 17.18;
    this.daylight = 1;
    this.options = {
      autoDaylight: state.settings?.autoDaylight ?? true,
      autoRotate: state.settings?.autoRotate ?? false,
      labels: state.settings?.labels ?? true,
      cowTags: false,
      fog: state.settings?.fog ?? true,
      clouds: state.settings?.clouds ?? true,
      volumetric: state.settings?.volumetric ?? true,
      tiltShift: state.settings?.tiltShift ?? true,
      fireflies: state.settings?.fireflies ?? true,
      bloom: state.settings?.bloom ?? 0.28,
      exposure: state.settings?.exposure ?? 1.02,
      daylightSpeed: state.settings?.daylightSpeed ?? 1,
      quality: state.settings?.quality ?? 'auto',
    };
    this.selected = null;
    this.hovered = null;
    this.pointerDown = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.clickable = [];
    this.fans = [];
    this.mistSystems = [];
    this.heaters = [];
    this.sensorVisuals = new Map();
    this.cowModels = new Map();
    this.barnAnchors = new Map();
    this.labels = new Map();
    this.interiorLights = [];
    this.windowMaterials = [];
    this.stringBulbs = [];
    this.cloudMeshes = [];
    this.cloudMaterial = null;
    this.stars = null;
    this.fireflies = null;
    this.fireflyBase = [];
    this.godRays = [];
    this.butterflies = [];
    this.windmillBlades = null;
    this.ripples = [];
    this.ducks = [];
    this.clock = new THREE.Clock();
    this.cameraTween = null;
    this.lastTimeReport = 0;
    this.initialized = false;
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.raycastTimer = 0;
    this.paused = false;

    /* 性能：画质档位 + 自适应降级 */
    this.qualityName = 'high';
    this.qualityAuto = false;
    this.preset = QUALITY_PRESETS.high;
    this.maxDpr = QUALITY_PRESETS.high.dpr;
    this.gpuName = '';
    this.perf = { fps: 0, calls: 0, triangles: 0, level: 'high', auto: false };
    this._fpsFrames = 0;
    this._fpsStart = 0;
    this._warmupUntil = 0;
    this._lowStreak = 0;
    this._highStreak = 0;
    this._upgradeLocked = false;
    this._autoDowngraded = false;
    this._shadowTick = 0;
    this._projVec = new THREE.Vector3();
    this.onQuality = null;
  }

  init() {
    this.resolveQuality();
    this.setupRenderer();
    this.setupScene();
    this.setupLights();
    this.buildWorld();
    this.setupLabels();
    this.setupPostProcessing();
    this.bindEvents();
    this.resize();
    this.syncState(this.state);
    this.applyDayNight();
    this.initialized = true;
    this.introCamera();
    this._warmupUntil = performance.now() + 2600; // 首帧编译着色器会掉帧，先不判定
    this.animate();
    if (this.renderer.shadowMap.enabled) this.renderer.shadowMap.needsUpdate = true;
    this.onReady();
    return this;
  }

  /* ---------------- core setup ---------------- */

  /* ---------------- 画质与性能 ---------------- */

  /** 首次进入时决定画质：显式档位直接采用，'auto' 则按 GPU / 分辨率猜一个起点。 */
  resolveQuality() {
    const requested = String(this.options.quality || 'auto');
    if (QUALITY_PRESETS[requested]) {
      this.qualityAuto = false;
      this.qualityName = requested;
    } else {
      this.qualityAuto = true;
      this.qualityName = this.guessQuality();
    }
    this.preset = QUALITY_PRESETS[this.qualityName];
    this.perf.level = this.qualityName;
    this.perf.auto = this.qualityAuto;
  }

  guessQuality() {
    const gpu = this.detectGpuName();
    if (/swiftshader|software|basic render/i.test(gpu)) return 'minimal';
    const cssArea = (window.innerWidth || 1280) * (window.innerHeight || 800);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixels = cssArea * dpr * dpr; // 实际要着色的像素量
    let idx = 1; // high
    const weak = /(intel|hd graphics|uhd graphics|iris|mali|adreno|powervr)/i.test(gpu);
    if (weak) idx = 2; // balanced
    if (pixels > 3.2e6) idx += 1;
    if (pixels > 6.5e6) idx += 1;
    if (!weak && pixels < 1.6e6) idx -= 1;
    return QUALITY_ORDER[Math.max(0, Math.min(QUALITY_ORDER.length - 1, idx))];
  }

  detectGpuName() {
    if (this.gpuName) return this.gpuName;
    try {
      const ctx = this.renderer?.getContext?.();
      if (ctx) {
        const ext = ctx.getExtension('WEBGL_debug_renderer_info');
        this.gpuName = ext
          ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL))
          : String(ctx.getParameter(ctx.RENDERER));
      }
    } catch (error) {
      this.gpuName = '';
    }
    return this.gpuName || '';
  }

  /** 按档位的像素预算算渲染倍率：窗口越大倍率越低，避免 4K 窗口直接压垮核显。 */
  resolveDpr(preset) {
    const width = this.container?.clientWidth || window.innerWidth || 1280;
    const height = this.container?.clientHeight || window.innerHeight || 800;
    const budgetDpr = Math.sqrt((preset.budget || 2.6e6) / Math.max(1, width * height));
    return Math.max(0.6, Math.min(window.devicePixelRatio || 1, preset.dpr, budgetDpr));
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.options.exposure;
    this.renderer.info.autoReset = false;

    // 拿到真实显卡名之后再定自动档，避免在被核显拖慢的机器上从高档起步
    this.detectGpuName();
    if (this.qualityAuto) {
      const guessed = this.guessQuality();
      if (guessed !== this.qualityName) {
        this.qualityName = guessed;
        this.preset = QUALITY_PRESETS[guessed];
        this.perf.level = guessed;
      }
      // 起步低于高档时允许自动往上探一次
      this._autoDowngraded = QUALITY_ORDER.indexOf(this.qualityName) > 1;
    }

    const preset = this.preset;
    this.maxDpr = preset.dpr;
    this.pixelRatio = this.resolveDpr(preset);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.shadowMap.enabled = preset.shadow > 0;
    this.renderer.shadowMap.type = preset.shadow >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = preset.shadowEveryFrame;
    if ('transmissionResolutionScale' in this.renderer) {
      this.renderer.transmissionResolutionScale = preset.transmissionScale || 0.5;
    }
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(new THREE.Color('#0a1713'), 0.017);
    this.camera = new THREE.PerspectiveCamera(33, 1, 0.1, 120);
    this.camera.position.set(27, 21.5, 33);
    this.camera.lookAt(0, 1.1, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.1, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.7;
    this.controls.panSpeed = 0.5;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 48;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI * 0.45;
    this.controls.enablePan = false;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.update();

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.4;

    this.world = new THREE.Group();
    this.world.name = 'MistyPasture';
    this.scene.add(this.world);
  }

  setupLights() {
    this.hemi = new THREE.HemisphereLight(new THREE.Color('#b3d4d4'), new THREE.Color('#303528'), 0.52);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(new THREE.Color('#ffdcae'), 1.8);
    this.sun.position.set(-13, 17, 9);
    this.sun.castShadow = this.preset.shadow > 0;
    const shadowSize = this.preset.shadow || 1024;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.sun.shadow.camera.left = -17;
    this.sun.shadow.camera.right = 17;
    this.sun.shadow.camera.top = 16;
    this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 48;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(new THREE.Color('#8db8e8'), 0.18);
    this.moon.position.set(12, 9, -10);
    this.scene.add(this.moon);

    this.fill = new THREE.DirectionalLight(new THREE.Color('#a4d1ca'), 0.27);
    this.fill.position.set(12, 7, 10);
    this.scene.add(this.fill);

    this.rim = new THREE.DirectionalLight(new THREE.Color('#f4c496'), 0.36);
    this.rim.position.set(-5, 5, -12);
    this.scene.add(this.rim);
  }

  setupPostProcessing() {
    const preset = this.preset;
    this.composer = new EffectComposer(this.renderer);
    this.composer.renderTarget1.samples = preset.msaa;
    this.composer.renderTarget2.samples = preset.msaa;
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), this.options.bloom, 0.72, 0.82);
    this.composer.addPass(this.bloomPass);

    this.tiltPassH = new ShaderPass(BokehGradeShader);
    this.tiltPassH.uniforms.direction.value.set(1, 0);
    this.tiltPassH.uniforms.strength.value = 1;
    this.composer.addPass(this.tiltPassH);

    this.tiltPassV = new ShaderPass(BokehGradeShader);
    this.tiltPassV.uniforms.direction.value.set(0, 1);
    this.tiltPassV.uniforms.strength.value = 1;
    this.tiltPassV.uniforms.vignette.value = 0.32;
    this.composer.addPass(this.tiltPassV);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.refreshFeatures();
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.width = width;
    this.height = height;
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(width, height);
      this.tiltPassH.uniforms.resolution.value.set(width * this.pixelRatio, height * this.pixelRatio);
      this.tiltPassV.uniforms.resolution.value.set(width * this.pixelRatio, height * this.pixelRatio);
      this.bloomPass.setSize(width * this.pixelRatio, height * this.pixelRatio);
    }
    if (this.renderer.shadowMap.enabled) this.renderer.shadowMap.needsUpdate = true;
  }

  /* ---------------- 画质运行时 ---------------- */

  /** 切换档位：'auto' 或 QUALITY_PRESETS 里的档位名。 */
  setQuality(name) {
    if (!this.renderer) return;
    const auto = !QUALITY_PRESETS[name];
    const level = auto ? this.guessQualityForCurrent() : name;
    const preset = QUALITY_PRESETS[level];
    this.qualityAuto = name === 'auto' || auto;
    this.options.quality = name;
    this.qualityName = level;
    this.preset = preset;
    this.perf.level = level;
    this.perf.auto = this.qualityAuto;

    // 1) 渲染分辨率
    const dpr = this.resolveDpr(preset);
    this.maxDpr = preset.dpr;
    if (Math.abs(dpr - this.pixelRatio) > 0.001) {
      this.pixelRatio = dpr;
      this.renderer.setPixelRatio(dpr);
      this.resize();
    }

    // 2) 后处理抗锯齿
    this.applySamples(preset.msaa);

    // 3) 阴影
    this.applyShadowQuality(preset.shadow);

    // 4) 玻璃透射（关闭后每帧少渲一整遍场景）
    this.applyTransmission(preset.transmission);
    if ('transmissionResolutionScale' in this.renderer) {
      this.renderer.transmissionResolutionScale = preset.transmissionScale || 0.5;
    }

    // 5) 其余开关
    this.refreshFeatures();
    if (this.renderer.shadowMap.enabled) this.renderer.shadowMap.needsUpdate = true;
    this.onQuality?.(this.getPerf());
  }

  guessQualityForCurrent() {
    // 自动模式下的起点：沿用首次判断，之后再交给帧率自适应
    return this.qualityName || this.guessQuality();
  }

  applySamples(samples) {
    const composer = this.composer;
    if (!composer) return;
    const rt1 = composer.renderTarget1;
    const rt2 = composer.renderTarget2;
    if (rt1.samples === samples && rt2.samples === samples) return;
    rt1.samples = samples;
    rt2.samples = samples;
    rt1.dispose();
    rt2.dispose();
    composer.setSize(this.width, this.height);
  }

  applyShadowQuality(size) {
    if (!this.sun) return;
    const enabled = size > 0;
    if (!enabled) {
      this.sun.castShadow = false;
      if (this.renderer.shadowMap.enabled) {
        this.renderer.shadowMap.enabled = false;
        this.refreshShadowShaders();
      }
      return;
    }
    this.sun.castShadow = true;
    if (!this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = size >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      this.refreshShadowShaders();
    }
    this.renderer.shadowMap.autoUpdate = this.preset.shadowEveryFrame;
    const half = size >= 2048 ? 17 : size >= 1024 ? 15 : 12;
    const cam = this.sun.shadow.camera;
    if (cam.right !== half) {
      cam.left = -half;
      cam.right = half;
      cam.top = half - 1;
      cam.bottom = -half + 1;
      cam.updateProjectionMatrix();
    }
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** 关/开阴影通道会改变着色器变体，必须让材质重新编译。 */
  refreshShadowShaders() {
    this.scene?.traverse((obj) => {
      const material = obj.material;
      if (!material) return;
      if (Array.isArray(material)) material.forEach((m) => { m.needsUpdate = true; });
      else material.needsUpdate = true;
    });
  }

  applyTransmission(value) {
    if (!this._transmissive) {
      this._transmissive = [];
      const candidates = [this.materials?.glass, this.materials?.glassWarm, this.materials?.water, this.water?.material];
      for (const material of candidates) {
        if (material && typeof material.transmission === 'number') {
          this._transmissive.push({ material, base: material.transmission });
        }
      }
    }
    for (const { material, base } of this._transmissive) {
      const next = base > 0 && value > 0 ? value : 0;
      if (Math.abs(material.transmission - next) > 0.001) {
        material.transmission = next;
        if (next === 0) {
          // 关掉透射后靠普通透明度兜底，避免玻璃变成实心板
          if (material.opacity > 0.92) material.opacity = 0.72;
        } else if (material.opacity !== 0.82 && material.opacity !== 0.92) {
          material.opacity = base > 0.5 ? 0.82 : 0.92;
        }
        material.needsUpdate = true;
      }
    }
  }

  /** 把「用户开关」和「画质档位」合并成最终生效状态。 */
  refreshFeatures() {
    const preset = this.preset || QUALITY_PRESETS.high;
    if (this.tiltPassH && this.tiltPassV) {
      const on = preset.tiltShift && !!this.options.tiltShift;
      this.tiltPassH.enabled = on;
      this.tiltPassV.enabled = on;
    }
    if (this.bloomPass) {
      this.bloomPass.enabled = preset.bloom && Number(this.options.bloom) > 0.001;
    }
    if (this.volumetricGroup) {
      this.volumetricGroup.visible = preset.volumetric && !!this.options.volumetric;
    }
  }

  getPerf() {
    return {
      fps: Math.round(this.perf.fps || 0),
      calls: this.perf.calls || 0,
      triangles: this.perf.triangles || 0,
      level: this.qualityName,
      label: QUALITY_PRESETS[this.qualityName]?.label || this.qualityName,
      auto: this.qualityAuto,
      dpr: Number(this.pixelRatio.toFixed(2)),
      gpu: this.gpuName,
      gpuShort: String(this.gpuName || '').replace(/^ANGLE\s*\(/, '').split(',')[0].slice(0, 28),
      software: /basic render|swiftshader|software|llvmpipe/i.test(this.gpuName || ''),
      size: `${Math.round((this.width || 0) * this.pixelRatio)}×${Math.round((this.height || 0) * this.pixelRatio)}`,
    };
  }

  samplePerf(now) {
    this._fpsFrames += 1;
    if (!this._fpsStart) this._fpsStart = now;
    const span = now - this._fpsStart;
    if (span < 700) return;
    const fps = (this._fpsFrames * 1000) / span;
    this._fpsFrames = 0;
    this._fpsStart = now;
    this.perf.fps = fps;
    const info = this.renderer.info.render;
    this.perf.calls = info.calls;
    this.perf.triangles = info.triangles;
    this.adaptQuality(fps, now);
  }

  /** 自动档：掉帧就降档，掉得越狠降得越多；稳定高于 56fps 才尝试升一档，失败即锁定。 */
  adaptQuality(fps, now) {
    if (!this.qualityAuto || this.paused) return;
    if (now < this._warmupUntil) return;
    const index = QUALITY_ORDER.indexOf(this.qualityName);
    if (fps < 52 && index < QUALITY_ORDER.length - 1) {
      this._lowStreak += 1;
      this._highStreak = 0;
      if (this._lowStreak >= 2) {
        this._lowStreak = 0;
        const steps = fps < 16 ? 4 : fps < 30 ? 2 : 1;
        this._autoDowngraded = true;
        this.setQuality(QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, index + steps)]);
      }
      return;
    }
    this._lowStreak = 0;
    if (index === 0 || this._upgradeLocked || !this._autoDowngraded || fps < 56) {
      this._highStreak = 0;
      return;
    }
    this._highStreak += 1;
    if (this._highStreak >= 10) {
      this._highStreak = 0;
      this._upgradeLocked = true; // 只尝试升一次，避免来回抖动
      this.setQuality(QUALITY_ORDER[index - 1]);
    }
  }

  bindEvents() {
    this._onResize = () => this.resize();
    this._onPointerMove = (e) => this.handlePointerMove(e);
    this._onPointerDown = (e) => {
      this.pointerDown = { x: e.clientX, y: e.clientY };
    };
    this._onPointerUp = (e) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(e.clientX - this.pointerDown.x, e.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved > 6) return;
      this.handleClick(e);
    };
    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('pointermove', this._onPointerMove, { passive: true });
    this.canvas.addEventListener('pointerdown', this._onPointerDown, { passive: true });
    this.canvas.addEventListener('pointerup', this._onPointerUp, { passive: true });
    this.canvas.addEventListener('pointerleave', () => {
      this.hovered = null;
      this.canvas.style.cursor = '';
      this.updateLabelHover();
    });
    this.controls.addEventListener('start', () => {
      this.cameraTween = null;
    });
  }

  /* ---------------- world building ---------------- */

  buildWorld() {
    this.buildIsland();
    this.buildPaths();
    this.buildFences();
    this.buildPond();
    this.buildBarnB01();
    this.buildBarnB02();
    this.buildBarnB03();
    this.buildSilo();
    this.buildWindmill();
    this.buildSolarArray();
    this.buildEntrance();
    this.buildTrees();
    this.buildShrubsAndFlowers();
    this.buildGrass();
    this.buildStringLights();
    this.buildSensorPoles();
    this.buildCows();
    this.buildClouds();
    this.buildMistSprites();
    this.buildFireflies();
    this.buildStars();
    this.buildVolumetric();
    this.buildFloatingStones();
    this.buildDucksAndRipples();
    this.buildButterflies();
    this.buildGateFence();
    this.world.traverse((obj) => {
      if (!obj.isMesh) return;
      if (obj.userData.noShadow) return;
      const material = obj.material;
      const isGlass = material && (material.transmission > 0.2 || material.transparent);
      if (!isGlass) {
        obj.receiveShadow = true;
        // 石子、花瓣、草叶这类小摆件不进阴影贴图，可省掉大量绘制调用
        obj.castShadow = this.isShadowCaster(obj);
      } else {
        obj.castShadow = false;
        obj.receiveShadow = false;
      }
    });
  }

  /** 只有够大的物件才值得写进 2K 阴影贴图。 */
  isShadowCaster(mesh) {
    const geo = mesh.geometry;
    if (!geo) return false;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const radius = geo.boundingSphere?.radius ?? 1;
    const scale = Math.max(
      Math.abs(mesh.scale.x) || 1,
      Math.abs(mesh.scale.y) || 1,
      Math.abs(mesh.scale.z) || 1,
    );
    return radius * scale >= 0.24;
  }

  addMesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], castShadow = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = castShadow;
    parent.add(mesh);
    return mesh;
  }

  box(parent, w, h, d, material, position, rotation = [0, 0, 0], radius = 0.04, castShadow = true) {
    const safeRadius = Math.min(radius, Math.min(w, h, d) * 0.24);
    const geo = new RoundedBoxGeometry(w, h, d, 3, safeRadius);
    return this.addMesh(parent, geo, material, position, rotation, [1, 1, 1], castShadow);
  }

  cylinder(parent, rTop, rBottom, h, seg, material, position, rotation = [0, 0, 0], castShadow = true) {
    return this.addMesh(parent, new THREE.CylinderGeometry(rTop, rBottom, h, seg), material, position, rotation, [1, 1, 1], castShadow);
  }

  get materials() {
    if (this._materials) return this._materials;
    const glass = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#b7ded7'),
      roughness: 0.09,
      metalness: 0.0,
      transmission: 0.62,
      thickness: 0.35,
      transparent: true,
      opacity: 0.82,
      ior: 1.38,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      iridescence: 0.18,
      iridescenceIOR: 1.3,
      side: THREE.DoubleSide,
      envMapIntensity: 1.2,
      depthWrite: false,
    });
    const glassWarm = glass.clone();
    glassWarm.color = new THREE.Color('#d8e9df');
    const water = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#3d7d78'),
      roughness: 0.08,
      metalness: 0.08,
      transmission: 0.28,
      thickness: 0.65,
      transparent: true,
      opacity: 0.92,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.55,
    });
    const woodDark = stdMat(C.woodDark, { roughness: 0.73 });
    const wood = stdMat(C.wood, { roughness: 0.78 });
    const woodLight = stdMat(C.woodLight, { roughness: 0.84 });
    const plaster = stdMat(C.plaster, { roughness: 0.92 });
    const cream = stdMat(C.cream, { roughness: 0.88 });
    const roof = stdMat(C.roof, { roughness: 0.56, metalness: 0.16 });
    const metal = stdMat(C.metal, { roughness: 0.42, metalness: 0.55, envMapIntensity: 1.1 });
    const hay = stdMat(C.hay, { roughness: 0.98 });
    const pink = stdMat(C.pink, { roughness: 0.87 });
    const glow = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffdbac'),
      emissive: new THREE.Color('#ffb86c'),
      emissiveIntensity: 1.4,
      roughness: 0.35,
      toneMapped: true,
    });
    this._materials = { glass, glassWarm, water, woodDark, wood, woodLight, plaster, cream, roof, metal, hay, pink, glow };
    return this._materials;
  }

  buildIsland() {
    const M = this.materials;
    const island = new THREE.Group();
    island.name = 'floating-island';
    this.world.add(island);
    this.island = island;

    // 草地与土壤夹层
    this.box(island, 22, 0.58, 15, stdMat(C.grass, { roughness: 0.96, envMapIntensity: 0.45 }), [0, -0.29, 0], [0, 0, 0], 0.34);
    this.box(island, 22.25, 0.2, 15.22, stdMat(C.grassLight, { roughness: 0.98 }), [0, 0.02, 0], [0, 0, 0], 0.38);
    this.box(island, 21.55, 0.7, 14.55, stdMat(C.soil, { roughness: 1 }), [0, -0.82, 0], [0, 0, 0], 0.3);
    this.box(island, 20.3, 0.58, 13.35, stdMat(C.soilDark, { roughness: 1 }), [0, -1.35, 0], [0, 0, 0], 0.28);

    // 悬浮岛的岩石底部
    const rockGeo = this.createRockCoreGeometry();
    const rockMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(C.rock),
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true,
    });
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.y = -1.28;
    rock.castShadow = true;
    rock.receiveShadow = true;
    island.add(rock);

    // 岛底的碎石与根须
    const rng = makeRng(74);
    for (let i = 0; i < 12; i++) {
      const geo = new THREE.DodecahedronGeometry(0.22 + rng() * 0.42, 0);
      const rockPiece = new THREE.Mesh(geo, stdMat(i % 3 === 0 ? '#4b4d42' : '#373d37', { roughness: 0.98, flatShading: true }));
      rockPiece.position.set((rng() - 0.5) * 12, -2.7 - rng() * 2.7, (rng() - 0.5) * 7);
      rockPiece.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      rockPiece.castShadow = true;
      island.add(rockPiece);
    }
    const rootMat = stdMat('#4a3b2d', { roughness: 1 });
    for (let i = 0; i < 8; i++) {
      const points = [];
      const startX = (rng() - 0.5) * 15;
      const startZ = (rng() - 0.5) * 8;
      for (let p = 0; p < 4; p++) {
        points.push(new THREE.Vector3(startX + Math.sin(p + i) * 0.25, -1.65 - p * 0.55, startZ + Math.cos(p * 1.2 + i) * 0.18));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      this.addMesh(island, new THREE.TubeGeometry(curve, 12, 0.018 + rng() * 0.02, 4, false), rootMat, [0, 0, 0], [0, 0, 0], [1, 1, 1], false);
    }

    // 岛缘的小石块和苔藓
    const edgeStone = stdMat(C.stone, { roughness: 0.98, flatShading: true });
    const moss = stdMat('#5c7954', { roughness: 1 });
    for (let i = 0; i < 22; i++) {
      const angle = rng() * TAU;
      const x = Math.cos(angle) * (9.6 + rng() * 1.2);
      const z = Math.sin(angle) * (6.2 + rng() * 1.1);
      const s = 0.15 + rng() * 0.26;
      const rock2 = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), edgeStone);
      rock2.position.set(x, 0.02, z);
      rock2.rotation.set(rng() * 2, rng() * 3, rng() * 2);
      rock2.scale.y = 0.55 + rng() * 0.4;
      rock2.castShadow = true;
      island.add(rock2);
      if (rng() > 0.4) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(s * 0.8, 8, 5, 0, TAU, 0, HALF_PI), moss);
        cap.position.set(x, rock2.position.y + s * 0.45, z);
        cap.scale.y = 0.24;
        island.add(cap);
      }
    }

    // 岛底发光晶洞
    const crystalMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#9cded0'),
      emissive: new THREE.Color('#5fbfae'),
      emissiveIntensity: 0.8,
      roughness: 0.22,
      metalness: 0.1,
    });
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.ConeGeometry(0.12, 0.7 + rng() * 0.7, 5);
      const crystal = new THREE.Mesh(geo, crystalMat);
      crystal.position.set((rng() - 0.5) * 5, -3.7 - rng() * 1.8, (rng() - 0.5) * 3);
      crystal.rotation.set(rng() * 0.8 - 0.4, rng() * 3, rng() * 0.8 - 0.4);
      island.add(crystal);
    }
  }

  createRockCoreGeometry() {
    const rng = makeRng(912);
    const segments = 22;
    const levels = [
      { y: 0.15, rx: 10.6, rz: 7.2, jitter: 0.18 },
      { y: -0.6, rx: 10.2, rz: 6.9, jitter: 0.24 },
      { y: -1.8, rx: 8.8, rz: 5.8, jitter: 0.38 },
      { y: -3.0, rx: 6.1, rz: 4.0, jitter: 0.5 },
      { y: -4.1, rx: 3.4, rz: 2.3, jitter: 0.48 },
      { y: -5.0, rx: 1.3, rz: 0.9, jitter: 0.45 },
    ];
    const positions = [];
    const colors = [];
    const indices = [];
    const colorTop = new THREE.Color('#60513e');
    const colorMid = new THREE.Color('#3d4038');
    const colorBottom = new THREE.Color('#232b29');
    const rings = [];
    for (let l = 0; l < levels.length; l++) {
      const lev = levels[l];
      const ring = [];
      for (let s = 0; s < segments; s++) {
        const angle = (s / segments) * TAU;
        const wobble = 1 + (rng() - 0.5) * lev.jitter;
        const x = Math.cos(angle) * lev.rx * wobble;
        const z = Math.sin(angle) * lev.rz * wobble;
        const y = lev.y + (rng() - 0.5) * 0.28;
        const idx = positions.length / 3;
        positions.push(x, y, z);
        const mix = l / (levels.length - 1);
        const col = mix < 0.5 ? colorTop.clone().lerp(colorMid, mix * 2) : colorMid.clone().lerp(colorBottom, (mix - 0.5) * 2);
        col.offsetHSL(0, 0, (rng() - 0.5) * 0.035);
        colors.push(col.r, col.g, col.b);
        ring.push(idx);
      }
      rings.push(ring);
    }
    for (let l = 0; l < rings.length - 1; l++) {
      for (let s = 0; s < segments; s++) {
        const a = rings[l][s];
        const b = rings[l][(s + 1) % segments];
        const c = rings[l + 1][s];
        const d = rings[l + 1][(s + 1) % segments];
        indices.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  buildPaths() {
    const M = this.materials;
    const rng = makeRng(33);
    const pathMat = stdMat('#c6b593', { roughness: 0.95 });
    const dirtMat = stdMat('#8d8167', { roughness: 1 });
    this.addPath([
      [0.4, 7.2], [0.2, 5.8], [0.45, 4.0], [-0.1, 2.3], [-1.5, 1.15], [-3.4, 0.2],
    ], 0.72, pathMat);
    this.addPath([
      [-0.1, 2.3], [1.1, 1.5], [2.7, 0.55]
    ], 0.56, pathMat);
    this.addPath([
      [1.4, 4.5], [2.7, 4.5], [4.15, 4.1]
    ], 0.46, pathMat);
    this.addPath([
      [-0.3, 4.0], [-1.8, 4.2], [-3.55, 4.35]
    ], 0.4, pathMat);

    // 入口鹅卵石
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      const x = lerp(-1.6, 2.5, t) + Math.sin(t * 14) * 0.16;
      const z = 6.6 + Math.cos(t * 8) * 0.35;
      const geo = new THREE.CylinderGeometry(0.06 + rng() * 0.12, 0.08 + rng() * 0.14, 0.04, 7);
      const stone = new THREE.Mesh(geo, stdMat('#a9a68f', { roughness: 0.98 }));
      stone.position.set(x, 0.04, z);
      stone.rotation.y = rng() * 3;
      stone.scale.z = 0.7 + rng() * 0.8;
      stone.castShadow = true;
      this.world.add(stone);
    }
    // 路边小地灯
    const lampGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const px = -1.7 - i * 0.28 + Math.sin(i) * 0.4;
      const pz = 5.6 - i * 0.55;
      this.makePathLantern(lampGroup, px, pz, i);
    }
    this.world.add(lampGroup);
  }

  addPath(points2d, width, material) {
    const rng = makeRng(points2d.length * 17 + Math.round(width * 100));
    const points = points2d.map(([x, z]) => new THREE.Vector2(x, z));
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0.055, p.y)));
    const divisions = 80;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector2(-tangent.z, tangent.x).normalize();
      const taper = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 0.13 + 0.87;
      const w = width * 0.5 * taper;
      const wobble = Math.sin(t * 27) * 0.035;
      positions.push(p.x + normal.x * (w + wobble), 0.055, p.z + normal.y * (w + wobble));
      positions.push(p.x - normal.x * (w + wobble * 0.6), 0.055, p.z - normal.y * (w + wobble * 0.6));
      uvs.push(0, t * 6, 1, t * 6);
      if (i < divisions) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    this.world.add(mesh);
    // 路径边缘的细碎石子
    for (let i = 0; i < 28; i++) {
      const t = rng();
      const p = curve.getPointAt(t);
      const side = rng() > 0.5 ? 1 : -1;
      const tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const s = 0.035 + rng() * 0.055;
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(s, 0),
        stdMat(rng() > 0.5 ? '#918e7c' : '#d0c4a9', { roughness: 1, flatShading: true }),
      );
      stone.position.copy(p).addScaledVector(normal, side * (width * 0.5 + 0.07 + rng() * 0.18));
      stone.position.y = 0.035;
      stone.rotation.set(rng() * 2, rng() * 3, rng() * 2);
      stone.castShadow = true;
      this.world.add(stone);
    }
  }

  makePathLantern(parent, x, z, index) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const pole = this.cylinder(group, 0.022, 0.03, 0.7, 6, stdMat('#687a6d', { metalness: 0.4, roughness: 0.5 }), [0, 0.35, 0]);
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.17, 6, 1, true), stdMat('#5f675c', { metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }));
    cage.position.set(0, 0.73, 0);
    group.add(cage);
    const lightMat = new THREE.MeshStandardMaterial({ color: '#ffe3b4', emissive: '#ffbe78', emissiveIntensity: 1.6, roughness: 0.2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), lightMat);
    bulb.position.set(0, 0.73, 0);
    group.add(bulb);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 6), stdMat('#4d5a50', { metalness: 0.4, roughness: 0.4 }));
    cap.position.set(0, 0.87, 0);
    group.add(cap);
    parent.add(group);
    this.stringBulbs.push({ mesh: bulb, material: lightMat, base: 1.3 + (index % 3) * 0.12, phase: index * 1.1 });
  }

  buildFences() {
    const fenceMat = stdMat('#ddd3bd', { roughness: 0.84 });
    const postGeo = new THREE.BoxGeometry(0.09, 0.72, 0.09);
    const railGeo = new THREE.BoxGeometry(1, 0.055, 0.055);
    const fences = [
      [[-9.1, 1.05], [-7.4, 0.5], [-5.9, 0.2], [-4.9, 0.1]],
      [[-9.4, 2.4], [-9.5, 4.7]],
    ];
    for (const pts of fences) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[i + 1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        const count = Math.max(2, Math.round(len / 0.72));
        for (let j = 0; j < count; j++) {
          const t = j / count;
          const px = lerp(x1, x2, t);
          const pz = lerp(z1, z2, t);
          const post = new THREE.Mesh(postGeo, fenceMat);
          post.position.set(px, 0.36, pz);
          post.castShadow = true;
          post.receiveShadow = true;
          this.world.add(post);
          if (j < count - 1) {
            const t2 = (j + 1) / count;
            const nx = lerp(x1, x2, t2);
            const nz = lerp(z1, z2, t2);
            const segLen = Math.hypot(nx - px, nz - pz);
            for (const y of [0.28, 0.51]) {
              const rail = new THREE.Mesh(railGeo, fenceMat);
              rail.scale.x = segLen + 0.02;
              rail.position.set((px + nx) / 2, y, (pz + nz) / 2);
              rail.rotation.y = -Math.atan2(nz - pz, nx - px);
              rail.castShadow = true;
              this.world.add(rail);
            }
          }
        }
      }
    }
  }

  buildGateFence() {
    const group = new THREE.Group();
    group.position.set(0.4, 0, 6.1);
    const mat = this.materials;
    const postL = this.box(group, 0.16, 2.2, 0.16, mat.woodDark, [-1.55, 1.1, 0], [0, 0, 0], 0.03);
    const postR = this.box(group, 0.16, 2.2, 0.16, mat.woodDark, [1.55, 1.1, 0], [0, 0, 0], 0.03);
    const top = this.box(group, 3.55, 0.16, 0.2, mat.wood, [0, 2.1, 0], [0, 0, 0.05], 0.04);
    const signTex = signTexture({ title: '云栖牧场', sub: 'MISTY PASTURE · EST. 2026', accent: '#e7d9c0', border: '#758776' });
    const signMat = new THREE.MeshStandardMaterial({
      map: signTex,
      transparent: true,
      roughness: 0.75,
      emissive: new THREE.Color('#e8d6b0'),
      emissiveMap: signTex,
      emissiveIntensity: 0.08,
      side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 0.77), signMat);
    sign.position.set(0, 1.7, 0.12);
    group.add(sign);
    const hangingL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4), stdMat('#5a5043', { metalness: 0.5, roughness: 0.5 }));
    hangingL.position.set(-0.95, 1.99, 0.1);
    const hangingR = hangingL.clone();
    hangingR.position.x = 0.95;
    group.add(hangingL, hangingR);
    // 低矮花箱
    for (const x of [-1.3, 1.3]) {
      this.box(group, 0.44, 0.22, 0.24, mat.wood, [x, 0.15, 0.1], [0, 0, 0], 0.03);
      const flowers = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.035 + Math.random() * 0.02, 6, 5), stdMat(i % 2 ? '#f3d6c1' : '#c7a7d6'));
        m.position.set((Math.random() - 0.5) * 0.36, 0.28 + Math.random() * 0.12, 0.1 + (Math.random() - 0.5) * 0.12);
        flowers.add(m);
      }
      group.add(flowers);
    }
    this.world.add(group);
    this.gate = group;
  }

  buildPond() {
    const M = this.materials;
    const rng = makeRng(424);
    const pond = new THREE.Group();
    pond.position.set(-5.9, 0, 4.35);
    this.world.add(pond);
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.55, 0.2, 48), stdMat('#8d8b72', { roughness: 0.96 }));
    outer.scale.z = 0.68;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    pond.add(outer);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.18, 2.2, 0.12, 48), M.water);
    water.scale.z = 0.66;
    water.position.y = 0.11;
    water.receiveShadow = true;
    pond.add(water);
    this.water = water;

    // 池边卵石
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU + rng() * 0.12;
      const r = 2.35 + rng() * 0.18;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + rng() * 0.14, 0), stdMat(rng() > 0.5 ? '#868b7d' : '#b2b09a', { roughness: 0.96, flatShading: true }));
      stone.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r * 0.68);
      stone.scale.y = 0.55;
      stone.rotation.set(rng() * 2, rng() * 3, rng() * 2);
      stone.castShadow = true;
      pond.add(stone);
    }

    // 睡莲与荷花
    const padMat = stdMat('#5e8d67', { roughness: 0.72, side: THREE.DoubleSide });
    const lotusMat = stdMat('#efc3b9', { roughness: 0.65 });
    for (let i = 0; i < 7; i++) {
      const a = rng() * TAU;
      const r = 0.3 + rng() * 1.45;
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.2 + rng() * 0.12, 12, 0.25, TAU - 0.5), padMat);
      pad.rotation.x = -HALF_PI;
      pad.rotation.z = rng() * TAU;
      pad.position.set(Math.cos(a) * r, 0.18, Math.sin(a) * r * 0.62);
      pond.add(pad);
      if (i < 3) {
        const lotus = new THREE.Group();
        for (let p = 0; p < 5; p++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), lotusMat);
          petal.rotation.z = (p / 5) * TAU;
          petal.rotation.x = 0.5;
          lotus.add(petal);
        }
        lotus.position.copy(pad.position).add(new THREE.Vector3(0.03, 0.04, 0));
        lotus.scale.setScalar(0.8);
        pond.add(lotus);
      }
    }

    // 芦苇
    for (let i = 0; i < 14; i++) {
      const a = rng() * TAU;
      const r = 2.1 + rng() * 0.32;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.66;
      const h = 0.45 + rng() * 0.7;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, h, 4), stdMat('#667c53', { roughness: 1 }));
      stem.position.set(x, 0.16 + h / 2, z);
      stem.rotation.z = (rng() - 0.5) * 0.2;
      pond.add(stem);
      if (rng() > 0.35) {
        const cattail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 3, 6), stdMat('#6c563b', { roughness: 1 }));
        cattail.position.set(x, 0.16 + h, z);
        pond.add(cattail);
      }
    }

    this.pond = pond;
    this.buildRipples();
  }

  buildRipples() {
    const rippleMat = new THREE.MeshBasicMaterial({ color: '#b9e4d9', transparent: true, opacity: 0.23, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.19, 48), rippleMat.clone());
      ring.rotation.x = -HALF_PI;
      ring.position.set(-5.9 + (Math.random() - 0.5) * 1.8, 0.178, 4.35 + (Math.random() - 0.5) * 0.8);
      this.world.add(ring);
      this.ripples.push({ mesh: ring, phase: Math.random() * TAU, base: 0.3 + Math.random() * 0.6 });
    }
  }

  buildDucksAndRipples() {
    const duckWhite = stdMat('#efe4cf', { roughness: 0.8 });
    const beak = stdMat('#e2aa55', { roughness: 0.6 });
    const colors = ['#f4e9d8', '#e7d3b3'];
    for (let i = 0; i < 2; i++) {
      const duck = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 9), stdMat(colors[i], { roughness: 0.8 }));
      body.scale.set(1.4, 0.7, 0.9);
      body.position.y = 0.1;
      duck.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), stdMat(colors[i], { roughness: 0.8 }));
      head.position.set(0.17, 0.23, 0);
      duck.add(head);
      const bill = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 5), beak);
      bill.rotation.z = -HALF_PI;
      bill.position.set(0.28, 0.22, 0);
      duck.add(bill);
      duck.position.set(-6.1 + i * 0.72, 0.18, 4.15 + i * 0.26);
      duck.rotation.y = i ? 2.3 : 0.2;
      duck.scale.setScalar(i ? 0.7 : 1);
      duck.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.world.add(duck);
      this.ducks.push({ mesh: duck, baseY: duck.position.y, phase: i * 1.4 + Math.random() * 2 });
    }
  }

  buildBarnB01() {
    const M = this.materials;
    const group = new THREE.Group();
    group.position.set(-4.25, 0, -2.3);
    group.rotation.y = 0.055;
    this.world.add(group);
    this.barnB01 = group;
    this.registerEntity(group, { type: 'barn', id: 'B01', name: '晨露泌乳舍' });
    this.barnAnchors.set('B01', new THREE.Vector3(-4.25 + 0.1, 4.95, -2.3 + 0.2));

    // 石质地基与木地板
    this.box(group, 7.0, 0.13, 5.25, stdMat('#8f8875', { roughness: 0.96 }), [0, 0.02, 0], [0, 0, 0], 0.12);
    this.box(group, 6.55, 0.05, 4.82, M.woodLight, [0, 0.1, 0], [0, 0, 0], 0.02);

    // 低墙
    this.box(group, 6.3, 1.0, 0.15, M.woodLight, [0, 0.62, -2.16], [0, 0, 0], 0.04);
    this.box(group, 0.15, 0.92, 4.3, M.plaster, [-3.08, 0.58, 0], [0, 0, 0], 0.04);
    this.box(group, 0.15, 0.92, 4.3, M.plaster, [3.08, 0.58, 0], [0, 0, 0], 0.04);

    // 撑起玻璃幕墙的木梁
    const postPositions = [[-3.08, -2.16], [3.08, -2.16], [-3.08, 2.05], [3.08, 2.05], [-1.55, -2.16], [1.55, -2.16]];
    for (const [x, z] of postPositions) {
      this.box(group, 0.17, 2.8, 0.17, M.woodDark, [x, 1.52, z], [0, 0, 0], 0.025);
    }
    // 侧墙上的玻璃
    this.box(group, 0.05, 1.5, 4.05, M.glass, [-3.06, 1.78, 0], [0, 0, 0], 0.01, false);
    this.box(group, 0.05, 1.5, 4.05, M.glass, [3.06, 1.78, 0], [0, 0, 0], 0.01, false);
    // 后墙玻璃与横梁
    this.box(group, 6.25, 1.6, 0.05, M.glass, [0, 1.78, -2.15], [0, 0, 0], 0.01, false);
    this.box(group, 6.3, 0.11, 0.13, M.wood, [0, 1.64, -2.14], [0, 0, 0], 0.02);
    this.box(group, 6.3, 0.1, 0.13, M.wood, [0, 2.43, -2.14], [0, 0, 0], 0.02);

    // 门窗框与横梁
    this.box(group, 0.2, 2.9, 0.2, M.woodDark, [-2.25, 1.55, 2.27], [0, 0, 0], 0.025);
    this.box(group, 0.2, 2.9, 0.2, M.woodDark, [2.25, 1.55, 2.27], [0, 0, 0], 0.025);
    this.box(group, 4.7, 0.18, 0.22, M.woodDark, [0, 2.58, 2.27], [0, 0, 0], 0.03);
    this.box(group, 6.0, 0.14, 0.2, M.wood, [0, 2.78, -2.0], [0, 0, 0], 0.02);
    // 弧形门楣
    const archPts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      archPts.push(new THREE.Vector3(lerp(-2.3, 2.3, t), 2.58 + Math.sin(t * Math.PI) * 0.33, 2.31));
    }
    const archCurve = new THREE.CatmullRomCurve3(archPts);
    this.addMesh(group, new THREE.TubeGeometry(archCurve, 28, 0.055, 6, false), M.woodDark, [0, 0, 0], [0, 0, 0]);
    // 窗棂
    for (const x of [-2.8, -2.2, -1.5, -0.8, 0, 0.8, 1.5, 2.2, 2.8]) {
      this.box(group, 0.055, 1.2, 0.07, M.wood, [x, 2.02, 2.3], [0, 0, 0], 0.015);
    }
    // 门牌
    const signTex = signTexture({ title: 'B01 · 晨露舍', sub: 'MILKING HOUSE · 52 HEADS', accent: '#eadbc5', border: '#899c8a' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color('#e2cda7'), emissiveMap: signTex, emissiveIntensity: 0.12 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.72), signMat);
    sign.position.set(0, 3.08, 2.34);
    group.add(sign);
    // 山墙
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-3.12, 0);
    gableShape.lineTo(3.12, 0);
    gableShape.lineTo(0, 1.25);
    gableShape.lineTo(-3.12, 0);
    const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 0.13, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    const gable = new THREE.Mesh(gableGeo, M.plaster);
    gable.position.set(0, 2.63, 2.19);
    gable.castShadow = true;
    gable.receiveShadow = true;
    group.add(gable);
    // 圆窗
    const roundFrame = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.055, 8, 28), M.woodDark);
    roundFrame.position.set(0, 3.33, 2.36);
    group.add(roundFrame);
    const roundGlass = new THREE.Mesh(new THREE.CircleGeometry(0.31, 28), M.glow);
    roundGlass.position.set(0, 3.33, 2.33);
    group.add(roundGlass);
    this.windowMaterials.push(roundGlass.material);

    // 屋顶
    const roofL = this.box(group, 3.95, 0.15, 5.5, M.roof, [-1.78, 3.38, 0.06], [0, 0, 0.352], 0.06);
    const roofR = this.box(group, 3.95, 0.15, 5.5, M.roof, [1.78, 3.38, 0.06], [0, 0, -0.352], 0.06);
    this.box(group, 0.15, 0.16, 5.6, M.woodDark, [0, 4.04, 0.06], [0, 0, 0], 0.03);
    // 屋顶木梁
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const z = -2.2 + i * 1.1;
        this.box(group, 3.8, 0.07, 0.08, M.wood, [side * 1.6, 3.25, z], [0, 0, side * 0.352], 0.015);
      }
      this.box(group, 0.1, 0.11, 5.45, M.wood, [side * 3.52, 2.84, 0.06], [0, 0, 0], 0.02);
    }
    // 屋顶天窗
    this.box(group, 0.43, 0.06, 3.8, M.glassWarm, [-0.82, 3.72, 0.06], [0, 0, 0.352], 0.02, false);
    this.box(group, 0.43, 0.06, 3.8, M.glassWarm, [0.82, 3.72, 0.06], [0, 0, -0.352], 0.02, false);
    // 顶部小灯楼
    const lantern = new THREE.Group();
    lantern.position.set(0, 4.15, 0.2);
    for (const [x, z] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) {
      this.box(lantern, 0.05, 0.45, 0.05, M.wood, [x, 0.18, z], [0, 0, 0], 0.01);
    }
    const lanternGlass = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.24, 0.48), M.glassWarm);
    lanternGlass.position.y = 0.2;
    lantern.add(lanternGlass);
    const lanternGlow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), M.glow);
    lanternGlow.position.y = 0.04;
    lantern.add(lanternGlow);
    const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.28, 4), M.roof);
    lanternRoof.position.y = 0.46;
    lanternRoof.rotation.y = Math.PI / 4;
    lantern.add(lanternRoof);
    group.add(lantern);

    // 悬挂灯
    this.makePendant(group, [-1.55, 2.98, 0.55], 0.55, M);
    this.makePendant(group, [1.65, 2.98, 0.55], 0.55, M);
    this.makePendant(group, [0, 3.18, -0.42], 0.42, M);

    // 室内暖光
    const interior = new THREE.PointLight('#ffbf7c', 3.2, 7, 2);
    interior.position.set(0, 2.2, 0.25);
    interior.userData.base = 3.2;
    group.add(interior);
    this.interiorLights.push(interior);

    // 饲槽
    this.box(group, 4.5, 0.32, 0.42, M.wood, [0, 0.3, -1.55], [0, 0, 0], 0.05);
    this.addMesh(group, new THREE.BoxGeometry(4.1, 0.05, 0.22), M.hay, [0, 0.49, -1.55]);
    for (let i = -2; i <= 2; i++) {
      this.box(group, 0.07, 0.33, 0.5, M.woodDark, [i * 0.82, 0.28, -1.55], [0, 0, 0], 0.02);
    }
    // 干草卷
    this.makeHayBale(group, 2.2, 0.05, -1.9, 0.42, 0.3, 0.52, 0.5);
    this.makeHayBale(group, -2.3, 0.05, -1.85, 0.4, 0.3, 0.5, 1.1);
    this.makeHayBale(group, 2.45, 0.05, 1.5, 0.35, 0.3, 0.45, 0.2);

    // 门口奶罐
    this.makeMilkCan(group, 2.55, 0.02, 2.25, 0.7);
    this.makeMilkCan(group, 2.92, 0.02, 2.05, 0.55);

    // 花箱
    for (const x of [-2.8, 2.8]) {
      this.box(group, 0.56, 0.24, 0.3, M.wood, [x, 0.22, 2.2], [0, 0, 0], 0.03);
      const bloom = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 6, 5), stdMat(i % 3 === 0 ? '#f5b5a8' : i % 3 === 1 ? '#f0d69c' : '#c4b3df', { roughness: 0.85 }));
        flower.position.set(x + (Math.random() - 0.5) * 0.44, 0.38 + Math.random() * 0.18, 2.2 + (Math.random() - 0.5) * 0.2);
        bloom.add(flower);
      }
      group.add(bloom);
    }

    // 山墙和屋檐的小灯带
    this.wireStringLights(group, [
      [-3.0, 2.9, 2.3], [-2.2, 2.78, 2.35], [-1.4, 2.7, 2.35], [-0.5, 2.66, 2.35], [0.5, 2.7, 2.35], [1.4, 2.7, 2.35], [2.2, 2.8, 2.35], [3.0, 2.9, 2.3],
    ], 0.055);
    this.wireStringLights(group, [
      [-3.55, 2.9, 2.3], [-3.4, 3.4, 2.3], [-2.8, 3.8, 2.3], [-1.8, 4.0, 2.3],
    ], 0.045);

    // 设备：风机 / 排风 / 微雾 / 保温
    const fan = this.makeFan(M, 0.54);
    fan.position.set(-1.7, 2.0, -2.02);
    group.add(fan);
    this.registerFan('D-B01-FAN', fan, 8.5);
    const exhaust = this.makeFan(M, 0.42);
    exhaust.position.set(2.95, 2.2, -1.5);
    exhaust.rotation.y = -HALF_PI;
    group.add(exhaust);
    this.registerFan('D-B01-EXH', exhaust, 6.5);
    this.makeMistNozzle(group, M, [[-2.3, 2.62, 2.25], [0, 2.7, 2.3], [2.3, 2.62, 2.25]]);
    this.mistSystems.push(this.makeMistCloud([-4.25, 0, -2.3], [-2.3, 2.35, 2.3], 'D-B01-MIST', 30));
    this.makeHeater(group, M, [2.45, 0.45, -1.15], 'D-B01-HEAT', false);
    this.receiveTag(group, 'B01');
  }

  receiveTag(group, barnId) {
    const tag = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshStandardMaterial({ color: '#f4d28e', emissive: '#b9832f', emissiveIntensity: 0.4, roughness: 0.3 }));
    tag.position.set(0.15, 0.17, -0.2);
    group.add(tag);
  }

  makePendant(parent, position, size, M) {
    const g = new THREE.Group();
    g.position.set(...position);
    this.addMesh(g, new THREE.CylinderGeometry(0.008, 0.008, 0.82, 4), stdMat('#56544b', { metalness: 0.5, roughness: 0.4 }), [0, 0.41, 0]);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(size * 0.34, size * 0.55, 14, 1, true), stdMat('#445c50', { metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide }));
    shade.position.y = 0.02;
    g.add(shade);
    const glowMat = new THREE.MeshStandardMaterial({ color: '#ffe6bf', emissive: '#ffc57e', emissiveIntensity: 1.55, roughness: 0.18, toneMapped: true });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(size * 0.12, 12, 10), glowMat);
    bulb.position.y = -0.18;
    g.add(bulb);
    parent.add(g);
    this.windowMaterials.push(glowMat);
    this.stringBulbs.push({ mesh: bulb, material: glowMat, base: 1.4, phase: Math.random() * 6 });
  }

  makeHayBale(parent, x, y, z, w, h, d, rotation = 0) {
    const mat = this.materials.hay;
    const bale = this.box(parent, w, h, d, mat, [x, y + h / 2, z], [0, rotation, 0], 0.06);
    const strap = stdMat('#9c8053', { roughness: 0.7 });
    this.box(parent, w + 0.02, 0.025, 0.035, strap, [x, y + h * 0.55, z + d * 0.18], [0, rotation, 0], 0.005);
    this.box(parent, w + 0.02, 0.025, 0.035, strap, [x, y + h * 0.55, z - d * 0.18], [0, rotation, 0], 0.005);
    return bale;
  }

  makeMilkCan(parent, x, y, z, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    const metal = stdMat('#c6c7ba', { metalness: 0.65, roughness: 0.3, envMapIntensity: 1.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.34, 12), metal);
    body.position.y = 0.17;
    body.castShadow = true;
    g.add(body);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.12, 12), metal);
    shoulder.position.y = 0.4;
    g.add(shoulder);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.09, 10), metal);
    neck.position.y = 0.5;
    g.add(neck);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 12), metal);
    lid.position.y = 0.56;
    g.add(lid);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 4, 12, Math.PI), stdMat('#8b9388', { metalness: 0.7, roughness: 0.3 }));
    handle.position.set(0, 0.57, 0);
    handle.rotation.z = 0.1;
    g.add(handle);
    parent.add(g);
    return g;
  }

  makeFan(M, radius = 0.5) {
    const g = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.105, 7, 24), stdMat('#66756d', { metalness: 0.65, roughness: 0.32 }));
    g.add(housing);
    const back = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 24), stdMat('#354a43', { metalness: 0.35, roughness: 0.55 }));
    back.position.z = -0.025;
    g.add(back);
    const blades = new THREE.Group();
    const bladeMat = stdMat('#ced8cc', { metalness: 0.15, roughness: 0.45 });
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.CapsuleGeometry(radius * 0.12, radius * 0.64, 4, 10), bladeMat);
      blade.rotation.z = (i / 4) * TAU;
      blade.position.set(Math.cos((i / 4) * TAU) * radius * 0.33, Math.sin((i / 4) * TAU) * radius * 0.33, 0);
      blade.castShadow = true;
      blades.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.2, 10, 8), stdMat('#7c8b82', { metalness: 0.5, roughness: 0.35 }));
    blades.add(hub);
    g.add(blades);
    const grille = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.98, 0.011, 4, 28), stdMat('#aab7ad', { metalness: 0.6, roughness: 0.35 }));
    grille.position.z = 0.045;
    g.add(grille);
    g.userData.blades = blades;
    return g;
  }

  registerFan(deviceId, group, speed = 8) {
    const blades = group.userData.blades;
    if (!blades) return;
    this.fans.push({ deviceId, blades, speed, current: 0, group });
  }

  makeMistNozzle(parent, M, positions) {
    const g = new THREE.Group();
    const pipeMat = stdMat('#6b7b70', { metalness: 0.55, roughness: 0.35 });
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i];
      const b = positions[i + 1];
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, len, 6), pipeMat);
      pipe.position.set((a[0] + b[0]) / 2, a[1] + 0.03, (a[2] + b[2]) / 2);
      pipe.rotation.z = HALF_PI;
      pipe.rotation.y = -Math.atan2(b[2] - a[2], b[0] - a[0]);
      g.add(pipe);
    }
    for (const [x, y, z] of positions) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.11, 6), pipeMat);
      nozzle.position.set(x, y, z);
      g.add(nozzle);
    }
    parent.add(g);
    return g;
  }

  makeMistCloud(barnPos, nozzlePos, deviceId, count = 26) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    const rng = makeRng(deviceId.length * 99 + 21);
    for (let i = 0; i < count; i++) {
      const offsetX = (rng() - 0.5) * 4.2;
      const offsetZ = (rng() - 0.5) * 2.5 + 1.5;
      positions[i * 3] = barnPos[0] + offsetX;
      positions[i * 3 + 1] = 1.1 + rng() * 1.9;
      positions[i * 3 + 2] = barnPos[2] + offsetZ;
      seeds[i * 3] = rng() * 10;
      seeds[i * 3 + 1] = rng() * 10;
      seeds[i * 3 + 2] = rng() * 10;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    const tex = radialTexture([[0, 'rgba(238,250,246,.9)'], [0.42, 'rgba(207,235,229,.35)'], [1, 'rgba(207,235,229,0)']], 96);
    const material = new THREE.PointsMaterial({
      size: 0.32,
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      color: new THREE.Color('#d3eee5'),
      blending: THREE.NormalBlending,
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    this.world.add(points);
    return { points, material, deviceId, positions, seeds, active: false };
  }

  makeHeater(parent, M, position, deviceId, visible = true) {
    const g = new THREE.Group();
    g.position.set(...position);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.28, 10), stdMat('#5b635c', { metalness: 0.55, roughness: 0.4 }));
    body.rotation.z = HALF_PI;
    g.add(body);
    const glowMat = new THREE.MeshStandardMaterial({ color: '#ffcf9d', emissive: '#ff8f45', emissiveIntensity: 0.2, roughness: 0.2 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), glowMat);
    bulb.position.set(0.15, 0, 0);
    g.add(bulb);
    const light = new THREE.PointLight('#ff9f54', 0, 2.5, 2);
    light.position.set(0.15, 0.08, 0);
    g.add(light);
    parent.add(g);
    this.heaters.push({ deviceId, glowMat, light, mesh: g });
    return g;
  }

  buildBarnB02() {
    const M = this.materials;
    const group = new THREE.Group();
    group.position.set(4.55, 0, -2.7);
    this.world.add(group);
    this.barnB02 = group;
    this.registerEntity(group, { type: 'barn', id: 'B02', name: '青禾成母舍' });
    this.barnAnchors.set('B02', new THREE.Vector3(4.75, 4.45, -2.5));

    this.box(group, 6.55, 0.11, 4.55, stdMat('#96917d', { roughness: 0.97 }), [0, 0.02, 0], [0, 0, 0], 0.1);
    this.box(group, 6.2, 0.05, 4.25, stdMat('#b3a47f', { roughness: 0.95 }), [0, 0.1, 0], [0, 0, 0], 0.02);
    // 后墙 & 侧墙
    this.box(group, 6.15, 0.92, 0.13, M.woodDark, [0, 0.6, -2.05], [0, 0, 0], 0.03);
    this.box(group, 6.15, 0.14, 0.18, M.wood, [0, 1.01, -2.05], [0, 0, 0], 0.03);
    for (const x of [-2.85, 2.85]) {
      this.box(group, 0.16, 2.8, 0.16, M.woodDark, [x, 1.45, 2.02], [0, 0, 0], 0.02);
    }
    for (const z of [-1.8, 0.1, 1.9]) {
      this.box(group, 0.16, 2.9, 0.16, M.woodDark, [-2.85, 1.5, z], [0, 0, 0], 0.02);
      this.box(group, 0.16, 2.9, 0.16, M.woodDark, [2.85, 1.5, z], [0, 0, 0], 0.02);
    }
    // 单坡屋顶
    this.box(group, 7.1, 0.16, 5.05, M.roof, [0, 3.04, 0.02], [0.145, 0, 0], 0.06);
    for (let i = -3; i <= 3; i++) {
      this.box(group, 0.08, 0.1, 4.7, M.wood, [i * 0.95, 2.78, 0.02], [0.145, 0, 0], 0.015);
    }
    this.box(group, 6.9, 0.12, 0.12, M.wood, [0, 3.22, -2.45], [0, 0, 0], 0.02);
    this.box(group, 6.9, 0.12, 0.12, M.wood, [0, 2.75, 2.45], [0, 0, 0], 0.02);
    // 一侧开敞百叶
    for (let i = 0; i < 4; i++) {
      this.box(group, 0.06, 0.08, 3.9, M.woodLight, [2.86, 1.15 + i * 0.32, 0.01], [0, 0, 0], 0.01);
    }
    // 屋顶太阳能板
    for (let i = 0; i < 3; i++) {
      const panel = this.box(group, 1.5, 0.045, 1.55, new THREE.MeshStandardMaterial({ color: '#253f49', roughness: 0.24, metalness: 0.5, envMapIntensity: 1.3 }), [-1.8 + i * 1.8, 3.2, 0.05], [0.145, 0, 0], 0.015);
      for (let j = 0; j < 3; j++) {
        this.box(group, 0.01, 0.05, 1.5, stdMat('#596b69', { metalness: 0.55, roughness: 0.35 }), [-1.8 + i * 1.8 + (j - 1) * 0.46, 3.225, 0.05], [0.145, 0, 0], 0.002);
      }
    }
    // 饲槽与干草架
    this.box(group, 4.3, 0.34, 0.4, M.wood, [0, 0.31, -1.52], [0, 0, 0], 0.05);
    this.addMesh(group, new THREE.BoxGeometry(3.8, 0.06, 0.23), M.hay, [0, 0.51, -1.52]);
    for (let i = -2; i <= 2; i++) this.box(group, 0.08, 0.4, 0.5, M.woodDark, [i * 0.82, 0.28, -1.52], [0, 0, 0], 0.015);
    this.makeHayBale(group, -2.25, 0.06, 1.2, 0.55, 0.4, 0.58, 0.8);
    this.makeHayBale(group, 2.1, 0.06, 1.35, 0.48, 0.35, 0.5, 1.5);
    // 饮水槽
    this.box(group, 1.5, 0.27, 0.52, M.metal, [2.0, 0.2, 1.8], [0, 0, 0], 0.06);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.36), this.materials.water);
    water.rotation.x = -HALF_PI;
    water.position.set(2.0, 0.34, 1.8);
    group.add(water);
    // 门牌
    const signTex = signTexture({ title: 'B02 · 青禾', sub: 'MATURE HERD · OPEN BARN', accent: '#e9dcc7', border: '#9b9985' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color('#e5c9a3'), emissiveMap: signTex, emissiveIntensity: 0.12 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 0.74), signMat);
    sign.position.set(0, 2.5, 2.16);
    group.add(sign);
    // 吊灯
    this.makePendant(group, [-1.7, 3.0, 0.5], 0.45, M);
    this.makePendant(group, [1.2, 3.05, -0.2], 0.4, M);
    const warm = new THREE.PointLight('#ffc184', 2.4, 6.5, 2);
    warm.position.set(0, 2.4, 0.2);
    warm.userData.base = 2.4;
    group.add(warm);
    this.interiorLights.push(warm);
    // 设备
    const fan = this.makeFan(M, 0.44);
    fan.position.set(-0.9, 2.35, -1.95);
    group.add(fan);
    this.registerFan('D-B02-EXH', fan, 7.5);
    const fan2 = this.makeFan(M, 0.32);
    fan2.position.set(2.55, 2.5, -1.1);
    fan2.rotation.y = -HALF_PI;
    group.add(fan2);
    this.registerFan('D-B02-FAN', fan2, 5.5);
    this.makeMistNozzle(group, M, [[-2.3, 2.75, 2.2], [0.5, 2.75, 2.3], [2.6, 2.75, 2.2]]);
    this.mistSystems.push(this.makeMistCloud([4.55, 0, -2.7], [-1.5, 2.5, 2.2], 'D-B02-MIST', 24));
    this.makeHeater(group, M, [2.2, 1.1, -1.75], 'D-B02-HEAT');
    this.wireStringLights(group, [
      [-2.9, 2.7, 2.25], [-1.8, 2.52, 2.3], [-0.6, 2.45, 2.3], [0.6, 2.45, 2.3], [1.8, 2.55, 2.3], [2.9, 2.72, 2.25],
    ], 0.05);
  }

  buildBarnB03() {
    const M = this.materials;
    const group = new THREE.Group();
    group.position.set(6.15, 0, 3.15);
    this.world.add(group);
    this.barnB03 = group;
    this.registerEntity(group, { type: 'barn', id: 'B03', name: '星芽犊牛舍' });
    this.barnAnchors.set('B03', new THREE.Vector3(6.15, 3.42, 3.25));

    this.cylinder(group, 2.38, 2.5, 0.16, 40, stdMat('#8d8c77', { roughness: 0.95 }), [0, 0.04, 0]);
    this.cylinder(group, 2.18, 2.26, 0.12, 40, stdMat('#b3a17d', { roughness: 0.92 }), [0, 0.14, 0]);
    this.cylinder(group, 2.1, 2.16, 0.52, 40, M.wood, [0, 0.43, 0]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.18, 0.045, 6, 48), M.woodDark);
    ring.rotation.x = HALF_PI;
    ring.position.y = 0.7;
    group.add(ring);
    const ring2 = ring.clone();
    ring2.position.y = 0.22;
    group.add(ring2);
    // 玻璃穹顶
    const domeGeo = new THREE.SphereGeometry(2.08, 36, 20, 0, TAU, 0, HALF_PI);
    const dome = new THREE.Mesh(domeGeo, M.glass);
    dome.position.y = 0.69;
    dome.receiveShadow = false;
    group.add(dome);
    // 穹顶框架
    const ribMat = stdMat('#8c9b8d', { metalness: 0.55, roughness: 0.3 });
    for (let i = 0; i < 8; i++) {
      const theta = (i / 8) * TAU;
      const pts = [];
      for (let s = 0; s <= 20; s++) {
        const phi = (s / 20) * HALF_PI;
        pts.push(new THREE.Vector3(Math.cos(phi) * 2.1 * Math.cos(theta), 0.69 + Math.sin(phi) * 2.1, Math.cos(phi) * 2.1 * Math.sin(theta)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      this.addMesh(group, new THREE.TubeGeometry(curve, 24, 0.025, 5, false), ribMat, [0, 0, 0], [0, 0, 0]);
    }
    for (let i = 1; i <= 2; i++) {
      const r = 2.1 * Math.cos((i / 3) * HALF_PI);
      const y = 0.69 + 2.1 * Math.sin((i / 3) * HALF_PI);
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 5, 48), ribMat);
      hoop.rotation.x = HALF_PI;
      hoop.position.y = y;
      group.add(hoop);
    }
    // 穹顶星灯
    const topper = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0), new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffc673', emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2 }));
    topper.position.y = 2.92;
    group.add(topper);
    const topperLight = new THREE.PointLight('#ffd08a', 2.4, 5.5, 2);
    topperLight.position.set(0, 2.65, 0);
    topperLight.userData.base = 2.4;
    group.add(topperLight);
    this.interiorLights.push(topperLight);
    this.b06Topper = topper;
    // 门与小门檐
    this.box(group, 0.82, 1.5, 0.08, M.glassWarm, [0, 0.92, 2.02], [0, 0, 0], 0.03, false);
    this.box(group, 0.1, 1.62, 0.16, M.woodDark, [-0.45, 0.88, 2.05], [0, 0, 0], 0.03);
    this.box(group, 0.1, 1.62, 0.16, M.woodDark, [0.45, 0.88, 2.05], [0, 0, 0], 0.03);
    this.box(group, 1.15, 0.12, 0.2, M.woodDark, [0, 1.7, 2.05], [0, 0, 0], 0.03);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.metal);
    knob.position.set(0.28, 0.88, 2.1);
    group.add(knob);
    // 室内软垫与热灯
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.78, 0.12, 20), stdMat('#e0cfa7', { roughness: 0.98 }));
    bed.position.set(-0.55, 0.23, -0.2);
    group.add(bed);
    const bed2 = bed.clone();
    bed2.position.set(0.8, 0.23, 0.6);
    bed2.scale.setScalar(0.85);
    group.add(bed2);
    const hanging = new THREE.Group();
    this.addMesh(hanging, new THREE.CylinderGeometry(0.008, 0.008, 1.1, 4), stdMat('#5b6359', { metalness: 0.5 }), [0, 1.45, 0]);
    const heatShade = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 14, 1, true), stdMat('#6a6e63', { metalness: 0.45, roughness: 0.4, side: THREE.DoubleSide }));
    heatShade.rotation.x = Math.PI;
    heatShade.position.y = 0.86;
    hanging.add(heatShade);
    const heatBulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffd095', emissive: '#ff9a4f', emissiveIntensity: 1.6, roughness: 0.2 }));
    heatBulb.position.y = 0.76;
    hanging.add(heatBulb);
    const heatLight = new THREE.PointLight('#ffac65', 1.8, 2.8, 2);
    heatLight.position.y = 0.65;
    hanging.add(heatLight);
    heatLight.userData.base = 1.8;
    group.add(hanging);
    this.interiorLights.push(heatLight);
    this.makeHeater(group, M, [-0.2, 1.1, -1.25], 'D-B03-HEAT');
    this.windowMaterials.push(heatBulb.material);
    // 外围小栅栏
    this.buildRoundFence(group, 2.65, 0.58, 12);
    // 铭牌
    const signTex = signTexture({ title: 'B03 · 星芽', sub: 'CALF NURSERY · 28 HEADS', accent: '#f0e4cf', border: '#a29f84' });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color('#dfcba8'), emissiveMap: signTex, emissiveIntensity: 0.1 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.56), signMat);
    sign.position.set(0, 2.0, 2.28);
    group.add(sign);
    const smallFan = this.makeFan(M, 0.24);
    smallFan.position.set(-0.9, 2.31, 1.2);
    smallFan.rotation.y = -0.7;
    group.add(smallFan);
    this.registerFan('D-B03-FAN', smallFan, 4.5);
    const lamp = new THREE.PointLight('#ffd6a0', 1.6, 4.7, 2);
    lamp.position.set(0.2, 2.05, 0.8);
    lamp.userData.base = 1.6;
    group.add(lamp);
    this.interiorLights.push(lamp);
    this.wireStringLights(group, [
      [-2.0, 1.25, 2.0], [-1.2, 1.0, 2.45], [-0.3, 0.95, 2.7], [0.6, 1.1, 2.55], [1.45, 1.35, 2.2],
    ], 0.042);
  }

  buildRoundFence(parent, radius, height, count) {
    const mat = stdMat('#d7cdb8', { roughness: 0.9 });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, height, 0.07), mat);
      post.position.set(Math.cos(a) * radius, height / 2, Math.sin(a) * radius);
      post.rotation.y = a;
      post.castShadow = true;
      parent.add(post);
    }
    for (const h of [0.24, height * 0.72]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 4, 48), mat);
      hoop.rotation.x = HALF_PI;
      hoop.position.y = h;
      parent.add(hoop);
    }
  }

  buildSilo() {
    const group = new THREE.Group();
    group.position.set(-8.65, 0, -5.25);
    this.world.add(group);
    const cream = stdMat('#b9ad90', { roughness: 0.82, metalness: 0.08 });
    const metal = this.materials.metal;
    this.cylinder(group, 0.8, 0.92, 3.9, 24, cream, [0, 1.95, 0]);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 12, 0, TAU, 0, HALF_PI), stdMat('#7d8378', { metalness: 0.35, roughness: 0.45 }));
    dome.position.y = 3.9;
    dome.castShadow = true;
    group.add(dome);
    for (const y of [0.4, 1.35, 2.3, 3.25, 3.8]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.84 + (y > 3.2 ? -0.02 : 0.03), 0.025, 5, 28), metal);
      band.rotation.x = HALF_PI;
      band.position.y = y;
      group.add(band);
    }
    // 爬梯
    for (const x of [-0.18, 0.18]) {
      this.cylinder(group, 0.018, 0.018, 3.0, 5, metal, [0.83 + x, 1.55, 0.02]);
    }
    for (let i = 0; i < 10; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), metal);
      rung.rotation.z = HALF_PI;
      rung.position.set(0.83, 0.18 + i * 0.3, 0.02);
      group.add(rung);
    }
    // 通气管与阀
    this.cylinder(group, 0.06, 0.06, 0.6, 8, metal, [0.2, 4.45, 0]);
    this.cylinder(group, 0.1, 0.1, 0.11, 8, stdMat('#6b756b', { metalness: 0.5 }), [0.2, 4.78, 0]);
    // 小操作箱
    this.box(group, 0.26, 0.4, 0.2, stdMat('#7b877a', { metalness: 0.4, roughness: 0.5 }), [-0.85, 1.1, 0.55], [0, 0.3, 0], 0.03);
    this.cylinder(group, 0.05, 0.05, 0.8, 6, metal, [-0.9, 0.55, 0.6], [0.3, 0, 0.2]);
  }

  buildWindmill() {
    const group = new THREE.Group();
    group.position.set(8.9, 0, -5.8);
    group.rotation.y = 0.55;
    this.world.add(group);
    const poleMat = stdMat('#d5d1c1', { roughness: 0.55, metalness: 0.2 });
    this.cylinder(group, 0.07, 0.16, 4.8, 12, poleMat, [0, 2.4, 0]);
    this.cylinder(group, 0.2, 0.26, 0.34, 14, stdMat('#7f8e86', { metalness: 0.5, roughness: 0.4 }), [0, 4.72, 0]);
    const blades = new THREE.Group();
    blades.position.set(0, 4.82, 0.15);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 1.75, 4, 6), poleMat);
      arm.position.set(Math.cos((i / 3) * TAU) * 0.78, Math.sin((i / 3) * TAU) * 0.78, 0);
      arm.rotation.z = (i / 3) * TAU - HALF_PI;
      arm.scale.z = 0.45;
      arm.castShadow = true;
      blades.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), stdMat('#89958a', { metalness: 0.5, roughness: 0.35 }));
    blades.add(hub);
    group.add(blades);
    this.windmillBlades = blades;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#f08f7d', emissive: '#f08f7d', emissiveIntensity: 1.2 }));
    beacon.position.set(0.18, 4.74, 0);
    group.add(beacon);
    this.windBeacon = beacon;
  }

  buildSolarArray() {
    const group = new THREE.Group();
    group.position.set(-0.2, 0, -6.25);
    this.world.add(group);
    const metal = this.materials.metal;
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 1.65;
      this.box(group, 0.06, 0.9, 0.06, metal, [x, 0.43, 0.4], [-0.36, 0, 0], 0.01);
      this.box(group, 0.06, 0.9, 0.06, metal, [x, 0.43, -0.4], [0.36, 0, 0], 0.01);
      const panel = this.box(group, 1.42, 0.05, 1.25, new THREE.MeshStandardMaterial({ color: '#29424a', roughness: 0.2, metalness: 0.55, envMapIntensity: 1.5 }), [x, 0.9, 0], [0.35, 0, 0], 0.02);
      for (const z of [-0.42, 0, 0.42]) {
        this.box(group, 1.4, 0.02, 0.025, stdMat('#667876', { metalness: 0.55, roughness: 0.4 }), [x, 0.94 - z * 0.35, z], [0.35, 0, 0], 0.002);
      }
    }
    this.solarArray = group;
  }

  buildEntrance() {
    const group = new THREE.Group();
    group.position.set(-10.68, 0, 3.0);
    this.world.add(group);
    // 一块向道路指引的小路牌
    this.cylinder(group, 0.04, 0.06, 1.5, 6, this.materials.woodDark, [0, 0.75, 0]);
    const board = this.box(group, 1.2, 0.5, 0.08, this.materials.woodLight, [0.42, 1.35, 0], [0, -0.35, 0.02], 0.03);
    const signMat = new THREE.MeshStandardMaterial({ color: '#4b5e51', roughness: 0.8 });
    const letters = this.box(group, 0.85, 0.05, 0.015, signMat, [0.44, 1.4, 0.055], [0, -0.35, 0.02], 0.002);
    this.entranceSign = board;
    // 岛缘三角彩旗
    const bunting = new THREE.Group();
    const flagColors = ['#e5c487', '#d49586', '#9fb99a', '#c9bbd6'];
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.16, 0, 0, 0.08, -0.16, 0], 3));
      geo.setIndex([0, 1, 2]);
      geo.computeVertexNormals();
      const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: flagColors[i % flagColors.length], roughness: 0.8, side: THREE.DoubleSide }));
      flag.position.set(-1 + i * 0.27, 1.75 + Math.sin((i / 9) * Math.PI) * 0.22, 0);
      flag.rotation.y = 0.1;
      bunting.add(flag);
    }
    group.add(bunting);
  }

  makeTree(x, z, scale = 1, type = 'green', rotation = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    group.scale.setScalar(scale);
    const rng = makeRng(Math.round((x + 20) * 98 + (z + 20) * 13));
    const trunkMat = stdMat(type === 'blossom' ? '#6d5140' : '#574536', { roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 1.55, 7), trunkMat);
    trunk.position.y = 0.72;
    trunk.rotation.z = (rng() - 0.5) * 0.06;
    trunk.castShadow = true;
    group.add(trunk);
    // 枝干
    for (let i = 0; i < 3; i++) {
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.065, 0.8, 5), trunkMat);
      branch.position.set(Math.cos(i * 2.1) * 0.25, 1.22 + i * 0.12, Math.sin(i * 2.1) * 0.2);
      branch.rotation.z = 0.5 + rng() * 0.4;
      branch.rotation.y = i * 2.1;
      branch.castShadow = true;
      group.add(branch);
    }
    const palettes = {
      green: ['#547b5b', '#6f9268', '#416b55'],
      light: ['#6e906a', '#86a172', '#547b5b'],
      blossom: ['#dca19b', '#e9b9ad', '#c98685'],
      autumn: ['#b58557', '#d0a46d', '#8d7050'],
    };
    const colors = palettes[type] || palettes.green;
    const blobs = type === 'blossom' ? 7 : 5;
    for (let i = 0; i < blobs; i++) {
      const radius = (0.52 + rng() * 0.42) * (i < 2 ? 1.1 : 0.85);
      const mat = stdMat(colors[i % colors.length], { roughness: 0.92, flatShading: i % 2 === 0 });
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), mat);
      crown.position.set(
        (rng() - 0.5) * 1.05,
        1.75 + rng() * 0.75,
        (rng() - 0.5) * 0.8,
      );
      crown.scale.set(1.05, 0.88 + rng() * 0.22, 1.0);
      crown.rotation.set(rng() * 2, rng() * 2, rng() * 2);
      crown.castShadow = true;
      crown.receiveShadow = true;
      group.add(crown);
    }
    // 树底苔藓与蘑菇
    const mossMat = stdMat('#69835b', { roughness: 1 });
    const moss = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 6, 0, TAU, 0, HALF_PI), mossMat);
    moss.scale.y = 0.18;
    moss.position.y = 0.04;
    group.add(moss);
    if (type === 'green' || type === 'blossom') {
      for (let i = 0; i < 4; i++) {
        this.makeMushroom(group, (rng() - 0.5) * 0.8, (rng() - 0.5) * 0.5, 0.36);
      }
    }
    this.world.add(group);
    return group;
  }

  makeMushroom(parent, x, z, scale) {
    const g = new THREE.Group();
    g.position.set(x, 0.01, z);
    g.scale.setScalar(scale);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.16, 6), stdMat('#dfd1b7', { roughness: 0.9 }));
    stem.position.y = 0.08;
    g.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 5, 0, TAU, 0, HALF_PI), new THREE.MeshStandardMaterial({ color: '#d9a7a3', emissive: '#d46f78', emissiveIntensity: 0.16, roughness: 0.6 }));
    cap.scale.y = 0.55;
    cap.position.y = 0.15;
    g.add(cap);
    parent.add(g);
  }

  buildTrees() {
    const trees = [
      [-9.15, -1.1, 1.35, 'blossom', 0.4],
      [-7.65, 2.45, 0.96, 'green', 1.2],
      [-3.0, -6.35, 1.25, 'green', 0.3],
      [3.2, -6.45, 1.1, 'light', 2.0],
      [9.65, -2.2, 1.15, 'green', 0.8],
      [9.2, 1.35, 0.92, 'blossom', 2.7],
      [-9.4, 6.0, 0.9, 'light', 1.4],
      [2.2, 6.7, 0.8, 'autumn', 0.2],
    ];
    for (const [x, z, s, type, rot] of trees) {
      this.makeTree(x, z, s, type, rot);
    }
    // 主树的秋千
    const swing = new THREE.Group();
    swing.position.set(-9.15, 1.55, -1.0);
    const ropeMat = stdMat('#b8a98c', { roughness: 0.8 });
    for (const x of [-0.28, 0.28]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.15, 4), ropeMat);
      rope.position.set(x, -0.58, 0);
      swing.add(rope);
    }
    this.box(swing, 0.7, 0.06, 0.26, this.materials.wood, [0, -1.15, 0], [0, 0, 0], 0.02);
    this.world.add(swing);
  }

  buildShrubsAndFlowers() {
    const rng = makeRng(881);
    const bushMat = stdMat('#678763', { roughness: 0.98 });
    for (let i = 0; i < 16; i++) {
      const angle = rng() * TAU;
      const radius = 5.2 + rng() * 4.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.7;
      if (this.isInsideBarn(x, z, 0.9) || this.isInsidePond(x, z, 0.6)) continue;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const r = 0.22 + rng() * 0.32;
      for (let b = 0; b < 3; b++) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r * (0.7 + rng() * 0.4), 1), bushMat);
        blob.position.set((rng() - 0.5) * r * 1.2, r * 0.45 + rng() * 0.15, (rng() - 0.5) * r);
        blob.scale.y = 0.68;
        blob.castShadow = true;
        group.add(blob);
      }
      this.world.add(group);
    }
    // 花簇
    const flowerColors = ['#f0c0b0', '#f4d795', '#c9b9dd', '#f1e9d7'];
    for (let i = 0; i < 42; i++) {
      const x = (rng() - 0.5) * 17.5;
      const z = (rng() - 0.5) * 11.5;
      if (this.isInsideBarn(x, z, 0.5) || this.isInsidePond(x, z, 0.8) || Math.abs(x) > 9.6 || Math.abs(z) > 6.4) continue;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const color = flowerColors[Math.floor(rng() * flowerColors.length)];
      for (let f = 0; f < 3; f++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.12 + rng() * 0.1, 3), stdMat('#6e855b', { roughness: 1 }));
        stem.position.set((rng() - 0.5) * 0.18, 0.08, (rng() - 0.5) * 0.18);
        group.add(stem);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.028 + rng() * 0.012, 5, 4), stdMat(color, { roughness: 0.9 }));
        head.position.copy(stem.position).add(new THREE.Vector3(0, 0.08, 0));
        group.add(head);
      }
      this.world.add(group);
    }
    // 南瓜与小菜地
    const patch = new THREE.Group();
    patch.position.set(-7.65, 0, 3.1);
    this.box(patch, 2.1, 0.12, 1.2, stdMat('#74563f', { roughness: 1 }), [0, 0.06, 0], [0, 0, 0], 0.03);
    for (let i = 0; i < 8; i++) {
      const cx = -0.8 + (i % 4) * 0.53;
      const cz = -0.25 + Math.floor(i / 4) * 0.5;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 5, 0, TAU, 0, HALF_PI), stdMat('#6c8c61', { roughness: 0.98 }));
      leaf.scale.y = 0.22;
      leaf.position.set(cx, 0.14, cz);
      patch.add(leaf);
      if (i % 3 === 0) {
        const pumpkin = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), stdMat('#cf8b53', { roughness: 0.8 }));
        pumpkin.scale.y = 0.7;
        pumpkin.position.set(cx + 0.14, 0.21, cz + 0.1);
        patch.add(pumpkin);
      }
    }
    this.world.add(patch);
  }

  buildGrass() {
    const rng = makeRng(2027);
    const bladeGeo = new THREE.ConeGeometry(0.028, 0.22, 3);
    bladeGeo.translate(0, 0.11, 0);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.95, metalness: 0.0 });
    const count = window.innerWidth < 800 ? 420 : 920;
    const mesh = new THREE.InstancedMesh(bladeGeo, mat, count);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    const dummy = new THREE.Object3D();
    const colors = [new THREE.Color('#6e885c'), new THREE.Color('#80986a'), new THREE.Color('#5d7a55'), new THREE.Color('#93a877')];
    let n = 0;
    let guard = 0;
    while (n < count && guard < count * 4) {
      guard++;
      const x = (rng() - 0.5) * 20.4;
      const z = (rng() - 0.5) * 13.2;
      if (this.isInsideBarn(x, z, 0.25) || this.isInsidePond(x, z, 0.2)) continue;
      dummy.position.set(x, 0.02, z);
      dummy.rotation.set(0, rng() * TAU, (rng() - 0.5) * 0.22);
      const scale = 0.6 + rng() * 1.2;
      dummy.scale.set(0.72 + rng() * 0.8, scale, 0.72 + rng() * 0.8);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, colors[Math.floor(rng() * colors.length)]);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.world.add(mesh);
    this.grass = mesh;
  }

  buildStringLights() {
    const group = new THREE.Group();
    const curvePoints = [
      new THREE.Vector3(-7.6, 3.0, 0.8),
      new THREE.Vector3(-6.3, 2.3, 1.3),
      new THREE.Vector3(-4.9, 2.05, 1.6),
      new THREE.Vector3(-3.2, 2.3, 1.5),
      new THREE.Vector3(-1.9, 2.9, 1.0),
    ];
    this.wireStringLights(group, curvePoints.map((p) => [p.x, p.y, p.z]), 0.028);
    this.world.add(group);
    this.stringLightGroup = group;
  }

  wireStringLights(parent, points, spacing = 0.045) {
    const vecs = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    if (vecs.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(vecs);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 30, 0.006, 4, false),
      stdMat('#5c5a50', { roughness: 0.8 }),
    );
    parent.add(tube);
    const divisions = Math.max(3, Math.round(curve.getLength() / 0.28));
    for (let i = 0; i <= divisions; i++) {
      const t = i / divisions;
      const p = curve.getPointAt(t);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: '#ffe5bf',
        emissive: '#ffc276',
        emissiveIntensity: 1.1 + (i % 3) * 0.12,
        roughness: 0.22,
      });
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(spacing, 8, 6), bulbMat);
      bulb.position.copy(p).add(new THREE.Vector3(0, -spacing * 0.9, 0));
      parent.add(bulb);
      this.stringBulbs.push({ mesh: bulb, material: bulbMat, base: 0.9 + (i % 4) * 0.15, phase: i * 0.8 + Math.random() * 2 });
    }
  }

  buildSensorPoles() {
    const placements = {
      B01: new THREE.Vector3(-7.8, 0, 0.55),
      B02: new THREE.Vector3(8.1, 0, -0.3),
      B03: new THREE.Vector3(8.55, 0, 4.75),
    };
    for (const [barnId, pos] of Object.entries(placements)) {
      const group = new THREE.Group();
      group.position.copy(pos);
      this.world.add(group);
      const poleMat = stdMat('#8d968c', { metalness: 0.55, roughness: 0.4 });
      this.cylinder(group, 0.028, 0.045, 2.4, 6, poleMat, [0, 1.2, 0]);
      this.box(group, 0.32, 0.24, 0.18, stdMat('#e2dfcf', { roughness: 0.62 }), [0, 1.52, 0], [0, 0.35, 0], 0.04);
      this.box(group, 0.18, 0.06, 0.12, stdMat('#7c8880', { metalness: 0.4 }), [0, 1.59, 0], [0, 0.35, 0], 0.01);
      const beaconMat = new THREE.MeshStandardMaterial({ color: '#86dfc2', emissive: '#5dc7a8', emissiveIntensity: 1.2, roughness: 0.25 });
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), beaconMat);
      beacon.position.set(0, 2.5, 0);
      group.add(beacon);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.13, 0.16, 24),
        new THREE.MeshBasicMaterial({ color: '#a8ebd6', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -HALF_PI;
      ring.position.set(0, 2.5, 0);
      group.add(ring);
      const light = new THREE.PointLight('#88e0c8', 0.6, 2.2, 2);
      light.position.set(0, 2.4, 0);
      group.add(light);
      this.sensorVisuals.set(barnId, { beacon, beaconMat, ring, light, baseRing: ring.material.clone() });
    }
  }

  registerEntity(group, entity) {
    group.userData.entity = entity;
    group.traverse((obj) => {
      if (!obj.isMesh) return;
      // 透明玻璃不参与拾取，避免遮挡舍内的牛只与设备
      if (obj.material && (obj.material.transparent || obj.material.transmission > 0.1)) return;
      obj.userData.entity = entity;
      this.clickable.push(obj);
    });
  }

  buildCows() {
    const showcase = this.state.cows.filter((cow) => cow.showcase && cow.scene);
    showcase.forEach((cow, index) => {
      const model = this.makeCow(cow, index);
      this.world.add(model.group);
      this.cowModels.set(cow.earTag, model);
      this.registerEntity(model.group, { type: 'cow', id: cow.earTag, name: cow.name });
    });
  }

  makeCow(cow, index) {
    const scene = cow.scene;
    const group = new THREE.Group();
    group.position.set(scene.x, scene.y, scene.z);
    group.rotation.y = scene.rotation;
    group.scale.setScalar(scene.scale);
    const inner = new THREE.Group();
    inner.position.y = -0.18;
    group.add(inner);
    const rng = makeRng(100 + index * 31 + cow.earTag.length * 7);
    const texture = cowTexture(index % 5);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: texture.texture,
      color: '#ffffff',
      roughness: 0.84,
      metalness: 0.01,
      envMapIntensity: 0.42,
    });
    const headMat = stdMat(texture.colors.base, { roughness: 0.86 });
    const darkMat = stdMat(texture.colors.dark, { roughness: 0.8 });
    const hoofMat = stdMat('#493d35', { roughness: 0.65 });
    const creamMat = stdMat(texture.colors.accent, { roughness: 0.9 });
    const pinkMat = stdMat('#dca08f', { roughness: 0.88 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#25221c', roughness: 0.17, metalness: 0.2 });
    const whiteEyeMat = new THREE.MeshBasicMaterial({ color: '#fff6e7' });

    // 身体
    const bodyPivot = new THREE.Group();
    inner.add(bodyPivot);
    const bodyGeo = new THREE.CapsuleGeometry(0.41, 0.86, 6, 18);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.z = HALF_PI;
    body.scale.set(1.08, 0.92, 0.92);
    body.position.y = 0.93;
    body.castShadow = true;
    body.receiveShadow = true;
    bodyPivot.add(body);

    // 颈背弧线
    const neckGeo = new THREE.CapsuleGeometry(0.24, 0.22, 4, 12);
    const neck = new THREE.Mesh(neckGeo, headMat);
    neck.rotation.z = -0.55;
    neck.position.set(0.76, 1.12, 0);
    neck.scale.set(1, 0.9, 0.95);
    bodyPivot.add(neck);

    // 头
    const head = new THREE.Group();
    head.position.set(0.95, 1.2, 0);
    bodyPivot.add(head);
    const skull = new THREE.Mesh(new RoundedBoxGeometry(0.53, 0.46, 0.4, 4, 0.12), headMat);
    skull.castShadow = true;
    head.add(skull);
    const muzzle = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.22, 0.32, 3, 0.08), creamMat);
    muzzle.position.set(0.31, -0.09, 0);
    muzzle.castShadow = true;
    head.add(muzzle);
    const nose = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.13, 0.25, 3, 0.05), pinkMat);
    nose.position.set(0.47, -0.06, 0);
    head.add(nose);
    for (const z of [-0.075, 0.075]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), eyeMat);
      nostril.position.set(0.525, -0.035, z);
      nostril.scale.set(1.2, 0.7, 0.75);
      head.add(nostril);
    }
    for (const z of [-0.2, 0.2]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), eyeMat);
      eye.position.set(0.16, 0.135, z);
      head.add(eye);
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), whiteEyeMat);
      shine.position.set(0.19, 0.155, z - 0.012 * Math.sign(z));
      head.add(shine);
    }
    // 耳朵
    const ears = [];
    for (const z of [-0.27, 0.27]) {
      const ear = new THREE.Group();
      ear.position.set(-0.01, 0.2, z);
      ear.rotation.x = z > 0 ? -0.35 : 0.35;
      ear.rotation.z = z > 0 ? 0.25 : -0.15;
      const earMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), headMat);
      earMesh.scale.set(0.6, 0.4, 1.0);
      earMesh.position.x = -0.05;
      ear.add(earMesh);
      const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), pinkMat);
      innerEar.scale.set(0.35, 0.3, 0.82);
      innerEar.position.set(-0.04, 0.035, z > 0 ? 0.02 : -0.02);
      ear.add(innerEar);
      head.add(ear);
      ears.push(ear);
    }
    // 耳标
    if (cow.group !== '犊牛') {
      const tag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.09, 0.02), new THREE.MeshStandardMaterial({ color: '#efc56d', roughness: 0.48, metalness: 0.12 }));
      tag.position.set(-0.04, 0.13, 0.34);
      tag.rotation.x = 0.15;
      head.add(tag);
    }
    // 角与额头毛
    if (cow.group !== '犊牛') {
      for (const z of [-0.14, 0.14]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.17, 6), creamMat);
        horn.position.set(0.0, 0.3, z);
        horn.rotation.z = 0.2;
        horn.rotation.x = z > 0 ? 0.3 : -0.3;
        head.add(horn);
      }
    }
    for (let i = 0; i < 3; i++) {
      const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 5), creamMat);
      tuft.position.set(-0.03 + i * 0.035, 0.26 - i * 0.02, (i - 1) * 0.07);
      tuft.scale.set(0.8, 1.1, 0.8);
      head.add(tuft);
    }

    // 腿
    const legs = [];
    const legGeo = new THREE.CapsuleGeometry(0.062, 0.34, 4, 8);
    for (const x of [0.48, -0.49]) {
      for (const z of [-0.25, 0.25]) {
        const legPivot = new THREE.Group();
        legPivot.position.set(x, 0.73, z);
        const upper = new THREE.Mesh(legGeo, headMat);
        upper.position.y = -0.27;
        upper.castShadow = true;
        legPivot.add(upper);
        const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.056, 0.1, 8), hoofMat);
        hoof.position.y = -0.5;
        legPivot.add(hoof);
        inner.add(legPivot);
        legs.push(legPivot);
      }
    }
    // 乳房
    if (cow.group === '泌乳牛' || cow.group === '干奶牛') {
      const udder = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 9), pinkMat);
      udder.scale.set(1.15, 0.7, 0.88);
      udder.position.set(-0.34, 0.56, 0);
      bodyPivot.add(udder);
      for (const x of [-0.09, 0.09]) {
        for (const z of [-0.06, 0.06]) {
          const teat = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.045, 3, 5), pinkMat);
          teat.position.set(-0.34 + x, 0.46, z);
          bodyPivot.add(teat);
        }
      }
    }
    // 尾巴
    const tailGroup = new THREE.Group();
    tailGroup.position.set(-0.8, 1.1, 0);
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.14, -0.18, 0.02),
      new THREE.Vector3(-0.18, -0.4, 0.05),
      new THREE.Vector3(-0.1, -0.58, 0.02),
    ]);
    const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 10, 0.016, 4, false), headMat);
    tail.castShadow = true;
    tailGroup.add(tail);
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 5), darkMat);
    tuft.position.set(-0.1, -0.61, 0.02);
    tuft.scale.y = 1.3;
    tailGroup.add(tuft);
    inner.add(tailGroup);
    // 铃铛
    if (cow.group !== '犊牛') {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.015, 5, 18), stdMat('#66543c', { roughness: 0.7 }));
      collar.rotation.y = HALF_PI;
      collar.position.set(0.78, 1.18, 0);
      bodyPivot.add(collar);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#d8ac58', metalness: 0.55, roughness: 0.28 }));
      bell.scale.y = 1.1;
      bell.position.set(0.78, 1.02, 0);
      bodyPivot.add(bell);
    }

    // 状态地环
    const statusColor = cow.healthStatus === 'risk' ? C.danger : cow.healthStatus === 'watch' ? C.watch : C.healthy;
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(statusColor), transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false });
    const statusRing = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.63, 32), ringMat);
    statusRing.rotation.x = -HALF_PI;
    statusRing.position.y = 0.018;
    group.add(statusRing);
    if (cow.healthStatus === 'risk') {
      const pulseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.danger), transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
      const pulse = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.66, 32), pulseMat);
      pulse.rotation.x = -HALF_PI;
      pulse.position.y = 0.02;
      group.add(pulse);
      group.userData.pulse = pulse;
    }

    group.userData.inner = inner;
    return {
      group,
      bodyPivot,
      head,
      ears,
      legs,
      tailGroup,
      statusRing,
      ringMat,
      cow,
      basePos: new THREE.Vector3(scene.x, scene.y, scene.z),
      baseRotation: scene.rotation,
      phase: scene.phase || index * 1.4,
      wander: scene.wander,
      range: scene.range || 0.6,
      scale: scene.scale,
      targetRingScale: 1,
    };
  }

  buildClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d9e1d7'),
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      envMapIntensity: 0.22,
      side: THREE.DoubleSide,
    });
    this.cloudMaterial = cloudMat;
    const rng = makeRng(561);
    const configs = [
      [-9.2, 8.1, -4.8, 0.86, 0.026],
      [6.8, 8.8, -2.2, 0.96, -0.022],
      [10.4, 7.2, 4.5, 0.64, 0.028],
      [-10.7, 7.0, 3.8, 0.56, -0.021],
      [1.2, 9.4, -7.0, 0.72, 0.018],
      [-3.8, 6.7, 8.2, 0.42, 0.03],
    ];
    const group = new THREE.Group();
    for (const [x, y, z, scale, speed] of configs) {
      const cloud = new THREE.Group();
      cloud.position.set(x, y, z);
      const puffs = 4 + Math.floor(rng() * 3);
      for (let p = 0; p < puffs; p++) {
        const radius = (0.5 + rng() * 0.52) * scale;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), cloudMat);
        puff.position.set((rng() - 0.5) * 2.4 * scale, (rng() - 0.5) * 0.28 * scale, (rng() - 0.5) * 0.7 * scale);
        puff.scale.set(1.55, 0.56, 0.9);
        puff.rotation.set(rng(), rng(), rng());
        cloud.add(puff);
      }
      cloud.userData.baseX = x;
      cloud.userData.speed = speed;
      cloud.userData.phase = rng() * 10;
      cloud.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
      group.add(cloud);
      this.cloudMeshes.push(cloud);
    }
    this.clouds = group;
    this.world.add(group);
  }

  buildMistSprites() {
    const tex = radialTexture([[0, 'rgba(230,243,236,.22)'], [0.55, 'rgba(204,225,217,.08)'], [1, 'rgba(204,225,217,0)']], 128);
    this.mistSpriteGroup = new THREE.Group();
    const rng = makeRng(29);
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color('#d5e5dd'), transparent: true, opacity: 0.22, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set((rng() - 0.5) * 19, 0.35 + rng() * 0.8, (rng() - 0.5) * 12);
      const scale = 2.5 + rng() * 4.5;
      sprite.scale.set(scale, 0.7 + rng() * 0.55, 1);
      sprite.userData.phase = rng() * TAU;
      sprite.userData.speed = 0.04 + rng() * 0.06;
      sprite.userData.baseX = sprite.position.x;
      this.mistSpriteGroup.add(sprite);
    }
    this.world.add(this.mistSpriteGroup);
  }

  buildFireflies() {
    const count = 110;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const rng = makeRng(711);
    for (let i = 0; i < count; i++) {
      const angle = rng() * TAU;
      const radius = 2.8 + rng() * 7.2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.7;
      const y = 0.5 + rng() * 3.1;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      this.fireflyBase.push({ x, y, z, phase: rng() * TAU, speed: 0.3 + rng() * 0.8 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const tex = radialTexture([[0, 'rgba(255,246,186,1)'], [0.25, 'rgba(255,222,132,.7)'], [1, 'rgba(255,222,132,0)']], 64);
    const mat = new THREE.PointsMaterial({
      size: 0.2,
      map: tex,
      color: new THREE.Color('#ffe8a3'),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.fireflies = new THREE.Points(geo, mat);
    this.fireflies.frustumCulled = false;
    this.world.add(this.fireflies);
  }

  buildStars() {
    const count = 260;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const rng = makeRng(442);
    for (let i = 0; i < count; i++) {
      const angle = rng() * TAU;
      const radius = 26 + rng() * 38;
      const y = 4 + rng() * 26;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const tex = radialTexture([[0, 'rgba(255,251,237,1)'], [0.3, 'rgba(251,242,214,.5)'], [1, 'rgba(251,242,214,0)']], 48);
    const mat = new THREE.PointsMaterial({
      size: 0.34,
      map: tex,
      color: new THREE.Color('#fff6de'),
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  buildVolumetric() {
    const tex = makeCanvasTexture(128, 512, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(255,244,218,0)');
      grad.addColorStop(0.18, 'rgba(255,244,218,.45)');
      grad.addColorStop(0.72, 'rgba(255,239,205,.12)');
      grad.addColorStop(1, 'rgba(255,239,205,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      const side = ctx.createLinearGradient(0, 0, w, 0);
      side.addColorStop(0, 'rgba(0,0,0,.5)');
      side.addColorStop(0.28, 'rgba(255,255,255,1)');
      side.addColorStop(0.72, 'rgba(255,255,255,1)');
      side.addColorStop(1, 'rgba(0,0,0,.5)');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = side;
      ctx.fillRect(0, 0, w, h);
    });
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      color: new THREE.Color('#ffe4b0'),
      toneMapped: false,
    });
    const group = new THREE.Group();
    const configs = [
      [-2.4, 7.6, -1.2, 4.2, 12.5, -0.17, 0.2],
      [2.0, 8.0, 0.9, 3.4, 13.5, 0.13, -0.35],
      [-5.0, 6.8, 2.3, 2.7, 10.5, -0.3, 0.5],
    ];
    for (const [x, y, z, w, h, rz, ry] of configs) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      plane.position.set(x, y, z);
      plane.rotation.z = rz;
      plane.rotation.y = ry;
      plane.renderOrder = 3;
      group.add(plane);
      this.godRays.push(plane);
    }
    this.volumetricGroup = group;
    this.world.add(group);
  }

  buildFloatingStones() {
    const rng = makeRng(118);
    const group = new THREE.Group();
    const colors = ['#5e685a', '#707565', '#4b574e'];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * TAU + 0.4;
      const stone = new THREE.Group();
      const r = 0.28 + rng() * 0.5;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stdMat(colors[i % 3], { roughness: 0.98, flatShading: true }));
      rock.scale.y = 0.65;
      rock.castShadow = true;
      stone.add(rock);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 8, 4, 0, TAU, 0, HALF_PI), stdMat('#668160', { roughness: 1 }));
      cap.scale.y = 0.22;
      cap.position.y = r * 0.32;
      stone.add(cap);
      stone.position.set(Math.cos(angle) * (11.3 + rng() * 2.4), 1.5 + rng() * 2.4, Math.sin(angle) * (8.2 + rng() * 1.7));
      stone.userData.phase = rng() * TAU;
      stone.userData.baseY = stone.position.y;
      stone.userData.rotSpeed = 0.05 + rng() * 0.08;
      group.add(stone);
      this.floatingStones = this.floatingStones || [];
      this.floatingStones.push(stone);
    }
    this.world.add(group);
  }

  buildButterflies() {
    const rng = makeRng(28);
    const colors = ['#f1cab5', '#f4db9f', '#c7c2ec'];
    for (let i = 0; i < 5; i++) {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(colors[i % colors.length]), roughness: 0.8, side: THREE.DoubleSide });
      const wingGeo = new THREE.CircleGeometry(0.09, 8);
      const wingL = new THREE.Mesh(wingGeo, mat);
      wingL.scale.x = 0.65;
      wingL.position.x = -0.055;
      const wingR = wingL.clone();
      wingR.position.x = 0.055;
      wingR.scale.x = -0.65;
      group.add(wingL, wingR);
      group.position.set((rng() - 0.5) * 4, 0.8 + rng() * 0.9, (rng() - 0.5) * 2 + 2.5);
      group.scale.setScalar(0.55 + rng() * 0.45);
      this.world.add(group);
      this.butterflies.push({
        group,
        wingL,
        wingR,
        phase: rng() * TAU,
        base: group.position.clone(),
        radius: 0.4 + rng() * 0.8,
      });
    }
  }

  /* ---------------- labels & interaction ---------------- */

  setupLabels() {
    for (const barn of this.state.barns) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'scene-label barn-label';
      el.dataset.type = 'barn';
      el.dataset.id = barn.barnId;
      el.innerHTML = `<span class="label-pin"></span><span class="label-main"><b>${barn.barnId}</b><span>${barn.name}</span></span><span class="label-meta"></span>`;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.select('barn', barn.barnId, true);
      });
      this.labelsEl.appendChild(el);
      this.labels.set(`barn:${barn.barnId}`, { el, type: 'barn', id: barn.barnId, anchor: this.barnAnchors.get(barn.barnId), visible: true });
    }
    for (const cow of this.state.cows.filter((c) => c.showcase && c.scene)) {
      const model = this.cowModels.get(cow.earTag);
      if (!model) continue;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'scene-label cow-label';
      el.dataset.type = 'cow';
      el.dataset.id = cow.earTag;
      el.innerHTML = `<span class="cow-dot"></span><span class="cow-tag">${cow.earTag}</span><span class="cow-name">${cow.name}</span>`;
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.select('cow', cow.earTag, true);
      });
      this.labelsEl.appendChild(el);
      this.labels.set(`cow:${cow.earTag}`, { el, type: 'cow', id: cow.earTag, model, visible: false });
    }
  }

  syncState(state) {
    this.state = state;
    if (!this.initialized && !this.barnB01) return;
    const barnMap = new Map(state.barns.map((b) => [b.barnId, b]));
    for (const barn of state.barns) {
      const label = this.labels.get(`barn:${barn.barnId}`);
      if (label) {
        const status = getBarnState(barn);
        label.el.classList.toggle('is-warning', status.level === 'watch');
        label.el.classList.toggle('is-danger', status.level === 'risk');
        const statusText = status.level === 'risk' ? '越限' : status.level === 'watch' ? '关注' : '舒适';
        label.el.querySelector('.label-meta').innerHTML = `<em>${barn.temperature.toFixed(1)}°</em><span class="nh3-dot"></span>${barn.nh3.toFixed(1)} ppm<small>${statusText}</small>`;
        label.el.classList.toggle('selected', this.selected?.type === 'barn' && this.selected.id === barn.barnId);
      }
    }
    for (const cow of state.cows.filter((c) => c.showcase)) {
      const model = this.cowModels.get(cow.earTag);
      const label = this.labels.get(`cow:${cow.earTag}`);
      if (model) {
        const statusColor = cow.healthStatus === 'risk' ? C.danger : cow.healthStatus === 'watch' ? C.watch : C.healthy;
        model.ringMat.color.set(statusColor);
        model.cow = cow;
      }
      if (label) {
        label.el.querySelector('.cow-tag').textContent = cow.earTag;
        label.el.querySelector('.cow-name').textContent = `${cow.name} · ${HEALTH_STATUS[cow.healthStatus]?.label || ''}`;
        label.el.classList.toggle('is-risk', cow.healthStatus === 'risk');
        label.el.classList.toggle('is-watch', cow.healthStatus === 'watch');
        label.el.classList.toggle('selected', this.selected?.type === 'cow' && this.selected.id === cow.earTag);
      }
    }
    const alarms = state.alarms.filter((a) => a.status === 'active');
    for (const [barnId, visual] of this.sensorVisuals) {
      const barn = barnMap.get(barnId);
      if (!barn) continue;
      const status = getBarnState(barn);
      const color = status.level === 'risk' ? C.danger : status.level === 'watch' ? C.watch : C.healthy;
      visual.beaconMat.color.set(color);
      visual.beaconMat.emissive.set(color);
      visual.ring.material.color.set(color);
      visual.light.color.set(color);
    }
    const deviceMap = new Map(state.devices.map((d) => [d.deviceId, d]));
    for (const fan of this.fans) {
      const device = deviceMap.get(fan.deviceId);
      fan.active = !!device?.running;
    }
    for (const heater of this.heaters) {
      const device = deviceMap.get(heater.deviceId);
      heater.active = !!device?.running;
      heater.glowMat.emissiveIntensity = heater.active ? 2.2 : 0.2;
      heater.light.intensity = heater.active ? 1.2 : 0;
    }
    for (const mist of this.mistSystems) {
      const device = deviceMap.get(mist.deviceId);
      mist.active = !!device?.running;
    }
    // 报警联动时，给牛舍标签一个呼吸状态
    this.alarmBarnIds = new Set(alarms.map((a) => a.barnId));
    for (const label of this.labels.values()) {
      if (label.type === 'barn') label.el.classList.toggle('has-alarm', this.alarmBarnIds.has(label.id));
    }
    this.updateAllBarnLamps();
  }

  setSelectedFromExternal(type, id) {
    this.selected = { type, id };
    for (const label of this.labels.values()) {
      label.el.classList.toggle('selected', label.type === type && label.id === id);
    }
    this.updateLabelHover();
  }

  select(type, id, focus = false) {
    this.selected = { type, id };
    for (const label of this.labels.values()) {
      label.el.classList.toggle('selected', label.type === type && label.id === id);
    }
    this.updateLabelHover();
    if (type === 'cow') {
      const model = this.cowModels.get(id);
      if (model) {
        model.statusRing.material.opacity = 0.65;
        if (focus) this.focusCow(id);
      }
    } else if (focus) {
      this.focusTarget(id);
    }
    this.onSelect(type, id);
  }

  handlePointerMove(event) {
    const now = performance.now();
    if (now - this.raycastTimer < 32) return;
    this.raycastTimer = now;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickable, false);
    if (hits.length) {
      const entity = hits[0].object.userData.entity;
      if (entity) {
        this.hovered = { type: entity.type, id: entity.id };
        this.canvas.style.cursor = 'pointer';
        this.updateLabelHover();
        return;
      }
    }
    this.hovered = null;
    this.canvas.style.cursor = '';
    this.updateLabelHover();
  }

  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.clickable, false);
    if (hits.length) {
      const entity = hits[0].object.userData.entity;
      if (entity) {
        this.select(entity.type, entity.id, true);
        return;
      }
    }
    this.hovered = null;
    this.updateLabelHover();
  }

  updateLabelHover() {
    for (const label of this.labels.values()) {
      if (label.type === 'cow') {
        const isHover = this.hovered?.type === 'cow' && this.hovered.id === label.id;
        const isSelected = this.selected?.type === 'cow' && this.selected.id === label.id;
        label.el.classList.toggle('is-visible', isHover || isSelected || this.options.cowTags);
        label.el.classList.toggle('is-hover', isHover);
      } else {
        label.el.classList.toggle('is-hover', this.hovered?.type === 'barn' && this.hovered.id === label.id);
      }
    }
    // 悬停时把牛只地环高亮
    for (const [tag, model] of this.cowModels) {
      const isHover = this.hovered?.type === 'cow' && this.hovered.id === tag;
      const isSelected = this.selected?.type === 'cow' && this.selected.id === tag;
      model.statusRing.material.opacity = isSelected ? 0.74 : isHover ? 0.56 : 0.3;
      model.targetRingScale = isSelected || isHover ? 1.05 : 1;
    }
  }

  showCowTag(tag) {
    const label = this.labels.get(`cow:${tag}`);
    if (label) label.el.classList.add('is-visible');
  }

  /* ---------------- camera ---------------- */

  introCamera() {
    const target = new THREE.Vector3(0, 0.95, 0);
    this.cameraTween = {
      start: performance.now(),
      duration: 2500,
      fromPos: new THREE.Vector3(26.5, 21, 31.5),
      toPos: new THREE.Vector3(19.5, 14.8, 23),
      fromTarget: new THREE.Vector3(0, 1.6, 0),
      toTarget: target,
      ease: easeOutCubic,
    };
    this.controls.enabled = false;
  }

  focusTarget(id) {
    let target;
    let offset;
    if (id === 'B01') {
      target = new THREE.Vector3(-4.3, 1.35, -2.2);
      offset = new THREE.Vector3(15.6, 10.4, 16.4);
    } else if (id === 'B02') {
      target = new THREE.Vector3(4.6, 1.1, -2.7);
      offset = new THREE.Vector3(15.2, 10.1, 16.0);
    } else if (id === 'B03') {
      target = new THREE.Vector3(6.15, 0.75, 3.15);
      offset = new THREE.Vector3(12.0, 8.3, 12.8);
    } else if (id === 'cows') {
      target = new THREE.Vector3(0.6, 0.9, 2.0);
      offset = new THREE.Vector3(14.6, 9.6, 15.4);
    } else {
      target = new THREE.Vector3(0, 0.95, 0);
      offset = new THREE.Vector3(19.5, 13.8, 23);
    }
    this.tweenCamera(target, target.clone().add(offset), 1400);
  }

  focusCow(earTag) {
    const model = this.cowModels.get(earTag);
    if (!model) return;
    const target = model.group.position.clone().add(new THREE.Vector3(0, 0.9 * model.scale, 0));
    const offset = new THREE.Vector3(10.0, 6.5, 11.5);
    this.tweenCamera(target, target.clone().add(offset), 1200);
  }

  tweenCamera(target, position, duration = 1200) {
    this.cameraTween = {
      start: performance.now(),
      duration,
      fromPos: this.camera.position.clone(),
      toPos: position,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      ease: easeInOutCubic,
    };
    this.controls.enabled = true;
  }

  updateCameraTween(now) {
    if (!this.cameraTween) return;
    const t = clamp((now - this.cameraTween.start) / this.cameraTween.duration, 0, 1);
    const e = this.cameraTween.ease(t);
    this.camera.position.lerpVectors(this.cameraTween.fromPos, this.cameraTween.toPos, e);
    this.controls.target.lerpVectors(this.cameraTween.fromTarget, this.cameraTween.toTarget, e);
    if (t >= 1) {
      this.cameraTween = null;
      this.controls.enabled = true;
    }
  }

  /* ---------------- time of day & animation ---------------- */

  applyDayNight() {
    if (!this.scene) return;
    const h = this.hour;
    const angle = ((h - 6) / 12) * Math.PI;
    const sunHeight = Math.sin(angle);
    const daylightRaw = smoothstep(-0.08, 0.22, sunHeight);
    this.daylight = daylightRaw;
    const twilight = Math.max(0, 1 - Math.abs(sunHeight - 0.1) / 0.38);
    const night = 1 - daylightRaw;

    this.sun.position.set(Math.cos(angle) * -16, 2.5 + sunHeight * 14.5, 9.5);
    this.sun.intensity = Math.max(0, daylightRaw * 1.82 + 0.02);
    const sunColor = new THREE.Color('#ff9d67').lerp(new THREE.Color('#fff0d1'), smoothstep(0.03, 0.48, sunHeight));
    this.sun.color.copy(sunColor);
    this.moon.position.set(Math.cos(angle + Math.PI) * 12, 4 + (1 - sunHeight) * 9, -10);
    this.moon.intensity = night * 0.18;
    this.hemi.intensity = 0.055 + daylightRaw * 0.51 + twilight * 0.025;
    const skyColor = new THREE.Color('#1b2a34').lerp(new THREE.Color('#c4dfdb'), daylightRaw);
    skyColor.lerp(new THREE.Color('#e8b994'), twilight * 0.25);
    this.hemi.color.copy(skyColor);
    this.hemi.groundColor.copy(new THREE.Color('#151b14').lerp(new THREE.Color('#565642'), daylightRaw));
    this.fill.intensity = 0.035 + daylightRaw * 0.19;
    this.rim.intensity = 0.1 + twilight * 0.56;
    this.fill.color.copy(new THREE.Color('#5d8194').lerp(new THREE.Color('#b6dbd4'), daylightRaw));
    this.rim.color.copy(new THREE.Color('#edb48a'));
    this.scene.environmentIntensity = 0.12 + daylightRaw * 0.32;
    this.renderer.toneMappingExposure = this.options.exposure * (0.7 + daylightRaw * 0.24);
    if (this.scene.fog) {
      const fogColor = new THREE.Color('#07110f').lerp(new THREE.Color('#12231d'), daylightRaw);
      fogColor.lerp(new THREE.Color('#2c2620'), twilight * 0.22);
      this.scene.fog.color.copy(fogColor);
      this.scene.fog.density = 0.0125 + night * 0.007;
    }
    if (this.cloudMaterial) {
      const cloudColor = new THREE.Color('#3d4d54').lerp(new THREE.Color('#d9e1d7'), daylightRaw);
      cloudColor.lerp(new THREE.Color('#d9b099'), twilight * 0.3);
      this.cloudMaterial.color.copy(cloudColor);
      this.cloudMaterial.opacity = 0.28 + daylightRaw * 0.22;
    }
    if (this.stars) this.stars.material.opacity = 0.06 + night * 0.62;
    if (this.fireflies) this.fireflies.material.opacity = 0.04 + night * 0.82;
    if (this.volumetricGroup) {
      this.volumetricGroup.visible = (this.preset?.volumetric ?? true) && !!this.options.volumetric;
      const mat = this.volumetricGroup.children[0]?.material;
      if (mat) mat.opacity = 0.014 + daylightRaw * 0.024 + twilight * 0.022;
    }
    for (const light of this.interiorLights) {
      light.intensity = (light.userData.base || 1) * (0.2 + night * 0.95);
    }
    for (const mat of this.windowMaterials) {
      if (mat.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = mat.userData?.baseEmissive ?? (0.5 + night * 1.5);
      }
    }
    this.updateAllBarnLamps();
    const info = daylightLabel(this.hour);
    this.onTime({
      hour: this.hour,
      clock: fmtClock(this.hour),
      daylight: daylightRaw,
      phase: info.label,
      icon: info.icon,
      auto: this.options.autoDaylight,
    });
  }

  updateAllBarnLamps() {
    const night = 1 - this.daylight;
    for (const bulb of this.stringBulbs) {
      if (!bulb.material || bulb.material.emissiveIntensity === undefined) continue;
      bulb.material.emissiveIntensity = (bulb.base ?? 1) * (0.28 + night * 1.15);
    }
  }

  setHour(hour) {
    this.hour = ((hour % 24) + 24) % 24;
    this.applyDayNight();
  }

  setAutoDaylight(enabled) {
    this.options.autoDaylight = !!enabled;
    this.applyDayNight();
  }

  setOptions(partial = {}) {
    const { quality, ...rest } = partial;
    Object.assign(this.options, rest);
    if ('autoRotate' in rest) {
      this.controls.autoRotate = !!rest.autoRotate;
    }
    if ('labels' in rest) {
      this.updateLabelHover();
    }
    if ('cowTags' in rest) this.updateLabelHover();
    if ('fog' in rest) {
      this.scene.fog = rest.fog ? new THREE.FogExp2(new THREE.Color('#0a1713'), 0.017) : null;
      this.applyDayNight();
    }
    if ('clouds' in rest && this.clouds) this.clouds.visible = !!rest.clouds;
    if ('fireflies' in rest && this.fireflies) this.fireflies.visible = !!rest.fireflies;
    if ('bloom' in rest && this.bloomPass) this.bloomPass.strength = rest.bloom;
    if ('exposure' in rest) this.renderer.toneMappingExposure = rest.exposure * (0.84 + this.daylight * 0.2);
    if ('daylightSpeed' in rest) this.options.daylightSpeed = rest.daylightSpeed;
    if ('autoDaylight' in rest) this.setAutoDaylight(rest.autoDaylight);
    // 画质档位与开关是叠加关系，统一次重算
    if ('tiltShift' in rest || 'volumetric' in rest || 'bloom' in rest) this.refreshFeatures();
    if (quality !== undefined) this.setQuality(quality);
  }

  setPaused(paused) {
    const next = !!paused;
    if (this.paused === next) return;
    this.paused = next;
    this.clock.getDelta();
    this._fpsFrames = 0;
    this._fpsStart = 0;
    if (!next && this.initialized) {
      this._warmupUntil = performance.now() + 1200;
      this.applyDayNight();
    }
  }

  animate() {
    if (!this.renderer) return;
    this.raf = requestAnimationFrame(() => this.animate());
    const now = performance.now();
    if (this.paused) {
      // 大屏打开时暂停 WebGL 渲染，但保留轻量的模拟时钟，让时间仍然向前。
      const dt = Math.min(this.clock.getDelta(), 0.15);
      if (this.options.autoDaylight) {
        this.hour = (this.hour + dt * DAY_SECONDS * this.options.daylightSpeed) % 24;
        const sunHeight = Math.sin(((this.hour - 6) / 12) * Math.PI);
        this.daylight = smoothstep(-0.08, 0.22, sunHeight);
        if (now - this.lastTimeReport > 900) {
          const phase = daylightLabel(this.hour);
          this.onTime({ hour: this.hour, clock: fmtClock(this.hour), daylight: this.daylight, phase: phase.label, icon: phase.icon, auto: true });
          this.lastTimeReport = now;
        }
      }
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.clockTime += dt;
    if (this.options.autoDaylight) {
      const prevHour = this.hour;
      this.hour = (this.hour + dt * DAY_SECONDS * this.options.daylightSpeed) % 24;
      if (this.hour < prevHour || now - this.lastTimeReport > 450) {
        this.applyDayNight();
        this.lastTimeReport = now;
      }
    }
    this.updateCameraTween(now);
    this.controls.autoRotate = this.options.autoRotate;
    this.controls.update(dt);
    // 阳光随时间缓慢移动：阴影不必每帧重算，隔帧刷新肉眼无感
    if (this.renderer.shadowMap.enabled && !this.preset.shadowEveryFrame) {
      this._shadowTick = (this._shadowTick + 1) % 2;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = this._shadowTick === 0;
    }
    this.animateFans(dt);
    this.animateCows(dt);
    this.animateMist(dt);
    this.animateClouds(dt);
    this.animateFireflies(dt);
    this.animateButterflies(dt);
    this.animateWater(dt);
    this.animateMisc(dt);
    this.updateLabels();
    this.renderer.info.reset();
    this.composer.render(dt);
    this.samplePerf(now);
  }

  animateFans(dt) {
    for (const fan of this.fans) {
      const target = fan.active ? fan.speed : 0;
      fan.current += (target - fan.current) * Math.min(1, dt * 1.8);
      fan.blades.rotation.z += fan.current * dt;
    }
  }

  animateCows(dt) {
    const t = this.clockTime;
    for (const model of this.cowModels.values()) {
      const p = model.phase;
      const speed = model.wander ? 0.5 : 1;
      model.bodyPivot.position.y = Math.sin(t * 1.4 * speed + p) * 0.012;
      model.bodyPivot.rotation.z = Math.sin(t * 0.6 * speed + p) * 0.012;
      model.head.rotation.y = Math.sin(t * 0.65 + p) * 0.1;
      model.head.rotation.z = Math.sin(t * 0.55 + p * 1.3) * 0.035;
      if (model.ears) {
        model.ears[0].rotation.z = -0.15 + Math.sin(t * 1.7 + p) * 0.06;
        model.ears[1].rotation.z = 0.25 + Math.sin(t * 1.5 + p + 0.4) * 0.07;
      }
      model.tailGroup.rotation.z = Math.sin(t * 1.6 + p) * 0.18 + 0.04;
      model.tailGroup.rotation.x = Math.sin(t * 1.1 + p) * 0.08;
      if (model.wander) {
        const wanderT = t * 0.1 + p;
        model.group.position.x = model.basePos.x + Math.cos(wanderT) * model.range;
        model.group.position.z = model.basePos.z + Math.sin(wanderT * 0.84) * model.range * 0.7;
        model.group.rotation.y = model.baseRotation + Math.sin(wanderT) * 0.3;
        const legSwing = Math.sin(t * 2.1 + p) * 0.1;
        model.legs.forEach((leg, i) => {
          leg.rotation.x = legSwing * (i % 2 === 0 ? 1 : -1);
        });
      } else {
        model.legs.forEach((leg, i) => {
          leg.rotation.x += (0 - leg.rotation.x) * Math.min(1, dt * 3);
        });
      }
      const ringTarget = model.targetRingScale;
      model.statusRing.scale.x += (ringTarget - model.statusRing.scale.x) * Math.min(1, dt * 7);
      model.statusRing.scale.y = model.statusRing.scale.x;
      const pulse = model.group.userData.pulse;
      if (pulse) {
        const cycle = (t * 0.6 + p) % 1;
        pulse.scale.setScalar(1 + cycle * 0.7);
        pulse.material.opacity = 0.22 * (1 - cycle);
      }
    }
  }

  animateMist(dt) {
    for (const mist of this.mistSystems) {
      const targetOpacity = mist.active ? 0.38 : 0;
      mist.material.opacity += (targetOpacity - mist.material.opacity) * Math.min(1, dt * 1.8);
      if (mist.material.opacity < 0.01) continue;
      const posAttr = mist.points.geometry.attributes.position;
      const time = this.clockTime;
      for (let i = 0; i < posAttr.count; i++) {
        const base = mist.positions[i * 3 + 1];
        posAttr.array[i * 3 + 1] -= dt * (0.15 + (mist.seeds[i * 3] % 0.2));
        if (posAttr.array[i * 3 + 1] < 0.4) posAttr.array[i * 3 + 1] = base + 1.1;
        posAttr.array[i * 3] += Math.sin(time * 0.7 + mist.seeds[i * 3 + 1]) * dt * 0.08;
      }
      posAttr.needsUpdate = true;
    }
    if (this.mistSpriteGroup) {
      for (const sprite of this.mistSpriteGroup.children) {
        sprite.position.x = sprite.userData.baseX + Math.sin(this.clockTime * sprite.userData.speed + sprite.userData.phase) * 2.8;
        sprite.material.opacity = (this.options.fog ? 0.18 : 0.04) * (0.7 + Math.sin(this.clockTime * 0.2 + sprite.userData.phase) * 0.3);
      }
      this.mistSpriteGroup.visible = this.options.fog;
    }
  }

  animateClouds(dt) {
    if (!this.clouds || !this.options.clouds) return;
    for (const cloud of this.cloudMeshes) {
      cloud.position.x += cloud.userData.speed * dt;
      cloud.position.y += Math.sin(this.clockTime * 0.2 + cloud.userData.phase) * dt * 0.008;
      if (cloud.position.x > 16) cloud.position.x = -16;
      if (cloud.position.x < -16) cloud.position.x = 16;
    }
  }

  animateFireflies(dt) {
    if (!this.fireflies) return;
    this.fireflies.visible = this.options.fireflies;
    if (!this.fireflies.visible) return;
    const posAttr = this.fireflies.geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const base = this.fireflyBase[i];
      posAttr.array[i * 3] = base.x + Math.sin(this.clockTime * base.speed + base.phase) * 0.5;
      posAttr.array[i * 3 + 1] = base.y + Math.sin(this.clockTime * base.speed * 1.4 + base.phase * 2) * 0.24;
      posAttr.array[i * 3 + 2] = base.z + Math.cos(this.clockTime * base.speed * 0.8 + base.phase) * 0.35;
    }
    posAttr.needsUpdate = true;
    this.fireflies.rotation.y = this.clockTime * 0.002;
  }

  animateButterflies(dt) {
    for (const b of this.butterflies) {
      const t = this.clockTime + b.phase;
      b.group.position.set(
        b.base.x + Math.sin(t * 0.4) * b.radius,
        b.base.y + Math.sin(t * 0.9) * 0.22,
        b.base.z + Math.cos(t * 0.33) * b.radius * 0.55,
      );
      const flap = Math.sin(t * 8) * 0.7;
      b.wingL.rotation.y = flap;
      b.wingR.rotation.y = -flap;
      if (this.daylight < 0.12) b.group.visible = false;
      else b.group.visible = true;
    }
  }

  animateWater(dt) {
    if (!this.water) return;
    for (const ripple of this.ripples) {
      const cycle = (this.clockTime * 0.22 + ripple.phase / TAU) % 1;
      ripple.mesh.scale.setScalar(ripple.base + cycle * 2.1);
      ripple.mesh.material.opacity = 0.2 * (1 - cycle);
    }
    for (const duck of this.ducks) {
      duck.mesh.position.y = duck.baseY + Math.sin(this.clockTime * 1.2 + duck.phase) * 0.012;
      duck.mesh.rotation.y = Math.sin(this.clockTime * 0.25 + duck.phase) * 0.16 + (duck.phase > 1 ? 2.3 : 0.2);
    }
  }

  animateMisc(dt) {
    if (this.windmillBlades) this.windmillBlades.rotation.z += dt * 0.28;
    if (this.windBeacon) {
      const blink = 0.3 + Math.abs(Math.sin(this.clockTime * 1.2)) * 1.2;
      this.windBeacon.material.emissiveIntensity = this.daylight < 0.3 ? blink : 0.12;
    }
    if (this.floatingStones) {
      for (const stone of this.floatingStones) {
        stone.position.y = stone.userData.baseY + Math.sin(this.clockTime * 0.5 + stone.userData.phase) * 0.12;
        stone.rotation.y += stone.userData.rotSpeed * dt;
      }
    }
    if (this.b06Topper) {
      this.b06Topper.rotation.y += dt * 0.35;
      this.b06Topper.rotation.z = Math.sin(this.clockTime * 0.6) * 0.08;
    }
    if (this.sensorVisuals) {
      for (const visual of this.sensorVisuals.values()) {
        const pulse = (this.clockTime * 0.55) % 1;
        visual.ring.scale.setScalar(1 + pulse * 1.7);
        visual.ring.material.opacity = 0.35 * (1 - pulse);
      }
    }
    if (this.godRays) {
      for (let i = 0; i < this.godRays.length; i++) {
        this.godRays[i].rotation.z += Math.sin(this.clockTime * 0.1 + i) * dt * 0.002;
      }
    }
  }

  updateLabels() {
    const width = this.width || window.innerWidth;
    const height = this.height || window.innerHeight;
    const cameraPos = this.camera.position;
    const vec = this._labelVec || (this._labelVec = new THREE.Vector3());
    const projected = this._projVec;
    for (const label of this.labels.values()) {
      let worldPos;
      if (label.type === 'cow') {
        const model = label.model;
        if (!model) continue;
        worldPos = vec.copy(model.group.position);
        worldPos.y += 1.75 * model.scale;
      } else {
        worldPos = vec.copy(label.anchor || this.barnAnchors.get(label.id));
      }
      projected.copy(worldPos).project(this.camera);
      const isVisibleByOption = label.type === 'barn'
        ? this.options.labels
        : (this.options.cowTags || (this.selected?.type === 'cow' && this.selected.id === label.id) || (this.hovered?.type === 'cow' && this.hovered.id === label.id));
      const behind = projected.z > 1;
      const dist = cameraPos.distanceTo(worldPos);
      const farFade = label.type === 'cow'
        ? (label.id === this.selected?.id ? 0.94 : clamp(1.3 - dist / 38, 0.72, 1))
        : clamp(1.25 - dist / 42, 0.55, 1);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const show = !behind && isVisibleByOption && x > 8 && x < width - 8 && y > 40 && y < height - 8;
      label.el.style.opacity = show ? String(farFade) : '0';
      label.el.style.pointerEvents = show ? 'auto' : 'none';
      label.el.style.transform = `translate(-50%, -100%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      label.el.classList.toggle('is-out', !show);
    }
  }

  getPhaseInfo() {
    const phase = daylightLabel(this.hour);
    return {
      hour: this.hour,
      clock: fmtClock(this.hour),
      daylight: this.daylight,
      ...phase,
      phase: phase.label,
    };
  }

  /* ---------------- utilities ---------------- */

  isInsideBarn(x, z, margin = 0) {
    return (
      (x > -7.9 - margin && x < -0.6 + margin && z > -5.1 - margin && z < 0.6 + margin) ||
      (x > 1.1 - margin && x < 8.1 + margin && z > -5.3 - margin && z < -0.2 + margin) ||
      (Math.hypot(x - 6.15, z - 3.15) < 3.0 + margin)
    );
  }

  isInsidePond(x, z, margin = 0) {
    return Math.hypot((x + 5.9) / (2.7 + margin), (z - 4.35) / (1.9 + margin)) < 1;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.renderer.dispose();
    this.scene?.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
