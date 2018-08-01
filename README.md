# Nordea and SAS Mastercard transactions

This node script will fetch those transactions for you and output a json, so you import this data and maybe archive it or send it to an API, like the [YNAB API](https://www.youneedabudget.com/introducing-ynabs-api/) (which motivated me to write this, since I'm too lazy to add the entries manually :P)

## Usage

```
# checkout the repo, and inside your working dir, do:

npm install # first time only
node sas-master-transactions.js <your person number>
node nordea-transactions.js <your person number>

# ProTIP: pipe the output of the commands above to jq to get the JSON formatted ;-)
```

## Requirements

* Node 8.x
* NPM

