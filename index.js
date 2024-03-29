import dotenv from 'dotenv'

import cors from 'cors'
import express, { urlencoded } from 'express'
import { expressjwt } from 'express-jwt'

// import our components
import application from './components/application/application.js'
import authentication from './components/authentication/authentication.js'

import plaid from "./components/plaid/plaid.js"
// environment variables must be set before connection with db is established
dotenv.config()


const
    app = express();
    const router = express.Router()



// register all our middlewares

// for now this will use cors
app.use(cors())

// Options
app.options("/auth/admin-create", cors({
    exposedHeaders: [
        "x-api-key"
    ]
}))
app.use(
    expressjwt({
        secret: process.env.LOANAPP_JWT_SECRET,
        algorithms: ["HS256"],
        credentialsRequired: false,
        onExpired: (err, req) =>{
            // do nothing so we can clear the auth
        }
    })
)

// clear expired tokens
app.use((req, res, next) => {
    // expiration date is in seconds 
    if(req.auth?.exp < Date.now()/1000){
        req.auth = {
            expired : true
        }
    }
    next()
})

// body parser
app.use(urlencoded({
    extended: true
}))



// tell our components to register all their routes
authentication(router)
application   (router)
plaid         (router)

app.use('/api/',router)


// if the frontend receives a 401 status, it should clear the
// token from localStorage
app.use( (err,req,res, next) =>{
    switch(err.name){
        case "UnauthorizedError":
            res.status(401).json({
                err : `Invalid authentication: ${err}`
            })
        break;
        default:
            res.status(500).json({
                err : err.message
            })
    }
})

app.get("/link_tester", (req,res)=>{
    res.sendFile(`${process.cwd()}/linktester.html`)
})

export default app;