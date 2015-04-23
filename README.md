# Crypto Capital - End-User API

## Connection
The Crypto Capital API is a Socket.io API, which can be reached at `https://api.cryptocapital.co`. No special headers or authentication is necessary to connect to the socket. All commands and messages are transmitted JSON encoded. 

## Account Registration
The Crypto Capital API uses a system very similar to BitID for authentication. By supporting BitID style key-pair authentication, we do not need to store any passwords on our system. Instead, we store only the public address associated with registered accounts.  It thus becomes impossible for a hacker to steal user passwords, since we do not store it.  The public address also becomes a handy way to identify users, and is used throughout the system.

In order to associate a BitID with an account, is necessary to prove ownership of that account. This is done by using the web interface of Crypto Capital to transfer 1.00 from the account to one of our registration accounts, setting the Narative of the transfer to the BitID to be associated with that account. It is necessary to do this for each individual account, which adds the benefit of having access to some accounts restricted and not available through the API.

The registration accounts are as follows:

| Currency | Account Number | Description                                   |
|:--------:|:--------------:|-----------------------------------------------|
|    USD   |   9120231592   | Crypto Capital Verification (Current Account) |
|    EUR   |   9120231638   | Crypto Capital Verification (Current Account) |
|    GBP   |   9120231677   | Crypto Capital Verification (Current Account) |
|    CAD   |   9120231625   | Crypto Capital Verification (Current Account) |
|    JPY   |   9120231773   | Crypto Capital Verification (Current Account) |
|    CNY   |   9120231746   | Crypto Capital Verification (Current Account) |
|    AUD   |   9120231731   | Crypto Capital Verification (Current Account) |
|    PLN   |   9120231707   | Crypto Capital Verification (Current Account) |

Funds sent to these accounts will be automatically reimbursed, as long as they are sent from an account in the same currency. Cross-currency transfers cannot be automatically reimbursed, and so we advise that in order to register an account in a different currency, you should contact Crypto Capital customer support and request that a registration account in your currency be created.

## Client API
All client operations should be JSON encoded messages, emitted to the server in the following format:

```json
{ "key" : "<BitID>", "nonce" : 12345, "params" : {}, "signed" : "<ECDSA Signature>" }
```

The `key` is the BitID associated with the account. The `nonce` is an incremental counter used to uniquely identify the operation. The server will validate the nonce by ensuring that it is higher than the previous nonce received from the same BitID. The `params` object contains parameters specific to the operation. The names of the parameters are case-sensitve. The message should be `signed` with a Base64 encoded SHA1sum of `key + nonce + JSONencode(params)`.

All operations will trigger either an unsigned `ack` or `err` response with the same `nonce`. Clients should listen for these types of messages from the API, to determine whether an operation was received and understood by the API server. An `ack` does not necessarily mean that an operation has been successful, only that it was properly formatted and accepted by the API server.

If an operation was successful, the client will eventually receive a message signed by `1AUTwMzqehYZVqKTvdkVwat4knMzMSkhYU` with details related to the request. Depending on the type of request, this message may be delayed several seconds or several minutes, or in the event of a problem, never arrive. For this reason, client code should be designed to not wait for these messages, but rather should act on them only when they are received. Occasionally, the client may receive messages from the server which are not related to any specific request. An example would be a notification of an incoming transfer.

### auth
Once connecting to the socket.io server, a registered user should authenticate in order to begin receiving messages from the server related to his accounts.

#### params
* This operation has no params, and the params object should not be included in the signature.

#### Sample Code
```javascript
var bckey = bitcoin.ECKey.makeRandom();
var bcpub = bckey.pub.getAddress().toString();

var authdata = { key : bcpub, nonce : Date.now() };
authdata.signed = bitcoin.Message.sign(bckey, authdata.key + authdata.nonce).toString('base64');
socket.emit('auth', JSON.stringify(authdata));
```

### transfer
To initiate a transfer between Crypto Capital accounts, the client should initiate a `transfer` operation. At this time, the API only supports same-currency transfers between Crypto Capital accounts.

#### params
* `accountNumber` - *string* - Account Number to send funds from (eg. `"9120231592"`)
* `beneficiary` - *string* - Account Number to received the funds (eg. `"9120231592"`)
* `currency` - *string* - Currency code of the sending account (eg. `"USD"`)
* `amount` - *number* - Amount for the transfer (eg. `1.00`)
* `narrative` - *string* - Descriptive narrative for the transfer (eg. `"Transaction #12345"`)

