import mongoose from 'mongoose'
import { ApplicationStatus } from './application-status.js'

console.log("Applicaton Schema imported")

const ApplicationSchema = new mongoose.Schema({
    requestedLoanAmount : {
        type: Number, required: true, min : [0, "Amount is too small"]
    },
    loanPurpose : {
        type: String, required: true
    },
    numberOfInstallments : {
        type: Number, required: true, min : [2, "At least 2 payment installments are required"]
    },
    installmentAmount : {
        type: Number, required: true, validate:{
            validator: function(value){
                return value * this.numberOfInstallments >= this.requestedLoanAmount
            },
            message : "Total payment amount must be larger than requested amount."
        }
    },
    applicantIncome: {
        type: Number, required: true
    },
    applicantOccupation: {
        type: String, required: true
    },
    // this can be: pending, approved, rejected, cancelled
    status : { type: String, enum: [ApplicationStatus.Pending, ApplicationStatus.Approved, ApplicationStatus.Rejected, ApplicationStatus
    .Cancelled, ApplicationStatus.Incomplete, ApplicationStatus.MoreInfoRequired]},
    statusMessage: String,

    // who requested this loan
    requestedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},

    // who evaluated this loan
    evaluatedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    // why was this rejected?
    rejectedReason : String,
    // when was this evaluated?
    evaluatedAt : Date,
},
    { 
        timestamps: true
    }
)

const ApplicationModel = mongoose.model('Application',ApplicationSchema)

export { ApplicationModel }
