import { Page, Locator, expect } from "@playwright/test";
import Base from "../../lib/page.js";

class X extends Base {
  constructor(readonly page: Page) {
    super(page, "https://x.com/VishalMalvi_");
  }

  locator = (selector: string) => {
    console.log(this.page.locator(selector))
    return this.page.locator(selector)
  }
  // Locators
}

export default X;