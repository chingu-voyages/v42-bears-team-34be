// libraries
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
// validator
import { 
    userProfileValidator,
    loginCredentialsValidator,
    adminCreationGuard,
    adminCreationValidator,
    adminAuthTokenGuard, 
    idValidator,
    patchUserAttributesValidator,
    passwordRecoveryRequestEmailValidator,
    passwordRecoveryUpdatePasswordValidator,
    sendSignUpEmailRequestValidator
} from './validators.js';

// schemas
import User from "../../schemas/user.js"

// services
import { protectedRoute } from '../../middleware/protectedRoute.js';
import { JWTManager } from '../../services/JWTManager.js';
import dayjs from 'dayjs';
import { IS_PRODUCTION } from '../../services/environment.js';
import { PasswordRecoveryEmail, PasswordChangedEmail } from '../../data/email/index.js';
import { SignUpEmail } from '../../data/email/sign-up-email/sign-up-email.js';
import { sendEmail } from '../../services/email-sender.js';


const TESTING = false;
// create account
// this should schedule an "activate your account" email.
async function postSignUp(req,res){
    try {

        /* First we should safely check if the e-mail already exists in our db
            If it does, we can return a 400 error and prompt the client to log in
        */
        const userAlreadyExists = await checkIfUserExistsInDb(req.body.email);
        if (userAlreadyExists) {
            return res.status(400).json({
                err: `${req.body.email} already exists.`,
                code: "$EMAIL_EXISTS"
            })
        }

        const addressInfo = {
            streetAddress    : req.body.streetAddress,
            unitNumber       : req.body.unitNumber,
            city             : req.body.city,
            postalCode       : req.body.postalCode,
            province         : req.body.province,
            additionalAddress: req.body.additionalAddress
        }

        const hashedPassword = await bcrypt.hash(req.body.password,10);
        const newUser = new User({
            role            : 'user',
            firstName       : req.body.firstName,
            lastName        : req.body.lastName,
            email           : req.body.email,
            hashedPassword  : hashedPassword,
            dateOfBirth     : new Date(req.body.dateOfBirth),
            dateSignedUp    : new Date(Date.now()),
            applicantGender : req.body.applicantGender,
            address         : addressInfo,
            active          : true  // make this one false when email integration is functional 
        })

        // we actually need to throw an error, this doesn't do it by itself
        let err = newUser.validateSync()
        if(err){
            throw err
        }

        await newUser.save();
        // Send a welcome e-mail to  the user
        res.status(201).json({
            msg : "Your account has been created, but it's pending activation. (not really, just login)"
        })
    }catch(e){
        console.error(e.error)
        res.status(500).json({
            msg : "Something went wrong: "+ e.message
        })
    }
}

/* Create admin account 
   admin account creation environment variable needs to be set to true for this to work
  admin token needs to be in the 'x-api-key' req.header for this to work
*/
async function postCreateAdmin(req,res){
    try {
        const hashedPassword = await bcrypt.hash(req.body.password,10);
        const newUser = new User({
            role            : 'admin',
            firstName       : req.body.firstName,
            lastName        : req.body.lastName,
            email           : req.body.email,
            hashedPassword  : hashedPassword,
            dateSignedUp    : new Date(Date.now()), // not necessary for admin
            dateOfBirth     : new Date(Date.now()), // not necessary for admin
            applicantGender : req.body.applicantGender,
            active          : true
        })
        newUser.validateSync()
        await newUser.save()
        res.status(201).json({
            msg : "Admin account created"
        })
    } catch (e) {
        console.error(e.error)
        res.status(500).json({
            msg : "Something went wrong: "+ e.message
        })
    }
}

