import {
  ACESFilmicToneMapping, AmbientLight, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  EdgesGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh,
  MeshPhysicalMaterial, OrthographicCamera, PCFSoftShadowMap, PlaneGeometry, Quaternion,
  Scene, ShadowMaterial, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { createDieShape, getResultRotation, type DieShape } from './diceGeometry';
import type { DisplayDie } from './dicePresentation';
import { drawCenteredDieLabel, drawPlotFace } from './diceLabels';

const PALETTE: Record<number, string> = { 4: '#8050b9', 6: '#b87928', 8: '#238baf', 10: '#27826c', 12: '#365fac', 20: '#5849a6' };
const CELL = 256;
const UP = new Vector3(0, 0, 1);

function seededRandom(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ state >>> 15, 1 | state);
    state ^= state + Math.imul(state ^ state >>> 7, 61 | state);
    return ((state ^ state >>> 14) >>> 0) / 4294967296;
  };
}

/** A numbered atlas is fixed per die type, shared by all copies in a batch. */
function makeDieAsset(die: DisplayDie) {
  const shape = createDieShape(die.sides);
  const columns = Math.ceil(Math.sqrt(shape.faces.length)), rows = Math.ceil(shape.faces.length / columns);
  const canvas = document.createElement('canvas');
  canvas.width = columns * CELL;
  canvas.height = rows * CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Dice face canvas unavailable');
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [];
  const base = die.kind === 'plot' ? '#863953' : die.kind === 'percentile-tens' ? '#246f79' : PALETTE[die.sides];
  shape.faces.forEach((face, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    const ox = column * CELL, oy = row * CELL;
    const local = face.vertices.map(v => {
      const relative = v.clone().sub(face.center);
      return { x: relative.dot(face.tangent), y: relative.dot(face.bitangent) };
    });
    const extent = Math.max(...local.flatMap(v => [Math.abs(v.x), Math.abs(v.y)])) * 1.06;
    const pixels = CELL / (2 * extent);
    const centerX = ox + CELL / 2, centerY = oy + CELL / 2;
    const gradient = ctx.createLinearGradient(ox, oy, ox + CELL, oy + CELL);
    gradient.addColorStop(0, new Color(base).multiplyScalar(1.32).getStyle());
    gradient.addColorStop(1, base);
    ctx.fillStyle = gradient;
    ctx.fillRect(ox, oy, CELL, CELL);
    // A fine inset edge makes facets legible without changing the actual solid.
    ctx.beginPath();
    local.forEach((v, i) => {
      const x = centerX + v.x * pixels * 0.91, y = centerY - v.y * pixels * 0.91;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(244,225,190,0.32)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff4db';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (die.sides === 4) {
      face.vertices.forEach((vertex, vertexIndex) => {
        const value = shape.vertices.findIndex(v => v.distanceTo(vertex) < 1e-5) + 1;
        const v = local[vertexIndex];
        ctx.save();
        ctx.translate(centerX + v.x * pixels * 0.56, centerY - v.y * pixels * 0.56);
        // Each corner label reads toward its vertex on all three adjoining faces.
        ctx.rotate(Math.atan2(-v.y, v.x) + Math.PI / 2);
        const fontSize = face.radius * pixels * 0.86;
        ctx.font = `bold ${fontSize}px Georgia, serif`;
        drawCenteredDieLabel(ctx, String(value), 0, 0, fontSize);
        ctx.restore();
      });
    } else if (die.kind === 'plot') {
      drawPlotFace(ctx, face.value, centerX, centerY, face.radius * pixels);
    } else {
      const value = die.kind === 'percentile-tens' ? `${face.value % 10}0`
        : die.kind === 'percentile-ones' ? String(face.value % 10) : String(face.value);
      const fontSize = face.radius * pixels * (value.length > 1 ? 1.22 : 1.65);
      ctx.font = `bold ${fontSize}px Georgia, serif`;
      drawCenteredDieLabel(ctx, value, centerX, centerY, fontSize, value === '6' || value === '9');
    }
    for (let i = 1; i < face.vertices.length - 1; i++) {
      for (const vertexIndex of [0, i, i + 1]) {
        positions.push(...face.vertices[vertexIndex].toArray());
        normals.push(...face.normal.toArray());
        const v = local[vertexIndex];
        uvs.push((column + 0.5 + v.x / (2 * extent)) / columns, 1 - (row + 0.5 - v.y / (2 * extent)) / rows);
      }
    }
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  const material = new MeshPhysicalMaterial({ map: texture, roughness: 0.34, metalness: 0.16, clearcoat: 0.55, clearcoatRoughness: 0.25 });
  const edges = new EdgesGeometry(geometry, 12);
  const edgeMaterial = new LineBasicMaterial({ color: '#f9e8c7', transparent: true, opacity: 0.24 });
  return { shape, geometry, material, texture, edges, edgeMaterial };
}

interface AnimatedDie {
  group: Group;
  shape: DieShape;
  end: Quaternion;
  axis: Vector3;
  turns: number;
  delay: number;
  side: number;
  drift: number;
  x: number;
  y: number;
}
export interface DiceRenderer { dispose: () => void }

export function createDiceRenderer(
  host: HTMLElement,
  dice: DisplayDie[],
  callbacks: { onSettled: () => void; onError: () => void },
): DiceRenderer {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new Scene();
  const camera = new OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
  camera.position.set(0, -8, 22);
  camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight('#cadfff', 2));
  const light = new DirectionalLight('#fff1d8', 4);
  light.position.set(-7, -5, 15);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 50;
  light.shadow.normalBias = 0.035;
  light.shadow.bias = -0.0005;
  scene.add(light);
  const fill = new DirectionalLight('#9dc5ff', 2.5);
  fill.position.set(8, 6, 5);
  scene.add(fill);
  const floorGeometry = new PlaneGeometry(200, 200);
  const floorMaterial = new ShadowMaterial({ opacity: 0.3 });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.receiveShadow = true;
  floor.position.z = -0.015;
  scene.add(floor);

  const assets = new Map<string, ReturnType<typeof makeDieAsset>>();
  const animated: AnimatedDie[] = [];
  let frame = 0, disposed = false, settled = false, width = 20, started = 0;
  let observer: ResizeObserver | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    for (const asset of assets.values()) {
      asset.geometry.dispose(); asset.material.dispose(); asset.texture.dispose();
      asset.edges.dispose(); asset.edgeMaterial.dispose();
    }
    floorGeometry.dispose(); floorMaterial.dispose();
    light.shadow.map?.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
  const fail = () => { dispose(); callbacks.onError(); };
  const contextLost = (event: Event) => { event.preventDefault(); fail(); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);

  const place = (elapsed: number) => {
    let allSettled = true;
    for (const item of animated) {
      const p = Math.max(0, Math.min(1, (elapsed - item.delay) / 1550));
      const remaining = (1 - p) ** 3;
      item.group.visible = elapsed >= item.delay;
      allSettled &&= p === 1;
      item.group.quaternion.setFromAxisAngle(item.axis, item.turns * remaining).multiply(item.end);
      let lowest = Infinity;
      for (const vertex of item.shape.vertices) lowest = Math.min(lowest, vertex.clone().applyQuaternion(item.group.quaternion).z);
      item.group.position.set(
        item.x + item.side * (width * 0.55 + 2) * remaining,
        item.y + Math.sin(p * Math.PI) * item.drift,
        -lowest + Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p) ** 2 * 3.4,
      );
    }
    return allSettled;
  };
  const resize = () => {
    if (disposed) return;
    try {
      const rect = host.getBoundingClientRect();
      const w = Math.max(1, rect.width), h = Math.max(1, rect.height), aspect = w / h;
      renderer.setSize(w, h);
      const columns = Math.max(1, Math.min(dice.length, Math.ceil(Math.sqrt(dice.length * aspect))));
      const rows = Math.ceil(dice.length / columns);
      const height = Math.max(7, rows * 2.75 + 1.5, (columns * 2.75 + 1.5) / aspect);
      width = height * aspect;
      camera.left = -width / 2; camera.right = width / 2;
      camera.top = height / 2; camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      light.shadow.camera.left = -width; light.shadow.camera.right = width;
      light.shadow.camera.top = height; light.shadow.camera.bottom = -height;
      light.shadow.camera.updateProjectionMatrix();
      animated.forEach((item, i) => {
        const row = Math.floor(i / columns);
        const rowCount = Math.min(columns, dice.length - row * columns);
        item.x = (i % columns - (rowCount - 1) / 2) * 2.75;
        item.y = ((rows - 1) / 2 - row) * 2.9 - 0.35;
      });
      place(settled ? 10000 : Math.max(0, performance.now() - started));
      renderer.render(scene, camera);
    } catch { fail(); }
  };
  try {
    dice.forEach((die, index) => {
      const key = `${die.sides}-${die.kind}`;
      let asset = assets.get(key);
      if (!asset) { asset = makeDieAsset(die); assets.set(key, asset); }
      const group = new Group();
      const mesh = new Mesh(asset.geometry, asset.material);
      mesh.castShadow = true;
      group.add(mesh, new LineSegments(asset.edges, asset.edgeMaterial));
      scene.add(group);
      const random = seededRandom(die.id);
      const end = getResultRotation(asset.shape, die.value);
      end.premultiply(new Quaternion().setFromAxisAngle(UP, (random() - 0.5) * 0.4));
      animated.push({
        group, shape: asset.shape, end, axis: new Vector3(random() + 0.2, random() + 0.2, random()).normalize(),
        turns: Math.PI * (4 + random() * 4), delay: index * 25, side: random() > 0.5 ? 1 : -1,
        drift: (random() - 0.5) * 4, x: 0, y: 0,
      });
    });
    started = performance.now();
    observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const tick = (now: number) => {
      if (disposed) return;
      try {
        settled = place(now - started);
        renderer.render(scene, camera);
        if (settled) callbacks.onSettled();
        else frame = requestAnimationFrame(tick);
      } catch { fail(); }
    };
    frame = requestAnimationFrame(tick);
  } catch (error) { dispose(); throw error; }
  return { dispose };
}
