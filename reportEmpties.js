const puppeteer = require("puppeteer");
const fs = require("fs");
const moment = require("moment");

const TYPE = "wallcoverings";
const DATE_STRING = new Date()
  .toDateString()
  .split(" ")
  .join("-");
const REPORT_FILE_NAME = `reports/${DATE_STRING}_${TYPE}.txt`;

const STREAM = fs.createWriteStream(REPORT_FILE_NAME, { flags: "a" });

async function getAllLinksFromGrid(page) {
  try {
    return await page.evaluate(() => {
      const links = [];
      const productEls = document.getElementsByClassName(
        "woocommerce-LoopProduct-link"
      );
      for (let i = 0; i < productEls.length; i++) {
        links.push(productEls[i].getAttribute("href").split("/?")[0]);
      }
      return links;
    });
  } catch (e) {
    console.log(e);
    process.exit();
  }
}

async function scrapePage(page) {
  return await page.evaluate(() => {
    let scrapedData = {};

    scrapedData.patternName = document
      .getElementsByClassName("entry-title")[0]
      .innerText.split(" ")
      .join("-");

    scrapedData.sku = document
      .getElementsByClassName("woo-prod-sku")[0]
      .innerText.split(" ")
      .join("-");

    scrapedData.hasMemo = !document.querySelector(
      "a.woo-prod-download-memo.js-download-memo.hide"
    );

    return scrapedData;
  });
}

async function getDataFromPattern(page) {
  const patternVariantsDataArr = [];

  const tileCount = await page.evaluate(function() {
    return document.getElementsByClassName("colorway-tile").length;
  });

  iterator = [];
  for (let i = 1; i <= tileCount; i++) {
    iterator.push(i);
  }

  for (let i of iterator) {
    await page.click(`.colorway-tile:nth-of-type(${i})`);
    await page.waitFor(1);
    const scrapedData = await scrapePage(page);
    patternVariantsDataArr.push(scrapedData);
  }

  patternData = {
    patternVariantsDataArr,
    tileCount,
    tileCountEqualsReturnedData: tileCount === patternVariantsDataArr.length
  };

  return patternData;
}

function writeToReport(string) {
  STREAM.write(string);
}

(async () => {
  let missCount = 0;

  const startDate = moment();

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const misses = [];

  await page.goto(`https://peterfasano.com/${TYPE}/`);
  console.log(`https://peterfasano.com/${TYPE}/`);

  await page.waitForSelector(".woocommerce-LoopProduct-link");

  const links = await getAllLinksFromGrid(page);

  writeToReport(`# of Links: ${links.length} \n`);

  for (link of links) {
    console.log(link);

    await page.goto(link);
    await page.waitForSelector(".jsZoom");

    const dataFromPattern = await getDataFromPattern(page);

    writeToReport(
      `\n[${dataFromPattern.patternVariantsDataArr[0].patternName}] \n`
    );
    writeToReport(
      `\t correct tile count: ${dataFromPattern.tileCountEqualsReturnedData} \n`
    );

    for (variantData of dataFromPattern.patternVariantsDataArr) {
      if (!variantData.hasMemo) {
        missCount++;
        if (!misses.includes(variantData.patternName)) {
          misses.push(variantData.patternName);
        }
      }
      writeToReport(`\t${variantData.hasMemo} --- ${variantData.sku}\n`);
    }
  }

  const endDate = moment();
  const secondsDiff = endDate.diff(startDate, "seconds");

  console.log("Time to run: " + secondsDiff + " s");

  writeToReport("\n" + JSON.stringify(misses));
  writeToReport("\nMiss Count:" + missCount);
  console.log(JSON.stringify(misses));
  console.log("Miss Count: " + missCount);

  STREAM.end();

  await browser.close();
})();
