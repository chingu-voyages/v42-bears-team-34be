import { describe, jest, test } from '@jest/globals';
import dayjs from 'dayjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import * as UUID from 'uuid';
import app from '../../index';
import { EmailVerificationModel } from '../../schemas/email-verification';
import User from '../../schemas/user';
import { emailServiceClient } from '../../services/email-service-client/email-service-client';
import { JWTManager } from '../../services/jwt-manager/jwt-manager';
import { HEADERS } from '../../services/test-helpers/headers/headers.js';
import loginUser from '../../services/test-helpers/login-user/login-user';
import createMockUser from '../../services/test-helpers/mock-user/create-mock-user.js';
import * as VerificationData from '../../services/verification-data/verification-data';
import * as Helpers from './helpers/helpers';

const request = supertest(app);
let mongoServer;
const dbOptions = {
  autoIndex: false,
  serverSelectionTimeoutMS: 5000,
  family: 4,
};

jest.mock('../../services/email-service-client/email-service-client');
jest.mock('uuid');

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

beforeEach(() => {
  jest.clearAllMocks();
});
async function createUserGroup() {
  const adminUser = await createMockUser(
    1,
    null,
    null,
    'admin',
    'mockPassword1',
    'admin'
  );
  const normalUsers = await createMockUser(3);

  return { adminUser, normalUsers };
}

