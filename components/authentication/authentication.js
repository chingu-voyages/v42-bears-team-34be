// libraries
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// validator
import { 
    userProfileValidator,
    loginCredentialsValidator,
    adminCreationGuard,
    adminCreationValidator,
    adminAuthTokenGuard, 
    idValidator
} from './validators.js';

// schemas
import User from "../../schemas/user.js"

// services
import "../../services/emailer.js"
import { protectedRoute } from '../../middleware/protectedRoute.js';

// create account
// this should schedule an "activate your account" email.
async function postSignUp(req,res){
    try{

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
            active          : true  // make this one false when email integration is functional 
        })

        // we actually need to throw an error, this doesn't do it by itself
        let err = newUser.validateSync()
        if(err){
            throw err
        }

        await newUser.save()
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
        let token = jwt.sign(
            {
                id : _id,
                firstName,
                lastName,
                email,
                role
            }, 
            process.env.LOANAPP_JWT_SECRET,
            {
                expiresIn: process.env.LOANAPP_JWT_DURATION
            }
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

        // clear exp and iat
        delete oldToken.iat
        delete oldToken.exp
        let newToken = jwt.sign(
            oldToken,
            process.env.LOANAPP_JWT_SECRET,
            {
                expiresIn: process.env.LOANAPP_JWT_DURATION
            }
        )
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
    // For non-admins, you can get your own user info by ID
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
            applicantGender: user.applicantGender
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
function postForgotPassword(req,res){
    /*
        DOS
        - should this directly set something within the user document
        - or should this simply enqueue a "password change" without changing anything
          within the user document?
    */
    throw "Not implemented"
    res.status(200).json({
        msg : "If the e-mail belongs to an account, you'll be receiving a password-reset e-mail soon."
    })
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
            msg: "Encountered a server error completing this request"
        })
    }
}

export default function(app){
    app.post("/auth/signup"         , userProfileValidator     , postSignUp)
    app.post("/auth/admin-create"   , adminCreationGuard, adminAuthTokenGuard, adminCreationValidator, postCreateAdmin)
    app.post("/auth/login"          , loginCredentialsValidator, postLogin)
    app.post("/auth/refresh"        , postRefresh)
    app.get ("/auth/profile"        , getProfile)
    app.get ("/auth/verify/:tok"    , getVerify)
    app.post("/auth/forgotpassword" , postForgotPassword)
    app.get("/auth/user/:id"        , protectedRoute, idValidator              , getUserById)

    console.log("Authentication component registered.")
}
