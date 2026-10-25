import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});await page.goto('http://localhost:3000',{waitUntil:'networkidle'});await page.getByRole('heading',{level:1}).waitFor();await page.screenshot({path:'docs/preview.png',fullPage:true});await page.screenshot({path:'docs/preview-cover.png'});}finally{await browser.close();}
