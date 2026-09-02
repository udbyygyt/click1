import { describe, expect, it } from 'vitest';
import { buildMergeLayers } from '../apps/web/src/merge-animation';

describe('buildMergeLayers', () => {
  it('collapses 222 toward the clicked tile one adjacent step at a time', () => {
    expect(buildMergeLayers([[0, 0], [0, 1], [0, 2]], [0, 2])).toEqual([
      [{ from: [0, 0], to: [0, 1] }],
      [{ from: [0, 1], to: [0, 2] }],
    ]);
  });

  it('moves equal-distance branches together before the inner layer', () => {
    expect(buildMergeLayers([[0, 1], [1, 0], [1, 1], [1, 2]], [1, 1])).toEqual([
      [
        { from: [0, 1], to: [1, 1] },
        { from: [1, 0], to: [1, 1] },
        { from: [1, 2], to: [1, 1] },
      ],
    ]);
  });
});
