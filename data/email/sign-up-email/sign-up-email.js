// This e-mail is sent when the user signs up

import { BaseEmail } from "../base-email.js";
import ejs from 'ejs';
const html = `
<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Recovery E-mail</title>
  </head>
  <body>
		<p>Hello, <%= name %></p>
		<p>Thank you for registering for an AVCDOLOAN </p>
		<p> We have received your application</p>
		<p> Expect a response between 24-72 business hours.</p>
  <footer>
    <p>Best regards,</p>
    <p>AVOCDOLOAN Admin Team</p>
  </footer>
  </body>
  </html>
`
export class SignUpEmail extends BaseEmail {
	/**
	 * 
	 * @param {string} recipient e-mail address of recipient
	 * @param {*} name 
	 */
	constructor(recipient, name) {
		const subject = `AVCDOLOAN Sign up`;
		const htmlBody = {
			html: ejs.render(html, { name: name }),
			text: 
			`Hello${name}
			Thank you for registering for an AVCDOLOAN 
			We have received your application.
			Expect a response between 24-72 business hours.

			If you have received this in error, please e-mail us at ${process.env.ADMIN_EMAIL}
      Best regards,
      AVCDOLOAN Admin Team
			`
		};
		super(
			recipient,
			subject,
			htmlBody
		)
	}
}
