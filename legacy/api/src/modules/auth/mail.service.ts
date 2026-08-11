import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { AppConfig } from '../../common/config/app.config';
import { otpEmailHtml, otpEmailText } from './otp-email.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly ses: SESClient;
  private readonly from: string;

  constructor(private readonly config: AppConfig) {
    this.ses = new SESClient({ region: config.awsRegion ?? 'us-east-1' });
    this.from = config.sesFrom ?? 'no-reply@savia.uno';
  }

  async sendOtp(email: string, code: string): Promise<void> {
    // OTP_DEBUG logs the code instead of sending — for dev/test workflows that
    // read it back from the logs (e.g. automated e2e/Puppeteer). It can never
    // be true in production (env.schema.ts's superRefine fails the boot), so
    // this is opt-in only; with it off, dev sends real email too, same as prod.
    if (this.config.otpDebug) {
      this.logger.log(`[DEV] OTP para ${email}: ${code}`);
      return;
    }

    await this.ses.send(
      new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Tu código de acceso · Savia', Charset: 'UTF-8' },
          Body: {
            Text: { Data: otpEmailText(code), Charset: 'UTF-8' },
            Html: { Data: otpEmailHtml(code), Charset: 'UTF-8' },
          },
        },
      }),
    );
  }
}
