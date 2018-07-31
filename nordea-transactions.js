const puppeteer = require('puppeteer')
const fetch = require('node-fetch')

async function main() {
  const personNumber = process.argv[2]
  if (!personNumber) throw new Error(helpMessage())

  const browser = await puppeteer.launch()

  try {
    const transactions = 
      await start(browser)
        .then(goToLogin)
        .then((page) => setPersonNumber(personNumber, page))
        .then(goToTransactionsPage)
        .then(getTransactions)
    
    console.log(JSON.stringify(transactions))
  } catch(error) {
    console.error(error.stack)
  } 
  
  browser.close()
}

function helpMessage()
{
  return 'Usage: example.js <your-host:debugport>'
}

async function start(browser) {
  console.warn('>>> Open BankID to authorise (will timeout in 30s)')
  const page = await browser.newPage()
  await page.goto('https://www.nordea.se/')
  return page
}

async function goToLogin(page) {
  await page.goto('https://internetbanken.privat.nordea.se/nsp/login')
  return page
}

async function setPersonNumber(personNumber, page) {
  const inputField = await page.$('#personnummer')
  await inputField.focus()
  await inputField.type(personNumber)
  await inputField.press('Enter')
  await page.waitForSelector('#currentaccountsoverviewtable a')
  return page
}

async function goToTransactionsPage(page) {
  const link = await page.evaluate(() => document.querySelector('#currentaccountsoverviewtable a').href)
  await page.goto(link)
  return page
}

async function getTransactions(page) {
  return await page.evaluate(extractTransactions)
}

function extractTransactions() {
  const allRows = [...document.querySelectorAll('#transactionstable tr')]
  const rows = allRows.filter(row => row.querySelectorAll('td').length > 1)
  const transactions = rows.map(row => {
    const allCols = [...row.querySelectorAll('td')]
    const selCols = allCols.filter((col, index) => [1, 2, 4].includes(index))
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

