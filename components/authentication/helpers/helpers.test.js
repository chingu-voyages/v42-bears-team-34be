import { jest } from "@jest/globals";
import User from "../../../schemas/user";
import { checkIfUserExistsInDb } from "./helpers";

jest.mock("../../../schemas/user");

beforeEach(() => jest.restoreAllMocks())
describe("Helpers", () => {
  describe("Check if user exists", () => {
    test("Returns true if exists", async () => {
      User.findOne.mockImplementation(() => Promise.resolve({ value: true }))
      const res = await checkIfUserExistsInDb("dummy@example.com");
      expect(res).toBe(true)
    });
    test("Returns false", async () => {
      jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null))
      const res = await checkIfUserExistsInDb("dummy@example.com");
      expect(res).toBe(false)
    })
  })
})