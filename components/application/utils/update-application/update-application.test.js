import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { expect, test } from '@jest/globals';
import createMockUser from '../../../../services/test-helpers/mock-user/create-mock-user';
import { createMockApplication } from '../../../../services/test-helpers/mock-application/mock-application';
import { ApplicationStatus } from '../../../../schemas/application-status';
import updateAndReconcileApplications from './update-application';
import { ApplicationModel } from '../../../../schemas/application';

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

describe('update application', () => {
  test('Finds and updates applications properly', async () => {
    const [mockUser] = await createMockUser(1);
    await Promise.all([
      createMockApplication(mockUser, { status: ApplicationStatus.Incomplete }),
      createMockApplication(mockUser, { status: ApplicationStatus.Incomplete }),
      createMockApplication(mockUser, { status: ApplicationStatus.Pending }),
    ]);

    mockUser.plaidItemId = 'dummyId';
    mockUser.plaidAccessToken = 'mockToken';
    await mockUser.save();

    const result = await updateAndReconcileApplications(mockUser._id);

    const updatedApplications = await ApplicationModel.find({
      requestedBy: mockUser._id,
    });
    expect(result.modifiedCount).toBe(2); // Expect that two applications were updated
    expect(updatedApplications.length).toBe(3);
    expect(
      updatedApplications.every(
        (application) => application.status === ApplicationStatus.Pending
      )
    ).toBeTruthy();
  });
  test('No applications are found with the proper status', async () => {
    const [mockUser] = await createMockUser(1);
    await Promise.all([
      createMockApplication(mockUser, { status: ApplicationStatus.Pending }),
      createMockApplication(mockUser, { status: ApplicationStatus.Approved }),
      createMockApplication(mockUser, {
        status: ApplicationStatus.MoreInfoRequired,
      }),
    ]);

    mockUser.plaidItemId = 'dummyId';
    mockUser.plaidAccessToken = 'mockToken';
    await mockUser.save();

    const result = await updateAndReconcileApplications(mockUser._id);
    expect(result.matchedCount).toBe(0);
    expect(result.modifiedCount).toBe(0);
  });
  test('User has no plaidToken or itemId, expect updater to be undefined', async () => {
    const [mockUser] = await createMockUser(1);
    await Promise.all([
      createMockApplication(mockUser, { status: ApplicationStatus.Incomplete }),
      createMockApplication(mockUser, { status: ApplicationStatus.Incomplete }),
      createMockApplication(mockUser, { status: ApplicationStatus.Pending }),
    ]);
    const result = await updateAndReconcileApplications(mockUser._id);
    expect(result).not.toBeDefined();
  });
});
