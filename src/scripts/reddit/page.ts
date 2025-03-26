import { Page, expect, Locator } from "@playwright/test";
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
  commentLocator = () => this.page.locator('shreddit-comment');
  commentActionRow = () => this.page.locator("shreddit-comment-action-row");
  commentComposer = () => this.page.locator('comment-composer-host');
  joinButton = () => this.page.locator('shreddit-join-button').first();

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
    await expect(this.commentComposer()).toBeVisible();

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

  // New methods from reply-comment.ts
  async getFirstCommentText(): Promise<string | null> {
    await this.commentLocator().first().waitFor();
    return await this.commentLocator().first().evaluate(el => {
      const content = el.querySelector("div[slot='comment']");
      return content ? content.textContent?.trim() || null : null;
    });
  }

  async replyToFirstComment(replyMessage: string): Promise<boolean> {
    try {
      const firstComment = this.commentLocator().first();
      await firstComment.waitFor();
      
      const replyButton = firstComment.locator("shreddit-comment-action-row button").first();
      await replyButton.click();
      
      await this.page.waitForTimeout(1000);
      
      const replyBox = firstComment.locator("shreddit-comment-action-row shreddit-async-loader comment-composer-host faceplate-form shreddit-composer");
      await replyBox.waitFor();
      
      await this.page.keyboard.type(replyMessage);
      const submitButton = replyBox.locator("button[slot='submit-button']");
      await submitButton.click();
      
      return true;
    } catch (error) {
      console.error("Error replying to comment:", error);
      return false;
    }
  }

  async findAndReplyToComment(
    replyMessage: string,
    triggerWords: string[] = ["there is almost"], // Default trigger words
    caseSensitive: boolean = false, // Optional case sensitivity flag
    replyIfNoMatch: boolean = true // Whether to reply to random comment if no triggers match
  ): Promise<string | false> {
    try {
      const commentText = await this.getFirstCommentText();
      if (!commentText) return false;
  
      // Check if trigger words are provided and if any match the comment
      if (triggerWords.length > 0) {
        const compareText = caseSensitive ? commentText : commentText.toLowerCase();
        const matchedTrigger = triggerWords.some(trigger => {
          const compareTrigger = caseSensitive ? trigger : trigger.toLowerCase();
          return compareText.includes(compareTrigger);
        });
  
        if (matchedTrigger) {
          const success = await this.replyToFirstComment(replyMessage);
          return success ? commentText : false;
        } else if (!replyIfNoMatch) {
          console.log("No trigger words matched the comment and replyIfNoMatch is false. Skipping reply.");
          return false;
        }
        // If we get here, no triggers matched but replyIfNoMatch is true
        console.log("No trigger words matched, but replying to random comment as fallback");
      }
  
      // Either no trigger words provided or we're falling back to random reply
      const success = await this.replyToFirstComment(replyMessage);
      return success ? commentText : false;
    } catch (error) {
      console.error("Error finding or replying to comment:", error);
      return false;
    }
  }

  async isSubredditMember(): Promise<boolean> {
    const parentElement = this.joinButton().locator('..');
    if (await parentElement.count() === 0) {
      console.log("Parent element of the 'Join' button not found.");
      return false;
    }

    const joinStatusAttribute = await parentElement.evaluate(el => el.getAttribute("noun"));
    if (!joinStatusAttribute) {
      console.log("The 'noun' attribute is missing on the parent element.");
      return false;
    }

    return joinStatusAttribute.toLowerCase().includes("unsubscribe");
  }
  async joinSubreddit(): Promise<boolean> {
    const shadowRootHandle = await this.joinButton().evaluateHandle(el => el.shadowRoot);
    const joined = await shadowRootHandle.evaluate((shadowRoot: ShadowRoot) => {
      const button = shadowRoot.querySelector<HTMLElement>('.button');
      if (!button) return false;
      button.click();
      return true;
    });

    if (!joined) return false;
    console.log("Successfully joined the subreddit.");
    return true;
  }
  async checkAndJoinSubreddit(): Promise<boolean> {
    if (await this.joinButton().count() === 0) {
      console.log("No 'Join' button found on the page.");
      return false;
    }

    const isMember = await this.isSubredditMember();
    if (!isMember) {
      console.log("User is not a member of the subreddit. Joining now...");
      const isJoined = await this.joinSubreddit();
      if (!isJoined) {
        console.log("Failed to join the subreddit.");
        return false;
      }
      return true;
    } else {
      console.log("User is already a member of the subreddit.");
      return true;
    }
  }
}

export default Reddit;