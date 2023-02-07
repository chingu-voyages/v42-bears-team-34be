// libraries
import { body }  from 'express-validator';

// validator
import {  protectedRoute } from '../../middleware/protectedRoute.js';
import {  adminRoute }     from '../../middleware/adminRoute.js';

import validationGuard from '../../middleware/validationGuard.js'

// schemas
import  {Application, ApplicationStatus} from "../../schemas/application.js"

// services
import "../../services/emailer.js"




async function postMakeApplication(req,res,next){

    // if multiple applications aren't allowed, we check if there's a single Application for user id where status is pending
    // does this need to be a middleware? I don't think so <- answer is no, leaving this here for historic reasons

    try{
        if(process.env.ALLOW_MULTIPLE_APPLICATIONS !== "true"){
            let application = await Application.findOne({
                requestedBy  : req.auth.id,
                status       : ApplicationStatus.Pending
            }).exec()
    
            if(application !== null){
                return res.status(400).json({
                    err : "User has an application pending review."
                })
            }
        }

        let application = new Application({
            amount       : parseFloat(req.body.amount),
            payments     : parseInt  (req.body.payments),
            paymentAmount: parseFloat(req.body.paymentAmount),
            reason       : req.body.reason,
            description  : req.body.description,
            requestedBy  : req.auth.id,
            status       : ApplicationStatus.Pending
        })

        // client made an invalid request
        let err = application.validateSync()
        if(err){
            return res.status(400).json({
                err : err.message
            })
        }

        await application.save()

        res.status(200).json({
            msg  : "Application received.",
        })
    }catch(e){
        return next(e)
    }
}


async function getApplicationsForAuthenticatedUser(req,res,next){
    try{
        let applications = await Application.find({
            requestedBy : req.auth.id
        })
        // there are some details which we cannot provide to the user
        applications = applications.map( a => ({
                // should we wend this one out?
                id            : a.id,
                amount        : a.amount,
                payments      : a.payments,
                paymentAmount : a.paymentAmount,
                reason        : a.reason,
                description   : a.description,
                status        : a.status
            })
        )
        res.status(200).json(applications)
    }catch(e){
        return next(e)
    }
}

async function getApplicationById(req,res,next){
    try{
        // find application by id and user
        let criteria = {
            _id : req.params.id
        }

        // admin can bypass the application ownership 
        if("admin" !== req.auth.role){
            criteria.requestedBy == req.auth.id
        }

        let a = await Application.findOne(criteria)
        if(!a){
            return next(
                new Error("No such application for the current user.")
            )
        }

        // we don't let the user see very single detail.
        let result = {
            amount        : a.amount,
            payments      : a.payments,
            paymentAmount : a.paymentAmount,
            reason        : a.reason,
            description   : a.description,
            status        : a.status,
            requestedAt   : a.createdAt
        }

        if("rejected" === a.status){
            result.rejectedReason = a.rejectedReason
        }

        return res.status(200).json(result)
    }catch(e){
        return next(e)
    }
}

/**
 * Cancels an application. User initiated.
 * When this happens, we need to give the user a "cooldown period" before he/she can apply again.
 */
async function postCancelApplication(req,res,next){
    try{
        // find application by id and user
        let criteria = {
            _id : req.params.id,
            status : ApplicationStatus.Pending
        }

        // admin can bypass the application ownership 
        if("admin" !== req.auth.role){
            criteria.requestedBy == req.auth.id
        }

        let application = await Application.findOne(criteria)
        if(!application){
            return next(
                new Error("No pending application with that id for the current user.")
            )
        }

        // change status to cancelled.
        application.status = ApplicationStatus.Cancelled
        await application.save()

        return res.status(200).json({
            msg : "Application cancelled successfully."
        })

        // TODO: notify the system there was a cancellation
    }catch(e){
        return next(e)
    }
}



async function adminGetAllApplications(req,res){
    let applications = await Application.find()
    if(!applications){
        return next(
            new Error("No applications.")
        )
    }

    res.status(200).json({
        msg  : "All applications.",
        applications : applications
    })
}

function adminPostApproveApplication(req,res){
    res.status(200).json({
        msg : "Approving application "+req.params.id
    })
}

function adminPostRejectApplication(req,res){
    res.status(200).json({
        msg    : "Rejecting application "+req.params.id,
        reason : req.body.reason
    })
}


export const applicationValidator = [
    protectedRoute,
    body('amount').isNumeric(),
    body('payments').isNumeric(),
    body('paymentAmount').isNumeric(),
    body('reason').exists().trim().escape(),
    body('description').exists().trim().escape(),
    validationGuard
]

export default function(app){
    // user procedures
    app.post("/application/apply"      , applicationValidator,postMakeApplication)
    app.post("/application/cancel/:id" , protectedRoute      ,postCancelApplication)
    app.get ("/application/view/:id"   , protectedRoute      ,getApplicationById)
    app.get ("/application/my"         , protectedRoute      ,getApplicationsForAuthenticatedUser)

    // administrative procedures
    app.get ("/admin/application/all"        , adminRoute, adminGetAllApplications    )
    app.post("/admin/application/approve/:id", adminRoute, adminPostApproveApplication)
    app.post("/admin/application/reject/:id" , adminRoute, adminPostRejectApplication )

    console.log("Application component registered.")
}