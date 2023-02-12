
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { protectedRoute } from "../../middleware/protectedRoute.js"
import { linkPublicTokenValidator } from '../authentication/validators.js';
import User from '../../schemas/user.js';
import { adminRoute } from '../../middleware/adminRoute.js';
import { userIdValidator } from './validators.js';

// values are initialized when this component
// is associated with an express context
const plaidAPI = {
  configuration : undefined,
  client        : undefined
}

const allowMultipleApplications = process.env.ALLOW_MULTIPLE_APPLICATIONS === "true"
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

async function getLinkToken(req,res){
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

/**
 * Handles exchanging public token. Stores itemId and accessToken
 * on the user document
 */
async function postSetPublicToken(req,res) {
  // Get the token from req.body.publicToken.
  const { publicToken } = req.body;
  try {
    const tokenResponse = await plaidAPI.client.itemPublicTokenExchange({
      public_token: publicToken
    });

    // Extract access token and itemID and store it on the user document
    const ACCESS_TOKEN = tokenResponse.data.access_token;
    const ITEM_ID = tokenResponse.data.item_id;

    const user = await User.findById(req.auth.id).exec();

    if (!user) {
      return userNotFound(res);
    }

    user.plaidAccessToken = ACCESS_TOKEN;
    user.plaidItemId = ITEM_ID
    await user.save();

    // We can send a response at this stage with the item ID
    return res.status(201).json({
      itemId: ITEM_ID
    });
  } catch (e) {
    console.error(e)
    return res.status(500).json({
      err : `An error occurred in the token process ${e.message}`
    })
  }
}

/* This should only be accessed by admins. Get financial details by userID
*/
async function getFinancialDetailsFromPlaidByUserId(req,res){
  try{
    /* Things to consider for future iterations:
      => what if plaid doesn't respond?
      => what if the server dies?
      => this should be a scheduled task.
    */
    const { id } = req.params;
    const user = await User.findById(id).exec()
    if (!user) {
      return userNotFound(res)
    }
    const { plaidAccessToken, plaidItemId } = user;
    if (!plaidAccessToken) {
      return res.status(400).json({
        err: `Access token not found. This financial request cannot be completed.`
      })
    }

    // In sandbox and dev we can get liabilities, investments, balance
    // To keep it simple, let's just support liabilities for V1 MVP
    const financialLiabilitiesRequest = await plaidAPI.client.liabilitiesGet({
      access_token: user.plaidAccessToken
    });

    res.status(200).json({
      itemId : plaidItemId,
      data: financialLiabilitiesRequest.data
    })

  }catch(e){
    console.error(e)
    res.status(500).json({
      err : `Something bad happened: ${e.message}`
    })
  }  
}

const userNotFound = (res) => {
  return res.status(404).json({
    err : "User not found"
  })
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

  app.get ('/plaid/get_token', protectedRoute, getLinkToken);
  app.get('/plaid/financial_details/:id', protectedRoute, adminRoute, userIdValidator, getFinancialDetailsFromPlaidByUserId)
  app.post('/plaid/set_public_token', protectedRoute, linkPublicTokenValidator, postSetPublicToken)

  console.log("Plaid component registered.")
}
