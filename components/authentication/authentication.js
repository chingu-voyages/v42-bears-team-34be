// libraries
import dayjs from 'dayjs';
import bcrypt from 'bcrypt';
import { body , validationResult} from 'express-validator';
import jwt from 'jsonwebtoken';



// schemas
import User from "../../schemas/user.js"

// services
import "../../services/emailer.js"

// create account
async function postSignUp(req,res){
    try{
        const hashedPassword = await bcrypt.hash(req.body.password,10);
        const newUser = new User({
            role            : 'user',
            firstName       : req.body.firstName,
            lastName        : req.body.lastName,
            email           : req.body.email,
            hashedPassword  : hashedPassword,
            dateOfBirth     : new Date(req.body.dateOfBirth)
        })

        newUser.validateSync()
        await newUser.save()
        res.status(201).json({
            msg : "Your account has been created, but it's pending activation. (not really, just login)"
        })
    }catch(e){
        console.error(e.error)
        res.status(500).json({
            msg : "Something went wrong"
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
            throw new Error("User not found or password is incorrect.")

        // compare hashedPassword with the provided password
        let result = await bcrypt.compare(req.body.password, user.hashedPassword)

        if(!result)
            throw new Error("User not found or password is incorrect.")
    
        let { _id, firstName, lastName, email, role } = user
    
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
    res.json({
        msg : "Ok."
    })
}

// For checking if the JWT is readable
function getProfile(req,res){
    // middleware should have placed the 
    // token inside the Authorization header before the request gets here.
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

const validationGuard = (req,res, next) =>{
    const errors = validationResult(req)
    if(!errors.isEmpty())
        return res.status(400).json({err : errors.array()})
    next()
}

const userProfileValidator = [
    body('email').isEmail(),
    body('firstName').exists().trim().escape(),
    body('lastName').exists().trim().escape(),
    body('password').exists(),
    body('dateOfBirth').exists().custom(
        date =>{
            const dateObject = dayjs(date)
            return dayjs(dateObject, "MM-DD-YYYY", true).isValid()
        }
    ),
    validationGuard
]

const loginCredentialsValidator = [
    body('email').exists().isEmail(),
    body('password').exists(),
    validationGuard
]

export default function(app){
    app.post("/auth/signup"         , userProfileValidator, postSignUp)
    app.post("/auth/login"          , loginCredentialsValidator, postLogin)
    app.post("/auth/refresh"        , postRefresh)
    app.get ("/auth/profile"        , getProfile)
    app.get ("/auth/verify/:tok"    , getVerify)
    app.post("/auth/forgotpassword/", postForgotPassword)

    console.log("Authentication component registered.")
}