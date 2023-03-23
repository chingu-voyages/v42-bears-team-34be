import { BaseEmail } from "../base-email.js";
import ejs from 'ejs';

const html =`
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
    <p>Here's your password reset link:</p>

    <a href="<%= recoveryURL %>"><%= recoveryURL %></a>
    <p>Do not share this link with anyone else, as this can be used to gain control of your account.</p>
    <p>If you have received this in error, please e-mail us at ${process.env.ADMIN_EMAIL}</p>

  <footer>
    <p>Best regards,</p>
    <p>AVOCDOLOAN Admin Team</p>
  </footer>
  </body>
  </html>
`

export class PasswordRecoveryEmail extends BaseEmail {
  /**
   * 
   * @param {string} recipient e-mail address of recipient
   * @param {string} recoveryURL Formatted https url
   */
  constructor(recipient, name, recoveryURL) {
    const subject = `AVCDOLOAN Password recovery link`;
    const htmlBody = { 
      html: ejs.render(html, { recoveryURL: recoveryURL, name: name } ), 
      text: 
      `Hello, ${name}

      Here's your password reset link:
      ${recoveryURL}

      Do not share this link with anyone else, as this can be used to gain control of your account.

      If you have received this in error, please e-mail us at ${process.env.ADMIN_EMAIL}
      Best regards,
      AVCDOLOAN Admin Team
      `
  };

    super(
      recipient,
      subject,
      htmlBody
    );
  }
}
