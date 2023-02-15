import { body , param}  from 'express-validator';

// application level validators
import {  protectedRoute } from '../../middleware/protectedRoute.js';
import {  adminRoute }     from '../../middleware/adminRoute.js';
import validationGuard     from '../../middleware/validationGuard.js'

export const applicationValidator = [
    protectedRoute,
    body('requestedLoanAmount').isNumeric(),
    body('numberOfInstallments').isNumeric(),
    body('installmentAmount').isNumeric(),
    body('loanPurpose').exists().trim().escape(),
    body('applicantOccupation').exists().trim().escape(),
    body('applicantIncome').isNumeric(),
    validationGuard
]

export const userApplicationQueryValidator = [
    protectedRoute,
    param('id').isHexadecimal().trim().isLength({min: 24, max: 24}).escape(),
    validationGuard
]

export const adminApplicationQueryValidator = [
    adminRoute,
    param('id').isHexadecimal().trim().isLength({min: 24, max: 24}).escape(),
    validationGuard
]

export const adminApplicationRejectValidator = [
    body("reason").exists().trim().escape(),
    validationGuard,
]
