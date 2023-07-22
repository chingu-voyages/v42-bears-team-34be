import dayjs from 'dayjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { EmailVerificationModel } from '../../schemas/email-verification';
import {
  createVerificationData,
  isEmailVerified,
  validateCode,
} from './verification-data';

let mongoServer;

const dbOptions = {
  autoIndex: false,
  serverSelectionTimeoutMS: 5000,
  family: 4,
};

beforeEach(async () => {
  mongoose.set('strictQuery', false);
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  try {
    await mongoose.connect(mongoUri, dbOptions);
  } catch (err) {
    console.error('Mongo error', err);
  }
});

afterEach(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

const testEmail = 'dummyEmail@example.com';

/**
 * Helper method to create dummy verification documents for test purposes
 * @param {string?} email
 * @param {boolean?} verified
 *
 */
async function createDummyVerificationEntry(
  email = testEmail,
  verified = false
) {
  return EmailVerificationModel.create({
    email,
    verified,
    code: '111111',
  });
}
describe('Verification data method tests', () => {
  describe('CreateVerificationData', () => {
    test("creates a verification document when one isn't found", async () => {
      const dummyDocument = await createVerificationData(testEmail);
      expect(dummyDocument.email).toBe(testEmail);
      expect(dummyDocument.code).toBeDefined();
      expect(dummyDocument.code.length).toBe(6);
    });

    test('Verification document marked as verified should return null', async () => {
      await createDummyVerificationEntry(testEmail, true);

      const dummyDocument = await createVerificationData(testEmail);
      expect(dummyDocument).toBeNull();
    });

    test('trigger the cool-off period - method should throw', async () => {
      await createDummyVerificationEntry();
      await expect(() => createVerificationData(testEmail)).rejects.toThrow();
    });

    test("document is returned when it's not expired and it's after the cool-off period", async () => {
      // Create a document that is just past the 20 minute cool-off
      await EmailVerificationModel.create({
        email: testEmail,
        verified: false,
        created: dayjs().subtract(20, 'minute').toDate(),
      });
      await expect(() => createVerificationData(testEmail)).resolves;
      const testDummyElement = await createVerificationData(testEmail);

      expect(testDummyElement.email).toBe(testEmail);
    });

    test('isEmailVerified function - returns true if verified', async () => {
      await createDummyVerificationEntry(undefined, true);
      await expect(isEmailVerified(testEmail)).resolves.toBe(true);
    });

    test('isEmailVerified function - returns false', async () => {
      await createDummyVerificationEntry(undefined, false);
      await expect(isEmailVerified(testEmail)).resolves.toBe(false);
    });

    describe('Validate code functionality', () => {
      test('return invalid verification code', async () => {
        await createDummyVerificationEntry();
        const res = await validateCode(testEmail, '222222');
        expect(res).toEqual({
          result: false,
          msg: 'Invalid verification code',
        });
      });

      test('request has expired - returns the correct response', async () => {
        // Create dummy
        await EmailVerificationModel.create({
          email: testEmail,
          verified: false,
          code: '211111',
          created: dayjs().subtract(60, 'minute').toDate(),
          expires: dayjs().subtract(30, 'minute').toDate(),
        });

        // Attempt to validate
        const res = await validateCode(testEmail, '211111');
        expect(res).toEqual({
          result: false,
          msg: 'Request has expired',
        });
      });

      test('validation is complete and document is updated correctly', async () => {
        const doc = await EmailVerificationModel.create({
          email: testEmail,
          verified: false,
          code: '211111',
          created: dayjs().toDate(),
          expires: dayjs().add(60, 'minutes'),
        });
        const res = await validateCode(testEmail, '211111');
        expect(res.result).toBe(true);
        expect(res.msg).toBeNull();

        // Fetch the doc and verify it was updated properly
        const updatedDoc = await EmailVerificationModel.findById(
          doc._id
        ).exec();
        expect(updatedDoc.code).toBe('');
        expect(updatedDoc.expires).toBeNull();
        expect(updatedDoc.verified).toBe(true);
      });
    });
  });
});

