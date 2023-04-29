// libraries
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
// validator
import dayjs from 'dayjs';
import {
  adminAuthTokenGuard,
  adminCreationGuard,
  adminCreationValidator,
  idValidator,
  loginCredentialsValidator,
  passwordRecoveryRequestEmailValidator,
  passwordRecoveryUpdatePasswordValidator,
  patchUserAttributesValidator,
  requestVerificationCodeValidator,
  userProfileValidator,
  verifyEmailAddressRequestValidator,
  verifyEmailIsValidatedValidator,
} from './validators.js';

// schemas
import User from '../../schemas/user.js';

// services
import { protectedRoute } from '../../middleware/protectedRoute.js';
import { emailServiceClient } from '../../services/email-service-client/email-service-client.js';
import { JWTManager } from '../../services/jwt-manager/jwt-manager.js';
import {
  createVerificationData,
  isEmailVerified,
  validateCode,
} from '../../services/verification-data/verification-data.js';
import { checkIfUserExistsInDb, generatePasswordRecoveryURL } from './helpers/helpers.js';

// create account
// this should schedule an "activate your account" email.
async function postSignUp(req, res) {
	try {
		/* First we should safely check if the e-mail already exists in our db
            If it does, we can return a 400 error and prompt the client to log in
        */
		const userAlreadyExists = await checkIfUserExistsInDb(req.body.email);
		if (userAlreadyExists) {
			return res.status(400).json({
				err: `${req.body.email} already exists.`,
				code: '$EMAIL_EXISTS',
			});
		}

		const addressInfo = {
			streetAddress: req.body.streetAddress,
			unitNumber: req.body.unitNumber,
			city: req.body.city,
			postalCode: req.body.postalCode,
			province: req.body.province,
			additionalAddress: req.body.additionalAddress,
		};

		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const newUser = new User({
			role: 'user',
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			email: req.body.email,
			hashedPassword,
			dateOfBirth: new Date(req.body.dateOfBirth),
			dateSignedUp: new Date(Date.now()),
			applicantGender: req.body.applicantGender,
			address: addressInfo,
			active: true, // make this one false when email integration is functional
		});

		// we actually need to throw an error, this doesn't do it by itself
		const err = newUser.validateSync();
		if (err) {
			throw err;
		}

		await newUser.save();
		// Send a welcome e-mail to  the user
		res.status(201).json({
			msg: "Your account has been created, but it's pending activation. (not really, just login)",
		});
	} catch (e) {
		console.error(e.error);
		res.status(500).json({
			msg: `Something went wrong: ${e.message}`,
		});
	}
}

/* Create admin account 
  admin account creation environment variable needs to be set to true for this to work
  admin token needs to be in the 'x-api-key' req.header for this to work
*/
async function postCreateAdmin(req, res) {
	try {
		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const newUser = new User({
			role: 'admin',
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			email: req.body.email,
			hashedPassword,
			dateSignedUp: new Date(Date.now()), // not necessary for admin
			dateOfBirth: new Date(Date.now()), // not necessary for admin
			applicantGender: req.body.applicantGender,
			active: true,
		});
		newUser.validateSync();
		await newUser.save();
		res.status(201).json({
			msg: 'Admin account created',
		});
	} catch (e) {
		console.error(e.error);
		res.status(500).json({
			msg: `Something went wrong: ${e.message}`,
		});
	}
}

// login
async function postLogin(req, res) {
	/*
        - get e-mail and password from request
        - check hashed password against hashed password in database (for now it's just plain text)
        - use bcrypt to encode / decode it
        - if it's ok, send a token
    */
	try {
		const user = await User.findOne({
			email: req.body.email,
		}).exec();

		// user can be null.
		if (!user)
			return res
				.status(401)
				.json({
					err: 'User not found or password is incorrect.',
					code: '$INVALID_USER_OR_PASSWORD',
				});

		// compare hashedPassword with the provided password
		const result = await bcrypt.compare(req.body.password, user.hashedPassword);

		if (!result)
			return res
				.status(401)
				.json({ err: 'User not found or password is incorrect.' });

		const { _id, firstName, lastName, email, role } = user;

		// If the isAdmin flag is present and set to true, make sure the
		// user actually has an admin status. If they don't, throw
		if (req.body.isAdmin === 'true') {
			if (role !== 'admin') {
				return res
					.status(401)
					.json({
						err: 'Access is denied due to invalid access level',
						code: '$INVALID_USER_OR_PASSWORD',
					});
			}
		}

		// make a JWT
		const token = JWTManager.createLoginToken(
			_id,
			firstName,
			lastName,
			email,
			role
		);

		// send it back
		res.status(200).json({
			tok: token,
		});
	} catch (e) {
		res.status(500).json({
			err: e.message,
		});
	}
}