// login
async function postLogin(req,res){
    /*
        - get e-mail and password from request
        - check hashed password against hashed password in database (for now it's just plain text)
        - use bcrypt to encode / decode it
        - if it's ok, send a token
    */
    try{
        const user = await User.findOne({
            email    : req.body.email
        }).exec()
    
        // user can be null.
        if (!user)
            return res.status(401).json({ err: "User not found or password is incorrect.", code: "$INVALID_USER_OR_PASSWORD"})

        // compare hashedPassword with the provided password
        let result = await bcrypt.compare(req.body.password, user.hashedPassword)

        if(!result)
            return res.status(401).json({ err: "User not found or password is incorrect."})
    
        let { _id, firstName, lastName, email, role } = user

        // If the isAdmin flag is present and set to true, make sure the
        // user actually has an admin status. If they don't, throw
        if (req.body.isAdmin === "true") {
            if (role !== "admin") {
                return res.status(401).json({err: "Access is denied due to invalid access level", code: "$INVALID_USER_OR_PASSWORD" })
            }
        }

        // make a JWT
        const token = JWTManager.createLoginToken(
            _id,
            firstName,
            lastName,
            email,
            role
        )

        // send it back
        res.status(200).json({
            tok : token
        })
    }catch(e){
        res.status(500).json({
            err : e.message
        })
    }
}

// jwt refresh
// if the token is within the expiraiton period,
// returns a fresh one.
function postRefresh(req,res){
    // What should this actually do?
    // A valid token for a deleted user profile can lead to
    // undefined behavior
    // should we make a DB query to see if the user is still active?
    try{
        let oldToken = {...req.auth}
        // we don't need to check if it's null or undefined because the
        // protectedRoute middleware did this before we got here.
        if(oldToken.expired)
            return res.status(401).json({
                err : "Expired session. Please login again."
            })
        
        // Grab a refresh token using the token manager
        const newToken = JWTManager.createRefreshToken(oldToken);

        res.status(200).json({
            tok : newToken
        })
    }catch(e){
        res.status(500).json({
            err : e.message
        })
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
        if (req.auth.role !== "admin") {
            if (id !== req.auth.id) {
                return res.status(401).json({
                    err: 'Invalid request. Invalid access.'
                })
            }
        }
    
        const user = await User.findById(id).exec();
        if (!user) return res.status(404).json({
            err: `User not found with id ${id}`
        })
        return res.status(200).send({
            id: user._id.toString(),
            address: {
                ...user.address,
            },
            dateSignedUp: user.dateSignedUp,
            firstName : user.firstName,
            lastName: user.lastName,
            dateOfBirth: user.dateOfBirth,
            email: user.email,
            applicantGender: user.applicantGender,
            plaid: !!(user.plaidAccessToken && user.plaidItemId)
        })

    } catch (error) {
        return next(error)
    }
}

// For checking if the JWT is readable
function getProfile(req,res){
    // middleware should have placed the 
    // token inside the Authorization header before the request gets here.
    // if it's expired, it will return a object with a single "expired = true" field.
    res.json( req.auth )
}

// activates an account
function getVerify(req,res){
    /*
        DOS
        - takes a verifcation token from the URL
        - looks for an account with that activation token
        - marks it as active
    */
    throw "Random made up error"
    res.status(200).json({
        msg : "Your account is now active."
    })
}

// send a "change password" e-mail
async function postRequestPasswordRecovery(req,res){
    /*
        DOS
        - should this directly set something within the user document
        - or should this simply enqueue a "password change" without changing anything
          within the user document?
    */

    // Find the user by e-mail. Create a token from the data and send an e-mail
    const { email } = req.body;

    try {
        const user = await User.findOne({ email: email }).exec();
        if (!user) {
            // Do nothing
            return res.status(200).send({ msg: "User wasn't found, but OK"})
        }

        // Use the token manager to tokenize password recovery
        // Also generate a UUID to store on user document
        const recoveryToken = uuidv4();

        const token = await JWTManager.sign(
            {
                email: user.email,
                createdAt: dayjs().toDate(),
                expires: dayjs().add(30, 'minutes').toDate(),
                recoveryToken: recoveryToken,
                isAdmin: user.role === "admin"
            }
        )
        const recoveryURL = generatePasswordRecoveryURL(token);
        const userName = `${user.firstName} ${user.lastName}`
        await sendEmail(new PasswordRecoveryEmail(user.email, userName, recoveryURL));

        user.recoveryToken = recoveryToken;
        await user.save()
        return res.status(200).send({
            msg: 'OK'
        })

    } catch (err) {
        console.log(err)
        return res.status(500).json({
            err: 'Unable to complete recovery operation'
        })
    }
}

