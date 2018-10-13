# Nordea and SAS Mastercard transactions

This node script will fetch those transactions for you and either send it to ynab through its API (only sas mastercard supports this for now) or output a json (nordea), so you import this data.

## Before using...

You will need to get your Ynab access token, account id and budget id.
See how to get those here: https://api.youneedabudget.com

## Usage

```
# checkout the repo, and inside your working dir, do:

npm install # first time only
node sas-master-transactions.js <12-digit personummer> <Ynab Access Token> <Ynab Budget Id> <Ynab Account Id> 

```

## Requirements

* Node 8.x
* NPM

