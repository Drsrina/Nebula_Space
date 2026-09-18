import { diffLines, Change } from 'diff';

export interface GutterChange {
  type: 'added' | 'modified' | 'deleted';
  startLine: number;
  endLine: number;
}

/**
 * Computes line-by-line diff between base content (HEAD) and current editor content.
 */
export function computeGutterChanges(baseContent: string, currentContent: string): GutterChange[] {
  if (baseContent === currentContent) {
    return [];
  }

  const changes = diffLines(baseContent, currentContent);
  const gutterChanges: GutterChange[] = [];
  let currentLine = 1;

  for (let i = 0; i < changes.length; i++) {
    const part = changes[i];
    const nextPart: Change | undefined = changes[i + 1];

    // Check for Modified: removed block immediately followed by added block
    if (part.removed && nextPart && nextPart.added) {
      const addedCount = nextPart.count || 1;
      gutterChanges.push({
        type: 'modified',
        startLine: currentLine,
        endLine: currentLine + addedCount - 1,
      });
      currentLine += addedCount;
      i++; // skip nextPart as it's paired with this modification
      continue;
    }

    if (part.added) {
      const count = part.count || 1;
      gutterChanges.push({
        type: 'added',
        startLine: currentLine,
        endLine: currentLine + count - 1,
      });
      currentLine += count;
    } else if (part.removed) {
      // Deletion marker at the current modified line
      gutterChanges.push({
        type: 'deleted',
        startLine: Math.max(1, currentLine),
        endLine: Math.max(1, currentLine),
      });
    } else {
      // Unchanged lines
      currentLine += part.count || 0;
    }
  }

  return gutterChanges;
}

/**
 * Converts gutter changes into Monaco Editor decorations.
 */
export function createMonacoGutterDecorations(
  changes: GutterChange[],
  monaco: any
): any[] {
  return changes.map((ch) => {
    let className = 'git-gutter-modified';
    let hoverMessage = 'Linha modificada';

    if (ch.type === 'added') {
      className = 'git-gutter-added';
      hoverMessage = 'Linha adicionada';
    } else if (ch.type === 'deleted') {
      className = 'git-gutter-deleted';
      hoverMessage = 'Linhas excluídas abaixo';
    }

    return {
      range: new monaco.Range(ch.startLine, 1, ch.endLine, 1),
      options: {
        isWholeLine: false,
        linesDecorationsClassName: className,
        hoverMessage: { value: hoverMessage },
      },
    };
  });
}
