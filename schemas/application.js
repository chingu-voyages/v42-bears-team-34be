import mongoose from 'mongoose'

console.log("Applicaton Schema imported")

const ApplicationSchema = new mongoose.Schema({
    amount : {
        type: Number, required: true
    },
    reason : {
        type: String, required: true
    },
    description : {
        type: String, required: true
    },
    payments  : {
        type: Number, required: true
    },
    paymentAmount : {
        type: Number, required: true
    },
    // Dump plaid response data here
    financialData: {
        liabilities: {
            type: {}, required: true
        }
    },
    status : String,
    
    requestedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    evaluatedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},

    createdAt  : Date,
    updatedAt  : Date,

})

const Application = mongoose.model('Application',ApplicationSchema)

export default  Application
