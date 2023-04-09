import mongoose from 'mongoose';
console.log("EmailVerificationSchema imported")
const EmailVerificationSchema = new mongoose.Schema({
	email: String,
	code: String,
	verified: {
		type: Boolean, default: false
	},
	created: Date,
	expires: { type: Date, default: null }
},
	{ 
		timestamps: true
	}
)

const EmailVerificationModel = mongoose.model("EmailVerification", EmailVerificationSchema);
export { EmailVerificationModel };
