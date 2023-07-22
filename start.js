import dotenv from "dotenv";
dotenv.config();
import app from "./index.js"
import db from './services/database.js'
// Here we connect to mongodb and start the server as listening
// Used to actually start the dev server

db.initialize()
const port = process.env.LOANAPP_PORT
app.listen(port, () => {
    console.info(`Listening on port ${port}`)
})