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
  upVoteButton = () => this.page.locator('shreddit-post button[upvote]');
  downVoteButton = () => this.page.locator('shreddit-post button[downvote]');
  PosttitleText = async () => {
    const selector = 'h1[id^="post-title-"][slot="title"]';
    await expect(this.page.locator(selector)).toBeVisible();
    // Use evaluate with a more sophisticated text extraction
    const title = await this.page.locator(selector).evaluate(el => {
      // Get the text directly, trim whitespace, and normalize spaces
      return el.textContent?.replace(/\s+/g, ' ').trim();
    });
    if (!title)
      throw new Error("Post title not found");
    return title;
  }

  // Check login  
  checkLoginAuthentication = async () => {
    try {
      const selector = '#login-button';
      const loginButton = this.page.locator(selector);
      const isLoginBtn = await loginButton.isVisible();
      if (!isLoginBtn) {
        console.log('isAuthenticated : ', true);
      } else {
        console.log('isAuthenticated : ', false);
      }
      return isLoginBtn;
    } catch (error) {
      console.log('user can not logged in');
    }
  }

  loginWithCredentials = async (email: string, password: string) => {
    console.log('login proccess started...');
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
    console.log('login proccess started...');
    const selector = '#login-button';
    const loginButton = this.page.locator(selector);
    await expect(loginButton).toBeVisible();
    loginButton.click();

    const googleIframeSelector = 'iframe[title="Sign in with Google Button"]';
    await this.page.waitForSelector(googleIframeSelector, { state: "visible" });
    const googleButton = await this.page.locator(googleIframeSelector);
    await googleButton.click();

    const waitForOpenPopup = this.page.waitForEvent("popup");
    const popupDetailFilleds = await waitForOpenPopup;
    await popupDetailFilleds.waitForLoadState();

    const emailButtons = popupDetailFilleds.locator('[data-email]');
    const emailCount = await emailButtons.count();

    if (emailCount > 0) {
      await emailButtons.first().click();
    } else {
      const emailInput = popupDetailFilleds.getByLabel("Email or phone");
      await emailInput.waitFor({ state: "visible" });
      let isEmailValueEmpty = await emailInput.inputValue();

      const googleLoginNextButton = popupDetailFilleds.locator('div#identifierNext button');
      await googleLoginNextButton.waitFor({ state: 'visible' });

      if (!isEmailValueEmpty) {
        console.log('email not found!');
        await emailInput.type(email, { delay: random(10, 50) });
        await googleLoginNextButton.click();

        const passwordInput = popupDetailFilleds.getByLabel("Enter your password");
        await passwordInput.waitFor({ state: 'visible' });
        await passwordInput.type(password, { delay: random(10, 50) });

        const googleLoginPassNextButton = popupDetailFilleds.locator('div#passwordNext button');
        await googleLoginPassNextButton.waitFor({ state: 'visible' });
        await googleLoginPassNextButton.click();
      } else {
        await googleLoginNextButton.click();
      }
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

  async doVote(vote: boolean) {
    const upVoteButton = this.upVoteButton();
    const downVoteButton = this.downVoteButton();

    if (vote) {
      const upVoteCount = await upVoteButton.count();
      if (upVoteCount > 0) {
        const isVisible = await upVoteButton.first().isVisible();
        if (isVisible) {
          const isPressed = await upVoteButton.first().getAttribute("aria-pressed");
          if (isPressed !== "true") {
            await upVoteButton.first().scrollIntoViewIfNeeded();
            await upVoteButton.first().click();
            console.log("Upvote clicked");
          } else {
            console.log("Upvote already done");
          }
        } else {
          console.log("Upvote button is not visible");
        }
      } else {
        console.log("No upvote button found");
      }
    } else {
      const downVoteCount = await downVoteButton.count();
      if (downVoteCount > 0) {
        const isVisible = await downVoteButton.first().isVisible();
        if (isVisible) {
          const isPressed = await downVoteButton.first().getAttribute("aria-pressed");
          if (isPressed !== "true") {
            await downVoteButton.first().scrollIntoViewIfNeeded();
            await downVoteButton.first().click();
            console.log("Downvote clicked");
          } else {
            console.log("Downvote already done");
          }
        } else {
          console.log("Downvote button is not visible");
        }
      } else {
        console.log("No downvote button found");
      }
    }

    return true;
  }



  async findSubreddit(search: string): Promise<boolean> {

    const selector = "faceplate-tracker[noun=tab_communities]";
    await this.page.locator(selector).click();

    await this.waitForNavigation();

    const subRedditSearchOption = this.page.locator("search-telemetry-tracker a").first();
    const href = await this.page.locator("search-telemetry-tracker a").first().getAttribute("href");
    if (href) {
      try {
        const url = new URL(href);
        const searchTerm = url.searchParams.get('q');
        const decodedSearchTerm = searchTerm ? decodeURIComponent(searchTerm) : "";
        if (decodedSearchTerm.toLowerCase().trim() === search.toLowerCase().trim()) {
          console.log("Found Subreddit");
          subRedditSearchOption.click();
          await this.waitForNavigation();

          const postButton = this.page.locator("#subgrid-container faceplate-tracker[noun=create_post]").first();
          await expect(postButton).toBeVisible();
          return true;
        }
      } catch (error) {
        return false;
      }
    } else {
      console.log("URL not found.");
      return false;
    }
    return false
  }

  async createPostSubreddit(commentTitle: string, commmentText: string): Promise<boolean> {
    const postButton = this.page.locator("#subgrid-container faceplate-tracker[noun=create_post]").first().click();
    const titleElem = this.page.locator("#innerTextArea").first();
    const bodyElem = this.page.locator("shreddit-composer div[name=body]").first();
    await titleElem.click();
    await titleElem.pressSequentially(commentTitle, { delay: random(56, 128) });
    await this.page.keyboard.press("Tab");
    await this.page.keyboard.press("Tab");
    await this.page.keyboard.press("Enter");
    await this.page.keyboard.type(commmentText, { delay: random(56, 128) });

    const buttonLocator = this.page.locator('#inner-post-submit-button');
    const buttonCount = await buttonLocator.count();
    if (buttonCount > 0) {
      await buttonLocator.first().click();
      return true
    } else {
      console.log('Button not found');
      return true
    }

  }

}

export default Reddit;