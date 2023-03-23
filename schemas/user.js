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
    applicantGender    : {
        type: String, required: true
    },
    address : {
        streetAddress     : {type : String},
        unitNumber        : {type: String},
        additionalAddress : {type: String},
        city              : {type: String},
        postalCode        : {type : String},
        province          : {type : String}
    },

    // not the same thing as a timestamp
    dateSignedUp : {
        type : Date, required: true
    },

    // Plaid needs one access token for each individual client
    // each individual client has its own plaid item id
    // the backend can query the Plaid API on its own with no input from the user
    // at a later date...

    plaidItemId      : {type: String, index: true},
    plaidAccessToken : {type: String, index: true},

    //activation: String,    // should be indexed by this, not used at the moment
    active    : Boolean,   // if this account is active or not
    recoveryToken: String,
    
    },
    // this is actually the  second argument, not a field
    {
        // lets us use createdAt and updatedAt
        timestamps: true
    }
)

const User = mongoose.model('User',UserSchema)

export default  User

