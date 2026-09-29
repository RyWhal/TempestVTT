import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { createDieShape, getResultRotation } from './diceGeometry';

const UP = new Vector3(0, 0, 1);
describe('physical dice geometry', () => {
  it.each([[4, 4, 3], [6, 8, 4], [8, 6, 3], [10, 12, 4], [12, 20, 5], [20, 12, 3]] as const)(
    'd%i has the correct vertices and planar faces', (sides, vertices, corners) => {
      const shape = createDieShape(sides);
      expect(shape.vertices).toHaveLength(vertices);
      expect(shape.faces).toHaveLength(sides);
      const edges = new Map<string, number>();
      for (const face of shape.faces) {
        expect(face.vertices).toHaveLength(corners);
        expect(face.normal.dot(face.center)).toBeGreaterThan(0);
        for (const v of face.vertices) expect(Math.abs(v.clone().sub(face.center).dot(face.normal))).toBeLessThan(1e-5);
        face.vertices.forEach((v, i) => {
          const a = shape.vertices.findIndex(p => p.distanceTo(v) < 1e-5);
          const b = shape.vertices.findIndex(p => p.distanceTo(face.vertices[(i + 1) % corners]) < 1e-5);
          const key = [a, b].sort((x, y) => x - y).join('-');
          edges.set(key, (edges.get(key) ?? 0) + 1);
        });
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      expect(vertices - edges.size + sides).toBe(2);
    }
  );
  it.each([6, 8, 10, 12, 20] as const)('d%i places each fixed result face upwards', sides => {
    const shape = createDieShape(sides);
    expect(shape.faces.map(f => f.value).sort((a, b) => a - b)).toEqual(Array.from({ length: sides }, (_, i) => i + 1));
    for (let value = 1; value <= sides; value++) {
      const rotation = getResultRotation(shape, value);
      const face = shape.faces.find(f => f.value === value)!;
      expect(face.normal.clone().applyQuaternion(rotation).dot(UP)).toBeCloseTo(1, 5);
      {
        const opposite = shape.faces.find(f => f.normal.dot(face.normal) < -0.9999)!;
        expect(opposite.value + face.value).toBe(sides + 1);
      }
    }
  });
  it('d4 uses vertex labels and places the rolled vertex above its resting face', () => {
    const shape = createDieShape(4);
    for (let value = 1; value <= 4; value++) {
      const rotation = getResultRotation(shape, value);
      expect(shape.vertices[value - 1].clone().normalize().applyQuaternion(rotation).dot(UP)).toBeCloseTo(1, 5);
      const down = shape.faces.filter(f => f.normal.clone().applyQuaternion(rotation).dot(UP) < -0.9999);
      expect(down).toHaveLength(1);
    }
  });
  it('rejects invalid result values instead of showing an arbitrary face', () => {
    expect(() => getResultRotation(createDieShape(20), 21)).toThrow();
  });
});
