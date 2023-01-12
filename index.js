import express from 'express';
import cors from 'cors';

const
    app = express()

app.use(cors())

import { Configuration, PlaidApi, Products, PlaidEnvironments } from 'plaid';

// Leaving this here because I'm not a paying user anyway
// Will eventually replace it with .env variables.
const PLAID_CLIENT_ID = "63b6174c898b950012ffbe4b"
const PLAID_SECRET = "06a72b7e1af069d9933fe6341f2812"
const PLAID_ENV = 'sandbox';

// We need a Plaid client.

const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
        'Plaid-Version': '2020-09-14',
      },
    },
  });
  
const client = new PlaidApi(configuration);

app.get('/api/get_token', async (req,res)=>{
    const configs = {
        user:{
            client_user_id: 'user-id'
        },
        client_name: 'Plaid QUickstart',
        products: ['liabilities'],
        country_codes: ['US'],
        language: 'en',
        // redirect_uri : "http://localhost:3000"
    }
    const createTokenResponse = await client.linkTokenCreate(configs)
    res.json(createTokenResponse.data)
})
  

app.listen("3000")