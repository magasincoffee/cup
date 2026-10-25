import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdirSync} from "node:fs";

const url="http://127.0.0.1:8765/v7-preview/";
mkdirSync("artifacts/v7-preview",{recursive:true});
const browser=await chromium.launch({headless:true});
const failures=[];
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on("pageerror",error=>failures.push(error.message));
try {
 await page.goto(url,{waitUntil:"networkidle"});
 await page.getByRole("heading",{name:"Tổng quan hoạt động"}).waitFor();
 assert.equal(await page.locator("#side-nav .nav-item").count(),8);
 await page.screenshot({path:"artifacts/v7-preview/desktop-dashboard.png",fullPage:true});

 await page.locator('#side-nav [data-nav="sales"]').click();
 await page.getByRole("heading",{name:"Bán hàng"}).waitFor();
 await page.locator('[data-add="DEMO-PP700-01"]').click();
 await page.locator('[data-qty="DEMO-PP700-01"]').fill("2");
 await page.locator('[data-qty="DEMO-PP700-01"]').press("Tab");
 await page.locator("#shipping-mode").selectOption("SEPARATE");
 await page.locator("#shippingFeeVnd").fill("50000");
 await page.locator("#shippingFeeVnd").press("Tab");
 const summary=await page.locator(".pos-summary").innerText();
 assert.match(summary,/Tổng đã chốt/);
 assert.match(summary,/950.000/);
 assert.equal(await page.getByRole("button",{name:"Lưu đơn"}).isDisabled(),true);
 assert.equal(await page.getByRole("button",{name:"Chốt đơn"}).isDisabled(),true);
 await page.screenshot({path:"artifacts/v7-preview/desktop-sales.png",fullPage:true});

 await page.locator('#side-nav [data-nav="inventory"]').click();
 await page.getByRole("heading",{name:"Kho & kiểm kê"}).waitFor();
 assert.match(await page.locator("main").innerText(),/Chưa kiểm kê/);
 assert.match(await page.locator("main").innerText(),/DEMO-PP520-02/);
 await page.screenshot({path:"artifacts/v7-preview/desktop-stock.png",fullPage:true});

 await page.setViewportSize({width:390,height:844});
 await page.reload({waitUntil:"networkidle"});
 await page.getByRole("heading",{name:"Tổng quan hoạt động"}).waitFor();
 assert.equal(await page.locator("#bottom-nav").isVisible(),true);
 await page.locator('#bottom-nav [data-nav="sales"]').click();
 await page.getByRole("heading",{name:"Bán hàng"}).waitFor();
 await page.locator('[data-add="DEMO-PP700-01"]').click();
 assert.equal(await page.locator('[data-qty="DEMO-PP700-01"]').count(),1);
 await page.locator('#bottom-nav [data-nav="more"]').click();
 assert.equal(await page.locator("#sidebar").evaluate(e=>e.classList.contains("open")),true);
 await page.locator('#side-nav [data-nav="orders"]').click();
 await page.getByRole("heading",{name:"Đơn hàng & sản xuất"}).waitFor();
 await page.screenshot({path:"artifacts/v7-preview/mobile-orders.png",fullPage:true});
 assert.equal(await page.locator("#overlay").evaluate(e=>e.hidden),true);
 assert.deepEqual(failures,[],"Uncaught browser errors");
 console.log("V7_BROWSER_DESKTOP_MOBILE_SMOKE_PASS_NO_WRITES");
} finally {
 await browser.close();
}
