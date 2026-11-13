import { ExecutionContext, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AIExecutionController } from '../ai-execution.controller';
import { AIExecutionService } from '../ai-execution.service';
import { INTERNAL_KEY_EXEMPT } from '../../guards/internal-key-exempt.decorator';
import { InternalServiceAuthGuard } from '../../guards/internal-service-auth.guard';

/**
 * PROVIDER-KEY-01 contract C3:
 * GET /api/internal/provider-availability (internal key) answers
 * { providers: { xai, groq, deepseek, openai, anthropic: boolean } }.
 */
describe('GET internal/provider-availability (PROVIDER-KEY-01 C3)', () => {
  const marker = 'provider-key-01-availability-marker';

  function controllerWith(values: Record<string, unknown>): AIExecutionController {
    const config = { get: jest.fn((name: string) => values[name]) } as unknown as ConfigService;
    return new AIExecutionController(new AIExecutionService(config));
  }

  it('is a GET on internal/provider-availability', () => {
    const handler = AIExecutionController.prototype.providerAvailability;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('internal/provider-availability');
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
  });

  it('answers the C3 shape with booleans that follow the configured keys', () => {
    const answer = controllerWith({
      XAI_API_KEY: marker,
      GROQ_API_KEY: '',
      OPENAI_API_KEY: `${marker}-openai`,
      ANTHROPIC_API_KEY: '  ',
    }).providerAvailability();

    expect(answer).toEqual({
      providers: { xai: true, groq: false, deepseek: false, openai: true, anthropic: false },
    });
    expect(Object.keys(answer)).toEqual(['providers']);
    expect(Object.keys(answer.providers)).toEqual(['xai', 'groq', 'deepseek', 'openai', 'anthropic']);
  });

  it('never returns a key value, a length or a variable name', () => {
    const body = JSON.stringify(
      controllerWith({
        XAI_API_KEY: marker,
        GROQ_API_KEY: marker,
        DEEPSEEK_API_KEY: marker,
        OPENAI_API_KEY: marker,
        ANTHROPIC_API_KEY: marker,
      }).providerAvailability(),
    );
    expect(body).not.toContain(marker);
    expect(body).not.toContain(String(marker.length));
    expect(body).not.toMatch(/API_KEY/);
    expect(body).not.toContain('stub');
  });

  describe('internal key', () => {
    const originalKey = process.env.INTERNAL_SERVICE_KEY;
    const controller = controllerWith({});

    function context(headers: Record<string, unknown>): ExecutionContext {
      return {
        getType: () => 'http',
        getHandler: () => controller.providerAvailability,
        getClass: () => AIExecutionController,
        switchToHttp: () => ({
          getRequest: () => ({
            headers,
            method: 'GET',
            path: '/api/internal/provider-availability',
          }),
        }),
      } as unknown as ExecutionContext;
    }

    beforeEach(() => {
      process.env.INTERNAL_SERVICE_KEY = 'provider-key-01-internal-key';
    });

    afterEach(() => {
      if (originalKey === undefined) {
        delete process.env.INTERNAL_SERVICE_KEY;
      } else {
        process.env.INTERNAL_SERVICE_KEY = originalKey;
      }
    });

    it('is not exempt from the global internal-key guard', () => {
      expect(
        Reflect.getMetadata(INTERNAL_KEY_EXEMPT, AIExecutionController.prototype.providerAvailability),
      ).toBeUndefined();
      expect(Reflect.getMetadata(INTERNAL_KEY_EXEMPT, AIExecutionController)).toBeUndefined();
    });

    it('is refused without the key or with a wrong key', () => {
      const guard = new InternalServiceAuthGuard(new Reflector());
      expect(() => guard.canActivate(context({}))).toThrow(UnauthorizedException);
      expect(() =>
        guard.canActivate(context({ 'x-internal-service-key': 'provider-key-01-internal-kez' })),
      ).toThrow(UnauthorizedException);
    });

    it('is allowed with the key', () => {
      const guard = new InternalServiceAuthGuard(new Reflector());
      expect(
        guard.canActivate(context({ 'x-internal-service-key': 'provider-key-01-internal-key' })),
      ).toBe(true);
    });
  });
});
