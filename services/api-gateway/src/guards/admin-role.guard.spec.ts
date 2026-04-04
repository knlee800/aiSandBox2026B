import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminRoleGuard } from './admin-role.guard';
import { UserRole } from '../entities/user-role.enum';

describe('AdminRoleGuard', () => {
  const guard = new AdminRoleGuard();

  const createContext = (role?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    }) as any;

  it('allows admin role', () => {
    expect(guard.canActivate(createContext(UserRole.ADMIN))).toBe(true);
  });

  it('rejects missing identity', () => {
    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });

  it('rejects non-admin role', () => {
    expect(() => guard.canActivate(createContext(UserRole.USER))).toThrow(
      ForbiddenException,
    );
  });
});
