import { cosine, mean, norm, renorm, truncate } from './vector';

describe('vector math', () => {
  it('renorm projects to unit length', () => {
    expect(norm(renorm([3, 4]))).toBeCloseTo(1, 10);
  });

  it('renorm leaves the zero vector untouched (no NaN)', () => {
    expect(renorm([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('truncate keeps the first dims and renormalizes', () => {
    const v = truncate([3, 4, 99, 99], 2);
    expect(v).toHaveLength(2);
    expect(norm(v)).toBeCloseTo(1, 10);
  });

  it('cosine of identical directions is 1', () => {
    expect(cosine([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
  });

  it('cosine of orthogonal vectors is 0', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it('mean averages componentwise', () => {
    expect(mean([[0, 2], [2, 0]])).toEqual([1, 1]);
  });
});
