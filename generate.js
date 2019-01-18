const puppeteer = require('puppeteer');
const fs = require('fs');
const pdf = require('html-pdf');
const html = fs.readFileSync('test.html', 'utf8');

async function getAllLinksFromGrid(page, isNewArrivals) {
  if (isNewArrivals) {
    return await page.evaluate(() => {
      const links = [];
      const newArrivals = document.getElementsByClassName('featured-items');
      const productEls = newArrivals[0].getElementsByClassName('woocommerce-LoopProduct-link');
      for (var i = 0; i < productEls.length; i++) {
        links.push(productEls[i].getAttribute('href').split('/?')[0]);
      }
      return links;
    });
  }
  else {
    return await page.evaluate(() => {
      const links = [];
      const productEls = document.getElementsByClassName('woocommerce-LoopProduct-link');
      for (var i = 0; i < productEls.length; i++) {
        links.push(productEls[i].getAttribute('href').split('/?')[0]);
      }
      return links;
    });
  }
}

async function scrapePage(page) {
  return await page.evaluate(() => {
    const scrapedData = {
      alternate: undefined,
    };
    scrapedData['patternName'] = document.getElementsByClassName('entry-title')[0].innerText;
    [
      scrapedData['desc'],
      scrapedData['dimensions']
    ] = document.getElementsByClassName('woo-prod-description')[0].innerText.split('\n');
    scrapedData['sku'] = document.getElementsByClassName('woo-prod-sku')[0].innerText;
    scrapedData['img'] = document.getElementsByClassName('jsZoom')[0].getAttribute('data-zoom');
    
    const htmlText = document.getElementsByTagName('html')[0].innerHTML;
    if (htmlText.search('in Fabrics') !== -1) {
      scrapedData['alternate'] = 'fabric';
    }
    if (htmlText.search('in Wallcoverings') !== -1) {
      scrapedData['alternate'] = 'wallpaper';
    }
    // scrapedData['alternate'] = 'fabric'
    return scrapedData;
  });
}

async function clickColorways(page) {
  const scrapedDataArr = [];

  const tileCount = await page.evaluate(function() {
    return document.getElementsByClassName('colorway-tile').length;
  });

  iterator = [];
  for (let i = 1; i <= tileCount; i++) {
    iterator.push(i);
  }

  for (let i of iterator) {
    await page.click(`.colorway-tile:nth-of-type(${i})`);
    await page.waitFor(1);
    scrapedData = await scrapePage(page);
    scrapedDataArr.push(scrapedData);
  }

  return scrapedDataArr;
}

async function createPdf(scrapedData) {
  replacedHtml = html.replace('{{patternName}}', scrapedData.patternName)
    .replace('{{img}}', scrapedData.img)
    .replace('{{sku}}', scrapedData.sku)
    .replace('{{desc}}', scrapedData.desc)
    .replace('{{dimensions}}', scrapedData.dimensions)
    .replace('{{dimensions}}', scrapedData.dimensions)
    .replace('{{also}}', scrapedData.alternate ? '<p><i>Also available in ' + scrapedData.alternate + '</i></p>' : '');

  const options = {
    format: 'Letter',
    quality: '100',
  };
  const fileName = `${scrapedData.patternName}-${scrapedData.sku.split(' - ').join('-')}`.replace('/', ':');
  await pdf.create(replacedHtml, options).toFile(`./pdfs-wallcoverings-new-arrivals2/${fileName}.pdf`, function(err, res) {
    if (err) return console.log(err);
    console.log(res);
  });
}

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://peterfasano.com/wallcoverings/');

  await page.waitForSelector('.woocommerce-LoopProduct-link');
  const links = await getAllLinksFromGrid(page, true);

  for (link of links) {
    await page.goto(link);
    await page.waitForSelector('.jsZoom');

    const scrapedDataArr = await clickColorways(page);
    for(scrapedData of scrapedDataArr) {
      await createPdf(scrapedData);
    }
  }

  await browser.close();
})();

