import mongoose from 'mongoose'

const db = {
    initialize(){
        const
            user = process.env.MONGO_USER,
            pass = process.env.MONGO_PASS,
            base = process.env.MONGO_BASE,
            db   = process.env.MONGO_DBNAME
        const
            mongoUri = `mongodb+srv://${user}:${pass}@${base}/${db}?retryWrites=true&w=majority`

        mongoose.set('strictQuery', false);

        console.log("DB is initialized here...")

        mongoose.connect(mongoUri).then( ()=>{
            console.log("Connected to mongo database!")
        })
    }
}

export default db
