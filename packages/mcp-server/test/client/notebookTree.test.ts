import { describe, expect, it } from 'vitest';
import { buildNotebookTree } from '../../src/client/notebookTree.js';

describe('buildNotebookTree', () => {
  it('nests a child notebook under its parent', () => {
    const tree = buildNotebookTree([
      { id: 'root', parent_id: '', title: 'Root' },
      { id: 'child', parent_id: 'root', title: 'Child' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('child');
  });

  it('treats a notebook with an unknown parent_id as a root', () => {
    const tree = buildNotebookTree([{ id: 'orphan', parent_id: 'missing', title: 'Orphan' }]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });

  it('supports multiple levels of nesting', () => {
    const tree = buildNotebookTree([
      { id: 'a', parent_id: '', title: 'A' },
      { id: 'b', parent_id: 'a', title: 'B' },
      { id: 'c', parent_id: 'b', title: 'C' },
    ]);
    expect(tree[0].children[0].children[0].id).toBe('c');
  });
});
