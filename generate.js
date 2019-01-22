const puppeteer = require("puppeteer");
const fs = require("fs");
const pdf = require("html-pdf");
const html = fs.readFileSync("test.html", "utf8");
const moment = require("moment");

const TYPE = "wallcoverings";
const WHITE_LIST = [
  "Surrey",
  "Box-Leaf",
  "Dotty",
  "Maile",
  "Randy’s-Ribbons"
].map(name => {
  return name
    .toLowerCase()
    .split("'")
    .join("");
});
const SKU_TYPE_TITLE = true;

const startDate = moment();

async function getAllLinksFromGrid(page) {
  return await page.evaluate(() => {
    const links = [];
    const productEls = document.getElementsByClassName(
      "woocommerce-LoopProduct-link"
    );
    for (var i = 0; i < productEls.length; i++) {
      links.push(productEls[i].getAttribute("href").split("/?")[0]);
    }
    return links;
  });
}

async function scrapePage(page) {
  return await page.evaluate(() => {
    const scrapedData = {
      alternate: undefined
    };
    scrapedData["patternName"] = document.getElementsByClassName(
      "entry-title"
    )[0].innerText;
    [
      scrapedData["desc"],
      scrapedData["dimensions"]
    ] = document
      .getElementsByClassName("woo-prod-description")[0]
      .innerText.split("\n");
    scrapedData["sku"] = document.getElementsByClassName(
      "woo-prod-sku"
    )[0].innerText;
    scrapedData["img"] = document
      .getElementsByClassName("jsZoom")[0]
      .getAttribute("data-zoom");

    const htmlText = document.getElementsByTagName("html")[0].innerHTML;
    if (htmlText.search("in Fabrics") !== -1) {
      scrapedData["alternate"] = "fabric";
    }
    if (htmlText.search("in Wallcoverings") !== -1) {
      scrapedData["alternate"] = "wallpaper";
    }
    // scrapedData['alternate'] = 'fabric'
    return scrapedData;
  });
}

async function clickColorways(page) {
  const scrapedDataArr = [];

  const tileCount = await page.evaluate(function() {
    return document.getElementsByClassName("colorway-tile").length;
  });

  iterator = [];
  for (let i = 1; i <= tileCount; i++) {
    iterator.push(i);
  }

  for (let i of iterator) {
    await page.click(`.colorway-tile:nth-of-type(${i})`);
    await page.waitFor(100);
    scrapedData = await scrapePage(page);
    scrapedDataArr.push(scrapedData);
  }

  return scrapedDataArr;
}

async function createPdf(scrapedData) {
  replacedHtml = html
    .replace("{{patternName}}", scrapedData.patternName)
    .replace("{{img}}", scrapedData.img)
    .replace("{{sku}}", scrapedData.sku)
    .replace("{{desc}}", scrapedData.desc)
    .replace("{{dimensions}}", scrapedData.dimensions)
    .replace("{{dimensions}}", scrapedData.dimensions)
    .replace(
      "{{also}}",
      scrapedData.alternate
        ? "<p><i>Also available in " + scrapedData.alternate + "</i></p>"
        : ""
    );

  const options = {
    format: "Letter",
    quality: "100"
  };

  console.log(scrapedData.sku);

  let fileName = "";

  if (SKU_TYPE_TITLE) {
    fileName = scrapedData.sku.split(" ")[0];
  } else {
    fileName = `${scrapedData.patternName}-${scrapedData.sku
      .split(" - ")
      .join("-")}`
      .split("/")
      .join("")
      .split("'")
      .join("")
      .split("’")
      .join("")
      .split("–")
      .join("-")
      .replace(/\s/g, "")
      .replace(/\s/g, "")
      .replace(/\s/g, "")
      .replace(/\s/g, "");
  }

  return new Promise(resolve => {
    pdf.create(replacedHtml, options).toFile(
      `./2pdfs-${TYPE}-${new Date()
        .toDateString()
        .split(" ")
        .join("-")}/${fileName}.pdf`,
      function(err, res) {
        if (err) return console.log(err);
        console.log(res.filename);
        resolve();
      }
    );
  });
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(`https://peterfasano.com/${TYPE}/`);

  await page.waitForSelector(".woocommerce-LoopProduct-link");
  const links = await getAllLinksFromGrid(page);

  for (link of links) {
    console.log(link);

    if (
      WHITE_LIST.some(substring => !!link.includes(substring)) ||
      !WHITE_LIST.length
    ) {
      console.log("STARTING: " + link);

      await page.goto(link);
      await page.waitForSelector(".jsZoom");

      const scrapedDataArr = await clickColorways(page);

      const pdfReqs = scrapedDataArr.map(scrapedData => {
        return createPdf(scrapedData);
      });

      await Promise.all(pdfReqs);

      console.log("DONE: " + link);
    }
  }

  const endDate = moment();
  const secondsDiff = endDate.diff(startDate, "seconds");

  console.log("Time to run: " + secondsDiff + " s");

  await browser.close();
})();
