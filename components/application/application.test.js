import { afterEach, beforeAll } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import supertest from "supertest";
import app from "../../index";
import { ApplicationModel } from "../../schemas/application";
import { ApplicationStatus } from "../../schemas/application-status";
import { HEADERS } from "../../services/test-helpers/headers/headers";
import loginUser from "../../services/test-helpers/login-user/login-user";
import { APP_POST_DATA, createMockApplication } from "../../services/test-helpers/mock-application/mock-application";
import createMockUser from "../../services/test-helpers/mock-user/create-mock-user";

const request = supertest(app);
const OLD_ENV = process.env;

let mongoServer;
const dbOptions = {
  autoIndex: false,
  serverSelectionTimeoutMS: 5000,
  family: 4,
}

beforeEach(async () => {
  mongoose.set('strictQuery', false);
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  try {
    await mongoose.connect(mongoUri, dbOptions);
  } catch (err) {
    console.error("Mongo error", err)
  }
})

afterEach(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(() => {
  jest.restoreAllMocks();
})

describe("Application tests", () => {
  beforeAll(() => {
    process.env = { ...OLD_ENV }
  });
  afterAll(() => {
    process.env = OLD_ENV
  })
  describe("POST - MAKE APPLICATION", () => {
    test("400 - Pending application already exists", async () => {
      //  Create a user
      const testUser = await createMockUser(1);
      // Create a mock application
      await createMockApplication(testUser[0]);
      const token = await loginUser(request, testUser[0], "Password$123");
      const req = await request.post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA
        });
      // An application should exist already, expect a 400 error
      expect(req.statusCode).toBe(400)
    })
    test("200 - Application create successfully", async () => {
      const testUser = await createMockUser(1);
      const token = await loginUser(request, testUser[0], "Password$123");
      const req = await request.post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA
        });

      expect(req.statusCode).toBe(200);
      expect(req.body.id).toBeDefined();
      const refreshedApplication = await ApplicationModel.findById(req.body.id);
      
      // Check that data is written to DB properly, application is in pending status
      // and the application is linked to the user
      expect(refreshedApplication.requestedBy).toBeDefined();
      expect(refreshedApplication.requestedBy.toString()).toBe(testUser[0]._id.toString());
      expect(refreshedApplication.applicantIncome).toBe(6000);
      expect(refreshedApplication.numberOfInstallments).toBe(12);
      expect(refreshedApplication.installmentAmount).toBe(100);
      expect(refreshedApplication.applicantOccupation).toBe("entrepreneur");
      expect(refreshedApplication.status).toBe("pending");
    });
    test("500 - trigger server error", async () => {
      // Simulate a database error
      jest.spyOn(ApplicationModel, "create").mockImplementation(() => Promise.reject(new Error("Fake error")))
      const testUser = await createMockUser(1);
      const token = await loginUser(request, testUser[0], "Password$123");
      const req = await request.post('/api/application/apply')
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send({
          ...APP_POST_DATA
        });
      
      expect(req.statusCode).toBe(500);
    })
  })
  describe("Get application for authenticated user", () => {
    test("200 - Normal user can get their own applications", async () => {
      const testUser = await createMockUser(1);
      const token = await loginUser(request, testUser[0], "Password$123");
      await createMockApplication(testUser[0]);
      const req = await request.get("/api/application/my")
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(200);
      expect(req.body).toBeDefined();
      expect(req.body).toHaveLength(1);
    });
    test("200 - not application found, expect empty array", async () => {
      const testUser = await createMockUser(1);
      const token = await loginUser(request, testUser[0], "Password$123");
      const req = await request.get("/api/application/my")
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${token}` })
        .send();
      expect(req.statusCode).toBe(200);
      expect(req.body).toBeDefined();
      expect(req.body).toHaveLength(0);
    })
  })
  describe("Get Application By Id", () => {
    test("200 - Admin can find an application by ID", async () => {
      const testUsers = await createMockUser(2);
      const adminUser = await createMockUser(1, undefined, undefined, undefined, undefined, "admin");

      const user0Application = await createMockApplication(testUsers[0]);

      // Create some dummy applications
      const tok1 = await loginUser(request, testUsers[0], "Password$123");
      const tok2 = await loginUser(request, testUsers[1], "Password$123");
      const adminToken = await loginUser(request, adminUser[0], "Password$123");
      
      const adminRequest = await request.get(`/api/application/view/${user0Application._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${adminToken}` })
        .send();
      
      expect(adminRequest.statusCode).toBe(200);


      // User1 should be able to get their own application
      const user1Request = await request.get(`/api/application/view/${user0Application._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${tok1}` })
        .send();
      
      expect(user1Request.statusCode).toBe(200);
      expect(user1Request.status).toBeDefined();
      
      // User2 should not be able to get user1's applcations - returns 404
      const user2Request = await request.get(`/api/application/view/${user0Application._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${tok2}` });
      expect(user2Request.statusCode).toBe(404);
    });
    test("Rejeted application returns a reason", async () => {
      const testUser = await createMockUser(1);
      const adminUser = await createMockUser(1, undefined, undefined, undefined, undefined, "admin")
      const mockApplication = await createMockApplication(testUser[0]);

      mockApplication.status = ApplicationStatus.Rejected;
      mockApplication.rejectedReason = "fake reason";
      await mockApplication.save();

      const adminToken = await loginUser(request, adminUser[0], "Password$123");
      const adminRequest = await request.get(`/api/application/view/${mockApplication._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${adminToken}` })
        .send();
      expect(adminRequest.body.status).toBe(ApplicationStatus.Rejected);
      expect(adminRequest.body.rejectedReason).toBe("fake reason");
    });
    test("500 - method throws error", async () => {
      jest.spyOn(ApplicationModel, "findOne").mockImplementation(() => new Error("fake rejection error"));
      const testUser = await createMockUser(1);
      const adminUser = await createMockUser(1, undefined, undefined, undefined, undefined, "admin")
      const mockApplication = await createMockApplication(testUser[0]);

      const adminToken = await loginUser(request, adminUser[0], "Password$123");

      const adminRequest = await request.get(`/api/application/view/${mockApplication._id.toString()}`)
        .set({ ...HEADERS.formUrlEncoded, authorization: `Bearer ${adminToken}` })
        .send();
      expect(adminRequest.statusCode).toBe(500);
    })
  })

  describe("PAYMENTS SIZE", () => {
    test("400 - Returns error if the request isn't a number", async () => {
      const req = await request.get("/api/application/payment_size?requestedLoanAmount=abcdefg")
        .set(HEADERS.formUrlEncoded)
        .send();
      expect(req.statusCode).toBe(400);
    });
    test("400 - returns error if value is an integer of 0 or less", async () => {
      const req = await request.get("/api/application/payment_size?requestedLoanAmount=0")
        .set(HEADERS.formUrlEncoded)
        .send();
      expect(req.statusCode).toBe(400);
    })
    test("200 - Returns values for the query", async () => {
      const req = await request.get("/api/application/payment_size?requestedLoanAmount=1000")
        .set(HEADERS.formUrlEncoded)
        .send();
      expect(req.statusCode).toBe(200);
      const data = Object.values(req.body).every((value) => !Number.isNaN(value) && value> 0);
      const keys = Object.keys(req.body)
      expect(data).toBe(true);
      expect(keys.every(key => key >= 2 && key <= 12 )).toBe(true)
    })
  })
})