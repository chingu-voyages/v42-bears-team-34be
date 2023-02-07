import mongoose from 'mongoose'

console.log("Applicaton Schema imported")

const ApplicationSchema = new mongoose.Schema({
    requestedLoanAmount : {
        type: Number, required: true, min : [0, "Amount is too small"]
    },
    loanPurpose : {
        type: String, required: true
    },
    description : {
        type: String, required: true
    },
    payments  : {
        type: Number, required: true, min : [2, "At least 2 payments are required"]
    },
    paymentAmount : {
        type: Number, required: true, validate:{
            validator: function(value){
                return value * this.payments >= this.amount
            },
            message : "Total payment amount must be larger than requested amount."
        }
    },
    applicantIncome: {
        type: Number, required: true
    },
    // Dump plaid response data here
    financialData: {
        liabilities: {
            type: {}
        }
    },

    applicantOccupation: {
        type: String, required: true
    },
    // this can be: pending, approved, rejected, cancelled
    status : String,

    // who requested this loan
    requestedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},

    // who evaluated this loan
    evaluatedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    // why was this rejected?
    rejectedReason : String,
    // when was this evaluated?
    evaluatedAt : Date,

    createdAt  : Date,
    updatedAt  : Date,
})

const Application = mongoose.model('Application',ApplicationSchema)

const ApplicationStatus = {
    Pending  : "pending",
    Approved : "approved",
    Rejected : "rejected",
    Cancelled: "cancelled"
}

export default { Application, ApplicationStatus}
export { Application };
export { ApplicationStatus }