describe('Authentication route tests', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  describe('LOGIN tests', () => {
    describe('BAD LOGIN REQUEST', () => {
      test('401: No such user', async () => {
        const res = await request
          .post('/api/auth/login')
          .set(HEADERS.formUrlEncoded)
          .send({ email: 'testemail@example.com', password: '12345' });
        expect(res.statusCode).toBe(401);
      });
    });
    test('401: Incorrect username/password', async () => {
      // create a mock user
      await createMockUser(1);
      const res = await request
        .post('/api/auth/login')
        .set(HEADERS.formUrlEncoded)
        .send({ email: 'mockEmail1@example.com', password: '12345' });
      expect(res.statusCode).toBe(401);
    });
    test('401 - Inactive user', async () => {
      const user = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'user',
        false
      );
      const res = await request
        .post('/api/auth/login')
        .set(HEADERS.formUrlEncoded)
        .send({ email: user[0].email, password: 'Password$123' });
      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('$INACTIVE_USER');
    });
    test('200 - Valid login request', async () => {
      const mockEmail = 'mock1@example.com';
      const mockPassword = 'mockPassword$1';

      await createMockUser(1, null, null, 'mock', mockPassword);
      const res = await request
        .post('/api/auth/login')
        .set(HEADERS.formUrlEncoded)
        .send({ email: mockEmail, password: mockPassword });
      expect(res.statusCode).toBe(200);
      expect(res.body.tok).toBeDefined();
    });
    test('500 - Server error logging in', async () => {
      const mockEmail = 'mock1@example.com';
      const mockPassword = 'mockPassword$1';

      await createMockUser(1, null, null, 'mock', mockPassword);
      jest
        .spyOn(User, 'findOne')
        .mockImplementation(() => new Error('fakeError'));
      const res = await request
        .post('/api/auth/login')
        .set(HEADERS.formUrlEncoded)
        .send({ email: mockEmail, password: mockPassword });
      expect(res.statusCode).toBe(500);
    });
  });
  describe('ADMIN', () => {
    describe('Create admin account', () => {
      test('201 - creates admin account correctly', async () => {
        const res = await request
          .post('/api/auth/admin-create')
          .set({
            ...HEADERS.formUrlEncoded,
            'x-api-key': process.env.ADMIN_TOKEN,
          })
          .send({
            email: 'admin@example.com',
            firstName: 'fnadmin',
            lastName: 'lnadmin',
            applicantGender: 'female',
            password: 'Password$123',
          });
        expect(res.statusCode).toBe(201);
        expect(res.body.msg).toBe('Admin account created');

        const adminUser = await User.findOne({
          email: 'admin@example.com',
        }).exec();

        expect(adminUser).toBeDefined();
        expect(adminUser.role).toBe('admin');
      });
      test('401 - Invalid admin token', async () => {
        const res = await request
          .post('/api/auth/admin-create')
          .set({ ...HEADERS.formUrlEncoded, 'x-api-key': '' })
          .send({
            email: 'admin@example.com',
            firstName: 'fnadmin',
            lastName: 'lnadmin',
            applicantGender: 'female',
            password: 'Password$123',
          });
        expect(res.statusCode).toBe(401);
      });
      test('500 - server error', async () => {
        jest
          .spyOn(User.prototype, 'save')
          .mockImplementation(() => Promise.reject(new Error('mockError')));
        const res = await request
          .post('/api/auth/admin-create')
          .set({
            ...HEADERS.formUrlEncoded,
            'x-api-key': process.env.ADMIN_TOKEN,
          })
          .send({
            email: 'admin@example.com',
            firstName: 'fnadmin',
            lastName: 'lnadmin',
            applicantGender: 'female',
            password: 'Password$123',
          });
        expect(res.statusCode).toBe(500);
      });
    });
  });
  describe('SIGN UP', () => {
    const mockUser = {
      role: 'user',
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'dummy@example.com',
      password: 'passworD$123',
      applicantGender: 'female',
      streetAddress: '1234',
      unitNumber: 'BSMT',
      city: 'Placeholder',
      postalCode: 'R1R1R1',
      province: 'on',
      additionalAddress: undefined,
      dateOfBirth: '2000-04-01',
    };
    test('400 - Sign up fails because user already exists', async () => {
      const testUser = await createMockUser(1);
      const invalidRequestData = {
        ...mockUser,
        email: testUser[0].email,
        firstName: testUser[0].firstName,
        lastName: testUser[0].lastName,
      };

      const res = await request
        .post('/api/auth/signup')
        .set(HEADERS.formUrlEncoded)
        .send({
          ...invalidRequestData,
        });
      expect(res.statusCode).toBe(400);
      const errorTextObject = JSON.parse(res.error.text);
      expect(errorTextObject.code).toBe('$EMAIL_EXISTS');
    });
    test('201 - Account is created successfully', async () => {
      const res = await request
        .post('/api/auth/signup')
        .set(HEADERS.formUrlEncoded)
        .send(mockUser);

      expect(res.statusCode).toBe(201);
      expect(res.body.msg).toBeDefined();
    });
    test('500 - Server error during sign-up', async () => {
      jest
        .spyOn(User, 'findOne')
        .mockImplementation(() => Promise.reject(new Error('fake error')));
      const res = await request
        .post('/api/auth/signup')
        .set(HEADERS.formUrlEncoded)
        .send(mockUser);
      expect(res.statusCode).toBe(500);
    });
  });

  describe('METHODS', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });
    describe('getUserById', () => {
      describe('ADMIN', () => {
        test('200 - get any user by Id', async () => {
          const { adminUser, normalUsers } = await createUserGroup();
          // log the admin in
          const loginRequest = await request
            .post('/api/auth/login')
            .set(HEADERS.formUrlEncoded)
            .send({ email: adminUser[0].email, password: 'mockPassword1' });

          const adminLoginToken = loginRequest.body.tok;

          // Request to get the user
          const res = await request
            .get(`/api/auth/user/${normalUsers[0]._id}`)
            .set({ authorization: `Bearer ${adminLoginToken}` })
            .send();

          expect(res.statusCode).toBe(200);
          expect(res.body.id).toBe(normalUsers[0]._id.toString());
        });
        test('404 - get user that is not found', async () => {
          const { adminUser } = await createUserGroup();
          // log the admin in
          const loginRequest = await request
            .post('/api/auth/login')
            .set(HEADERS.formUrlEncoded)
            .send({ email: adminUser[0].email, password: 'mockPassword1' });

          const adminLoginToken = loginRequest.body.tok;
          const id = mongoose.Types.ObjectId();
          // return 404
          const res = await request
            .get(`/api/auth/user/${id.toString()}`)
            .set({ authorization: `Bearer ${adminLoginToken}` })
            .send();
          expect(res.statusCode).toBe(404);
        });
        test('500 - Invalid mongoObjectId gives a server error', async () => {
          const { adminUser } = await createUserGroup();
          // log the admin in
          const loginRequest = await request
            .post('/api/auth/login')
            .set(HEADERS.formUrlEncoded)
            .send({ email: adminUser[0].email, password: 'mockPassword1' });
          const adminLoginToken = loginRequest.body.tok;
          // Return 500
          const res = await request
            .get(`/api/auth/user/1`)
            .set({ authorization: `Bearer ${adminLoginToken}` })
            .send();
          expect(res.statusCode).toBe(500);
        });
      });
      describe('USER', () => {
        test('401 - tries to access another user by id', async () => {
          const { _, normalUsers } = await createUserGroup();
          const mockUser = await createMockUser(
            1,
            undefined,
            undefined,
            'bigtest',
            'mockPassword1'
          );
          const loginRequest = await request
            .post('/api/auth/login')
            .set(HEADERS.formUrlEncoded)
            .send({ email: mockUser[0].email, password: 'mockPassword1' });

          const { tok } = loginRequest.body;
          const req = await request
            .get(`/api/auth/user/${normalUsers[0]._id.toString()}`)
            .set({ authorization: `Bearer ${tok}` })
            .send();
          expect(req.statusCode).toBe(401);
        });
        test('200 - Access own user id', async () => {
          const mockUser = await createMockUser(
            1,
            undefined,
            undefined,
            'bigtest',
            'mockPassword1'
          );
          const loginRequest = await request
            .post('/api/auth/login')
            .set(HEADERS.formUrlEncoded)
            .send({ email: mockUser[0].email, password: 'mockPassword1' });

          const { tok } = loginRequest.body;
          const req = await request
            .get(`/api/auth/user/${mockUser[0]._id.toString()}`)
            .set({ authorization: `Bearer ${tok}` })
            .send();
          expect(req.statusCode).toBe(200);
        });
      });
    });
    describe('PATCH USER ATTRIBUTES', () => {
      test('401 - Authenticated user can only update their own profile', async () => {
        const mockUser = await createMockUser(2);
        const token = await loginUser(request, mockUser[0], 'Password$123');
        const req = await request
          .patch(`/api/auth/user/${mockUser[1]._id.toString()}`)
          .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
          .send({
            firstName: 'fn',
            lastName: 'ln',
            city: 'city',
            postalCode: 'L0L0L0',
            province: 'ON',
            applicantGender: 'female',
            dateOfBirth: dayjs().subtract(18, 'years').toDate(),
            streetAddress: '500 SW ST',
          });
        expect(req.statusCode).toBe(401);
      });
      test('201 - Patch user success', async () => {
        const mockUser = await createMockUser(1);
        const token = await loginUser(request, mockUser[0], 'Password$123');
        const req = await request
          .patch(`/api/auth/user/${mockUser[0]._id.toString()}`)
          .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
          .send({
            firstName: 'fn1122',
            lastName: 'ln2233',
            streetAddress: '200 New Address',
            city: 'Fake City',
            postalCode: 'L0L0L0',
            province: 'SK',
            applicantGender: 'other',
            dateOfBirth: new Date().toISOString(),
          });
        expect(req.statusCode).toBe(201);
        // Confirm data has been patched
        const verifyUser = await User.findById(mockUser[0]._id.toString());
        expect(verifyUser.firstName).toBe('fn1122');
        expect(verifyUser.address.city).toBe('Fake City');
        expect(verifyUser.address.province).toBe('SK');
      });
    });
    describe('GET PROFILE', () => {
      test('200 - User can get profile', async () => {
        const user = await createMockUser(1);
        const token = await loginUser(request, user[0], 'Password$123');

        const req = await request
          .get('/api/auth/profile')
          .set({ authorization: `Bearer ${token}` })
          .send();
        expect(req.statusCode).toBe(200);
      });
    });
  });
  describe('PASSWORD RECOVERY', () => {
    describe('POST request password recovery', () => {
      test('200 - user not found - get correct response message', async () => {
        const req = await request
          .post('/api/auth/password-recovery/request')
          .set(HEADERS.formUrlEncoded)
          .send({ email: 'dummy@example.com' });

        expect(req.statusCode).toBe(200);
        expect(req.body.msg.includes("User wasn't found")).toBe(true);
      });

      test('200 - Check that methods are called properly', async () => {
        const jwtManagerSpy = jest.spyOn(JWTManager, 'sign');
        const generatePasswordRecoveryURLSpy = jest
          .spyOn(Helpers, 'generatePasswordRecoveryURL')
          .mockReturnValueOnce('mockUrl');
        const emailServiceClientSpy = jest
          .spyOn(emailServiceClient, 'sendEmail')
          .mockImplementation(() => Promise.resolve());
        const v4Spy = jest.spyOn(UUID, 'v4').mockReturnValueOnce('1234');
        const dummyAccounts = await createMockUser(1);
        const req = await request
          .post('/api/auth/password-recovery/request')
          .set(HEADERS.formUrlEncoded)
          .send({ email: dummyAccounts[0].email });

        expect(jwtManagerSpy).toHaveBeenCalled();
        expect(generatePasswordRecoveryURLSpy).toHaveBeenCalled();
        expect(emailServiceClientSpy).toHaveBeenCalled();
        expect(v4Spy).toHaveBeenCalled();

        const savedUser = await User.findOne({ email: dummyAccounts[0].email });
        expect(savedUser.recoveryToken).toBeDefined();
        expect(savedUser.recoveryToken).toBe('1234');
        expect(req.statusCode).toBe(200);
      });
    });
    describe('POST Recovery - UpdatePassword', () => {
      test('500 - malformed token', async () => {
        const req = await request
          .post('/api/auth/password-recovery/update-password')
          .set(HEADERS.formUrlEncoded)
          .send({ password: 'Password$123', token: 'fakeToken' });

        expect(req.statusCode).toBe(500);
      });
      test('400 - Invaid or expired token', async () => {
        const jwtSpy = jest
          .spyOn(JWTManager, 'verify')
          .mockImplementation(() =>
            Promise.resolve({ recoveryToken: 'dummyToken ' })
          );
        const req = await request
          .post('/api/auth/password-recovery/update-password')
          .set(HEADERS.formUrlEncoded)
          .send({ password: 'Password$123', token: 'fakeToken' });

        expect(req.statusCode).toBe(400);
        expect(jwtSpy).toHaveBeenCalledWith('fakeToken');
        expect(req.error.text.includes('Invalid or expired')).toBe(true);
      });
      test('201 - recovery flow', async () => {
        const user = await createMockUser(1);
        // Mock the recoveryToken and the jwtToken
        jest.spyOn(UUID, 'v4').mockReturnValueOnce('1234');
        jest
          .spyOn(emailServiceClient, 'sendEmail')
          .mockImplementation(() => Promise.resolve());
        const recoveryJWToken = await JWTManager.sign({
          email: user[0].email,
          createdAt: dayjs().toDate(),
          expires: dayjs().add(30, 'minutes').toDate(),
          recoveryToken: '1234',
          isAdmin: false,
        });
        jest
          .spyOn(JWTManager, 'sign')
          .mockImplementation(() => Promise.resolve(recoveryJWToken));

        // Create the request
        await request
          .post('/api/auth/password-recovery/request')
          .set(HEADERS.formUrlEncoded)
          .send({ email: user[0].email });

        // Attempt the password reset process
        const recoveryRequest = await request
          .post('/api/auth/password-recovery/update-password')
          .set(HEADERS.formUrlEncoded)
          .send({ password: 'NewPassword$123', token: recoveryJWToken });
        expect(recoveryRequest.statusCode).toBe(201);
        expect(recoveryRequest.body.password).toBe('NewPassword$123');
      });
    });
  });
  describe('EMAIL VERIFICATION', () => {
    test('400 - Email is already verified', async () => {
      const testUser = await createMockUser(1);
      await EmailVerificationModel.create({
        email: testUser[0].email,
        code: '111111',
        verified: true,
      });

      const req = await request
        .post('/api/auth/verification-code-email')
        .set(HEADERS.formUrlEncoded)
        .send({ email: testUser[0].email, code: '111111' });

      expect(req.statusCode).toBe(400);
      expect(
        JSON.parse(req.error.text).err.includes('E-mail address is already')
      ).toBe(true);
    });
    test('400 - Invalid request for the e-mail address', async () => {
      const testUser = await createMockUser(1);
      const verificationDataSpy = jest
        .spyOn(VerificationData, 'createVerificationData')
        .mockImplementation(() => Promise.resolve(null));

      const req = await request
        .post('/api/auth/verification-code-email')
        .set(HEADERS.formUrlEncoded)
        .send({ email: testUser[0].email });
      expect(verificationDataSpy).toHaveBeenCalled();
      expect(req.statusCode).toBe(400);
    });
    test('500 - verification code is not defined', async () => {
      const testUser = await createMockUser(1);
      const verificationDataSpy = jest
        .spyOn(VerificationData, 'createVerificationData')
        .mockImplementation(() =>
          Promise.resolve({
            _id: 'mockId',
            email: testUser[0].email,
            verified: false,
            created: new Date(),
            expires: new Date(),
          })
        );

      const req = await request
        .post('/api/auth/verification-code-email')
        .set(HEADERS.formUrlEncoded)
        .send({ email: testUser[0].email });
      expect(verificationDataSpy).toHaveBeenCalled();
      expect(req.statusCode).toBe(500);
    });
    test('200 - sends verification code e-mail successfully', async () => {
      const testUser = await createMockUser(1);
      jest
        .spyOn(VerificationData, 'createVerificationData')
        .mockImplementation(() =>
          Promise.resolve({
            _id: 'mockId',
            email: testUser[0].email,
            code: '123456',
            verified: false,
            created: new Date(),
            expires: new Date(),
          })
        );

      const emailSenderSpy = jest
        .spyOn(emailServiceClient, 'sendEmail')
        .mockResolvedValue();

      const req = await request
        .post('/api/auth/verification-code-email')
        .set(HEADERS.formUrlEncoded)
        .send({ email: testUser[0].email });

      expect(emailSenderSpy).toHaveBeenCalledWith('/verification-code', {
        recipient: testUser[0].email,
        code: '123456',
      });
      expect(req.statusCode).toBe(200);
    });
    describe('CHECK IF EMAIL IS VERIFIED', () => {
      test('200 - Email is verified expect correct message', async () => {
        const testUser = await createMockUser(1);
        await EmailVerificationModel.create({
          email: testUser[0].email,
          code: '123456',
          verified: true,
          created: new Date(),
          expires: new Date(),
        });
        const req = await request
          .get(`/api/auth/isEmailVerified/${testUser[0].email}`)
          .set(HEADERS.formUrlEncoded)
          .send();
        expect(req.body.value).toBeDefined();
        expect(req.body.value).toBe(true);
        expect(req.statusCode).toBe(200);
      });
      test('200 - Email is not verified, expect correct message', async () => {
        const testUser = await createMockUser(1);
        await EmailVerificationModel.create({
          email: testUser[0].email,
          code: '123456',
          verified: false,
          created: new Date(),
          expires: new Date(),
        });
        const req = await request
          .get(`/api/auth/isEmailVerified/${testUser[0].email}`)
          .set(HEADERS.formUrlEncoded)
          .send();
        expect(req.body.value).toBeDefined();
        expect(req.body.value).toBe(false);
        expect(req.statusCode).toBe(200);
      });
    });
  });
});
