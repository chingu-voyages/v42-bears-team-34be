import mongoose from 'mongoose'

console.log("UserSchema imported")
const UserSchema = new mongoose.Schema({
    role : {
        type: String, required: true
    },
    firstName : {
        type: String, required: true
    },   // first and last name should be some type of composite index
    lastName  : {
        type: String, required: true
    },
    dateOfBirth:{
        type : Date, required: true
    },
    email     : {
        type : String, required: true, 
        index: { unique: true }
    },   // should be indexed by this
    hashedPassword  : {
        type: String, required: true
    },
    applications : [{
        type: mongoose.Schema.Types.ObjectId, ref: 'Application'
    }],
    address : {
        streetNumber      : {type : String},
        streetName        : {type : String},
        unitNumber        : {type : String},
        additionalAddress : {type : String},
        postalCode        : {type : String},
        province          : {type : String}
    },

    // Plaid needs one access token for each individual client
    // each individual client has its own plaid item id
    plaidItemId      : String,
    plaidAccessToken : String,

    activation: String    // should be indexed by this
})

const User = mongoose.model('User',UserSchema)

export default  User

