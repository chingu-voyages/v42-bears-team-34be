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
    requestedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
})

const Application = mongoose.model('Application',ApplicationSchema)

export default  Application