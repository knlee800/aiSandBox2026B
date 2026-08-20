import { test, expect } from '@playwright/test';
import {
  extractExecutionIdFromConfirmUrl,
  isPublicConfirmBuildApplyUrl,
  parseConfirmBody,
  validateLiveConfirmResponse,
  ConfirmObservationError,
} from '../lib/network';

test.describe('public confirm observation', () => {
  test('validates the public 03J route, HTTP 200, triggered=true, reason=completed', () => {
    const url =
      'https://staging.ainow.biz/api/ai/executions/d3b8409f-18c8-42e4-a9fc-e8fcb7574494/confirm-build-apply';
    expect(isPublicConfirmBuildApplyUrl(url)).toBe(true);
    expect(
      isPublicConfirmBuildApplyUrl(
        'https://staging.ainow.biz/api/internal/executions/d3b8409f-18c8-42e4-a9fc-e8fcb7574494/confirm-build-apply',
      ),
    ).toBe(false);
    expect(extractExecutionIdFromConfirmUrl(url)).toBe(
      'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
    );
    expect(parseConfirmBody({ triggered: true, reason: 'completed' })).toEqual({
      triggered: true,
      reason: 'completed',
    });
    expect(() =>
      validateLiveConfirmResponse({
        url,
        status: 200,
        body: { triggered: true, reason: 'completed' },
        executionId: 'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
      }),
    ).not.toThrow();
    expect(() =>
      validateLiveConfirmResponse({
        url,
        status: 500,
        body: { triggered: true, reason: 'completed' },
        executionId: 'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
      }),
    ).toThrow(ConfirmObservationError);
    expect(() =>
      validateLiveConfirmResponse({
        url,
        status: 200,
        body: { triggered: false, reason: 'completed' },
        executionId: 'd3b8409f-18c8-42e4-a9fc-e8fcb7574494',
      }),
    ).toThrow(ConfirmObservationError);
  });
});
