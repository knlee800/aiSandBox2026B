import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreditGrantService, CreditGrantResult } from '../billing/credit-grant/credit-grant.service';
import {
  AdminCreditGrantRequestDto,
  AdminCreditGrantResponseDto,
} from './dto/admin-credit-grant.dto';

@Injectable()
export class AdminCreditGrantService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly creditGrantService: CreditGrantService,
  ) {}

  async grantCredits(
    targetUserId: string,
    authenticatedAdminId: string,
    dto: AdminCreditGrantRequestDto,
  ): Promise<AdminCreditGrantResponseDto> {
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
      select: ['id'],
    });

    if (!targetUser) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const result = await this.creditGrantService.processGrant({
      ownerId: targetUserId,
      grantType: 'admin',
      amount: dto.amount,
      reason: dto.reason,
      grantedByUserId: authenticatedAdminId,
      sourceEventId: dto.idempotencyKey,
    });

    return {
      grantId: result.grantId,
      status: this.toAdminResponseStatus(result),
      amount: result.amount,
      balanceBefore: result.balanceBefore,
      balanceAfter: result.balanceAfter,
    };
  }

  private toAdminResponseStatus(
    result: CreditGrantResult,
  ): 'granted' | 'duplicate' | 'failed' {
    if (result.status === 'granted' || result.status === 'duplicate') {
      return result.status;
    }
    return 'failed';
  }
}
