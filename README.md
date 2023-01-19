# Environment variables

Create a .env file in the root of the project and populate it with:

```
LOANAPP_PORT=(the port the server is going to listen on)
LOANAPP_JWT_SECRET="(what the server will use to encode JWTs)"
LOANAPP_JWT_DURATION="24h" or how long the token is supposed to be valid for.

PLAID_CLIENT_ID=(your plaid client id)
PLAID_SECRET=(your plaid secret)
PLAID_ENV=(either sandbox or production)

MONGO_USER=(username for your db)
MONGO_PASS=(password for your db)
MONGO_BASE=(connection base url that mongodb gives, e.g: cluster0.gjssls2.mongodb.net)
MONGO_DBNAME=(the database name the app is going to use)

```

I think this can be done automatically?

# Standards

## Response

Backend will respond only with objects encoded in JSON.

It will accept only data encoded as ``application/x-www-form-urlencoded`` .


```
{
    err : "error message",
    field : "data according to what is specified by the component"
}
```

Where "field" is also specified by the component, so the Authentication component, for example, returns an object with a "token" field.


## Endpoints

- Backend endpoints should be prefixed with ``/{component name}/``.

- When implementing a new endpoint, the preferred format should be:

```
/{component name}/action/:parameter
```



