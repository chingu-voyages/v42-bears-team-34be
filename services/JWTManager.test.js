
import { JWTManager } from "./JWTManager"
import { jest } from "@jest/globals"

const OLD_ENV = process.env;

describe("JW Token Manager tests", () => {
	beforeAll(() => {
		jest.resetModules();
		process.env = {...OLD_ENV}
	})
	afterAll(() => {
		process.env = OLD_ENV
	})
	const mockPayload = {
		id: 12345,
		email: "test@email.com",
	}
	test("JWT Manager creates a token from payload", async() =>{
		const res = await JWTManager.sign(mockPayload);
		expect(res).toBeDefined();
	});

	test("JWT Manager verifies a token correctly", async() => {
		const token = await JWTManager.sign(mockPayload);
		const verifiedData = await JWTManager.verify(token);
		expect(verifiedData.id).toBe(12345);
		expect(verifiedData.email).toBe("test@email.com")
	})

	test("throws error when secret key is not defined", async ()=> {
		process.env.LOANAPP_JWT_SECRET = undefined;
		await expect( ()=> JWTManager.sign(mockPayload)).rejects.toThrow();
		process.env = OLD_ENV;
	})
	describe("JWT - create login token", ()=> {
		test("creates login token", async ()=> {
			const token = JWTManager.createLoginToken("12345", "testFirstName", "testLastName", "test@example.com", "user");
			expect(token).toBeDefined();
			
			const verifiedData = await JWTManager.verify(token);
			expect(verifiedData.id).toBe("12345");
			expect(verifiedData.firstName).toBe("testFirstName");
			expect(verifiedData.lastName).toBe("testLastName");
			expect(verifiedData.email).toBe("test@example.com");
			expect(verifiedData.role).toBe("user");
			expect(verifiedData.iat).toBeDefined();
			expect(verifiedData.exp).toBeDefined();
		})
	})
	describe("JWT refresh token tests", ()=> {
		test("creates refresh token successfully", async () => {
			// Create a basic token
			const token = JWTManager.createLoginToken("12345", "testFirstName", "testLastName", "test@example.com", "user");

			// Verify the token
			const verifiedToken = await JWTManager.verify(token);
			const refreshToken = JWTManager.createRefreshToken(verifiedToken)
			expect(refreshToken).toBeDefined()
		})
	})
})
