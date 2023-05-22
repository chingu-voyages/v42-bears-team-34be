import { body, param, query } from 'express-validator';

// application level validators
import { adminRoute } from '../../middleware/adminRoute.js';
import { protectedRoute } from '../../middleware/protectedRoute.js';
import validationGuard from '../../middleware/validationGuard.js';

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

export const adminApplicationPatchStatusValidator = [
    body("action").custom((value) => ["mark_incomplete",
        "mark_more_info_required", "update_reject_reason", "admin_cancel"].includes(value)),
    body("message").optional().trim().escape()
]

export const paymentSizeValidator = [
    query("requestedLoanAmount").exists().isInt(),
    validationGuard
]

export const triggerWelcomeEmailValidator = [
    body("itemId").exists().isString(),
    body("email").exists().isEmail(),
    body("applicationId").exists().isString(),
    validationGuard
]

export const pageSearchQueryValidator = [
    query("page").exists().isInt().custom((val) => val >= 0),
    query("count").exists().isInt().custom((val) => val > 0),
    validationGuard
]