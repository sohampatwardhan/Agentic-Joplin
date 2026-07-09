import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export type Tag = z.infer<typeof TagSchema>;
