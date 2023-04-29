// Mock users created for testing

import dayjs from "dayjs";
import User from "../../../schemas/user.js"
import bcrypt from "bcrypt"
/**
 * 
 * @param {number} count 
 * @param {string} firstName 
 * @param {string} lastName 
 * @param {string} email 
 * @param {string} password 
 * @param {"user" | "admin"} role 
 * @returns {Promise<any[]>} Array of create mongo user documents 
 */
export async function createMockUser(
    count,
    firstName,
    lastName,
    email,
    password,
    role
    ) {
    const dummies = [];
    for (let i = 1; i <= count; i++) {
        dummies.push(
            generateUserData(i,
                firstName, lastName, undefined, email, undefined, password, role)
        )
    }
    return Promise.all((dummies.map((dummy) => {
       return User.create(dummy)
    })))
}
function generateUserData(
    idx=1,
    firstName="muFirstName",
    lastName="muLastName",
    dateOfBirth=dayjs().subtract(19, "years").toDate(),
    email="mockEmail",
    applicantGender="male",
    password="Password$123",
    role="user"
) {
    return {
        firstName: firstName + idx,
        lastName: lastName + idx,
        dateOfBirth: dateOfBirth,
        email: `${email}${idx}@example.com`,
        applicantGender: applicantGender,
        dateSignedUp: dayjs().toDate(),
        hashedPassword: bcrypt.hashSync(password, 10),
        role: role
    }
}