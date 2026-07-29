import { WriteKernelPolicy } from './write-kernel.policy';

describe('WriteKernelPolicy (reference monitor)', () => {
  const policy = new WriteKernelPolicy();

  it('allows an assign whose areas all belong to the author', () => {
    const d = policy.decide({
      kind: 'assign',
      memoryId: 'm1',
      authorUserId: 'u1',
      membership: ['a', 'general'],
      areaOwners: { a: 'u1', general: 'u1' },
    });
    expect(d.allowed).toBe(true);
  });

  it('DENIES a move into an area owned by someone else (scope-confinement)', () => {
    const d = policy.decide({
      kind: 'move',
      memoryId: 'm1',
      authorUserId: 'u1',
      membership: ['a'],
      areaOwners: { a: 'u2' }, // belongs to another user
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/ownership scope/);
  });

  it('DENIES an empty membership (a memory must live in ≥1 area)', () => {
    const d = policy.decide({
      kind: 'assign',
      memoryId: 'm1',
      authorUserId: 'u1',
      membership: [],
      areaOwners: {},
    });
    expect(d.allowed).toBe(false);
  });

  it('there is no hard-delete op in the vocabulary (deletion is supersede only)', () => {
    // The KernelOp union has no "delete vector" variant — enforced by the type.
    const d = policy.decide({ kind: 'supersede', memoryId: 'm1', authorUserId: 'u1', supersededBy: 'm2' });
    expect(d.allowed).toBe(true);
  });

  it('cannot supersede a memory by itself', () => {
    const d = policy.decide({ kind: 'supersede', memoryId: 'm1', authorUserId: 'u1', supersededBy: 'm1' });
    expect(d.allowed).toBe(false);
  });

  it('allows seeding an area owned by the author', () => {
    const d = policy.decide({
      kind: 'seed',
      spaceId: 's1',
      authorUserId: 'u1',
      spaceOwnerUserId: 'u1',
      memoryIds: ['m1'],
    });
    expect(d.allowed).toBe(true);
  });

  it('DENIES seeding an area owned by someone else', () => {
    const d = policy.decide({
      kind: 'seed',
      spaceId: 's1',
      authorUserId: 'u1',
      spaceOwnerUserId: 'u2',
      memoryIds: ['m1'],
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/ownership scope/);
  });
});