#### Sample Code
```javascript
var txparams = { accountNumber : "9120000001", 
                 beneficiary : "9120000002", 
                 currency : "USD", 
                 amount : 150.00, 
                 narrative : "Test API Transfer" };
var txdata = { key : bcpub, nonce : Date.now(), params : txparams };
txdata.signed = bitcoin.Message.sign(bckey, txdata.key + txdata.nonce + JSON.stringify(txdata.params)).toString('base64');
socket.emit('transfer', JSON.stringify(txdata));
```

#### Server Response
The server will send a `transfer` response to the BitID associated with both the sender and recipient of a successful transfer. It will have the following format:

```json
{ 
  "key" : "1AUTwMzqehYZVqKTvdkVwat4knMzMSkhYU",
  "nonce" : 1429815032196,
  "rcpt" : "1BitIDofRecipient",
  "params" : { 
    "id" : "4795",
    "date" : "2015-04-23",
    "sendAccount" : "9120000001",
    "receiveAccount" : "9120000002",
    "sendCurrency" : "USD",
    "receiveCurrency" : "USD",
    "sendAmount" : "150.00",
    "receiveAmount" : "150.00",
    "narrative" : "Test API Transfer #1"
  },
  "signed" : "HHtq7HXqWx1Pi754iAhWWSugJOlmiNrZxrvfui6Y3mPxK1y5ayvJu+3vF2zR9DjIi0XwAouGhLdjHtFii8RlilM="
}
```

#### Response Params
* `id` - Internal Transaction ID
* `date` - Date of Transaction
* `sendAccount` - Account Number of the Sender
* `receiveAccount` - Account Number of the Recipient
* `sendCurrency` - Currency of the Sending Account
* `receiveCurrency` - Currency of the Receiving Account
* `sendAmount` - Amount Sent
* `receiveAmount` - Amount Received
* `narrative` - Description of the transfer

#### Response Signature
The signature is a Base64 encoded SHA1SUM signature of the string:

```javascript
key + nonce + rcpt + JSONencode(params)
```

### statement
A registered user can check transaction history of his account by issuing the `statement` operation.

#### Parameters
* `accountId` - *string* - Account number to query
* `limit` - *string* - a numeric value indicating the number of records to return. This will always return the most recent records.
* `transactionId` - *string* - a numeric value indicating the Transaction ID of a single transaction that should be returned.
* `fromTime` - *string* - a numeric value indicating the Unix-epoch timestamp of the oldest transaction that should be returned. All transactions that have occurred since that time will be returned.

Only one of `limit`, `transactionId`, or `fromTime` should be used.

#### Sample Code
```javascript
var reqparams = { accountId : "9120000001", 
                  fromTime : "1429488000" };
var req = { key : bcpub, nonce : Date.now(), params : reqparams };
req.signed = bitcoin.Message.sign(bckey, req.key + req.nonce + JSON.stringify(req.params)).toString('base64');
socket.emit('statement', JSON.stringify(req));
```

#### Server Response
The server will send a `transfer` response to the BitID associated with both the sender and recipient of a successful transfer. It will have the following format:

```json
{ 
  "key" : "1AUTwMzqehYZVqKTvdkVwat4knMzMSkhYU",
  "nonce" : 1429815032196,
  "rcpt" : "1BitIDofRecipient",
  "params" : { 
    "transactions" : [
      { 
        "id" : "4795",
        "date" : "2015-04-23",
        "sendAccount" : "9120000001",
        "receiveAccount" : "9120000002",
        "sendCurrency" : "USD",
        "receiveCurrency" : "USD",
        "sendAmount" : "150.00",
        "receiveAmount" : "150.00",
        "narrative" : "Test API Transfer #1"
      }
    ]
  },
  "signed" : "HHtq7HXqWx1Pi754iAhWWSugJOlmiNrZxrvfui6Y3mPxK1y5ayvJu+3vF2zR9DjIi0XwAouGhLdjHtFii8RlilM="
}
```

#### Response Params
The response params contains a `transactions` object which is an array of all transactions matching the filters specified. The transactions have the same parameters as the server response for an individual transfer.

#### Response Signature
The signature is a Base64 encoded SHA1SUM signature of the string:

```javascript
key + nonce + rcpt + JSONencode(params)
```
