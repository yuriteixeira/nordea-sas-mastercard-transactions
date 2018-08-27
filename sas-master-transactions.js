const puppeteer = require('puppeteer')
const ynab = require('ynab')
const accessToken = process.argv[3]
const ynabAPI = new ynab.API(accessToken);

async function main() {
  const personNumber = process.argv[2]
  const budgetId = process.argv[4]
  const accountId = process.argv[5]
  if (!personNumber || !accessToken || !budgetId || !accountId) throw new Error(helpMessage())

  // Workaround: doesn't work when headless 
  const browser = await puppeteer.launch({ headless: false })

  try {
    await start(browser)
      .then((page) => setPersonNumber(personNumber, page))
      .then(goToCardTransactionsPage)
      .then(getCardTransactions)
      .then((cardTransactions) => getTransactionsToBeAddedToYnab(cardTransactions, budgetId, accountId))
      .then((cardTransactions) => buildYnabPayload(cardTransactions, accountId))
      .then((ynabTransactions) => addTransactionsToYnab(ynabTransactions, budgetId))
  } catch (error) {
    console.error(error.stack)
  }
  await browser.close()
}

function helpMessage() {
  return 'Usage: node sas-master-transactions.js <12-digit personummer> <Ynab Access Token> <Ynab Budget Id> <Ynab Account Id> '
}

async function start(browser) {
  console.warn('>>> Open BankID to authorise (will timeout in 30s)')
  const page = await browser.newPage()
  await page.goto('https://secure.sebkort.com/nis/m/sase/external/initEidLogin?method=sbid-remote-seb')
  await page.waitForSelector('.id-number-input')
  return page
}

async function setPersonNumber(personNumber, page) {
  const inputField = await page.$('.id-number-input')

  // Workaround for input problems (remove the +0 and the delay and you will see...)
  await inputField.type('0' + personNumber, { delay: 100 })
  await inputField.press('Enter')
  await page.waitForSelector('section.overview')
  return page
}

async function goToCardTransactionsPage(page) {
  await page.goto('https://secure.sebkort.com/nis/m/sase/external/t/login/index#uninvoice')
  return page
}

async function getCardTransactions(page) {
  await page.waitForSelector('#cardTransactionContentTable')
  return await page.evaluate(extractTransactions)
}

function extractTransactions() {
  const rows = [...document.querySelectorAll('li.reserved, li.list-item')]
  const transactions = rows.map(row => {
    const allCols = [...row.querySelectorAll('ul.container li')]
    const selCols = allCols.filter((col, index) => [0, 1, 2, 6].includes(index))
    const mappedCols = selCols.map(col => col.innerText)
    const [rawDate, reserved, payee, rawAmount] = mappedCols
    const amount = rawAmount.replace(',', '.').replace('\xc2', '').replace('\xa0', '')
    const isCleared = reserved !== 'Reserverat'
    const date = toDateString(rawDate);

    return { date, isCleared, payee, amount }
  })
  return transactions

  function toDateString(rawDate) {
    let date = rawDate;
    let year = new Date().getFullYear();
    let month = parseInt(date.split("-")[0]) - 1; // WHY GOD WHY
    let day = date.split("-")[1];
    let utcDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    return utcDate.toJSON().toString();
  }
}

async function getTransactionsToBeAddedToYnab(transactions, budgetId, accountId) {
  const earliestDate = transactions.reduce(getEarliestDate(), new Date());

  const ynabTransactions = await getYnabTransactions(budgetId, accountId, earliestDate)
  return transactions.filter(transaction => isTransactionNotInYnab(transaction, ynabTransactions))

  function getEarliestDate() {
    return (earliest, tx) => {
      return new Date(earliest) < new Date(tx.date) ? earliest : tx.date;
    };
  }
}

function buildYnabPayload(transactions, accountId) {
  return {
    'transactions': transactions.map(transaction => {
      return {
        'account_id': accountId,
        'date': new Date(transaction.date),
        // *-1 since it's an expense, *1000 to convert it to the correct unit
        'amount': Math.trunc(parseFloat(transaction.amount) * -1 * 1000),
        'payee_id': null,
        'payee_name': transaction.payee,
        'category_id': null,
        'memo': null,
        'cleared': transaction.isCleared ? 'cleared' : 'uncleared',
        'approved': false,
        'flag_color': null,
        'import_id': null
      };
    })
  };
}

async function addTransactionsToYnab(transactions, budgetId) {
  try {
    ynabAPI.transactions.bulkCreateTransactions(budgetId, transactions)
    console.log(`Added ${transactions.transactions.length} transactions to YNAB`)
  } catch (error) {
    console.error(error.stack)
  }
}

async function getYnabTransactions(budgetId, accountId, earliestDate) {
  const transactions = await ynabAPI.transactions.getTransactions(budgetId, accountId, earliestDate)
  return transactions.data.transactions
}

function isTransactionNotInYnab(transaction, ynabTransactions) {
  return !isTransactionAlreadyInYnab(transaction, ynabTransactions)
}

function isTransactionAlreadyInYnab(transaction, ynabTransactions) {
  const filtered = ynabTransactions.filter(ynabTransaction => areSameTransaction(transaction, ynabTransaction))
  return filtered.length > 0
}

function areSameTransaction(cardTransaction, ynabTransaction) {
  if (cardTransaction.payee.toLowerCase().startsWith('betalt')) {
    //Filter out payments to the credit card
    return true
  }

  const cardTransactionDate = new Date(cardTransaction.date)
  const ynabTransactionDate = new Date(ynabTransaction.date)
  const hasSameDate = cardTransactionDate.getMonth() === ynabTransactionDate.getMonth()
    && cardTransactionDate.getDay() === ynabTransactionDate.getDay()

  const cardTransactionAmount = -1 * parseFloat(cardTransaction.amount);
  const ynabTransactionAmount = parseFloat(ynabTransaction.amount) / 1000;
  // Sometimes the ynab amount has a rounding problem, so we fix by looking at the absolute differente
  const hasSameAmount = Math.abs(cardTransactionAmount - ynabTransactionAmount) < 0.001

  const hasSameName = ynabTransaction.payee_name && ynabTransaction.payee_name.toLowerCase() === cardTransaction.payee.toLowerCase()

  return hasSameDate && hasSameName && hasSameAmount
}

try {
  main()
} catch (error) {
  console.error(error.message)
}

