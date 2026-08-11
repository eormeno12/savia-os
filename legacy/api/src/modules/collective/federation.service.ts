import { Injectable } from '@nestjs/common';
import { AccessService } from '../access/access.service';
import { CrossBoundaryReadService } from '../memory/cross-boundary-read.service';
import type { GroupMemoryDto } from '@savia-os/legacy-contracts';

/**
 * The group's live-union VIEW (08 §5.2 / 0A F6): a thin mapper over the cross-boundary
 * read core. `AccessService.buildGroupReadPlan` asserts membership and compiles the
 * per-owner plan (the SAME planner the MCP path uses — one home for the invariants +
 * R4), and `CrossBoundaryReadService.searchPartitions` fans out + dedups. No predicate
 * is hand-rolled here anymore; sensitivity is the fragment owner's opt-in.
 */
@Injectable()
export class FederationService {
  constructor(
    private readonly access: AccessService,
    private readonly reader: CrossBoundaryReadService,
  ) {}

  async search(
    groupId: string,
    viewerUserId: string,
    query: string,
    opts: { limit?: number } = {},
  ): Promise<GroupMemoryDto[]> {
    const limit = opts.limit ?? 10;
    const plan = await this.access.buildGroupReadPlan(groupId, viewerUserId); // asserts membership + default-deny
    const hits = await this.reader.searchPartitions(plan, query, limit, viewerUserId);
    return hits.map((h) => ({
      memoryId: h.memoryId,
      text: h.text,
      score: h.score,
      authorUserId: h.ownerUserId,
      alsoFrom: h.alsoFrom,
      sensitivity: h.sensitivity,
    }));
  }
}
