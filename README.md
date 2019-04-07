# YNAB Transactions Importer 

This node script will fetch those transactions for you and send it to YNAB through its API

## Supported sources

### Credit cards

* SAS Mastercard

### Banks

* Nordea


## Before using...

You will need to get your YNAB access token, account id and budget id.
See how to get those here: https://api.youneedabudget.com

## Usage

```
### Checkout the repo, and inside your working dir, do:

# first time only

npm install

### CLI

node bin/send-to-ynab.js <params, help msg has all the details>
    
### API
node bin/api.js

# then, to test it
curl localhost:5000 
```

## Requirements

* Node 8.x
* NPM

