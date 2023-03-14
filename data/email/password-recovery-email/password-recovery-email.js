import { BaseEmail } from "../base-email.js";

export class PasswordRecoveryEmail extends BaseEmail {
	/**
	 * 
	 * @param {string} recipient e-mail address of recipient
	 * @param {string} recoveryURL Formatted https url
	 */
	constructor(recipient, recoveryURL) {
		const subject = 'Password recovery';
		const htmlBody = `<p>Click <a href="${recoveryURL}">here</a></p> <p>or the link here <a href="${recoveryURL}>${recoveryURL}</a> to reset your password</p>`
		super(
			recipient,
			subject,
			htmlBody
		);
	}
}
