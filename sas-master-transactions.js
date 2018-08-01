const puppeteer = require('puppeteer')
const fetch = require('node-fetch')

async function main() {
  const personNumber = process.argv[2]
  if (!personNumber) throw new Error(helpMessage())

  // Workaraound: doesn't work when headless 
  const browser = await puppeteer.launch({headless: false})

  try {
    const transactions = 
      await start(browser)
        .then((page) => setPersonNumber(personNumber, page))
        .then(goToTransactionsPage)
        .then(getTransactions)
    
    console.log(JSON.stringify(transactions))
  } catch(error) {
    console.error(error.stack)
  } 

  await browser.close()
}

function helpMessage()
{
  return 'Usage: node sas-master-transactions.js <your-host:debugport>'
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
  await inputField.type('0' + personNumber, {delay: 100})
  await inputField.press('Enter')
  await page.waitForSelector('section.overview')
  return page
}

async function goToTransactionsPage(page) {
  await page.goto('https://secure.sebkort.com/nis/m/sase/external/t/login/index#uninvoice')
  return page
}

async function getTransactions(page) {
  await page.waitForSelector('#cardTransactionContentTable')
  return await page.evaluate(extractTransactions)
}

function extractTransactions() {
  const rows = [...document.querySelectorAll('li.reserved, li.list-item')]
  const transactions = rows.map(row => {
    const allCols = [...row.querySelectorAll('ul.container li')]
    const selCols = allCols.filter((col, index) => [0, 2, 6].includes(index))
    const mappedCols = selCols.map(col => col.innerText)
    const [date, desc, amount] = mappedCols
    return {date, desc, amount}
  })
  return transactions
}

try {
  main()
} catch (error) {
  console.error(error.message)
}

