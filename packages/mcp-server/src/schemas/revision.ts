import { z } from 'zod';

export const RevisionSchema = z.object({
  id: z.string(),
  item_type: z.number(),
  item_id: z.string(),
  title_diff: z.string().optional(),
  body_diff: z.string().optional(),
  created_time: z.number().optional(),
  updated_time: z.number().optional(),
});

export type Revision = z.infer<typeof RevisionSchema>;
