import User from '../../../schemas/user.js';
import { IS_PRODUCTION } from '../../../services/environment.js';

export function generatePasswordRecoveryURL(token) {
	// We need to determine the development environment.
	if (IS_PRODUCTION) {
		return `${process.env.PRODUCTION_APP_DOMAIN}/password-reset/recover?token=${token}`;
	}
	return `${process.env.DEV_APP_DOMAIN}/password-reset/recover?token=${token}`;
}

/**
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function checkIfUserExistsInDb(email) {
	const user = await User.findOne({ email });
  if (user) return true;
  return false;
}
