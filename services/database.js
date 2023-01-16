

const db = {
    initialize(){
        console.log("DB is initialized here")
    }
}

// due to the way NodeJS works, this will be called only once, even if this file
// is included in multiple places.
db.initialize()

export default db