import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import * as PlaidMock from 'plaid';
import supertest from 'supertest';
import app from '../../index';
import User from '../../schemas/user';
import { HEADERS } from '../../services/test-helpers/headers/headers';
import loginUser from '../../services/test-helpers/login-user/login-user';
import createMockUser from '../../services/test-helpers/mock-user/create-mock-user';

const request = supertest(app);
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

beforeEach(() => {
  jest.clearAllMocks();
});
describe('PLAID tests', () => {
  describe('GET Link token', () => {
    test('200 - Link token created', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');
      const plaidInstanceSpy = jest
        .spyOn(PlaidMock.PlaidApi.prototype, 'linkTokenCreate')
        .mockImplementation(() =>
          Promise.resolve({
            data: {
              expiration: '2023-05-09T22:42:32Z',
              link_token: 'fakeLinkToken',
              request_id: 'fakeRequestId',
            },
          })
        );

      const req = await request
        .get('/api/plaid/get_token')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(plaidInstanceSpy).toHaveBeenCalled();
      expect(req.statusCode).toBe(200);
    });
    test('500 error response', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');
      const plaidInstanceSpy = jest
        .spyOn(PlaidMock.PlaidApi.prototype, 'linkTokenCreate')
        .mockImplementation(() => Promise.reject(new Error('Server Error')));

      const req = await request
        .get('/api/plaid/get_token')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(plaidInstanceSpy).toHaveBeenCalled();
      expect(req.statusCode).toBe(500);
    });
  });
  describe('Set Public Token', () => {
    test('Testing the public token', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');

      // Mock the itemPublicToken
      const itemPublicTokenSpy = jest
        .spyOn(PlaidMock.PlaidApi.prototype, 'itemPublicTokenExchange')
        .mockImplementation(() =>
          Promise.resolve({
            data: {
              access_token: 'dummyToken',
              item_id: 'dummyItemId',
            },
          })
        );
      jest
        .spyOn(PlaidMock.PlaidApi.prototype, 'linkTokenCreate')
        .mockImplementation(() =>
          Promise.resolve({
            data: {
              expiration: '2023-05-09T22:42:32Z',
              link_token: 'fakeLinkToken',
              request_id: 'fakeRequestId',
            },
          })
        );
      const req = await request
        .post('/api/plaid/set_public_token')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({ publicToken: 'fakeLinkToken' });
      expect(req.statusCode).toBe(201);
      expect(itemPublicTokenSpy).toHaveBeenCalled();

      const refreshedUser = await User.findById(testUser._id.toString());
      // Test that the user document is updated properly
      expect(refreshedUser.plaidAccessToken).toBe('dummyToken');
      expect(refreshedUser.plaidItemId).toBe('dummyItemId');
    });
    test('500 error response', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');

      // Mock the itemPublicToken
      jest
        .spyOn(PlaidMock.PlaidApi.prototype, 'itemPublicTokenExchange')
        .mockImplementation(() => Promise.reject(new Error('Mock rejected')));
      const req = await request
        .post('/api/plaid/set_public_token')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({ publicToken: 'fakeLinkToken' });

      expect(req.statusCode).toBe(500);
    });
  });
  describe('Get financial details by userId', () => {
    test('404 - Admin tries to get financial data for user who does not exist', async () => {
      // Create a dummy user and admin
      const [testAdmin] = await createMockUser(
        1,
        undefined,
        undefined,
        'admin',
        undefined,
        'admin'
      );

      // Log both users in
      const testAdminToken = await loginUser(
        request,
        testAdmin,
        'Password$123'
      );

      // Create a dummy ID to search
      const dummyId = mongoose.Types.ObjectId();
      const req = await request
        .get(`/api/plaid/financial_details/${dummyId}?category=balance`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${testAdminToken}`,
        })
        .send();

      expect(req.statusCode).toBe(404);
    });
    test('400 - Access token is not found on target user', async () => {
      const [testUser] = await createMockUser(1);
      const [testAdmin] = await createMockUser(
        1,
        undefined,
        undefined,
        'admin',
        undefined,
        'admin'
      );
      const testAdminToken = await loginUser(
        request,
        testAdmin,
        'Password$123'
      );

      const req = await request
        .get(
          `/api/plaid/financial_details/${testUser._id.toString()}?category=balance`
        )
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${testAdminToken}`,
        })
        .send();

      // Since the access_token has not been set on testUser, this should return 400
      expect(req.statusCode).toBe(400);
    });
    test('200 Response', async () => {
      const [testUser] = await createMockUser(1);
      const [testAdmin] = await createMockUser(
        1,
        undefined,
        undefined,
        'admin',
        undefined,
        'admin'
      );
      const testAdminToken = await loginUser(
        request,
        testAdmin,
        'Password$123'
      );

      const financialRequestSpy = jest
        .spyOn(PlaidMock.PlaidApi.prototype, 'liabilitiesGet')
        .mockImplementation(() => Promise.resolve({ data: 'mockData' }));
      // Add a token to the user
      testUser.plaidAccessToken = 'dummyToken';
      await testUser.save();
      const req = await request
        .get(
          `/api/plaid/financial_details/${testUser._id.toString()}?category=balance`
        )
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${testAdminToken}`,
        })
        .send();

      expect(req.statusCode).toBe(200);
      expect(financialRequestSpy).toHaveBeenCalled();
    });
    test('500 response', async () => {
      const [testUser] = await createMockUser(1);
      const [testAdmin] = await createMockUser(
        1,
        undefined,
        undefined,
        'admin',
        undefined,
        'admin'
      );
      const testAdminToken = await loginUser(
        request,
        testAdmin,
        'Password$123'
      );

      jest
        .spyOn(PlaidMock.PlaidApi.prototype, 'liabilitiesGet')
        .mockImplementation(() => Promise.reject(new Error('Error')));
      // Add a token to the user
      testUser.plaidAccessToken = 'dummyToken';
      await testUser.save();
      const req = await request
        .get(
          `/api/plaid/financial_details/${testUser._id.toString()}?category=balance`
        )
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${testAdminToken}`,
        })
        .send();
      expect(req.statusCode).toBe(500);
    });
  });
});