/**
 * 
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function checkIfUserExistsInDb (email) {
    try {
        const user = await User.findOne({ email: email });
        if (user) return true;
        return false;
    } catch (error) {
        return res.status(500).json({
            err: "Encountered a server error completing this request"
        })
    }
}

/**
 * This patches the user's details
 */
async function patchUpdateUserAttributes (req, res) {
    const { id } = req.params;
    // Authenticated user can only update their own profile
    if (req.auth.id !== id) return res.status(401).json({ err: "Update user attributes: not an authorized operation"});

    try {
        const user = await User.findById(id).exec();
        if (!user) return res.status(404).json({ err: `User with ${id} not found.`});
        const {
            firstName, lastName, city, province, postalCode, additionalAddress, unitNumber, applicantGender, dateOfBirth, streetAddress
        } = req.body;

        user.firstName = firstName;
        user.lastName = lastName;
        user.address = {
            streetAddress, 
            unitNumber,
            city,
            postalCode,
            province,
            additionalAddress
        }
        user.applicantGender = applicantGender;
        user.dateOfBirth = dateOfBirth;
        await user.save();
        return res.status(201).send({ 
            msg: `User attributes were patched`
        })
    } catch (error) {
        return res.status(500).json({
            err: "Encountered a server error completing this request"
        })
    }

}

async function passwordRecoveryUpdatePassword(req, res) {
    // Expect a token and a plain-text string consisting of new password
    const { password, token } = req.body;
    try {
        const decodedToken = await JWTManager.verify(token);
        const user = await User.findOne(
            {
                email: decodedToken.email,
                recoveryToken: decodedToken.recoveryToken
            }
        ).exec();

        if (!user) {
            return res.status(400).json(
                {
                    err: "Invalid or expired request."
                }
            )
        }
        // If we found the user, let's has the password
        const hashedPassword = await bcrypt.hash(password, 10);
        user.hashedPassword = hashedPassword;
        user.recoveryToken = ''
        await user.save();

        // Send a notification e-mail to user that password has been updated
        await sendEmail(new PasswordChangedEmail(user.email, `${user.firstName} ${user.lastName}`));
        return res.status(201).json({
            msg: 'ok',
            password
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            err: err,
        })
    }
}

async function sendSignUpEmail(req, res) {
    const { email, itemId } = req.body;
    // Find the user by the e-mail and itemID and then send the welcome e-mail
    try {
        const user = await User.findOne({ email: email, plaidItemId: itemId }).exec();
        if (!user) return res.status(404).send({
            err: `User not found with e-mail ${email} and itemId: ${itemId}`
        });
    
        await sendEmail(new SignUpEmail(user.email, `${user.firstName} ${user.lastName}`))
        return res.status(200).send({ msg: "ok "})
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            err: err,
        })
    }
}
function generatePasswordRecoveryURL (token) {
    // We need to determine the development environment.
    if (IS_PRODUCTION) {
        return `${process.env.PRODUCTION_APP_DOMAIN}/password-reset/recover?token=${token}`
    }
    return `${process.env.DEV_APP_DOMAIN}/password-reset/recover?token=${token}`
}

export default function(app){
    app.get  ("/auth/user/:id"                   , protectedRoute, idValidator, getUserById)
    app.get  ("/auth/profile"                    , getProfile)
    app.get  ("/auth/verify/:tok"                , getVerify)
    app.post ("/auth/signup"                     , userProfileValidator     , postSignUp)
    app.post ("/auth/admin-create"               , adminCreationGuard, adminAuthTokenGuard, adminCreationValidator, postCreateAdmin)
    app.post ("/auth/login"                      , loginCredentialsValidator, postLogin)
    app.post ("/auth/refresh"                    , postRefresh)
    app.post ("/auth/password-recovery/request"  , passwordRecoveryRequestEmailValidator, postRequestPasswordRecovery)
    app.post ("/auth/password-recovery/update-password", passwordRecoveryUpdatePasswordValidator, passwordRecoveryUpdatePassword)
    app.post ("/auth/send_signup_email", sendSignUpEmailRequestValidator, sendSignUpEmail)
    app.patch("/auth/user/:id", protectedRoute   , idValidator, patchUserAttributesValidator, patchUpdateUserAttributes);
    

    console.log("Authentication component registered.")
}

