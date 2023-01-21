import dotenv from 'dotenv'
// environment variables must be set before connection with db is established
dotenv.config()

import express from 'express'
import cors from 'cors'
import { urlencoded } from 'express'
import { expressjwt } from 'express-jwt'

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
    if(req.auth?.exp*1000 < Date.now()/1000){
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
authentication(app)
plaid         (app)


// if the frontend receives a 401 status, it should clear the
// token from localStorage
app.use( (err,req,res, next) =>{
    switch(err.name){
        case "UnauthorizedError":
            res.status(401).json({
                err : "Invalid authentication"
            })
        break;
        default:
            res.status(500).json({
                err : err.message
            })
    }
})
 
app.get("/link_tester", (req,res)=>{
    res.sendFile(process.cwd()+"/linktester.html")
})

const port = process.env.LOANAPP_PORT
app.listen(port)

console.log("Listening on port "+port)

