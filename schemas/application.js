import mongoose from 'mongoose'

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
    status : { type: String, enum: [ApplicationStatus.Pending, ApplicationStatus.Approved, ApplicationStatus.Rejected, ApplicationStatus
    .Cancelled]},

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




