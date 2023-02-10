import { body }  from 'express-validator';
import dayjs from 'dayjs';
import validationGuard from '../../middleware/validationGuard.js'

const errorMessage = "This request is not authorized. Please check with your administrator to enable this feature."
export const userProfileValidator = [
    body('email').isEmail(),
    body('firstName').exists().trim().escape(),
    body('lastName').exists().trim().escape(),
    body('password').exists(),
    body('applicantGender').trim().escape().custom((value) => {
        return ["male", "female", "other"].includes(value);
    }),
    body('dateOfBirth').exists().custom(
        date =>{
            // maybe check if the person is at least X years old where X is how old you need
            // to be to get a loan?
            const dateObject = dayjs(date)
            return dayjs(dateObject, "MM-DD-YYYY", true).isValid()
        }
    ),
    validationGuard
]

export const loginCredentialsValidator = [
    body('email').exists().isEmail(),
    body('password').exists(),
    validationGuard
]

export const adminCreationValidator = [
    body('email').isEmail(),
    body('firstName').exists().trim().escape(),
    body('lastName').exists().trim().escape(),
    body('password').exists(),
    body('applicantGender').trim().escape().custom((value) => {
        return ["male", "female", "other"].includes(value);
    }),
    validationGuard,
]

export const linkPublicTokenValidator = [
    body('publicToken').exists(),
    validationGuard
]

export const adminCreationGuard = (_, res, next) => {
    /* Middleware. 
       Checks if the admin creation is set to "true" in the .env variable
       It checks explicitly for the string "true".
       Falsy will return a 401
    */
    const adminMode = process.env.ALLOW_ADMIN_ACCOUNT_CREATION;
    if (adminMode !== "true") {
        return res.status(401).json({
            err : errorMessage
        }) 
    }
    next()
}

export const adminAuthTokenGuard = (req, res, next) => {
    /* 
    Middleware that checks for the admin token in the 'x-api-key' header
    If it's null or invalid, return a 401 response.
    User needs this to be valid to create an admin account
    */

    const ADMIN_TOKEN_ENV = process.env.ADMIN_TOKEN;
    if (!ADMIN_TOKEN_ENV) return res.status(401).json({
        err : errorMessage
    });
    const token = req.headers["x-api-key"];
    if (token && token === ADMIN_TOKEN_ENV) {
        next()
    } else {
        return res.status(401).send({
            error: "Invalid or missing admin token. Check with your administrator to enable this feature.",
        })
    }
}
