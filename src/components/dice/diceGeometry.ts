import {
  BoxGeometry, BufferGeometry, DodecahedronGeometry, IcosahedronGeometry,
  OctahedronGeometry, TetrahedronGeometry, Matrix4, Quaternion, Vector3,
} from 'three';
import type { DieSides } from './dicePresentation';

export interface DieFace {
  vertices: Vector3[];
  normal: Vector3;
  center: Vector3;
  tangent: Vector3;
  bitangent: Vector3;
  radius: number;
  value: number;
}
export interface DieShape { sides: DieSides; vertices: Vector3[]; faces: DieFace[] }
const UP = new Vector3(0, 0, 1);

function faceFromVertices(vertices: Vector3[]): DieFace {
  const center = vertices.reduce((sum, v) => sum.add(v), new Vector3()).divideScalar(vertices.length);
  const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();
  if (normal.dot(center) < 0) normal.negate();
  const tangent = vertices[0].clone().sub(center).normalize();
  const bitangent = normal.clone().cross(tangent).normalize();
  vertices.sort((a, b) => {
    const av = a.clone().sub(center), bv = b.clone().sub(center);
    return Math.atan2(av.dot(bitangent), av.dot(tangent)) - Math.atan2(bv.dot(bitangent), bv.dot(tangent));
  });
  // Inscribed radius gives face labels clearance from every edge, including d10 kites.
  const radius = Math.min(...vertices.map((a, i) => {
    const edge = vertices[(i + 1) % vertices.length].clone().sub(a);
    return center.clone().sub(a).cross(edge).length() / edge.length();
  }));
  return { vertices, normal, center, tangent, bitangent, radius, value: 0 };
}

function extractFaces(geometry: BufferGeometry): Vector3[][] {
  const expanded = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = expanded.getAttribute('position');
  const groups: { normal: Vector3; distance: number; vertices: Vector3[] }[] = [];
  for (let i = 0; i < position.count; i += 3) {
    const triangle = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(position, i + offset));
    const normal = triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).normalize();
    const distance = normal.dot(triangle[0]);
    let group = groups.find(f => f.normal.dot(normal) > 0.99999 && Math.abs(f.distance - distance) < 1e-5);
    if (!group) { group = { normal, distance, vertices: [] }; groups.push(group); }
    for (const vertex of triangle) if (!group.vertices.some(v => v.distanceTo(vertex) < 1e-5)) group.vertices.push(vertex);
  }
  expanded.dispose();
  if (expanded !== geometry) geometry.dispose();
  return groups.map(group => group.vertices);
}

/** Ten kite faces: a pentagonal trapezohedron, not a decagonal prism/bipyramid. */
function trapezohedron(): Vector3[][] {
  const height = 1.2;
  const ringHeight = height * Math.tan(Math.PI / 10) ** 2;
  const ring = Array.from({ length: 10 }, (_, i) => new Vector3(
    Math.cos(i * Math.PI / 5), Math.sin(i * Math.PI / 5), i % 2 === 0 ? ringHeight : -ringHeight,
  ));
  const top = new Vector3(0, 0, height), bottom = new Vector3(0, 0, -height);
  return Array.from({ length: 10 }, (_, i) => [
    i % 2 === 0 ? top.clone() : bottom.clone(),
    ring[i].clone(), ring[(i + 1) % 10].clone(), ring[(i + 2) % 10].clone(),
  ]);
}

export function createDieShape(sides: DieSides): DieShape {
  let polygons: Vector3[][];
  switch (sides) {
    case 4: polygons = extractFaces(new TetrahedronGeometry(1)); break;
    case 6: polygons = extractFaces(new BoxGeometry(1.08, 1.08, 1.08)); break;
    case 8: polygons = extractFaces(new OctahedronGeometry(1)); break;
    case 10: polygons = trapezohedron(); break;
    case 12: polygons = extractFaces(new DodecahedronGeometry(1)); break;
    case 20: polygons = extractFaces(new IcosahedronGeometry(1)); break;
  }
  const faces = polygons.map(faceFromVertices);
  const vertices: Vector3[] = [];
  faces.forEach(face => face.vertices.forEach(v => {
    if (!vertices.some(existing => existing.distanceTo(v) < 1e-5)) vertices.push(v.clone());
  }));
  // Fixed opposite sums for the centrally symmetric dice, including the d10.
  let low = 1;
  for (const face of faces) {
    if (face.value) continue;
    face.value = low;
    const opposite = faces.filter(f => f !== face && !f.value)
      .sort((a, b) => a.normal.dot(face.normal) - b.normal.dot(face.normal))[0];
    if (opposite && sides !== 4) opposite.value = sides + 1 - low;
    low++;
  }
  return { sides, vertices, faces };
}

/** Rotate a fixed numbered mesh; never relabel faces to fabricate the recorded outcome. */
export function getResultRotation(shape: DieShape, value: number): Quaternion {
  if (!Number.isInteger(value) || value < 1 || value > shape.sides) throw new Error('Invalid die result');
  if (shape.sides === 4) return new Quaternion().setFromUnitVectors(shape.vertices[value - 1].clone().normalize(), UP);
  const face = shape.faces.find(f => f.value === value)!;
  // Map label horizontal/vertical axes to the tabletop axes so the winning face is readable.
  const basis = new Matrix4().makeBasis(face.tangent, face.bitangent, face.normal);
  return new Quaternion().setFromRotationMatrix(basis).invert();
}
