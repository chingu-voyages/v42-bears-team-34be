import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import supertest from 'supertest';
import { expect, jest, test } from '@jest/globals';
import app from '../../index';
import { ApplicationModel } from '../../schemas/application';
import { ApplicationStatus } from '../../schemas/application-status';
import { HEADERS } from '../../services/test-helpers/headers/headers';
import loginUser from '../../services/test-helpers/login-user/login-user';
import {
  APP_POST_DATA,
  createMockApplication,
} from '../../services/test-helpers/mock-application/mock-application';
import createMockUser from '../../services/test-helpers/mock-user/create-mock-user';
import { EmailServiceClient } from '../../services/email-service-client/email-service-client';

const request = supertest(app);
const OLD_ENV = process.env;

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
  jest.restoreAllMocks();
});

describe('Application tests', () => {
  beforeAll(() => {
    process.env = { ...OLD_ENV };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });
  describe('POST - MAKE APPLICATION', () => {
    test('400 - Pending application already exists', async () => {
      //  Create a user
      const testUser = await createMockUser(1);
      // Create a mock application
      const mockApplication = await createMockApplication(testUser[0]);
      mockApplication.status = ApplicationStatus.Pending;
      await mockApplication.save();
      const token = await loginUser(request, testUser[0], 'Password$123');
      const req = await request
        .post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA,
        });
      // An application should exist already, expect a 400 error
      expect(req.statusCode).toBe(400);
    });
    test('200 - Application created successfully', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');
      const req = await request
        .post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA,
        });

      expect(req.statusCode).toBe(200);
      expect(req.body.id).toBeDefined();
      const refreshedApplication = await ApplicationModel.findById(req.body.id);

      // Check that data is written to DB properly, application is in pending status
      // and the application is linked to the user
      expect(refreshedApplication.requestedBy).toBeDefined();
      expect(refreshedApplication.requestedBy.toString()).toBe(
        testUser._id.toString()
      );
      expect(refreshedApplication.applicantIncome).toBe(6000);
      expect(refreshedApplication.numberOfInstallments).toBe(12);
      expect(refreshedApplication.installmentAmount).toBe(100);
      expect(refreshedApplication.applicantOccupation).toBe('entrepreneur');
      expect(refreshedApplication.status).toBe('incomplete');
    });
    test('200 - user re-applying, no plaid data on user document', async () => {
      const [user] = await createMockUser(1);
      const mockApplication = await createMockApplication(user);
      const token = await loginUser(request, user, 'Password$123');
      const req = await request
        .post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA,
        });
      expect(req.body.msg).toBe('Existing incomplete application');
      expect(req.body.id).toBe(mockApplication._id.toString());
    });
    test('400 - user re-applying, plaid data on user document - should return error', async () => {
      const [user] = await createMockUser(1);
      user.plaidItemId = 'fakeItemId';
      user.plaidAccessToken = 'fakeToken';

      await user.save();

      await createMockApplication(user);
      const token = await loginUser(request, user, 'Password$123');
      const req = await request
        .post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA,
        });

      expect(req.statusCode).toBe(400);
      expect(req.body.err).toBe('User has an application pending review.');
      expect(req.body.code).toBe('$PENDING_APPLICATION_EXISTS');
    });
    test('500 - trigger server error', async () => {
      // Simulate a database error
      jest
        .spyOn(ApplicationModel, 'create')
        .mockImplementation(() => Promise.reject(new Error('Fake error')));
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');
      const req = await request
        .post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA,
        });

      expect(req.statusCode).toBe(500);
    });
    test('400 - validation error - missing data', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');

      const incompleteData = {
        numberOfInstallments: 12,
        installmentAmount: 100,
        applicantOccupation: 'entrepreneur',
      };
      const req = await request
        .post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send(incompleteData);
      expect(req.statusCode).toBe(400);
      expect(req.body.err.length).toBe(3);
    });
    test('200 - Multiple applications allowed', async () => {
      process.env.ALLOW_MULTIPLE_APPLICATIONS = 'true';

      const [user] = await createMockUser(1);
      await createMockApplication(user);
      const token = await loginUser(request, user, 'Password$123');
      const req = await request
        .post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA,
        });

      expect(req.statusCode).toBe(200);
      expect(req.body.msg).toBe('Application received.');
      expect(req.body.id).toBeDefined();

      // We should have two applications in the DB for the mock user
      const applications = await ApplicationModel.find({
        requestedBy: user._id.toString(),
      });
      expect(applications.length).toBe(2);
      expect(
        applications.some((application) => application._id.toString() === req.body.id)
      ).toBe(true);
      process.env = OLD_ENV;
    });
  });
  describe('Get application for authenticated user', () => {
    test('200 - Normal user can get their own applications', async () => {
      const testUser = await createMockUser(1);
      const token = await loginUser(request, testUser[0], 'Password$123');
      await createMockApplication(testUser[0]);
      const req = await request
        .get('/api/application/my')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(200);
      expect(req.body).toBeDefined();
      expect(req.body).toHaveLength(1);
    });
    test('200 - not application found, expect empty array', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');
      const req = await request
        .get('/api/application/my')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(200);
      expect(req.body).toBeDefined();
      expect(req.body).toHaveLength(0);
    });
    test('500 - error occurs', async () => {
      const [testUser] = await createMockUser(1);
      const token = await loginUser(request, testUser, 'Password$123');
      jest
        .spyOn(ApplicationModel, 'find')
        .mockImplementation(() => new Error('fake error'));
      const req = await request
        .get('/api/application/my')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(500);
    });
  });
  describe('Get Application By Id', () => {
    test('200 - Admin can find an application by ID', async () => {
      const testUsers = await createMockUser(2);
      const adminUser = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );

      const user0Application = await createMockApplication(testUsers[0]);

      // Create some dummy applications
      const tok1 = await loginUser(request, testUsers[0], 'Password$123');
      const tok2 = await loginUser(request, testUsers[1], 'Password$123');
      const adminToken = await loginUser(request, adminUser[0], 'Password$123');

      const adminRequest = await request
        .get(`/api/application/view/${user0Application._id.toString()}`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${adminToken}`,
        })
        .send();

      expect(adminRequest.statusCode).toBe(200);

      // User1 should be able to get their own application
      const user1Request = await request
        .get(`/api/application/view/${user0Application._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${tok1}` })
        .send();

      expect(user1Request.statusCode).toBe(200);
      expect(user1Request.status).toBeDefined();

      // User2 should not be able to get user1's applcations - returns 404
      const user2Request = await request
        .get(`/api/application/view/${user0Application._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${tok2}` });
      expect(user2Request.statusCode).toBe(404);
    });
    test('Rejeted application returns a reason', async () => {
      const [testUser] = await createMockUser(1);
      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const mockApplication = await createMockApplication(testUser);

      mockApplication.status = ApplicationStatus.Rejected;
      mockApplication.rejectedReason = 'fake reason';
      await mockApplication.save();

      const adminToken = await loginUser(request, adminUser, 'Password$123');
      const adminRequest = await request
        .get(`/api/application/view/${mockApplication._id.toString()}`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${adminToken}`,
        })
        .send();
      expect(adminRequest.body.status).toBe(ApplicationStatus.Rejected);
      expect(adminRequest.body.rejectedReason).toBe('fake reason');
    });
    test('500 - method throws error', async () => {
      jest
        .spyOn(ApplicationModel, 'findOne')
        .mockImplementation(() => new Error('fake rejection error'));
      const testUser = await createMockUser(1);
      const adminUser = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const mockApplication = await createMockApplication(testUser[0]);

      const adminToken = await loginUser(request, adminUser[0], 'Password$123');

      const adminRequest = await request
        .get(`/api/application/view/${mockApplication._id.toString()}`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${adminToken}`,
        })
        .send();
      expect(adminRequest.statusCode).toBe(500);
    });
  });

  describe('PAYMENTS SIZE', () => {
    test("400 - Returns error if the request isn't a number", async () => {
      const req = await request
        .get('/api/application/payment_size?requestedLoanAmount=abcdefg')
        .set(HEADERS.formUrlEncoded)
        .send();
      expect(req.statusCode).toBe(400);
    });
    test('400 - returns error if value is an integer of 0 or less', async () => {
      const req = await request
        .get('/api/application/payment_size?requestedLoanAmount=0')
        .set(HEADERS.formUrlEncoded)
        .send();
      expect(req.statusCode).toBe(400);
    });
    test('200 - Returns values for the query', async () => {
      const req = await request
        .get('/api/application/payment_size?requestedLoanAmount=1000')
        .set(HEADERS.formUrlEncoded)
        .send();
      expect(req.statusCode).toBe(200);
      const data = Object.values(req.body).every(
        (value) => !Number.isNaN(value) && value > 0
      );
      const keys = Object.keys(req.body);
      expect(data).toBe(true);
      expect(keys.every((key) => key >= 2 && key <= 12)).toBe(true);
    });
  });
  describe('CANCEL Application', () => {
    test('200 - User cancels own application', async () => {
      const [testUser] = await createMockUser(1);
      const testApplication = await createMockApplication(testUser);
      testApplication.status = ApplicationStatus.Pending;
      await testApplication.save();

      const token = await loginUser(request, testUser, 'Password$123');

      const req = await request
        .post(`/api/application/cancel/${testApplication._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(200);

      // Grab the application and make sure the status is updated correctly.
      const updatedApplication = await ApplicationModel.findById(
        testApplication._id.toString()
      );
      expect(updatedApplication.status).toBe(ApplicationStatus.Cancelled);
    });
    test("404 - User tries to cancel application that they don't own", async () => {
      const [testUser0, testUser1] = await createMockUser(2);
      const testApplication = await createMockApplication(testUser1);
      const token = await loginUser(request, testUser0, 'Password$123');
      const req = await request
        .post(`/api/application/cancel/${testApplication._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();

      expect(req.statusCode).toBe(404);
    });
    test("200 - admin can cancel a user's application", async () => {
      const [testUser] = await createMockUser(1);
      const testApplication = await createMockApplication(testUser);
      testApplication.status = ApplicationStatus.Pending;
      await testApplication.save();

      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const token = await loginUser(request, adminUser, 'Password$123');
      const req = await request
        .post(`/api/application/cancel/${testApplication._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(200);
    });
    test('500 - server error occurs', async () => {
      const [testUser] = await createMockUser(1);
      const testApplication = await createMockApplication(testUser);

      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const token = await loginUser(request, adminUser, 'Password$123');
      jest
        .spyOn(ApplicationModel, 'findOne')
        .mockImplementation(() => new Error('fake error'));
      const req = await request
        .post(`/api/application/cancel/${testApplication._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(500);
    });
  });
  describe('ADMIN - get all applications', () => {
    test('401 - normal user tries to get all applications admin route', async () => {
      const [testUser] = await createMockUser(4);
      const token = await loginUser(request, testUser, 'Password$123');

      const req = await request
        .get('/api/admin/application/all?page=1&count=3')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();

      expect(req.statusCode).toBe(401);
    });
    test('200 - Admin can get all applications. Count route returns correct number', async () => {
      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const testUsers = await createMockUser(4);
      await Promise.all(
        testUsers.map((testUser) => createMockApplication(testUser))
      );
      const token = await loginUser(request, adminUser, 'Password$123');
      let req = await request
        .get('/api/admin/application/all?page=0&count=10')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.body.applications).toBeDefined();
      expect(req.body.applications.length).toBe(4);
      expect(req.statusCode).toBe(200);

      req = await request
        .get('/api/admin/application/count')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.body).toBe(4);
    });
    test('500 - count route returns server error', async () => {
      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const token = await loginUser(request, adminUser, 'Password$123');
      jest
        .spyOn(ApplicationModel, 'count')
        .mockImplementation(() => Promise.reject(new Error('fake error')));
      const req = await request
        .get('/api/admin/application/count')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(500);
    });
    test('500 - Server error when trying to get all applications', async () => {
      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const token = await loginUser(request, adminUser, 'Password$123');

      jest
        .spyOn(ApplicationModel, 'find')
        .mockImplementation(() => new Error('fake error'));
      const req = await request
        .get('/api/admin/application/all?page=0&count=10')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(500);
    });
  });
  describe('APPLICATION actions', () => {
    describe('approve actions', () => {
      test('401 - User tries to take an illegal action on application', async () => {
        const [testUser] = await createMockUser(1);
        await createMockApplication(testUser);

        const token = await loginUser(request, testUser, 'Password$123');
        const dummyId = mongoose.Types.ObjectId();
        const req = await request
          .patch(`/api/admin/application/approve/${dummyId}`)
          .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
          .send();

        const cancelReq = await request
          .patch(`/api/admin/application/reject/${dummyId}`)
          .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
          .send();
        expect(req.statusCode).toBe(401);
        expect(cancelReq.statusCode).toBe(401);
      });
      test('200 - Admin user can approve an application', async () => {
        const [adminUser] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined,
          'admin'
        );
        const [user] = await createMockUser(1);

        const mockApplication = await createMockApplication(user);
        const adminToken = await loginUser(request, adminUser, 'Password$123');

        const req = await request
          .patch(
            `/api/admin/application/approve/${mockApplication._id.toString()}`
          )
          .set({
            ...HEADERS.formUrlEncoded,
            authorization: `Bearer ${adminToken}`,
          })
          .send();
        expect(req.body.msg).toBeDefined();
        expect(req.body.msg.includes('Approving application')).toBe(true);
        expect(req.body.id).toBe(mockApplication._id.toString());
      });
      test('404 - application was not found', async () => {
        const [adminUser] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined,
          'admin'
        );
        const [user] = await createMockUser(1);
        const adminToken = await loginUser(request, adminUser, 'Password$123');
        const mockApplication = await createMockApplication(user);
        jest
          .spyOn(ApplicationModel, 'findById')
          .mockImplementation(() => undefined);
        const req = await request
          .patch(
            `/api/admin/application/approve/${mockApplication._id.toString()}`
          )
          .set({
            ...HEADERS.formUrlEncoded,
            authorization: `Bearer ${adminToken}`,
          })
          .send();
        expect(req.statusCode).toBe(404);
      });
      test('500 - Generate 500 error', async () => {
        jest
          .spyOn(ApplicationModel, 'findById')
          .mockImplementation(() => new Error('mock error'));
        const [adminUser] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined,
          'admin'
        );
        const [user] = await createMockUser(1);

        const mockApplication = await createMockApplication(user);
        const adminToken = await loginUser(request, adminUser, 'Password$123');

        const req = await request
          .patch(
            `/api/admin/application/approve/${mockApplication._id.toString()}`
          )
          .set({
            ...HEADERS.formUrlEncoded,
            authorization: `Bearer ${adminToken}`,
          })
          .send();
        expect(req.statusCode).toBe(500);
      });
    });
    describe('application reject actions', () => {
      test("404 - Attempt to reject an application that can't be found", async () => {
        const [adminUser] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined,
          'admin'
        );
        const fakeApplicationId = mongoose.Types.ObjectId();
        const adminToken = await loginUser(request, adminUser, 'Password$123');
        const req = await request
          .patch(`/api/admin/application/reject/${fakeApplicationId}`)
          .set({
            ...HEADERS.formUrlEncoded,
            authorization: `Bearer ${adminToken}`,
          })
          .send({ reason: 'test' });
        expect(req.statusCode).toBe(404);
      });
      test('201 - admin successfully rejects application', async () => {
        const [adminUser] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined,
          'admin'
        );
        const [user] = await createMockUser(1);
        const mockApplication = await createMockApplication(user);
        const adminToken = await loginUser(request, adminUser, 'Password$123');
        const req = await request
          .patch(
            `/api/admin/application/reject/${mockApplication._id.toString()}`
          )
          .set({
            ...HEADERS.formUrlEncoded,
            authorization: `Bearer ${adminToken}`,
          })
          .send({ reason: 'test' });
        expect(req.statusCode).toBe(201);
        expect(req.body.msg.includes('Rejecting application')).toBe(true);
        expect(req.body.reason).toBe('test');
        expect(req.body.id).toBe(mockApplication.id.toString());
        // Check the application
        const updatedApplication = await ApplicationModel.findById(
          mockApplication.id.toString()
        );
        expect(updatedApplication.status).toBe('rejected');
        expect(updatedApplication.rejectedReason).toBe('test');
        expect(updatedApplication.evaluatedBy.toString()).toBe(
          adminUser._id.toString()
        );
      });
      test('500 - Generate 500 error', async () => {
        jest
          .spyOn(ApplicationModel, 'findById')
          .mockImplementation(() => new Error('mock error'));
        const [adminUser] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined,
          'admin'
        );
        const [user] = await createMockUser(1);

        const mockApplication = await createMockApplication(user);
        const adminToken = await loginUser(request, adminUser, 'Password$123');

        const req = await request
          .patch(
            `/api/admin/application/reject/${mockApplication._id.toString()}`
          )
          .set({
            ...HEADERS.formUrlEncoded,
            authorization: `Bearer ${adminToken}`,
          })
          .send({ reason: 'test' });
        expect(req.statusCode).toBe(500);
      });
    });
    describe('Trigger welcome e-mail', () => {
      test('200 - should trigger welcome e-mail', async () => {
        // Create a user and assign an itemId
        const [user] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined
        );
        user.plaidItemId = 'fakeItemId';
        await user.save();

        const emailServiceSpy = jest
          .spyOn(EmailServiceClient.prototype, 'sendEmail')
          .mockResolvedValue(undefined);
        const mockApplication = await createMockApplication(user);
        const token = await loginUser(request, user, 'Password$123');
        const req = await request
          .post('/api/application/trigger-welcome-email')
          .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
          .send({
            itemId: 'fakeItemId',
            email: user.email,
            applicationId: mockApplication.id,
          });
        expect(req.statusCode).toBe(200);
        expect(emailServiceSpy).toHaveBeenCalled();
      });
      test('404 - welcome e-mail user not found', async () => {
        const [user] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined
        );
        user.plaidItemId = 'fakeItemId';
        await user.save();

        const mockApplicationId = mongoose.Types.ObjectId();
        const token = await loginUser(request, user, 'Password$123');
        const req = await request
          .post('/api/application/trigger-welcome-email')
          .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
          .send({
            itemId: 'fakeItemI',
            email: user.email,
            applicationId: mockApplicationId.toString(),
          });
        console.log(req.error);
        expect(req.statusCode).toBe(404);
      });
      test('500 - cause a server error', async () => {
        // Create a user and assign an itemId
        const [user] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined
        );
        user.plaidItemId = 'fakeItemId';
        await user.save();

        jest
          .spyOn(EmailServiceClient.prototype, 'sendEmail')
          .mockRejectedValue(undefined);
        const mockApplication = await createMockApplication(user);
        const token = await loginUser(request, user, 'Password$123');
        const req = await request
          .post('/api/application/trigger-welcome-email')
          .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
          .send({
            itemId: 'fakeItemId',
            email: user.email,
            applicationId: mockApplication.id,
          });
        expect(req.statusCode).toBe(500);
      });
    });
    describe('PATCH admin application status', () => {
      test('404 - application not found', async () => {
        const [adminUser] = await createMockUser(
          1,
          undefined,
          undefined,
          undefined,
          undefined,
          'admin'
        );
        const [user] = await createMockUser(1);
        const mockApplication = await createMockApplication(user);
        const adminToken = await loginUser(request, adminUser, 'Password$123');
        jest
          .spyOn(ApplicationModel, 'findById')
          .mockImplementation(() => undefined);
        const req = await request
          .patch(
            `/api/admin/application/update/${mockApplication._id.toString()}`
          )
          .set({
            ...HEADERS.formUrlEncoded,
            authorization: `Bearer ${adminToken}`,
          })
          .send({ action: 'mark_more_info_required', message: 'something' });
        expect(req.statusCode).toBe(404);
      });
    });
    test('500 - server error when updating status', async () => {
      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const [user] = await createMockUser(1);
      const mockApplication = await createMockApplication(user);
      const adminToken = await loginUser(request, adminUser, 'Password$123');
      jest
        .spyOn(ApplicationModel, 'findById')
        .mockImplementation(() => Promise.reject(new Error('fake error')));
      const req = await request
        .patch(
          `/api/admin/application/update/${mockApplication._id.toString()}`
        )
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${adminToken}`,
        })
        .send({ action: 'mark_more_info_required', message: 'something' });
      expect(req.statusCode).toBe(500);
    });
    test('different application status updates', async () => {
      const [adminUser] = await createMockUser(
        1,
        undefined,
        undefined,
        undefined,
        undefined,
        'admin'
      );
      const [user] = await createMockUser(1);
      const mockApplication = await createMockApplication(user);
      const adminToken = await loginUser(request, adminUser, 'Password$123');

      const applicationStatuses = [
        'mark_more_info_required',
        'mark_incomplete',
        'update_reject_reason',
        'admin_cancel',
        'fake-request',
      ];

      const result = await Promise.all(
        applicationStatuses.map((applicationStatus) => request
            .patch(
              `/api/admin/application/update/${mockApplication.id.toString()}`
            )
            .set({
              ...HEADERS.formUrlEncoded,
              authorization: `Bearer ${adminToken}`,
            })
            .send({ action: applicationStatus, message: applicationStatus }))
      );
      expect(result.filter((r) => r.statusCode === 400).length).toBe(1);
      expect(result.filter((r) => r.statusCode === 201).length).toBe(4);
    });
    test('200 - user patching own application', async () => {
      const [user] = await createMockUser(1);
      const mockApplication = await createMockApplication(user);

      const userToken = await loginUser(request, user, 'Password$123');
      const result = await request
        .patch(`/api/application/update/${mockApplication._id.toString()}`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${userToken}`,
        })
        .send({
          requestedLoanAmount: 2000,
          numberOfInstallments: 3,
          installmentAmount: 800,
          loanPurpose: 'rent',
          applicantOccupation: 'employee',
          applicantIncome: 5000,
        });
      expect(result.body.msg.includes(mockApplication._id.toString()));
    });
    test('400 - user encounters error patching own app', async () => {
      const [user] = await createMockUser(1);
      const mockApplication = await createMockApplication(user);

      const userToken = await loginUser(request, user, 'Password$123');
      jest
        .spyOn(ApplicationModel.prototype, 'save')
        .mockImplementation(() => Promise.reject(new Error('Fake error')));
      const result = await request
        .patch(`/api/application/update/${mockApplication._id.toString()}`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${userToken}`,
        })
        .send({
          requestedLoanAmount: 2000,
          numberOfInstallments: 3,
          installmentAmount: 800,
          loanPurpose: 'rent',
          applicantOccupation: 'employee',
          applicantIncome: 5000,
        });
      expect(result.statusCode).toBe(500);
    });
    test('401 - regular user trying to change another user`s application', async () => {
      const [firstUser, secondUserWithApplication] = await createMockUser(2);
      const mockApplication = await createMockApplication(
        secondUserWithApplication
      );

      const userToken = await loginUser(request, firstUser, 'Password$123');
      const result = await request
        .patch(`/api/application/update/${mockApplication._id.toString()}`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${userToken}`,
        })
        .send({
          requestedLoanAmount: 2000,
          numberOfInstallments: 3,
          installmentAmount: 800,
          loanPurpose: 'rent',
          applicantOccupation: 'employee',
          applicantIncome: 5000,
        });
      expect(result.statusCode).toBe(401);
    });
    test('404 - unabel to find application by id', async () => {
      const [user] = await createMockUser(1);

      const fakeApplicationId = mongoose.Types.ObjectId().toString();

      const userToken = await loginUser(request, user, 'Password$123');
      jest
        .spyOn(ApplicationModel.prototype, 'save')
        .mockImplementation(() => Promise.reject(new Error('Fake error')));
      const result = await request
        .patch(`/api/application/update/${fakeApplicationId}`)
        .set({
          ...HEADERS.formUrlEncoded,
          authorization: `Bearer ${userToken}`,
        })
        .send({
          requestedLoanAmount: 2000,
          numberOfInstallments: 3,
          installmentAmount: 800,
          loanPurpose: 'rent',
          applicantOccupation: 'employee',
          applicantIncome: 5000,
        });
      expect(result.statusCode).toBe(404);
    });
  });
});
