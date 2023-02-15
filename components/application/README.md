# Authentication

This is the component for the loan application submission/listing/etc.

# Endpoints

## Apply

Make an application for a loan.
This creates an application record tied to the user specified in req.auth

```
POST /application/apply

x-www-form-urlencoded body:
    requestedLoanAmount
    numberOfInstallments
    installmentAmount
    loanPurpose

Success:
{
    msg : "Application registered and pending evaluation."
}

Failure:
{
    err : (reason why the application was rejected.)
}
```

## View one

View the details of an application.
```
GET /aplication/:applicationId
Success:
{
    data : {
        // application data, status and financial details, if provided.
    }
}
```

## List
```
GET /application/all

Success:
{
    data : Application[]   // an array of applications
}

```
