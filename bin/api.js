const express = require('express')
const puppeteer = require('puppeteer')
const bodyParser = require('body-parser')

express()
  .use(bodyParser.json())
  .use(cors)
  .get('/', (req, res) => res.send('Tjena!'))
  .post('/transactions', sendTransactionsToYnab)
  .listen(process.env.PORT || 5000)

async function sendTransactionsToYnab(req, res) {
  const chosenAdapter = req.body.adapter
  const personNumber = req.body.personNumber

  if (['sas-master', 'nordea'].indexOf(chosenAdapter) < 0) {
    res.status(400).end()
    return
  }

  if (!personNumber) {
    res.status(400).end()
    return
  }

  const adapter = require(`../lib/${chosenAdapter}`)
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const sourceTransactions = await adapter.getSourceTransactions(browser, personNumber)

  await browser.close()

  res.send(sourceTransactions)
}

function cors (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
}
