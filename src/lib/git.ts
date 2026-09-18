import { diffLines, Change } from 'diff';
import { GitBranch, GitCommit, GitFileStatus } from '../types';

export interface DiffLineResult {
  type: 'added' | 'removed' | 'unchanged';
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
}

export interface FileDiffResult {
  filePath: string;
  lines: DiffLineResult[];
  additions: number;
  deletions: number;
}

/**
 * Calculates a structured line-by-line diff between old text and new text
 */
export function calculateDiff(oldContent: string, newContent: string, filePath: string): FileDiffResult {
  const changes: Change[] = diffLines(oldContent || '', newContent || '');
  const lines: DiffLineResult[] = [];
  let additions = 0;
  let deletions = 0;

  let oldLine = 1;
  let newLine = 1;

  for (const change of changes) {
    const rawLines = change.value.replace(/\r\n/g, '\n').split('\n');
    // If ending with \n, split leaves an empty string at the end
    if (rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }

    if (change.added) {
      for (const line of rawLines) {
        additions++;
        lines.push({
          type: 'added',
          newLineNumber: newLine++,
          text: line,
        });
      }
    } else if (change.removed) {
      for (const line of rawLines) {
        deletions++;
        lines.push({
          type: 'removed',
          oldLineNumber: oldLine++,
          text: line,
        });
      }
    } else {
      for (const line of rawLines) {
        lines.push({
          type: 'unchanged',
          oldLineNumber: oldLine++,
          newLineNumber: newLine++,
          text: line,
        });
      }
    }
  }

  return {
    filePath,
    lines,
    additions,
    deletions,
  };
}

/**
 * Generates a SHA-1-like 40-character hex hash for mock/client git commits
 */
export function generateGitHash(content: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x9e3779b9;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash1 ^= char;
    hash1 = (hash1 * 0x01000193) >>> 0;
    hash2 ^= char;
    hash2 = (hash2 * 0x5bd1e995) >>> 0;
  }
  const part1 = hash1.toString(16).padStart(8, '0');
  const part2 = hash2.toString(16).padStart(8, '0');
  const part3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, '0');
  const part4 = ((hash1 + hash2) >>> 0).toString(16).padStart(8, '0');
  const part5 = ((hash2 - hash1) >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}${part3}${part4}${part5}`.toLowerCase();
}

/**
 * Initial default commits for demonstration and playground
 */
export const INITIAL_GIT_COMMITS: GitCommit[] = [
  {
    oid: '8f7a9d3e5b1c4a2f6e0d9b8a7c5e3f1a2b4c6d8e',
    shortOid: '8f7a9d3',
    message: 'feat(space): implement 3-depth cognitive plane camera with Z translation',
    author: {
      name: 'Nebula Architect',
      email: 'dev@nebula.space',
      timestamp: Date.now() - 1000 * 60 * 60 * 4,
    },
    parentOids: ['4c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b'],
  },
  {
    oid: '4c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b',
    shortOid: '4c2b1a0',
    message: 'refactor(window): glassmorphism dark neon aesthetic and pointer capture',
    author: {
      name: 'Nebula Dev',
      email: 'dev@nebula.space',
      timestamp: Date.now() - 1000 * 60 * 60 * 18,
    },
    parentOids: ['1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b'],
  },
  {
    oid: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    shortOid: '1a2b3c4',
    message: 'chore: initial commit of Nebula workspace core',
    author: {
      name: 'Nebula Dev',
      email: 'dev@nebula.space',
      timestamp: Date.now() - 1000 * 60 * 60 * 48,
    },
    parentOids: [],
  },
];

export const INITIAL_GIT_BRANCHES: GitBranch[] = [
  { name: 'main', isCurrent: true, ahead: 2, behind: 0 },
  { name: 'feature/forgejo-sync', isCurrent: false, ahead: 0, behind: 1 },
  { name: 'feature/notepad-monaco', isCurrent: false, ahead: 1, behind: 0 },
];
