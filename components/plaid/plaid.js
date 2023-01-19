
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
  // se get the user ID from the data provided by the token, if it's absent, then this won't work
  if(!req.auth){
    return res.status(401).json({
      err : "Login first."
    })
  }


  const configs = {
      user:{
          client_user_id: req.auth.id
      },
      client_name: 'Plaid Quickstart',
      products: ['income','liabilities','assets','identity_verification','employment'],
      country_codes: ['US','CA'],
      language: 'en',
      // redirect_uri : "http://localhost:3000"
  }
  const createTokenResponse = await client.linkTokenCreate(configs)
  res.json(createTokenResponse.data)
}


export default function(app){
    app.get('/plaid/get_token', getToken)

    console.log("Plaid component registered.")
}