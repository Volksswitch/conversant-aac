// Makes Videos/Learning Conversant.pdf, the one-page list of every video made
// so far, in viewing order.
//   node scripts/video/make-course-map.mjs
import puppeteer from 'puppeteer';
import path from 'node:path';
import { ROOT } from './azure.mjs';
import { makeCourseMap } from './companion.mjs';

const browser = await puppeteer.launch({ headless: true });
try {
  console.log(path.relative(ROOT, await makeCourseMap(browser)));
} finally {
  await browser.close();
}
