
import { Configuration, PlaidApi, Products, PlaidEnvironments } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID
const PLAID_SECRET    = process.env.PLAID_SECRET
const PLAID_ENV       = process.env.PLAID_ENV

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

async function getToken(req,res){
    const configs = {
        user:{
            client_user_id: 'user-id'
        },
        client_name: 'Plaid Quickstart',
        products: ['liabilities'],
        country_codes: ['US','CA'],
        language: 'en',
        // redirect_uri : "http://localhost:3000"
    }
    const createTokenResponse = await client.linkTokenCreate(configs)
    res.json(createTokenResponse.data)
}


export default function(app){
    app.get('/api/plaid/get_token', getToken)

    console.log("Plaid component registered.")
}