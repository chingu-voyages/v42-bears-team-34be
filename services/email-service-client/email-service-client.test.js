import { beforeAll, jest } from '@jest/globals';
import { emailServiceClient } from './email-service-client';

describe('Email service client tests', () => {
  beforeAll(() => {
    jest.resetAllMocks();
  });
  test('Email service client calls method', async () => {
    const emailServiceSpy = jest
      .spyOn(emailServiceClient, 'sendEmail')
      .mockReturnValue(() => Promise.resolve());
    await emailServiceClient.sendEmail('/test', { data: 'test' });
    expect(emailServiceSpy).toHaveBeenCalledWith('/test', { data: 'test' });
  });
});
