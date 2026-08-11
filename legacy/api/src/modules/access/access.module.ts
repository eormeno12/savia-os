import { Module } from '@nestjs/common';
import { AccessService } from './access.service';
import { GroupScopeResolver } from './group-scope.resolver';

/**
 * The access layer. Exports AccessService (the single decision authority) so
 * memory/connections/mcp/areas depend on it rather than re-deriving authZ.
 * GroupScopeResolver is also exported — FederationService reuses it to flatten
 * a group's fragments instead of re-deriving the space/lens compilation.
 */
@Module({
  providers: [AccessService, GroupScopeResolver],
  exports: [AccessService, GroupScopeResolver],
})
export class AccessModule {}
