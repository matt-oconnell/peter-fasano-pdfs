const puppeteer = require('puppeteer');
const fs = require('fs');
const pdf = require('html-pdf');
const html = fs.readFileSync('test.html', 'utf8');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768});

  await page.goto('https://peterfasano.com/wp-admin/');

  // Log IN
  await page.waitForSelector('input#user_login');
  await page.$eval('input#user_login', el => el.value = 'rstewart');
  await page.$eval('input#user_pass', el => el.value = 'if^ZjRd(QCC$*urlB)FwtsCb');
  await page.click('#wp-submit');
  
  // Go to Products page
  await page.waitForSelector('.menu-icon-product');
  await page.click('.menu-icon-product');
  await page.waitForSelector('#product_cat');

  // Go to specific product page
  await page.click('#post-2286 .row-title');

  await page.waitForSelector('#postexcerpt');
  await page.waitFor(200);

  // Generate name of PDF
  const fabricName = await page.$eval('[name="post_title"]', el => el.value);
  const skus = await page.$$eval('[data-field_name="colorways"] [data-field_name="sku"] input', els => [].map.call(els, el => el.value));

  let count = 0;
  for (sku of skus) {
    if (sku) {
      count++;
      let path = `${__dirname}/pdfs/${fabricName}-${sku.trim().split(' ').join('')}.pdf`;
      if (fs.existsSync(path)) {
        const input = await page.evaluate((isku) => {
          try {
            return document.querySelectorAll(`[data-field_name="colorways"] [data-field_name="sku"] input[value="${isku}"]`)[0].parentElement.parentElement.parentElement.parentElement.getElementsByClassName('add-file')[0].classList.add('secret' + count);
          }
          catch(e) {
            return 'nah' + isku;
          }
        }, sku);
        await page.waitFor(200);
        await page.click('[data-field_name="colorways"] .add-file');
        // const whatevers = await page.$$eval('[data-field_name="colorways"] .add-file', els => [].map.call(els, el => el.classList));
        // console.log(whatevers);
        
        // await page.waitFor(400);
        // if (count === 1) {
          await page.click('.media-router a:first-child');
          await page.waitFor(200);
          await page.click('#__wp-uploader-id-1');
          await page.waitFor(1000);
          await page.screenshot({ path: 'example.png' });

        // }
      }
    }
  }

  await browser.close();
})();

