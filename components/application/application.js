// validator
import {  protectedRoute } from '../../middleware/protectedRoute.js';
import {  adminRoute }     from '../../middleware/adminRoute.js';
import { ApplicationModel } from '../../schemas/application.js';

import { ApplicationStatus } from '../../schemas/application-status.js';

// component level validators
import { 
    applicationValidator,
    userApplicationQueryValidator,
    adminApplicationQueryValidator,
    adminApplicationRejectValidator,
} from './validators.js';

// services
import "../../services/emailer.js"

async function postMakeApplication(req,res,next){

    // if multiple applications aren't allowed, we check if there's a single Application for user id where status is pending
    // does this need to be a middleware? I don't think so <- answer is no, leaving this here for historic reasons

    try{
        if(process.env.ALLOW_MULTIPLE_APPLICATIONS !== "true"){
            let application = await ApplicationModel.findOne({
                requestedBy  : req.auth.id,
                status       : ApplicationStatus.Pending
            }).exec()
    
            if(application !== null){
                return res.status(400).json({
                    err : "User has an application pending review.",
                    code: "$PENDING_APPLICATION_EXISTS"
                })
            }
        }

        const application = await ApplicationModel.create({
            requestedLoanAmount : parseFloat(req.body.requestedLoanAmount),
            numberOfInstallments: parseInt  (req.body.numberOfInstallments),
            installmentAmount   : parseFloat(req.body.installmentAmount),
            applicantOccupation : req.body.applicantOccupation,
            applicantIncome     : parseFloat(req.body.applicantIncome),
            loanPurpose         : req.body.loanPurpose,
            requestedBy         : req.auth.id,
            status              : ApplicationStatus.Pending
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
            id   : application.id
        })
    }catch(e){
        return next(e)
    }
}


async function getApplicationsForAuthenticatedUser(req,res,next){
    try{
        const userApplications = await ApplicationModel.find({
            requestedBy : req.auth.id
        }).exec()
        // there are some details which we cannot provide to the user
        const filteredApplications = userApplications.map( a => ({
                // should we wend this one out?
                id                  : a.id,
                applicantIncome     : a.applicantIncome,
                requestedLoanAmount : a.requestedLoanAmount,
                numberOfInstallments: a.numberOfInstallments,
                installmentAmount   : a.installmentAmount,
                loanPurpose         : a.loanPurpose,
                status              : a.status,
                requestedBy         : a.requestedBy
            })
        )
        res.status(200).json(filteredApplications);
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
            console.log("We need to check against the id")
            criteria.requestedBy = req.auth.id
        }

        const a = await ApplicationModel.findOne(criteria).exec()
        if(!a){
            return next(
                new Error("No such application for the current user.")
            )
        }

        // we don't let the user see very single detail.
        const result = {
            applicantIncome     : a.applicantIncome,
            requestedLoanAmount : a.requestedLoanAmount,
            numberOfInstallments: a.numberOfInstallments,
            installmentAmount   : a.installmentAmount,
            loanPurpose         : a.loanPurpose,
            status              : a.status,
            requestedAt         : a.createdAt,
            requestedBy         : a.requestedBy
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
        const criteria = {
            _id : req.params.id,
            status : ApplicationStatus.Pending
        }

        // admin can bypass the application ownership 
        if("admin" !== req.auth.role){
            criteria[requestedBy] = req.auth.id
        }

        const application = await ApplicationModel.findOne(criteria).exec()
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
    const applications = await ApplicationModel.find().exec();
    if(!applications){
        return next(
            new Error("No applications.")
        )
    }

    res.status(200).json({
        applications : applications
    })
}

async function adminPatchApproveApplication(req,res,next){
    try {
        const { id } = req.params;

        const app = await ApplicationModel.findById(id).exec();
        if (!app) return res.status(404).send({ err: `application with id ${id} not found`})
        app.status = "approved"
        app.evaluatedBy = req.auth.id

        await app.save();
        res.status(201).json({
            msg : "Approving application "+req.params.id,
            id
        })
    } catch (e) {
        next(e)
    }
}


async function adminPatchRejectApplication(req,res,next){
    try {
        const { reason } = req.body;
        const { id } = req.params;
        // Find the application and set the rejection status and reason
        const app = await ApplicationModel.findById(id).exec()

        if (!app) return res.status(404).json({ err: `application with id ${id} not found`});

        app.status = "rejected";
        app.rejectedReason = reason ? reason : "Application was rejected.";
        app.evaluatedBy = req.auth.id

        await app.save();
        res.status(201).json({
            msg    : `Rejecting application ${id}`,
            reason: reason || "Application was rejected",
            id,
        })
    } catch (e) {
        return next(e)
    }
}

export default function(app){
    // user procedures
    app.post("/application/apply"      , applicationValidator           ,postMakeApplication)
    app.post("/application/cancel/:id" , userApplicationQueryValidator  ,postCancelApplication)
    app.get ("/application/view/:id"   , userApplicationQueryValidator  ,getApplicationById)
    app.get ("/application/my"         , protectedRoute                 ,getApplicationsForAuthenticatedUser)

    // administrative procedures
    app.get ("/admin/application/all"        , adminRoute                    , adminGetAllApplications    )
    app.patch("/admin/application/approve/:id", adminApplicationQueryValidator, adminPatchApproveApplication)
    app.patch("/admin/application/reject/:id" , adminApplicationQueryValidator, adminApplicationRejectValidator,  adminPatchRejectApplication )

    console.log("Application component registered.")
}
