import { z } from 'zod';
import { SensitivitySchema } from './memory';

export const GovernanceSchema = z.enum(['auto', 'manual']);

export const CreateAreaSchema = z.object({
  description: z.string().min(3),
  parentId: z.string().optional(),
  memoryIds: z.array(z.string()).optional(), // confirmados desde /memory/search; [] o ausente = arranca vacía (gobernanza auto)
});

export const UpdateAreaSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    description: z.string().min(3).optional(),
  })
  .refine((d) => d.name !== undefined || d.description !== undefined, { message: 'Nada para actualizar' });

export const AreaDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parentId: z.string().nullable(),
  depth: z.number(),
  path: z.string(),
  isDefault: z.boolean(),
  governance: GovernanceSchema,
  memoryCount: z.number(), // overlapping Venn count (= subtree members)
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface AreaTreeNode {
  id: string;
  name: string;
  depth: number;
  isDefault: boolean;
  memoryCount: number;
  children: AreaTreeNode[];
}
export const AreaTreeNodeSchema: z.ZodType<AreaTreeNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    depth: z.number(),
    isDefault: z.boolean(),
    memoryCount: z.number(),
    children: z.array(AreaTreeNodeSchema),
  }),
);

export const AreaMemoryDtoSchema = z.object({
  memoryId: z.string(),
  text: z.string(),
  areaIds: z.array(z.string()),
  sensitivity: SensitivitySchema,
  createdAt: z.string().nullable(),
});

export const AreaMemoriesPageSchema = z.object({
  items: z.array(AreaMemoryDtoSchema),
  nextCursor: z.string().nullable(),
});

export type CreateAreaDto = z.infer<typeof CreateAreaSchema>;
export type UpdateAreaDto = z.infer<typeof UpdateAreaSchema>;
export type AreaDto = z.infer<typeof AreaDtoSchema>;
export type AreaMemoryDto = z.infer<typeof AreaMemoryDtoSchema>;
export type AreaMemoriesPage = z.infer<typeof AreaMemoriesPageSchema>;
