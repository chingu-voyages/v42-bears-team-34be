import nodemailer from 'nodemailer';
import dotenv from 'dotenv'
import { BaseEmail } from '../data/email/base-email.js';
// environment variables must be set before connection with db is established
dotenv.config()
/**
 * Handles e-mailing from the admin account
 * E-mail the admin when a new
 */
export class Emailer {
	#sender;
	#transporter;
	constructor() {
		this.#sender = process.env.ADMIN_EMAIL;
		this.#transporter = nodemailer.createTransport({
			host: process.env.EMAIL_HOST,
			port: 465,
			secure: true,
			auth: {
				user: process.env.ADMIN_EMAIL,
				pass: process.env.ADMIN_EMAIL_PASSWORD
			}
		})
	}
	/**
	 *  Send an e-mail
	 * @param {BaseEmail} email 
	 */
	async sendEmail (email) {
		try {
			const res = await this.#transporter.sendMail({
				from: this.#sender,
				...email.getEmail()
			});
			console.log(res)
		} catch (err) {
			console.log(err)
			throw new Error(err)
		}
	}
}
