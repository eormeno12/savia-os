import { Logger } from '@nestjs/common';
import { MemoryService } from './memory.service';
import type { PrismaService } from '../../common/clients/prisma.service';
import type { VectorStorePort } from '../../common/ports/vector-store.port';
import type { Mem0Service } from './mem0.service';
import type { MemoryMutationService } from '../kernel/memory-mutation.service';
import type { AreasService } from '../areas/areas.service';
import type { EnginePlacementService } from '../organization/engine-placement.service';
import type { EntityGraphPort } from '../../common/ports/entity-graph.port';
import type { AccessService } from '../access/access.service';

function makeService(overrides: { deletePointsSucceeds: boolean }) {
  const prisma = {} as PrismaService;
  const mem0 = { add: jest.fn().mockResolvedValue([{ id: 'mem-1', text: 'hi' }]) } as unknown as Mem0Service;
  const kernel = {
    assign: jest.fn().mockRejectedValue(new Error('postgres down')),
  } as unknown as MemoryMutationService;
  const areas = {
    ensureGeneral: jest.fn().mockResolvedValue({ id: 'general' }),
  } as unknown as AreasService;
  const placement = {
    placeAtAdd: jest.fn().mockResolvedValue({ membership: ['general'] }),
  } as unknown as EnginePlacementService;
  const entityGraph = { entitiesForMemory: jest.fn().mockResolvedValue([]) } as unknown as EntityGraphPort;
  const access = {} as AccessService;
  const deletePoints = overrides.deletePointsSucceeds
    ? jest.fn().mockResolvedValue(undefined)
    : jest.fn().mockRejectedValue(new Error('qdrant also down'));
  const vectors = {
    retrieve: jest.fn().mockResolvedValue([{ id: 'mem-1', vector: [] }]),
    deletePoints,
  } as unknown as VectorStorePort;

  const svc = new MemoryService(prisma, mem0, kernel, areas, placement, entityGraph, access, vectors);
  return { svc, deletePoints };
}

describe('MemoryService.add — orphan compensation on kernel.assign failure', () => {
  it('logs a plain "(compensated)" message when the orphan point is actually deleted', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { svc, deletePoints } = makeService({ deletePointsSucceeds: true });

    await svc.add('alice', 'text');

    expect(deletePoints).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('(compensated)'));
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('compensation failed'));
    errorSpy.mockRestore();
  });

  it('flags the failure distinctly when compensation ALSO fails — an orphan is left in Qdrant', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { svc, deletePoints } = makeService({ deletePointsSucceeds: false });

    await svc.add('alice', 'text');

    expect(deletePoints).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('compensation failed — orphan point left in Qdrant'));
    errorSpy.mockRestore();
  });
});
