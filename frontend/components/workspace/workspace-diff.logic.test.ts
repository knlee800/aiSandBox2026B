import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DIFF_MAX_LINES, computeLineDiff } from './workspace-diff.logic';

describe('workspace diff logic', () => {
  test('identical content returns an empty diff result', () => {
    const result = computeLineDiff('line one\nline two', 'line one\nline two');
    assert.equal(result.truncated, false);
    assert.equal(result.lines.length, 0);
  });

  test('added line is represented as an added diff line', () => {
    const result = computeLineDiff('alpha\ncharlie', 'alpha\nbravo\ncharlie');
    assert.equal(result.truncated, false);
    assert.ok(result.lines.some((line) => line.type === 'added' && line.content === 'bravo'));
  });

  test('removed line is represented as a removed diff line', () => {
    const result = computeLineDiff('alpha\nbravo\ncharlie', 'alpha\ncharlie');
    assert.equal(result.truncated, false);
    assert.ok(result.lines.some((line) => line.type === 'removed' && line.content === 'bravo'));
  });

  test('mixed changes include both removed and added lines', () => {
    const result = computeLineDiff('a\nb\nc', 'a\nx\nc\nd');
    assert.equal(result.truncated, false);
    assert.ok(result.lines.some((line) => line.type === 'removed' && line.content === 'b'));
    assert.ok(result.lines.some((line) => line.type === 'added' && line.content === 'x'));
    assert.ok(result.lines.some((line) => line.type === 'added' && line.content === 'd'));
  });

  test('empty current content marks proposed lines as added', () => {
    const result = computeLineDiff('', 'first\nsecond');
    assert.equal(result.truncated, false);
    assert.deepEqual(
      result.lines.map((line) => line.type),
      ['added', 'added'],
    );
    assert.deepEqual(
      result.lines.map((line) => line.content),
      ['first', 'second'],
    );
  });

  test('empty proposed content marks current lines as removed', () => {
    const result = computeLineDiff('first\nsecond', '');
    assert.equal(result.truncated, false);
    assert.deepEqual(
      result.lines.map((line) => line.type),
      ['removed', 'removed'],
    );
    assert.deepEqual(
      result.lines.map((line) => line.content),
      ['first', 'second'],
    );
  });

  test('caps output at DIFF_MAX_LINES and marks diff as truncated', () => {
    const proposed = Array.from({ length: DIFF_MAX_LINES + 40 }, (_, index) => `line-${index + 1}`).join('\n');
    const result = computeLineDiff('', proposed);
    assert.equal(result.truncated, true);
    assert.equal(result.lines.length, DIFF_MAX_LINES);
    assert.equal(result.lines.every((line) => line.type === 'added'), true);
  });

  test('includes 3 lines of surrounding context around changed regions', () => {
    const current = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].join('\n');
    const proposed = ['1', '2', '3', '4', '5', 'six', '7', '8', '9', '10', '11', '12'].join('\n');
    const result = computeLineDiff(current, proposed);

    const contextLineNumbers = result.lines
      .filter((line) => line.type === 'context')
      .map((line) => line.lineNumber);

    assert.ok(contextLineNumbers.includes(3));
    assert.ok(contextLineNumbers.includes(9));
    assert.equal(contextLineNumbers.includes(2), false);
    assert.equal(contextLineNumbers.includes(10), false);
    assert.ok(result.lines.some((line) => line.type === 'removed' && line.content === '6'));
    assert.ok(result.lines.some((line) => line.type === 'added' && line.content === 'six'));
  });
});
