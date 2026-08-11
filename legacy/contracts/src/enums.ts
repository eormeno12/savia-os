import { z } from 'zod';

export const FileStatusSchema = z.enum(['pending', 'processing', 'indexed', 'failed']);
export type FileStatus = z.infer<typeof FileStatusSchema>;
