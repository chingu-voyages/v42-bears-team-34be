
import { Configuration, PlaidApi, Products, PlaidEnvironments } from 'plaid';

// values are initialized when this component
// is associated with an express context
const plaidAPI = {
  configuration : undefined,
  client        : undefined
}

/*

    Assets = "assets",
    Auth = "auth",
    Balance = "balance",
    Identity = "identity",
    Investments = "investments",
    Liabilities = "liabilities",
    PaymentInitiation = "payment_initiation",
    IdentityVerification = "identity_verification",
    Transactions = "transactions",
    CreditDetails = "credit_details",
    Income = "income",
    IncomeVerification = "income_verification",
    DepositSwitch = "deposit_switch",
    StandingOrders = "standing_orders",
    Transfer = "transfer",
    Employment = "employment",
    RecurringTransactions = "recurring_transactions"

*/

async function getToken(req,res){
  // we get the user ID from the data provided by the token, if it's absent, then this won't work

  // should make this a middleware.
  if(!req.auth){
    return res.status(401).json({
      err : "Login first."
    })
  }
  const configs = {
      user:{
          client_user_id: req.auth.id, 
      },
      client_name   : process.env.LOANAPP_APP_NAME,
      products: ['auth','liabilities','assets'],
      country_codes: ['US','CA'],
      language: 'en',
      // redirect_uri : "http://localhost:3000"
  }
  try{
    const createTokenResponse = await plaidAPI.client.linkTokenCreate(configs)
    res.json(createTokenResponse.data)

  }catch(e){
    console.error(e)
    res.status(500).json({
      err : "Something went wrong:" +e.message
    })
  }
}

// WARNING: this violantes the single responsibility principle!
// this function is an example of how a public_token (obtained by the frontend) can be
// exchanged for an access token, and that access token used to obtain the financial
// data straight away.
// this is not a good idea by the way.
// this need:
//
// - a valid bearer token as provided by the login route
// - a valid public_token as provided by the frontend
//
// The public_token is not something the backend can just ask to Plaid's API because
// the Plaid's API expects the end user to provide explicit consent for certain types
// of financial operations (loans, balance, assets, payroll info)
async function postGetFinancialDetails(req,res){
  if(!req.auth){
    return res.status(401).json({
      err : "What are you even doing?"
    })
  }
  try{
    // use body validator to make sure we have this public_token
    let public_token = req.body.public_token
    console.log(`Using public token ${public_token} for user ${req.auth.id}`)

    // exchange the public_token for an access_token
    const tokenResponse = await plaidAPI.client.itemPublicTokenExchange({
      public_token : public_token
    })

    console.log(tokenResponse)

    // we need to store this in the user's DB entry
    let accessToken = tokenResponse.data.access_token
    let itemId      = tokenResponse.data.item_id

    // use that accessToken to perform a query
    // we can actually do this, but I'm not sure if this is a good idea at all.
    // (i'm certain this is not a good idea)
    // what if plaid doesn't respond?
    // what if the server dies?
    // this should be a scheduled task.
    const liabilitiesResponse = await plaidAPI.client.liabilitiesGet({
      access_token: accessToken
    })

    res.status(200).json({
      itemId : itemId,
      liabilities : liabilitiesResponse.data
    })

  }catch(e){
    console.error(e)
    res.status(500).json({
      err : "Something bad happened: "+e.message
    })
  }  
}

export default function(app){
  // initialize API variables
  // this can't be done as a top level statement because
  // the environment variables may not be there by the time
  // this file is included by node
  plaidAPI.configuration = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET'   : process.env.PLAID_SECRET,
        'Plaid-Version': '2020-09-14',
      },
    },
  });

  // create a client
  plaidAPI.client = new PlaidApi(plaidAPI.configuration);

  app.get ('/plaid/get_token'       ,getToken)
  app.post('/plaid/get_financial_details',postGetFinancialDetails)

  console.log("Plaid component registered.")
}