import { RequestOtpSchema, VerifyOtpSchema } from '@savia-os/contracts';

describe('email normalization (contract transform)', () => {
  it('trims + lowercases the email so case can never split an account', () => {
    expect(RequestOtpSchema.parse({ email: '  Juan@X.COM ' }).email).toBe('juan@x.com');
    expect(VerifyOtpSchema.parse({ email: 'ADA@Lovelace.IO', code: '123456' }).email).toBe('ada@lovelace.io');
  });

  it('still rejects malformed emails after normalizing', () => {
    expect(() => RequestOtpSchema.parse({ email: 'not-an-email' })).toThrow();
  });
});
