# Environment variables

Create a .env file in the root of the project and populate it with:

```
PLAID_CLIENT_ID=(your plaid client id)
PLAID_SECRET=(your plaid secret)
PLAID_ENV=(either sandbox or production)
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

- Backend endpoints should be prefixed with ``/api/``.

- When implementing a new endpoint, the preferred format should be:

```
/api/{component name}/action/:parameter
```



