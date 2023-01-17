import "../../services/emailer.js"
import User from "../../schemas/user.js"

// create account
async function postSignUp(req,res){
    try{
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
    }catch(e){
        res.status(400).json({
            err : "You did something wrong: " + e
        })
    }
}

// login
function postLogin(req,res){
    /*
        - get e-mail and password from request
        - check hashed password against hashed password in database (for now it's just plain text)
        - use bcrypt to encode / decode it
        - if it's ok, send a token
    */
    res.status(200).json({
        tok : "THIS IS A VERY FAKE TOKEN but store it in localStorage anyway"
    })
}

// activates an account
function getVerify(req,res){
    /*
        DOS
        - takes a verifcation token from the URL
        - looks for an account with that activation token
        - marks it as active
    */
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
    res.status(200).json({
        msg : "You should be receiving an e-mail link soon.."
    })
}

export default function(app){
    app.post("/auth/signup"         , postSignUp)
    app.post("/auth/login"          , postLogin)
    app.get ("/auth/verify/:tok"    , getVerify)
    app.post("/auth/forgotpassword/", postForgotPassword)

    console.log("Authentication component registered.")
}