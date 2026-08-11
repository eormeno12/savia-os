import { PersonaService } from './persona.service';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { MemoryGraphService } from './memory-graph.service';

function makeService(ego: { neighbors: string[]; edgesAmong: [string, string][] }, oldPersonas: { id: string; neighbors: string[] }[]) {
  const create = jest.fn().mockResolvedValue({ id: 'P-new' });
  const personaDeleteMany = jest.fn().mockResolvedValue({});
  const neighborDeleteMany = jest.fn().mockResolvedValue({});
  const neighborCreateMany = jest.fn().mockResolvedValue({});
  const prisma = {
    memoryPersona: {
      findMany: jest.fn().mockResolvedValue(
        oldPersonas.map((p) => ({ id: p.id, neighbors: p.neighbors.map((n) => ({ neighborId: n })) })),
      ),
      create,
      deleteMany: personaDeleteMany,
    },
    personaNeighbor: { deleteMany: neighborDeleteMany, createMany: neighborCreateMany },
  } as unknown as PrismaService;
  const graph = { egoNet: jest.fn().mockResolvedValue(ego) } as unknown as MemoryGraphService;
  return { svc: new PersonaService(prisma, graph), create, personaDeleteMany, neighborCreateMany };
}

describe('PersonaService.recompute — stable identity', () => {
  it('reuses a matched persona’s id and only creates rows for a genuinely new persona', async () => {
    // ego-net: {a,b} connected (one persona) + isolated c (second persona)
    const { svc, create, personaDeleteMany } = makeService(
      { neighbors: ['a', 'b', 'c'], edgesAmong: [['a', 'b']] },
      [{ id: 'P1', neighbors: ['a', 'b'] }],
    );

    const result = await svc.recompute('u', ['m']);

    expect(result).toContain('P1'); // matched persona kept (communityId preserved with it)
    expect(create).toHaveBeenCalledTimes(1); // only the new {c} persona is created
    expect(personaDeleteMany).not.toHaveBeenCalled(); // P1 was matched → not stale
  });

  it('deletes a persona that no longer corresponds to any ego-net component', async () => {
    // ego collapses to a single connected component → the second old persona is stale
    const { svc, personaDeleteMany } = makeService(
      { neighbors: ['a', 'b'], edgesAmong: [['a', 'b']] },
      [
        { id: 'P1', neighbors: ['a', 'b'] },
        { id: 'P2', neighbors: ['stale'] },
      ],
    );

    await svc.recompute('u', ['m']);

    expect(personaDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ['P2'] } } });
  });

  it('a memory with no mutual neighbours ends up with no persona', async () => {
    const { svc, create } = makeService({ neighbors: [], edgesAmong: [] }, []);
    expect(await svc.recompute('u', ['m'])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});
