import { param, query } from "express-validator"
import validationGuard from "../../middleware/validationGuard.js"

export const userIdValidator = [
	param('id').isHexadecimal().trim().isLength({min: 24, max: 24}).escape(),
	validationGuard
]

export const financialDetailsQueryValidator = [
	query('category').exists().toArray(),
	validationGuard
]
