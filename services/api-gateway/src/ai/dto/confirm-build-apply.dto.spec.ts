import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmBuildApplyDto } from './confirm-build-apply.dto';

describe('ConfirmBuildApplyDto', () => {
  async function validatePayload(payload: object) {
    const dto = plainToInstance(ConfirmBuildApplyDto, payload);
    return validate(dto);
  }

  it('accepts a well-formed applied confirmation', async () => {
    const errors = await validatePayload({
      applyStatus: 'applied',
      totalActions: 2,
      successCount: 2,
    });
    expect(errors).toHaveLength(0);
  });

  it('accepts skipped as a structurally valid non-applied payload', async () => {
    const errors = await validatePayload({
      applyStatus: 'skipped',
      totalActions: 2,
      successCount: 0,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects a naked success payload', async () => {
    const errors = await validatePayload({ success: true });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects missing totalActions', async () => {
    const errors = await validatePayload({
      applyStatus: 'applied',
      successCount: 1,
    });
    expect(errors.some((error) => error.property === 'totalActions')).toBe(true);
  });

  it('rejects non-integer totalActions', async () => {
    const errors = await validatePayload({
      applyStatus: 'applied',
      totalActions: 1.5,
      successCount: 1,
    });
    expect(errors.some((error) => error.property === 'totalActions')).toBe(true);
  });

  it('rejects negative successCount', async () => {
    const errors = await validatePayload({
      applyStatus: 'applied',
      totalActions: 1,
      successCount: -1,
    });
    expect(errors.some((error) => error.property === 'successCount')).toBe(true);
  });

  it('rejects empty applyStatus', async () => {
    const errors = await validatePayload({
      applyStatus: '',
      totalActions: 1,
      successCount: 1,
    });
    expect(errors.some((error) => error.property === 'applyStatus')).toBe(true);
  });
});
