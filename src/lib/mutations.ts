import { QueryCapture } from 'web-tree-sitter';
import { getTextParts, Lines } from './ts_tools';

export enum MUTANT_TYPES {
  ADDITION_SUBTRACT = 'addition_subtract',
  BOOLEAN = 'boolean',
  BREAK = 'break',
  CONTINUE = 'continue',
  COMPARISON_EQUAL = 'comparison_equal',
  COMPARISON_LESS_THAN = 'comparison_less_than',
  COMPARISON_LESS_THAN_EQUAL = 'comparison_less_than_equal',
  COMPARISON_GREATER_THAN = 'comparison_greater_than',
  COMPARISON_GREATER_THAN_EQUAL = 'comparison_greater_than_equal',
  COMPARISON_NOT_EQUAL = 'comparison_not_equal',
  DML_EXPRESSION = 'dml_expression',
  INT_VALUE = 'int_value',
  STRING_LITERAL = 'string_literal',
  UNARY_OPERATOR = 'unary_operator',
  UPDATE_DECREMENT = 'update_decrement',
  UPDATE_INCREMENT = 'update_increment',
  RETURN_WITH_VALUE = 'return_with_value',
}

export function getMutatedParts(capture: QueryCapture, text: Lines): string[] {
  // if start and end are on different lines, capture from start position to end of line,
  // then if needed, full lines, until finally 0 until end of capture
  const [start, capturedText, end] = getTextParts(text, capture.node);
  return [start, getMutantValue(capture, capturedText), end];
}

// eslint-disable-next-line complexity
export function getMutantValue(capture: QueryCapture, text: string): string {
  switch (capture.name) {
    case MUTANT_TYPES.ADDITION_SUBTRACT:
      return text === '+' ? '-' : '+';
    case MUTANT_TYPES.BOOLEAN:
      return text.toLowerCase() === 'true' ? 'false' : 'true';
    case MUTANT_TYPES.BREAK:
    case MUTANT_TYPES.CONTINUE:
      return '';
    case MUTANT_TYPES.COMPARISON_EQUAL:
      return '!=';
    case MUTANT_TYPES.COMPARISON_LESS_THAN:
    case MUTANT_TYPES.COMPARISON_LESS_THAN_EQUAL:
      return '>';
    case MUTANT_TYPES.COMPARISON_GREATER_THAN:
    case MUTANT_TYPES.COMPARISON_GREATER_THAN_EQUAL:
      return '<';
    case MUTANT_TYPES.COMPARISON_NOT_EQUAL:
      return '==';
    case MUTANT_TYPES.DML_EXPRESSION:
      return '';
    case MUTANT_TYPES.INT_VALUE:
      return `${(parseInt(text, 10) === 0 ? 7 : parseInt(text, 10)) * 10}`;
    case MUTANT_TYPES.STRING_LITERAL:
      return reverseQuotedString(text);
    case MUTANT_TYPES.UNARY_OPERATOR:
      return '';
    case MUTANT_TYPES.UPDATE_DECREMENT:
      return '++';
    case MUTANT_TYPES.UPDATE_INCREMENT:
      return '--';
    case MUTANT_TYPES.RETURN_WITH_VALUE:
      return 'return null;';
    default: // should really unwind the file changes and push the original back to the org
      throw new Error(`Unsupported Node Type:${capture.name}`);
  }
}

function reverseQuotedString(string: string): string {
  const parts = string.split('');
  // empty or single character
  if (parts.length <= 3) {
    return "'abc123'";
  }
  for (let i = 0; i < parts.length; i++) {
    // ensure escaped text ends up in the right order
    if (parts[i] === '\\') {
      parts[i] = parts[++i];
      parts[i] = '\\';
    }
  }
  parts.reverse();
  return parts.join('');
}
