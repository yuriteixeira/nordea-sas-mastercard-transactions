const express = require('express')
const puppeteer = require('puppeteer')
const bodyParser = require('body-parser')

const ynab = require('ynab')

express()
  .use(bodyParser.json())
  .use(cors)
  .get('/', (req, res) => res.send('Tjena!'))
  .get('/transactions', getTransactionsFromSource)
  .post('/transactions', sendTransactionsToYnab)
  .listen(process.env.PORT || 5000)

async function getTransactionsFromSource(req, res) {
  const { 
    adapter: chosenAdapter, 
    personnumber: personNumber, 
    ynabaccountid: ynabAccountId, 
    ynabbudgetid: ynabBudgetId, 
    ynabtoken: ynabToken,
    startdate: startDate
  } = req.headers

  if (
    ['sas-master', 'nordea'].indexOf(chosenAdapter) < 0 ||
    !personNumber ||
    !ynabAccountId || 
    !ynabBudgetId || 
    !ynabToken
  ) {
    res.status(400).end()
    return
  }

  const ynabApi = new ynab.API(ynabToken)
  const adapter = require(`../lib/${chosenAdapter}`)
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })

  const sourceTransactions = await adapter.getSourceTransactions(browser, personNumber)
  const filteredTransactions = await adapter.filterTransactionsNotSent(ynabApi, sourceTransactions, ynabBudgetId, ynabAccountId, startDate)

  browser.close()

  res.send(filteredTransactions)
}

async function sendTransactionsToYnab(req, res) {
  const { adapter: chosenAdapter, ynabAccountId, ynabBudgetId, ynabToken, transactions } = req.body

  if (
    ['sas-master', 'nordea'].indexOf(chosenAdapter) < 0 ||
    !ynabAccountId || 
    !ynabBudgetId || 
    !ynabToken || 
    !transactions ||
    !transactions.hasOwnProperty('length') ||
    !transactions.length
  ) {
    res.status(400).end()
    return
  }

  const ynabApi = new ynab.API(ynabToken)
  const adapter = require(`../lib/${chosenAdapter}`)

  const ynabPayload = await adapter.buildYnabPayload(transactions, ynabAccountId, false)
  await ynabApi.transactions.bulkCreateTransactions(ynabBudgetId, ynabPayload)
}

function cors (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
}