// jwt refresh
// if the token is within the expiraiton period,
// returns a fresh one.
function postRefresh(req, res) {
	// What should this actually do?
	// A valid token for a deleted user profile can lead to
	// undefined behavior
	// should we make a DB query to see if the user is still active?
	try {
		const oldToken = { ...req.auth };
		// we don't need to check if it's null or undefined because the
		// protectedRoute middleware did this before we got here.
		if (oldToken.expired)
			return res.status(401).json({
				err: 'Expired session. Please login again.',
			});

		// Grab a refresh token using the token manager
		const newToken = JWTManager.createRefreshToken(oldToken);

		res.status(200).json({
			tok: newToken,
		});
	} catch (e) {
		res.status(500).json({
			err: e.message,
		});
	}
}

/**
 * Mainly used for fetching the user profile associated with the application.
 */
async function getUserById(req, res, next) {
	// For non-admins, you can get only your own user info by ID
	// Only admins can get other users by id
	try {
		const { id } = req.params;
		if (req.auth.role !== 'admin') {
			if (id !== req.auth.id) {
				return res.status(401).json({
					err: 'Invalid request. Invalid access.',
				});
			}
		}

		const user = await User.findById(id).exec();
		if (!user)
			return res.status(404).json({
				err: `User not found with id ${id}`,
			});
		return res.status(200).send({
			id: user._id.toString(),
			address: {
				...user.address,
			},
			dateSignedUp: user.dateSignedUp,
			firstName: user.firstName,
			lastName: user.lastName,
			dateOfBirth: user.dateOfBirth,
			email: user.email,
			applicantGender: user.applicantGender,
			plaid: !!(user.plaidAccessToken && user.plaidItemId),
		});
	} catch (error) {
		return next(error);
	}
}

// For checking if the JWT is readable
function getProfile(req, res) {
	// middleware should have placed the
	// token inside the Authorization header before the request gets here.
	// if it's expired, it will return a object with a single "expired = true" field.
	res.json(req.auth);
}

// send a "change password" e-mail
async function postRequestPasswordRecovery(req, res) {
	/*
        DOS
        - should this directly set something within the user document
        - or should this simply enqueue a "password change" without changing anything
          within the user document?
    */

	// Find the user by e-mail. Create a token from the data and send an e-mail
	const { email } = req.body;

	try {
		const user = await User.findOne({ email }).exec();
		if (!user) {
			// Do nothing
			return res.status(200).send({ msg: "User wasn't found, but OK" });
		}

		// Use the token manager to tokenize password recovery
		// Also generate a UUID to store on user document
		const recoveryToken = uuidv4();

		const token = await JWTManager.sign({
			email: user.email,
			createdAt: dayjs().toDate(),
			expires: dayjs().add(30, 'minutes').toDate(),
			recoveryToken,
			isAdmin: user.role === 'admin',
		});
		const recoveryURL = generatePasswordRecoveryURL(token);
		const userName = `${user.firstName} ${user.lastName}`;

		await emailServiceClient.sendEmail('/recovery-email', {
			recipient: user.email,
			name: userName,
			recoveryURL,
			adminEmail: process.env.ADMIN_EMAIL,
		});
		user.recoveryToken = recoveryToken;
		await user.save();
		return res.status(200).send({
			msg: 'OK',
		});
	} catch (err) {
		console.log(`${JSON.stringify(err?.response?.data?.err)}`);
		return res.status(500).json({
			err: `Unable to complete recovery operation: ${err.message})}`,
		});
	}
}

/**
 * This patches the user's details
 */
async function patchUpdateUserAttributes(req, res) {
	const { id } = req.params;
	// Authenticated user can only update their own profile
	if (req.auth.id !== id)
		return res
			.status(401)
			.json({ err: 'Update user attributes: not an authorized operation' });

	try {
		const user = await User.findById(id).exec();
		if (!user)
			return res.status(404).json({ err: `User with ${id} not found.` });
		const {
			firstName,
			lastName,
			city,
			province,
			postalCode,
			additionalAddress,
			unitNumber,
			applicantGender,
			dateOfBirth,
			streetAddress,
		} = req.body;

		user.firstName = firstName;
		user.lastName = lastName;
		user.address = {
			streetAddress,
			unitNumber,
			city,
			postalCode,
			province,
			additionalAddress,
		};
		user.applicantGender = applicantGender;
		user.dateOfBirth = dateOfBirth;
		await user.save();
		return res.status(201).send({
			msg: `User attributes were patched`,
		});
	} catch (error) {
		return res.status(500).json({
			err: 'Encountered a server error completing this request',
		});
	}
}

