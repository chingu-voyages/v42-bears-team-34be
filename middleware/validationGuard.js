import { validationResult } from "express-validator"

// answers the request if an error if there were any data validation errors
const validationGuard = (req,res, next) =>{
    const errors = validationResult(req)
    if(!errors.isEmpty())
        return res.status(400).json({err : errors.array()})
    next()
}

export default validationGuard