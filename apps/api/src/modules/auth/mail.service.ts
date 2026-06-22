import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class MailService {
  private readonly ses: SESClient;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
    this.ses = new SESClient({ region: config.get<string>('AWS_REGION', 'us-east-1') });
    this.from = config.get<string>('AWS_SES_FROM', 'no-reply@savia.com');
  }

  async sendOtp(email: string, code: string): Promise<void> {
    const isDev = this.config.get<string>('NODE_ENV') !== 'production';

    if (isDev) {
      console.log(`\n[DEV] OTP para ${email}: ${code}\n`);
      return;
    }

    await this.ses.send(
      new SendEmailCommand({
        Source: this.from,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: `Tu código de acceso a Savia: ${code}` },
          Body: {
            Text: {
              Data: `Tu código de acceso es: ${code}\n\nVálido por 10 minutos. No lo compartas con nadie.`,
            },
            Html: {
              Data: `<p>Tu código de acceso es: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`,
            },
          },
        },
      }),
    );
  }
}
