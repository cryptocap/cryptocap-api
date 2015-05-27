# Crypto Capital - End-User API v2.1

## Connection
The Crypto Capital API is a Socket.io or Websockets API, which can be reached at `https://api.cryptocapital.co` or `https://api.cryptocapital.co/ws` respectively. No special headers or authentication are necessary to connect to the socket. All commands and messages are transmitted JSON encoded. 

## Account Registration
The Crypto Capital API uses a system very similar to BitID for authentication. By supporting BitID-style key-pair authentication, we do not need to store any passwords on our system. Instead, we store only the public address associated with registered accounts.  It thus becomes impossible for a hacker to steal user passwords, since we do not store them.  The public key also becomes a handy way to identify users, and is used throughout the API. The API uses a base64 encoded secp256k1 eliptical curve key pair. 

In order to associate a public key with an account, is necessary to prove ownership of that account. This is done by using the [Crypto Capital banking platform UI](https://secure.cryptocapital.co) to transfer 1.00 from the account to one of our registration accounts, setting the narrative of the transfer to the public key to be associated with that account. It is necessary to do this for each individual account, which adds the benefit of having access to some accounts restricted and not available through the API. 

The registration accounts are as follows:

| Currency | Account Number | Account Name | Address     | Country |
|:--------:|:--------------:|--------------|-------------|---------|
|    USD   |   9120231592   | CCAPI        | Panama City | Panama  |
|    EUR   |   9120231638   | CCAPI        | Panama City | Panama  |
|    GBP   |   9120231677   | CCAPI        | Panama City | Panama  |
|    CAD   |   9120231625   | CCAPI        | Panama City | Panama  |
|    JPY   |   9120231773   | CCAPI        | Panama City | Panama  |
|    CNY   |   9120231746   | CCAPI        | Panama City | Panama  |
|    AUD   |   9120231731   | CCAPI        | Panama City | Panama  |
|    PLN   |   9120231707   | CCAPI        | Panama City | Panama  |

Funds sent to these accounts will be automatically reimbursed, as long as they are sent from an account in the same currency. Cross-currency transfers cannot be automatically reimbursed, and so we advise that in order to register an account in a different currency, you should contact Crypto Capital customer support and request that a registration account in your currency be created.

## Client API
All client operations should be JSON encoded messages, emitted to the server in the following format:

```json
{ "apiVersion": 2, "key" : "<Public Key>", "nonce" : 12345, "params" : {}, "signed" : "<Signature>" }
```

When using native Websockets instead of Socket.io, the operation message object above should be the `data` parameter of a wrapper object, emitted to the server in the following format:

```json
{ "op": "<operation type>", "data" : <object> }
```

The `key` is the public key associated with the account. The `nonce` is an incremental counter used to uniquely identify the operation. The server will validate the nonce by ensuring that it is higher than the previous nonce received from the same key. The `params` object contains parameters specific to the operation. The names of the parameters are case-sensitve. The `signature` object contains a Base64 encoded ECDSA signature using the SHA256withECDSA algorithm.

All operations will trigger either an unsigned `ack` or `err` response with the same `nonce`. Clients should listen for these types of messages from the API, to determine whether an operation was received and understood by the API server. An `ack` does not necessarily mean that an operation has been successful, only that it was properly formatted and accepted by the API server.

When using native websockets instead of Socket.io, the server initiated messages will be wrapped in a JSON encoded object with `msg` and `data` variables. The value of the `data` variable will contain the message object. For example:

```json
{ "msg": "<message type>", "data" : <object> }
```

If an operation was successful, the client will eventually receive a message signed by the public key `BLmiS8rOACxx3WQfZp/xXyeqjtyrJE6VhMN4gVtpu/RQioE38MXYWxlRF4ONIYI2l9npoSXK1gVcyoB2+VRima0=` with details related to the request. Depending on the type of request, this message may be delayed several seconds or several minutes, or in the event of a problem, never arrive. For this reason, client code should be designed to not wait for these messages, but rather should act on them only when they are received. Occasionally, the client may receive messages from the server which are not related to any specific request. An example would be a notification of an incoming transfer.

### auth
Once connecting to the socket server, a registered user should authenticate in order to begin receiving messages from the server related to his accounts.

#### Parameters
This operation has no params, and the params object should not be included in the signature.

#### Signature String
The signature of the `auth` command should be based on the following concatenated strings:

```
'AUTH' + <key> + <nonce>
```

#### Sample Code
```javascript
var jscrypto = require('jsrsasign');

var ec = new jscrypto.ECDSA({"curve": 'secp256k1'});
var keypair = ec.generateKeyPairHex();

var cckey = new Buffer(keypair.ecprvhex, 'hex').toString('base64');
var ccpub = new Buffer(keypair.ecpubhex, 'hex').toString('base64');

var authdata = { apiVersion : 2, key : ccpub, nonce : Date.now() };
authdata.signed = doSign(cckey, 'AUTH' + authdata.key.toString() + authdata.nonce.toString());
socket.emit('auth', JSON.stringify(authdata));
```

### transfer
To initiate a transfer between Crypto Capital accounts, the client should initiate a `transfer` operation. At this time, the API only supports same-currency transfers between Crypto Capital accounts.

#### Parameters
* `accountNumber` - *string* - Account Number to send funds from (eg. `"9120231592"`)
* `beneficiary` - *string* - Account Number to received the funds (eg. `"9120231592"`)
* `currency` - *string* - Currency code of the sending or beneficiary account (eg. `"USD"`). Forex exchange rates will be automatically calculated and applied.
* `amount` - *number* - Amount for the transfer (eg. `1.00`)
* `narrative` - *string* - Descriptive narrative for the transfer (eg. `"Transaction #12345"`)

#### Signature String
The signature of the `auth` command should be based on the following concatenated string:

```
'TRANSFER' + <key> + <nonce> + <accountNumber> + <beneficiary> + <currency> + <amount>
```

#### Sample Code
```javascript
var txparams = { accountNumber : "9120000001", 
                     beneficiary : "9120000002", 
                     currency : 'USD', 
                     amount : 1.00, 
                     narrative : "Test API Transfer" };
var txdata = { apiVersion : 2, key : ccpub, nonce : Date.now(), params : txparams };
txdata.signed = doSign(cckey, 'TRANSFER' + txdata.key.toString() + txdata.nonce.toString() + txdata.params.accountNumber.toString() + txdata.params.beneficiary.toString() + txdata.params.currency.toString() + txdata.params.amount.toString());
socket.emit('transfer', JSON.stringify(txdata));
```

#### Server Response
The server will send a `transfer` response to the BitID associated with both the sender and recipient of a successful transfer. It will have the following format:

```json
{ 
  "key" : "BLmiS8rOACxx3WQfZp/xXyeqjtyrJE6VhMN4gVtpu/RQioE38MXYWxlRF4ONIYI2l9npoSXK1gVcyoB2+VRima0=",
  "nonce" : 1429815032196,
  "rcpt" : "RecipientKey=",
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
The signature is a Base64 encoded signature of the string:

```
'TRANSFER' + <key> + <rcpt> + <nonce> + <id> + <date> + <sendAccount> + <receiveAccount> + <sendCurrency> + <receiveCurrency> + <sendAmount> + <receiveAmount> + <narrative>
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
var stparams = { accountNumber : "9120000001", 
                 limit : 10 };
var stdata = { apiVersion : 2, key : ccpub, nonce : Date.now(), params : stparams };
stdata.signed = doSign(cckey, 'STATEMENT' + stdata.key.toString() + stdata.nonce.toString() + stdata.params.accountNumber.toString());
socket.emit('statement', JSON.stringify(stdata));
```

#### Server Response
The server will respond to a `statement` request by sending a series of `transfer` responses, one for each transfer that matches the request filter. These messages will have the identical format as in the case of standard transfer notification.
