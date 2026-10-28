import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5187/store-assets/index.html');
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('.shots figure').last().scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>[...document.images].filter(im=>im.hasAttribute('src')).every(im=>im.complete&&im.naturalWidth>0));
 assert.equal(await page.locator('.shots figure').count(),6);
 await page.locator('.shots button').first().click();assert.equal(await page.locator('dialog').evaluate(e=>e.open),true);
 await page.locator('#next').click();assert.equal(await page.locator('#view-title').innerText(),'Lezzetleri hazırla');
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(e=>e.open),false);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'store-assets/preview/gallery.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Gallery: images loaded, six entries, keyboard viewer and phone layout verified.');
}finally{await browser.close();}
