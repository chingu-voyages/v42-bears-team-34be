import "../../services/emailer.js"
import User from "../../schemas/user.js"

import jwt from 'jsonwebtoken';

// create account
async function postSignUp(req,res){
    const newUser = new User({
        firstName : req.body.firstName,
        lastName  : req.body.lastName,
        email     : req.body.email,
        password  : req.body.password
    })

    await newUser.validateSync()
    await newUser.save()

    res.status(201).json({
        msg : "Your account has been created, but it's pending activation. (not really, just login)"
    })
}

// login
async function postLogin(req,res){
    /*
        - get e-mail and password from request
        - check hashed password against hashed password in database (for now it's just plain text)
        - use bcrypt to encode / decode it
        - if it's ok, send a token
    */

    const user = await User.findOne({
        email    : req.body.email,
        password : req.body.password 
    }).exec()

    // user can be null.
    if(!user){
        throw "Either a user with that e-mail was not found or the password is wrong."
    }

    let { _id, firstName, lastName, email } = user

    // make a JWT
    let token = jwt.sign({
        id : _id,
        firstName : firstName,
        lastName  : lastName,
        email     : email
    }, process.env.LOANAPP_JWT_SECRET)

    // send it back
    res.status(200).json({
        tok : token
    })
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



export default function(app){
    app.post("/auth/signup"         , postSignUp)
    app.post("/auth/login"          , postLogin)
    app.post("/auth/refresh"        , postRefresh)
    app.get ("/auth/profile"        , getProfile)
    app.get ("/auth/verify/:tok"    , getVerify)
    app.post("/auth/forgotpassword/", postForgotPassword)

    console.log("Authentication component registered.")
}