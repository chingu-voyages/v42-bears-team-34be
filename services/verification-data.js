import { EmailVerificationModel } from "../schemas/email-verification.js";
import dayjs from "dayjs";

/**
 * This method handles the logic for sending the verification code e-mail
 * When to send it, generating codes, marking if the verification was complete
 * @param {string} email
 * @returns {Promise<{ _id: any, email: string, code: string, verified: boolean, created: Date, expires: Date, createdAt: Date, updatedAt: Date}> | Promise<null>}
 */
export async function createVerificationData (email) {
	const verificationDocument = await EmailVerificationModel.findOne({ email: email }).exec();
	if (!verificationDocument) {
		// Create an entry
		return createNewVerificationEntry(email)
	}

	// Verified e-mails don't need to be verified again
	if (verificationDocument.verified === true) return null;

	// If one already exists and is not expired, just return it
	if (!isExpired(verificationDocument.expires)) {
		return verificationDocument
	} else {
		// If it's expired, update
		return refreshRequest(verificationDocument);
	}
}

/**
 * 
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export async function emailVerified(email) {
	const verificationDocument = await EmailVerificationModel.findOne({ email: email }).exec();
	return verificationDocument.verified === true;
}

async function createNewVerificationEntry(email) {
	return EmailVerificationModel.create({
		email: email,
		code: generateVerificationCode(),
		created: new Date(),
		expires: dayjs().add(20, 'minute').toDate()
	})
}

/**
 * 
 */
function generateVerificationCode() {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validates and updates the verification document
 * @param {*} email 
 * @param {*} code
 * @returns {Promise<{ result: boolean, msg: string}>} if it's valid, patch and return true
 */
export async function validateCode(email, code) {
	const verificationDocument = await EmailVerificationModel.findOne({ email: email, code: code }).exec();
	if (!verificationDocument) return { result: false, msg: 'Invalid verification code'};

	// We found something. Make sure it hasn't expired
	if (isExpired(verificationDocument.expires)) {
		return {
			result: false,
			msg: 'Request has expired'
		}
	}

	// Else we should pass validation and mark the code as claimed
	verificationDocument.code = "";
	verificationDocument.verified = true;
	verificationDocument.expires = null;
	await verificationDocument.save();

	return {
		result: true,
		msg: null
	}
}

function isExpired(expiryDate) {
	return dayjs().isAfter(dayjs(expiryDate));
}


function refreshRequest(doc) {
	doc.code = generateVerificationCode();
	doc.created = new Date();
	doc.expires = dayjs().add(20, 'minute').toDate();
	return doc.save();
}
