import { body }  from 'express-validator';
import dayjs from 'dayjs';

import validationGuard from '../../middleware/validationGuard.js'

export const userProfileValidator = [
    body('email').isEmail(),
    body('firstName').exists().trim().escape(),
    body('lastName').exists().trim().escape(),
    body('password').exists(),
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

