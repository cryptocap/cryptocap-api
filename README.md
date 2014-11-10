# Crypto Capital - End-User API

## Operations and Messages
In the Crypto Capital API (CCC), there are two types of commands that are passed between the client and server: operations and messages. An operation is a command sent by the user to the server. A message is a command sent by the server to the user.

An example operation/message flow operates as such:

1. Customer sends a transfer request operation to CCC.
2. CCC creates a transfer record, with a status of NEW in its internal database, and may approve or reject the transfer according to its compliance rules.
3. CCC relays the transfer to the back-end financial servers and waits for status updates.
4. CCC updates the status of the transfer record based on the information from back-end servers.
5. CCC sends a transfer status message to the customer and beneficiary, with the updated status.

## Connection
The Crypto Capital API is a Websocket API, which can be reached at `ws://api.cryptocapital.co:8080`. No special headers or authentication is necessary to connect to the socket. All commands and messages are transmitted JSON encoded. 

Commands issued by the client to the server are referred to as Operations and have the basic structure:

```
{ “op”: “<command>”, “nonce”: 12345, “params”: { … }}
```

The nonce is an optional parameter that can allow the client to connect a response message to an operation. If a nonce is provided, the server will include it in the response.

Messages and notifications sent from the server to the client have the basic structure:

```
{ “msg”: “<type>”, “nonce”: 12345, “data”: { … }, “signed”: “...”}
```

Certain types of server based notifications will be signed by the secured Crypto Capital back-office server using the Public Key `1AUTwMzqehYZVqKTvdkVwat4knMzMSkhYU` as an added security measure. The signature is a Bitcoin signature of the JSON encoded data object included in the message.

## Authentication
The Crypto Capital API uses a system very similar to BitID for authentication. By supporting BitID style key-pair authentication, we do not need to store any passwords on our system. Instead, we store only the public address associated with registered accounts.  It thus becomes impossible for a hacker to steal user passwords, since we do not store it.  The public address also becomes a handy way to identify users, and is used throughout the system.  

The authentication sequence is as follows:

Connect to the API. You will receive a `challenge` message with a random, unique string. The message looks like:

```
{"msg":"challenge","data":"tlgczpu91rw6zuxr"}
```

Using the private key associated with your account to sign the challenge message (only the data), and send the command:

```
{
  “op”: ”auth”, 
  ”params”: { 
    “key”: ”<your public key>”, 
    ”signature”: ”<the signed message>”
  }
}
```

If your signature is valid, you will receive an “auth” message:

```
{"msg":"auth","data":"User Authenticated"}
```

Otherwise you will receive an `error` message explaining the problem.

Once authenticated, the public address used will be kept as a session variable, and automatically included as a parameter for all operations that require it.

Technically, any valid Bitcoin address can be used to authenticate. We do this to force new users to authenticate prior to registering an account. Only addresses associated with a registered account will be able to successfully execute any operations beyond registration. Also, for added security, the Public API servers operate “blind”. No user data (including public keys) is ever stored on the Public API server beyond the end of the session. All operations, once parsed and checked for validity, are passed through to the secured back-end server for processing. If the back-end server is offline, the operation will fail immediately and the user will be notified of the failure.

## Registration
Registering a new account with the Crypto Capital API is a 3-step process. Step one is authentication, described above. Step two is basic registration. Step three is providing KYC/AML information to get the account verified.

Basic registration involves issuing the `register` operation. Required parameters are as follows:

* `name` - Full legal name of the account holder (either a business or individual)
* `email` - Email Address of the account holder
* `country` - Country of Residence (use the two-letter identifier, eg. “PA”)
* `currency` - Preferred Fiat Currency (use the three-letter identifier, eg. “USD”)

Optional parameters are as follows:

* `address` - Full street address (eg. “123 Main Street, Anytown, ST, 12345”)
* `phone` - Phone number, including country code (eg. “+5071231234”)

The server will respond with a `register` message in the event of a successful registration, or `error` message indicating the error.

Verification currently requires the user to visit the Crypto Capital website, where they can submit ID and proof of residency.

## Account Information
### getinfo
A registered user can fetch his account details through the API by issuing the `getinfo` operation. No parameters are required. The server will respond with an `account` message, with a `data` object containing the following information:

* `name` - Name of the account holder
* `email` - Email address of the account holder
* `address` - Mailing address of the account holder
* `phone` - Phone number of the account holder
* `country` - Country of residence of the account holder
* `currency` - Preferred Fiat currency of the account holder
* `isVerified` - True or False, depending on whether the account holder has completed Verification.
* `iban` - IBAN number associated with the account - assigned once the account is verified.

### setinfo
A registered user may update some of his account contact details through the API by issuing the `setinfo` operation. All of the following parameters are optional, and only those provided will be changed. Some changes, such as change of the residence of the country may require re-verification.

* `email` - Email address of the account holder
* `address` - Mailing address of the account holder
* `phone` - Phone number of the account holder
* `country` - Country of residence of the account holder
* `currency` - Preferred Fiat currency of the account holder (using the 3 letter code, eg. “USD”)

The server will respond with an `account` message containing the updated information.

### balance
A registered user can check the balance of his account by issuing the `balance` operation. He may optionally limit the results to a specific currency by providing the `currency` parameter. The server will respond with a `balance` message. The data will contain key/value pairs for the preferred fiat currency (regardless of the balance), as well as any other currency containing a non-zero balance.

### history
A registered user can check transaction history of his account by issuing the `history` operation. He may optionally limit the results by providing either of the following parameters:

* `limit` - a numeric value indicating the number of records to return. This will always return the most recent records.
* `sinceTransaction` - a numeric value indicating the Transaction ID of the oldest transaction that should be returned. All transactions that have occurred since that transaction will be returned.
* `sinceTime` - a numeric value indicating the Unix-epoch timestamp (to the millisecond) of the oldest transaction that should be returned. All transactions that have occurred since that time will be returned.

The server will respond to the `history` operation by sending a separate `transfer` message for each transaction that matches the search, essentially providing a replay as if the user were connected when the transaction happened. This enables exchanges which have gone offline for whatever reason to quickly replay deposits that have occurred since last connected, making use of the same code as would be used to process deposits in real-time. It might also be useful on this operation to provide a nonce in order to distinguish messages sent in response to a `history` request from those sent in real-time.

## Transferring Funds
### transfer
A registered user can transfer funds from his account to another user, or to an IBAN account number by issuing the `transfer` operation with the following parameters:

* `destination` - the public address or IBAN account number of the recipient.
* `currency` - the fiat currency code of the funds to be transferred.
* `amount` - the amount of funds to be transferred.

Internal transfers are processed instantly. On a successful transfer, the server will send both the sender and recipient an identical `transfer` message with the following data:

* `txid` - Transaction ID
* `timestamp` - the unix-epoch timestamp of the transfer
* `sender` - the public address of the sender
* `destination` - the public address of the recipient
* `currency` - the fiat currency code of the funds transferred
* `amount` - the amount of funds transferred

Transfers to IBAN accounts take longer to process. When submitted, the server will respond to the sender with a `transfer` message similar to the above, but with an additional `status` field set to `pending`. When the transfer is processed, a followup `transfer` message will be issued to the sender with the `status` set to either `complete` or `failed`. If the transfer failed, a `message` field will contain a description of the reason the transfer failed.

Deposits from IBAN accounts will trigger a `transfer` message to be sent to the user. The `sender` field will show the IBAN account the originated the deposit.

