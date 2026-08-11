import { z } from 'zod';
import { SensitivitySchema } from './memory';

export const GroupRoleSchema = z.enum(['viewer', 'contributor', 'admin']);

export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(80),
});

export const ShareFragmentSchema = z.object({
  areaId: z.string(),
  // Owner opt-in (R4): share the area's `sensitive` memories into the group too.
  // Defaults false — sensitive is private unless the owner chooses to include it.
  includeSensitive: z.boolean().default(false),
});

export const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: GroupRoleSchema.default('contributor'),
});

export const UpdateMemberRoleSchema = z.object({ role: GroupRoleSchema });

export const GroupDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: GroupRoleSchema, // the requesting user's role
  memberCount: z.number(),
  fragmentCount: z.number(),
  createdAt: z.string(),
});

export const GroupMemberDtoSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: GroupRoleSchema,
  joinedAt: z.string(),
});

export const FragmentDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  spaceId: z.string(),
  includeSensitive: z.boolean(),
  createdAt: z.string(),
});

/** "Compartir mi parte similar": confirm a match against another member's
 *  fragment — creates a personalized Space seeded with the picked memories.
 *  shareBack defaults true (the point of the action is contributing back). */
export const ConfirmMatchSchema = z.object({
  description: z.string().min(3),
  memoryIds: z.array(z.string()).min(1),
  shareBack: z.boolean().default(true),
});

/** A pending invite shown to the invitee (Bandeja) — never exposes the token;
 *  accepting still goes through the emailed link (POST /invites/:token/accept). */
export const PendingInviteDtoSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  role: GroupRoleSchema,
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const GroupMemoryDtoSchema = z.object({
  memoryId: z.string(),
  text: z.string(),
  score: z.number(),
  authorUserId: z.string(),
  alsoFrom: z.array(z.string()), // other members who also have this (dedup)
  sensitivity: SensitivitySchema,
});

export type GroupRole = z.infer<typeof GroupRoleSchema>;
export type CreateGroupDto = z.infer<typeof CreateGroupSchema>;
export type ShareFragmentDto = z.infer<typeof ShareFragmentSchema>;
export type InviteDto = z.infer<typeof InviteSchema>;
export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleSchema>;
export type GroupDto = z.infer<typeof GroupDtoSchema>;
export type GroupMemberDto = z.infer<typeof GroupMemberDtoSchema>;
export type FragmentDto = z.infer<typeof FragmentDtoSchema>;
export type PendingInviteDto = z.infer<typeof PendingInviteDtoSchema>;
export type GroupMemoryDto = z.infer<typeof GroupMemoryDtoSchema>;
export type ConfirmMatchDto = z.infer<typeof ConfirmMatchSchema>;