async function passwordRecoveryUpdatePassword(req, res) {
	// Expect a token and a plain-text string consisting of new password
	const { password, token } = req.body;
	try {
		const decodedToken = await JWTManager.verify(token);
		const user = await User.findOne({
			email: decodedToken.email,
			recoveryToken: decodedToken.recoveryToken,
		}).exec();

		if (!user) {
			return res.status(400).json({
				err: 'Invalid or expired request.',
			});
		}
		// If we found the user, let's has the password
		const hashedPassword = await bcrypt.hash(password, 10);
		user.hashedPassword = hashedPassword;
		user.recoveryToken = '';
		await user.save();

		await emailServiceClient.sendEmail('/password-changed-notification', {
			recipient: user.email,
			adminEmail: process.env.ADMIN_EMAIL,
			name: `${user.firstName} ${user.lastName}`,
		});
		return res.status(201).json({
			msg: 'ok',
			password,
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({
			err: err.message,
		});
	}
}



async function triggerVerificationCodeEmail(req, res) {
	// Do logic. Trigger verification code e-mail as necessary
	const { email } = req.body;
	try {
		const emailVerifiedValue = await isEmailVerified(email);

		if (emailVerifiedValue)
			return res
				.status(400)
				.send({ err: 'E-mail address is already verified' });

		const verificationData = await createVerificationData(email);
		if (!verificationData)
			return res.status(400).send({
				err: 'This is an invalid request for this e-mail',
			});

		if (!verificationData.code) {
			throw new Error('Verification code is undefined');
		}
		await emailServiceClient.sendEmail('/verification-code', {
			recipient: email,
			code: verificationData.code,
		});

		return res.status(200).send({
			msg: 'OK',
		});
	} catch (err) {
		console.error(err.message);
		return res.status(500).send({
			err: `There was an issue sending the verification code e-mail: ${err.message}`,
		});
	}
}

async function getIsEmailVerified(req, res) {
	// This checks if an e-mail address has a verified status
	const { email } = req.params;
	try {
		const emailVerifiedValue = await isEmailVerified(email);
		return res.status(200).send({
			value: emailVerifiedValue,
		});
	} catch (err) {
		return res.status(500).send({
			err: err.message,
		});
	}
}

async function verifyEmailAddressRequest(req, res) {
	const { code, email } = req.body;
	// Attempt to verify the e-mail address using the code provided via the request
	try {
		const emailVerificationResult = await validateCode(email, code);
		return res.status(200).send(emailVerificationResult);
	} catch (err) {
		return res.status(500).send({
			err: err.message,
		});
	}
}

export default function (app) {
	app.get('/auth/user/:id', protectedRoute, idValidator, getUserById);
	app.get('/auth/profile', getProfile);
	app.get(
		'/auth/isEmailVerified/:email',
		verifyEmailIsValidatedValidator,
		getIsEmailVerified
	);
	app.post('/auth/signup', userProfileValidator, postSignUp);
	app.post(
		'/auth/admin-create',
		adminCreationGuard,
		adminAuthTokenGuard,
		adminCreationValidator,
		postCreateAdmin
	);
	app.post('/auth/login', loginCredentialsValidator, postLogin);
	app.post('/auth/refresh', postRefresh);
	app.post(
		'/auth/password-recovery/request',
		passwordRecoveryRequestEmailValidator,
		postRequestPasswordRecovery
	);
	app.post(
		'/auth/password-recovery/update-password',
		passwordRecoveryUpdatePasswordValidator,
		passwordRecoveryUpdatePassword
	);
	app.post(
		'/auth/verification-code-email',
		requestVerificationCodeValidator,
		triggerVerificationCodeEmail
	);
	app.post(
		'/auth/email/verify',
		verifyEmailAddressRequestValidator,
		verifyEmailAddressRequest
	);
	app.patch(
		'/auth/user/:id',
		protectedRoute,
		idValidator,
		patchUserAttributesValidator,
		patchUpdateUserAttributes
	);

	console.log('Authentication component registered.');
}
