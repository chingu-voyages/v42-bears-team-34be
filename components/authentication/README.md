# Authentication

This is the component for user authentication.

# Endpoints

```
POST /api/auth/login

x-www-form-urlencoded body:

username
password

```

Returns :

If it's OK:
```
{
    tok : JWT which must be sent in the authentication header in every subsequent request.
}
```

If it's not OK:

```
{
    err : "Reason why login failed"
}
```



