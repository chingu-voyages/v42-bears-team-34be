// Mock users created for testing

import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import User from '../../../schemas/user.js';

function generateUserData(
  idx = 1,
  firstName = 'muFirstName',
  lastName = 'muLastName',
  dateOfBirth = dayjs().subtract(19, 'years').toDate(),
  email = 'mockEmail',
  applicantGender = 'male',
  password = 'Password$123',
  role = 'user'
) {
  return {
    firstName: firstName + idx,
    lastName: lastName + idx,
    dateOfBirth,
    email: `${email}${idx}@example.com`,
    applicantGender,
    dateSignedUp: dayjs().toDate(),
    hashedPassword: bcrypt.hashSync(password, 10),
    role,
  };
}
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
async function createMockUser(
  count,
  firstName,
  lastName,
  email,
  password,
  role
) {
  const dummies = [];
  for (let i = 1; i <= count; i += 1) {
    dummies.push(
      generateUserData(
        i,
        firstName,
        lastName,
        undefined,
        email,
        undefined,
        password,
        role
      )
    );
  }
  return Promise.all(dummies.map((dummy) => User.create(dummy)));
}

export default createMockUser;
