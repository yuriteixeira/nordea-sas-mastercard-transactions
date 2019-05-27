const parseArgs = require('minimist')
const puppeteer = require('puppeteer')
const ynab = require('ynab')

let browser

async function main() {
  try {

    const { personNumber, accessToken, budgetId, accountId, startDate, allowSendAsCleared, verbose, dryRun, source } = getOptions(process.argv, process.env);
    const adapter = require(`../lib/${source}`)
    const {
      getSourceTransactions,
      filterTransactionsSinceStartDate,
      filterTransactionsNotSent,
      buildYnabPayload
    } = adapter

    const ynabApi = new ynab.API(accessToken)

    browser = await puppeteer.launch({ headless: true })
    console.log('>>> Open BankID and authorise (30s to timeout)')

    const sourceTransactions = await getSourceTransactions(browser, personNumber)
    const filteredTransactions = await filterTransactionsNotSent(ynabApi, sourceTransactions, budgetId, accountId, startDate)

    console.log(filteredTransactions)
    console.log('')
    console.log(`${sourceTransactions.length} found in total`)
    console.log(`${filteredTransactions.length} qualified for the filter (date + not sent yet)`)

    if (dryRun) {
      console.log(`DRY RUN mode (nothing was sent)`)
      return
    }

    const ynabPayload = await buildYnabPayload(filteredTransactions, accountId, allowSendAsCleared)
    await ynabApi.transactions.bulkCreateTransactions(budgetId, ynabPayload)
    console.log(`Added ${ynabPayload.transactions.length} transactions to YNAB`)
    
  } catch (error) {

    console.error(error.message)

  } finally {

    if (browser) await browser.close()
  }
}

function getOptions(rawArgs, env) {
  const args = parseArgs(rawArgs)
  const options = {
    source: args.s || args.source,
    personNumber: args.p || args.personNumber || env.PERSON_NUMBER,
    accessToken: args.t || args.accessToken || env.YNAB_ACCESS_TOKEN,
    budgetId: args.b || args.budgetId || env.YNAB_BUDGET_ID,
    accountId: args.a || args.accountId || env.YNAB_ACCOUNT_ID,
    startDate: args.d || args.startDate,
    allowSendAsCleared: args.c || args.allowSendAsCleared || env.YNAB_ALLOW_SEND_AS_CLEARED,
    dryRun: args.n || args.dryRun || env.YNAB_DRY_RUN,
    verbose: args.v || args.verbose || env.YNAB_VERBOSE,
  }
  
  const { source, personNumber, accessToken, budgetId, accountId, startDate, allowSendAsCleared, dryRun, verbose } = options
  const extras = verbose ? "\nArgs: " + JSON.stringify(args) + "\n" : ''

  if (!source || !personNumber || !accessToken || !budgetId || !accountId || source === 'nordea' && !startDate) throw new Error(helpMessage() + extras)

  return options
}

function helpMessage() {
  return "Usage: node nordea-to-ynab.js <arguments>" + 

    "\n\nRequired arguments:" + 
    "\n\t-s or --source: nordea or sas-master (check the lib folder to see supported vendors)" + 
    "\n\t-p or --personNumber (fallbacks to PERSON_NUMBER env var): You 12-digit one" + 
    "\n\t-a or --accessToken (fallbacks to YNAB_ACCESS_TOKEN env var): More info here: https://api.youneedabudget.com" + 
    "\n\t-b or --budgetId (fallbacks to YNAB_BUDGET_ID env var): More info here: https://api.youneedabudget.com" + 
    "\n\t-a or --accountId (fallbacks to YNAB_ACCOUNT_ID env var): More info here: https://api.youneedabudget.com" + 
    "\n\t-d or --startDate: YYYY-MM-DD formated, only transactions from this date are fetched" + 

    "\n\nOptional:" + 
    "\n\t-c or --allowSendAsCleared (fallbacks to YNAB_ALLOW_SEND_AS_CLEARED): Will send transactions as CLEARED, automagically" + 
    "\n\t-n or --dryRun (fallbacks to YNAB_DRY_RUN): Only show transactions, nothing is sent to YNAB" + 
    "\n\t-v or --verbose (fallbacks to YNAB_VERBOSE): Shows extra debug info"
}

async function addTransactionsToYnab(transactions, budgetId) {
  try {
    await ynabApi.transactions.bulkCreateTransactions(budgetId, transactions)
    console.log(`Added ${transactions.transactions.length} transactions to YNAB`)
  } catch (error) {
    console.error(error.stack)
  }
}

try {
  main()
} catch (error) {
  console.error(error.message)
}

