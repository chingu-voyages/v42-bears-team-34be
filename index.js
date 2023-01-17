import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import { urlencoded } from 'express'
import { expressjwt as jwt } from 'express-jwt'

// environment variables must be set before connection with db is established
dotenv.config()

// import our components
import authentication from './components/authentication/authentication.js'
import plaid from "./components/plaid/plaid.js"
import db from './services/database.js'

const
    app = express()


db.initialize()


// register all our middlewares

// for now this will use cors
app.use(cors())

// body parser
app.use(urlencoded({
    extended: true
}))

// jwt
app.use(jwt({
    secret : process.env.LOANAPP_JWT_SECRET,
    algorithms : ["HS256"],
    credentialsRequired: false
}))



// tell our components to register all their routes
authentication(app)
plaid         (app)

// build the indices for the shcmeas
 

const port = process.env.LOANAPP_PORT
app.listen(port)

console.log("Listening on port "+port)

