import mongoose from 'mongoose'

console.log("UserSschema imported")
const UserSchema = new mongoose.Schema({
    firstName : {
        type: String, required: true
    },   // first and last name should be some type of composite index
    lastName  : {
        type: String, required: true
    },
    email     : {
        type : String, required: true, 
        index: { unique: true }
    },   // should be indexed by this
    password  : {
        type: String, required: true
    },
    activation: String    // should be indexed by this
})

const User = mongoose.model('User',UserSchema)

export default  User

