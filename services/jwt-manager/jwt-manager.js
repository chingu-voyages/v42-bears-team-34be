/* eslint-disable no-param-reassign */
/* eslint-disable import/prefer-default-export */
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
        jsonwebtoken.sign(payload, process.env.LOANAPP_JWT_SECRET, { algorithm: 'HS256'}, (err, token) => {
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
      jsonwebtoken.verify(data, process.env.LOANAPP_JWT_SECRET, { algorithm: 'HS256'}, (err, decoded) => {
        // eslint-disable-next-line prefer-promise-reject-errors
        if (err) reject(`There was a problem processing the JWT: ${err}`);
        resolve(decoded)
      })
    })
  }

  /**
   * 
   * @param {string} id 
   * @param {string} firstName 
   * @param {string} lastName 
   * @param {string} email 
   * @param {"admin" | "user"} role 
   * @returns {string} JWT Login token
   */
  static createLoginToken(id, firstName, lastName, email, role) {
    // make a JWT
    return jsonwebtoken.sign(
      {
          id,
          firstName,
          lastName,
          email,
          role
      }, 
      process.env.LOANAPP_JWT_SECRET,
      {
          expiresIn: process.env.LOANAPP_JWT_DURATION
      }
    )
  }

  /**
   * 
   * @param {string} oldToken The old JWT
   * @returns {string} Refreshed JWT
   */
  static createRefreshToken(oldToken) {
    // clear exp and iat
    delete oldToken.iat
    delete oldToken.exp
    return jsonwebtoken.sign(
      oldToken,
      process.env.LOANAPP_JWT_SECRET,
      {
          expiresIn: process.env.LOANAPP_JWT_DURATION
      }
  )
  }
}
