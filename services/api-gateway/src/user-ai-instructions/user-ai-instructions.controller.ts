import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SessionCookieGuard } from '../auth/session-cookie.guard';
import { UpsertUserAiInstructionsDto } from './dto/upsert-user-ai-instructions.dto';
import { UserAiInstructionsService } from './user-ai-instructions.service';

@Controller('user/ai-instructions')
@UseGuards(SessionCookieGuard)
export class UserAiInstructionsController {
  constructor(
    private readonly userAiInstructionsService: UserAiInstructionsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getGlobalInstructions(
    @Request() req,
  ): Promise<{ globalInstructions: string | null }> {
    const globalInstructions = await this.userAiInstructionsService.getByUserId(
      req.user.userId,
    );
    return { globalInstructions };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async upsertGlobalInstructions(
    @Request() req,
    @Body() body: UpsertUserAiInstructionsDto,
  ): Promise<{ globalInstructions: string | null }> {
    const globalInstructions = body.globalInstructions ?? null;
    const savedGlobalInstructions = await this.userAiInstructionsService.upsert(
      req.user.userId,
      globalInstructions,
    );
    return { globalInstructions: savedGlobalInstructions };
  }
}
