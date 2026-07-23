export interface CodeFile {
  path: string;
  code: string;
  lang?: string;
}

export interface FolderNode {
  name: string;
  type: 'folder';
  path: string;
  children: TreeNode[];
}

export interface FileNode {
  name: string;
  type: 'file';
  path: string;
  file: CodeFile;
}

export type TreeNode = FolderNode | FileNode;
