import { z } from 'zod';

export const ResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  mime: z.string().optional(),
  file_extension: z.string().optional(),
  size: z.number().optional(),
});

export type Resource = z.infer<typeof ResourceSchema>;
