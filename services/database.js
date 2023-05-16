import mongoose from 'mongoose';

const database = {
  initialize() {
    const user = process.env.MONGO_USER;
    const pass = process.env.MONGO_PASS;
    const base = process.env.MONGO_BASE;
    const db = process.env.MONGO_DBNAME;
    const mongoUri = `mongodb+srv://${user}:${pass}@${base}/${db}?retryWrites=true&w=majority`;

    mongoose.set('strictQuery', false);

    console.info('DB is initialized here...');

    mongoose.connect(mongoUri).then(() => {
      console.info('Connected to mongo database!');
    });
  },
};

export default database;
