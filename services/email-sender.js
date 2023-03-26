import { Emailer } from "./emailer.js"
/**
 * 
 * @param {{Object}} email 
 * @returns {Promise<void>} Promise
 */
export async function sendEmail(email) {
	const emailer = new Emailer();
	return emailer.sendEmail(email);
}
