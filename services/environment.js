import dotenv from "dotenv"
dotenv.config();

export const IS_PRODUCTION = (process.env.NODE_ENV === "local" || process.env.NODE_ENV === "development") ? false : true;
