import { JWTManager } from "../../jwt-manager/jwt-manager.js";
/**
 * Create JWTToken for test purposes
 * @param {*} user 
 */
export function getTestToken(user) {
    const { _id, firstName, lastName, email, role } = user;
    return JWTManager.createLoginToken(_id, firstName, lastName, email, role)
}