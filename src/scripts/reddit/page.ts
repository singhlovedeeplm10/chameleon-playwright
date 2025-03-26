import { Page, expect } from "@playwright/test";
import { random, sleepRandom } from "../../lib/utils.js";
import Base from "../../lib/page.js";

class Reddit extends Base {
  constructor(readonly page: Page) {
    super(page, "https://www.reddit.com");
  }

  // Locators
  searchTextBox = () => this.page.locator(`faceplate-search-input`).getByRole("textbox");
  threadLocator = () => this.page.getByTestId("search-post-unit");
  commentButton = () => this.page.getByRole("button", { name: "Add a comment" });
  emailField = () => this.page.locator('input[type="email"]');
  passwordField = () => this.page.locator('input[type="password"]');
  nextButton = () => this.page.getByRole("button", { name: "Next" });

  PosttitleText = async() => {
    const selector = 'h1[id^="post-title-"][slot="title"]';
    await expect(this.page.locator(selector)).toBeVisible();
    
    // Use evaluate with a more sophisticated text extraction
    const title = await this.page.locator(selector).evaluate(el => {
      // Get the text directly, trim whitespace, and normalize spaces
      return el.textContent?.replace(/\s+/g, ' ').trim();
    });
    if(!title) 
      throw new Error("Post title not found");
    return title;
  }

  // Check login  
  checkLoginAuthentication = async () => {
    try {
      const selector = '#login-button';
      const loginButton = this.page.locator(selector);
      const isLoginBtn = await loginButton.isVisible();
      return isLoginBtn;
    } catch (error) {
      console.log('user can not logged in');
    }
  }  

  loginWithCredentials = async (email: string, password: string) => {
    const selector = '#login-button';
    const loginButton = this.page.locator(selector);
    await expect(loginButton).toBeVisible();
    loginButton.click();

    const loginUserName = this.page.locator("faceplate-text-input#login-username");
    loginUserName.click();

    const loginUserNameInput = loginUserName.locator("input");
    await loginUserNameInput.type(email, { delay: random(10, 50) });
    await loginUserNameInput.press('Tab');

    const loginUserPassword = this.page.locator("faceplate-text-input#login-password");
    loginUserPassword.click();

    const loginUserPasswordInput = loginUserPassword.locator("input");
    await loginUserPasswordInput.type(password, { delay: random(10, 50) });
    const loginButtonn = this.page.getByRole('button', { name: 'Log In' });

    await expect(loginButtonn).toBeVisible();
    loginButtonn.click();
    return true;
  }

  loginWithGoogle = async (email: string, password:string) => {
    const selector = '#login-button';
    const loginButton = this.page.locator(selector);
    await expect(loginButton).toBeVisible();
    loginButton.click();
    const googleSelector = 'auth-flow-sso-buttons iframe';
    const iframeLocator = this.page.frameLocator(googleSelector);
    
    const googleLoginButton = iframeLocator.locator('div#container div:nth-child(2)'); 
    await googleLoginButton.waitFor({ state: 'visible' });
    await googleLoginButton.click();

    const waitForOpenPopup = this.page.waitForEvent("popup");
    const popupDetailFilleds = await waitForOpenPopup;
    let isEmailValueEmpty =  await popupDetailFilleds.getByLabel("Email or phone").inputValue();
    const googleLoginNextButton = popupDetailFilleds.locator('div#identifierNext button');
    await googleLoginNextButton.waitFor({ state: 'visible' });

    if(!isEmailValueEmpty){
      console.log('email not found!');
      await popupDetailFilleds.getByLabel("Email or phone").type(email, { delay: random(10, 50) });
      await googleLoginNextButton.click();
      await popupDetailFilleds.getByLabel("Enter your password").type(password, { delay: random(10, 50) });
      const googleLoginPassNextButton = popupDetailFilleds.locator('div#passwordNext button');
      await googleLoginPassNextButton.waitFor({ state: 'visible' });
      await googleLoginPassNextButton.click();
    }else{
      await googleLoginNextButton.click();
    }
  } 

  async search(text: string) {
    await this.searchTextBox().waitFor(); //wait for textbox to display
    await this.searchTextBox().click();
    await this.searchTextBox().pressSequentially(text, { delay: random(128, 256) });
    await this.searchTextBox().press("Enter");
  }

  async findRandomThread(): Promise<boolean> {
    await this.page.getByRole("button", { name: "Posts" }).click();

    const maxAttempts = 18;
    const triedIndices: number[] = [];
    for (let i = 0; i < maxAttempts; i++) {
      console.debug(`Attempts remaining: ${maxAttempts - i}`);
      await this.waitForNavigation();
      await sleepRandom({ multiplier: 3 });

      // Wait for thread elements to be available
      const count = await this.threadLocator().count();
      const availableIndices = [...Array(count).keys()].filter((i) => !triedIndices.includes(i));
      const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      triedIndices.push(randomIndex);

      //await this.findByIndices(threadElement);
      const thread = this.threadLocator().nth(randomIndex);
      await thread.scrollIntoViewIfNeeded();
      await sleepRandom({ multiplier: 2 });
      await thread.click({ force: true });

      await this.waitForNavigation();
      await sleepRandom({ multiplier: 3 });
      try {
        await expect(this.commentButton()).toBeVisible({ timeout: 5000 });
        return true;
      } catch (e) {
        console.warn("Post is archived or removed.");
        await this.page.goBack();
      }
    }

    throw new Error(`Failed to find a thread with open comments after ${maxAttempts} attempts.`);
  }

  async addCommentToThread(comment: string) {
    // Wait for button to be visible and enabled
    await expect(this.commentButton()).toBeVisible();
    await expect(this.commentButton()).toBeEnabled();
    await this.commentButton().click();

    // Wait for comment input to be visible
    await this.page.waitForSelector('comment-composer-host[slot="ready"]');
    const commentComposer = this.page.locator('comment-composer-host');
    await expect(commentComposer).toBeVisible();

    // Continue with comment input
    const textbox = this.page.locator("#subgrid-container").getByRole("textbox");
    await expect(textbox).toBeVisible();
    await textbox.click();
    await textbox.pressSequentially(comment, { delay: random(56, 128) });

    // Submit comment
    const submitButton = this.page.locator('button.button-primary[slot="submit-button"]');
    expect(submitButton).toBeVisible();
    await submitButton.click();
  }
}

export default Reddit;