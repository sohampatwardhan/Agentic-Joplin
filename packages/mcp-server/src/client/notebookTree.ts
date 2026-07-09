import type { Notebook } from '../schemas/notebook.js';

export interface NotebookTreeNode extends Notebook {
  children: NotebookTreeNode[];
}

export function buildNotebookTree(notebooks: Notebook[]): NotebookTreeNode[] {
  const byId = new Map<string, NotebookTreeNode>();
  for (const notebook of notebooks) {
    byId.set(notebook.id, { ...notebook, children: [] });
  }

  const roots: NotebookTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
