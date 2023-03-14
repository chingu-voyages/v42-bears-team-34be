import jsonwebtoken from "jsonwebtoken";
export class JWTManager {
	/**
	 * 
	 * @param {{[keyof: string]: any}} payload Object to tokenize
	 * @returns {Promise<string>} token 
	 */
	static async sign (payload) {
		return new Promise((resolve, reject) => {
				// Created JWT from payload
				jsonwebtoken.sign(payload, process.env.PASSWORD_RECOVERY_SECRET, { algorithm: 'HS256'}, (err, token) => {
					if (err) reject(err);
					resolve(token);
				})
		})
	}

	/**
	 * 
	 * @param {string} data JWT Token
	 * @returns {Promise<{ [keyof: string]: any }} decoded object
	 */
	static async verify (data) {
		return new Promise((resolve, reject) => {
			jsonwebtoken.verify(data, process.env.PASSWORD_RECOVERY_SECRET, { algorithm: 'HS256'}, (err, decoded) => {
				if (err) reject(err);
				resolve(decoded)
			})
		})
	}
}
