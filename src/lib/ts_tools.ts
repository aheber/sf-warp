/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as Parser from 'tree-sitter';
import * as tsApex from 'tree-sitter-sfapex';

interface TSLocation {
  row: number;
  column: number;
}

interface TSNode {
  startPosition: TSLocation;
  endPosition: TSLocation;
}

export interface TSCapture {
  name: string;
  node: TSNode;
}
interface TSQuery {
  captures(TSTreeNode): TSCapture[];
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TSLanguage {}
// interface TSTree {
//   soemthing();
// }
interface TSParser {
  setLanguage(TSLanguage): void;
  getLanguage(): TSLanguage;
  parse(
    input: string | Parser.Input | Parser.InputReader,
    oldTree?: Parser.Tree,
    options?: {
      bufferSize?: number;
      includedRanges?: Parser.Range[];
    }
  ): Parser.Tree;
}
export interface Lines {
  [key: number]: string;
}

export async function isTestClass(classBody: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const parser = new Parser() as TSParser;
  parser.setLanguage((await tsApex).apex);

  const tree = parser.parse(classBody);

  const query = new Parser.Query(parser.getLanguage(), '(annotation name: (identifier) @annotationNames)') as TSQuery;

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

export function getTextParts(lines: Lines, node: TSNode): string[] {
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
