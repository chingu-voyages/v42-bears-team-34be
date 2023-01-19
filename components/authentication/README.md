# Authentication

This is the component for user signup/signin.

# Endpoints

## Signup
```
POST /auth/signup

x-www-form-urlencoded body:
    email
    firstName
    lastName
    password
    dateOfBirth (MM-DD-YYYY)

Success:
{
    msg : "Your account has been created"
}

Failure:
{
    err : (reason why the account could not be created)
}
```

## Signin

The contents of the token are yet to be specified, but should contain  "created at" , "good until" and "permissions" fields.
```
POST /auth/login

x-www-form-urlencoded body:

username
password

Success:
{
    tok : JWT which must be sent in the authentication header in every subsequent request.
}

Failure:
{
    err : (Reason why login failed)
}
```

## Profile

For now this just echoes the contents of the JWT which was sent in the Authorization header as a Bearer-Token.
```
GET /auth/profile

Success:
{
    "id": "63c60b22eabceba6b5aabe65",
    "firstName": "John",
    "lastName": "Nobody",
    "email": "john@nobody.com",
    "iat": 1673964038
}

Failure:
{
    err : (reason why it failed, which is going to be "invalid token")
}
```

