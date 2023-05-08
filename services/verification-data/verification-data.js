import dayjs from 'dayjs';
import { EmailVerificationModel } from '../../schemas/email-verification.js';

function isExpired(expiryDate) {
  return dayjs().isAfter(dayjs(expiryDate));
}
/**
 * Produces a 6-digit verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createNewVerificationEntry(email) {
  return EmailVerificationModel.create({
    email,
    code: generateVerificationCode(),
    created: new Date(),
    expires: dayjs().add(20, 'minute').toDate(),
  });
}

function refreshRequest(doc) {
  const document = doc;
  document.code = generateVerificationCode();
  document.created = new Date();
  document.expires = dayjs().add(20, 'minute').toDate();
  return document.save();
}

/**
 * This method handles the logic for sending the verification code e-mail
 * When to send it, generating codes, marking if the verification was complete
 * @param {string} email
 * @returns {Promise<{ _id: any, email: string, code: string, verified: boolean, created: Date, expires: Date, createdAt: Date, updatedAt: Date}> | Promise<null>}
 */
export async function createVerificationData(email) {
  const verificationDocument = await EmailVerificationModel.findOne({
    email,
  }).exec();
  if (!verificationDocument) {
    // Create an entry
    return createNewVerificationEntry(email);
  }

  // Verified e-mails don't need to be verified again
  if (verificationDocument.verified === true) return null;

  // Let's give this a 20 minute cooling off period so we don't send too many requests just in case
  if (dayjs().isBefore(dayjs(verificationDocument.created).add(20, 'minute'))) {
    throw new Error('Verification code cool off period');
  }

  // If one already exists and is not expired, just return it
  if (!isExpired(verificationDocument.expires)) {
    return verificationDocument;
  }
  // If it's expired, update
  return refreshRequest(verificationDocument);
}

/**
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function isEmailVerified(email) {
  const verificationDocument = await EmailVerificationModel.findOne({
    email,
  }).exec();
  return verificationDocument?.verified === true;
}

/**
 * Validates and updates the verification document
 * @param {*} email
 * @param {*} code
 * @returns {Promise<{ result: boolean, msg: string}>} if it's valid, patch and return true
 */
export async function validateCode(email, code) {
  const verificationDocument = await EmailVerificationModel.findOne({
    email,
    code,
  }).exec();
  if (!verificationDocument)
    return { result: false, msg: 'Invalid verification code' };

  // We found something. Make sure it hasn't expired
  if (isExpired(verificationDocument.expires)) {
    return {
      result: false,
      msg: 'Request has expired',
    };
  }

  // Else we should pass validation and mark the code as claimed
  verificationDocument.code = '';
  verificationDocument.verified = true;
  verificationDocument.expires = null;
  await verificationDocument.save();

  return {
    result: true,
    msg: null,
  };
}
