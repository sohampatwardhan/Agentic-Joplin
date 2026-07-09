import { z } from 'zod';

export const NotebookSchema = z.object({
  id: z.string(),
  parent_id: z.string(),
  title: z.string(),
});

export type Notebook = z.infer<typeof NotebookSchema>;
