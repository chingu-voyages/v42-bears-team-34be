import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'

// environment variables
dotenv.config()


// import our components
import authentication from './components/authentication/authentication.js'
import plaid from "./components/plaid/plaid.js"

const
    app = express()

// register all our middlewares

// for now this will use cors
app.use(cors())

// we will also need bodyparser, JWT and some type of rate limiting.

// tell our components to register all their routes
authentication(app)
plaid         (app)

// hardcoded 3000.
// replace with env.
app.listen("3000")

console.log("Listening on port 3000")

