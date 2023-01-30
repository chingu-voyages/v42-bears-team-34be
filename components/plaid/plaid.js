
import { Configuration, PlaidApi, Products, PlaidEnvironments } from 'plaid';
import { protectedRoute } from "../../middleware/protectedRoute.js"
import { linkPublicTokenValidator } from '../authentication/validators.js';
import User from '../../schemas/user.js';
import Application from '../../schemas/application.js';
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

/* This may need to be re-factored to get more specific financial details 
  other than liabilities. This method should be called from the front-end 
  by an applicant.
*/
async function getGetApplicantFinancialDetails(req,res){
  try{
    /* Things to consider for future iterations:
      => what if plaid doesn't respond?
      => what if the server dies?
      => this should be a scheduled task.
    */

    const user = await User.findById(req.auth.id).exec()
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

    const newApplication = await saveUserApplication(
      user,  
      financialLiabilitiesRequest.data,
      {
        amount: 100,
        reason: "loan",
        description: "new loan",
        payments: 0,
        paymentAmount: 100
      }
    )

    /* This is just for testing. We don't need to send this data back to the front end, except for a 200 response to
      let front end know that financial data was obtained
      We should save the data into the applications collection and updated the user document 
    */
    res.status(200).json({
      itemId : plaidItemId,
      application: newApplication // This is just for testing. Front end should re-request the data on the confirmation page
    })

  }catch(e){
    console.error(e)
    res.status(500).json({
      err : `Something bad happened: ${e.message}`
    })
  }  
}


/**
 * Handles single or multi-application mode and saves the application and user documents
 * @param {UserDocument} userDocument MongoDB document instance
 * @param {} financialData The raw response from the plaid client request
 * @param {{ amount: number, reason: string, description: string, payments: number, paymentAmount: number }} applicationData The rest of the stuff from the user's application that is pertinent to the loan request, but not obtained by Plaid
 * @returns {Promise<ApplicationDocument>} created application
 */
async function saveUserApplication (userDocument, financialData, applicationData) {
  // We'll only support liabilities for now, so this will save specifically to that section of the financial data
  const financialApplication = new Application({
    ...applicationData,
    requestedBy: userDocument._id,
    status: "new",
    financialData: {
      liabilities: financialData
    }
  })
  
  const createdApplication = await financialApplication.save();
  
  if (allowMultipleApplications) {
    userDocument.applications.push(createdApplication._id);
  } else {
    userDocument.applications = [createdApplication._id]
  }
  await userDocument.save();
  return createdApplication;
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
  app.get('/plaid/get_financial_details', protectedRoute, getGetApplicantFinancialDetails)
  app.post('/plaid/set_public_token', protectedRoute, linkPublicTokenValidator, postSetPublicToken)

  console.log("Plaid component registered.")
}
