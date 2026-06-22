import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { ZodValidationPipe } from 'nestjs-zod';
import { RescueTextSchema, ImportChatGptSchema, type RescueText, type ImportChatGpt } from '@savia-os/contracts';

@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Get('rescue-prompt')
  getRescuePrompt() {
    return { prompt: this.svc.getRescuePrompt() };
  }

  @Post('rescue')
  ingestRescue(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(RescueTextSchema)) dto: RescueText,
  ) {
    return this.svc.ingestRescue(user.sub, dto.text);
  }

  @Post('import/chatgpt')
  importChatGpt(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ImportChatGptSchema)) dto: ImportChatGpt,
  ) {
    return this.svc.importChatGpt(user.sub, dto.content);
  }

  @Get('suggest-spaces')
  suggestSpaces(@CurrentUser() user: JwtPayload) {
    return this.svc.suggestSpaces(user.sub);
  }
}
