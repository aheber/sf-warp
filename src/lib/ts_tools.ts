import { getApexParser } from 'web-tree-sitter-sfapex';
import { SyntaxNode } from 'web-tree-sitter';
export interface Lines {
  [key: number]: string;
}

export async function isTestClass(classBody: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const parser = await getApexParser();

  const tree = parser.parse(classBody);
  const query = parser.getLanguage().query('(annotation name: (identifier) @annotationNames)');

  const testCandidateCaptures = query.captures(tree.rootNode);
  const testLines = classBody.split('\n');
  const testLinesObj = {};
  testLines.forEach((line, num) => {
    testLinesObj[num] = line;
  });
  let isTest = false;
  for (const capt of testCandidateCaptures) {
    const lineParts = getTextParts(testLinesObj, capt.node);
    if (lineParts[1].toLowerCase() === 'istest') {
      isTest = true;
      break;
    }
  }
  return isTest;
}

export function getTextParts(lines: Lines, node: SyntaxNode): string[] {
  // probably a smarter way to do this out there...
  const line = lines[node.startPosition.row];
  if (node.startPosition.row === node.endPosition.row) {
    const start = line.slice(0, node.startPosition.column);
    const middle = line.slice(node.startPosition.column, node.endPosition.column);
    const end = line.slice(node.endPosition.column);
    return [start, middle, end];
  }

  const before = lines[node.startPosition.row].slice(0, node.startPosition.column);
  const matched = Object.keys(lines)
    .map((lineNum): string => {
      const lNum = parseInt(lineNum, 10);
      if (lNum === node.startPosition.row) {
        return (lines[lineNum] as string).slice(node.startPosition.column);
      }
      if (lNum === node.endPosition.row) {
        return (lines[lineNum] as string).slice(0, node.endPosition.column);
      }
      return lines[lineNum] as string;
    })
    .join('\n');

  const after = lines[node.endPosition.row].slice(node.endPosition.column);
  return [before, matched, after];
}
