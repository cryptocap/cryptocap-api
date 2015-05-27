var io = require('socket.io-client');
var jscrypto = require('jsrsasign');

var ec = new jscrypto.ECDSA({"curve": 'secp256k1'});
var keypair = ec.generateKeyPairHex();

var cckey = new Buffer(keypair.ecprvhex, 'hex').toString('base64');
var ccpub = new Buffer(keypair.ecpubhex, 'hex').toString('base64');
 
console.log({ 'key' : cckey, 'pub': ccpub });

var socket = io('https://localhost:8443');
socket.on('connect', function () {

    var authdata = { apiVersion : 2, key : ccpub, nonce : Date.now() };
    authdata.signed = doSign(cckey, 'AUTH' + authdata.key.toString() + authdata.nonce.toString());
    console.log('auth: %s', JSON.stringify(authdata, undefined, 2));
    socket.emit('auth', JSON.stringify(authdata, undefined, 2));

    var txparams = { accountNumber : "9120000001", 
                     beneficiary : "9120000002", 
                     currency : 'USD', 
                     amount : 1.00, 
                     narrative : "Test API Transfer" };
    var txdata = { apiVersion : 2, key : ccpub, nonce : Date.now(), params : txparams };
    txdata.signed = doSign(cckey, 'TRANSFER' + txdata.key.toString() + txdata.nonce.toString() + txdata.params.accountNumber.toString() + txdata.params.beneficiary.toString() + txdata.params.currency.toString() + txdata.params.amount.toString());
    console.log('transfer: %s', JSON.stringify(txdata, undefined, 2));
    socket.emit('transfer', JSON.stringify(txdata, undefined, 2));

    var stparams = { accountNumber : "9120000001", 
                     limit : 10 };
    var stdata = { apiVersion : 2, key : ccpub, nonce : Date.now(), params : stparams };
    stdata.signed = doSign(cckey, 'STATEMENT' + stdata.key.toString() + stdata.nonce.toString() + stdata.params.accountNumber.toString());
    console.log('statement: %s', JSON.stringify(stdata, undefined, 2));
    socket.emit('statement', JSON.stringify(stdata, undefined, 2));

    var ping = setInterval( function () { 
        var pingdata = { apiVersion : 2, key : ccpub, nonce : Date.now() };
        //var pingdata = { apiVersion : 2, key : ccpub, nonce : 5 }; // Uncomment this to test invalid nonce
        pingdata.signed = doSign(cckey, 'PING' + pingdata.key.toString() + pingdata.nonce.toString()); 
        console.log('ping: %s', JSON.stringify(pingdata, undefined, 2));
        socket.emit('ping', JSON.stringify(pingdata, undefined, 2)); 
    }, 30000 );

});

socket.on('ack', function (data) {
    console.log('ack: %s', JSON.stringify(data));
});

socket.on('err', function (data) {
    console.log('err: %s', JSON.stringify(data));
});

socket.on('transfer', function (data) {
    console.log('transfer notification: %s', JSON.stringify(data));
});

function doSign(prvkey, message) {

  var hexkey = new Buffer(prvkey, 'base64').toString('hex');

  var curve = 'secp256k1';
  var sigalg = 'SHA256withECDSA';

  var sig = new KJUR.crypto.Signature({"alg": sigalg, "prov": "cryptojs/jsrsa"});
  sig.initSign({'ecprvhex': hexkey, 'eccurvename': curve});
  sig.updateString(message);
  var sigValueHex = sig.sign();
  
  return new Buffer(sigValueHex, 'hex').toString('base64');

}
