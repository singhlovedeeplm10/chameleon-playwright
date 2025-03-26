import Reddit from "../page.js";
import ask from "../../../lib/ask.js";

export default async function (
  context: import('@playwright/test').BrowserContext,
  options: {
    search: string;
    comSearch: string;
    replyMessage?: string;
    triggerWords?: string[]; // Array of words/sentences that will trigger a reply if found in comment
    caseSensitive?: boolean; // Whether trigger matching should be case sensitive
    replyIfNoMatch?: boolean; // Whether to reply to random comment if no triggers match (default true)
  }
) {
  const page = new Reddit(await context.newPage());
  
  // Step 1 - Launch Reddit
  await page.goToStartPage();
  
  // Step 2 - Search for topic and click on 1st test result
  await page.search(options.search);
  await page.findRandomThread();

  // Step 3 - Check and join the subreddit if not already a member
  await page.checkAndJoinSubreddit();
  
  // Updated call with all options
  await page.findAndReplyToComment(
    options.replyMessage || "Reply to this comment", 
    options.triggerWords || ["there is almost"],
    options.caseSensitive || false,
    options.replyIfNoMatch !== false // Default to true if not specified
  );
}

// import { BrowserContext, Page } from 'playwright-core';
// import Reddit from "../page.js";

// interface Options {
//   postUrl?: string;
//   replyMessage?: string;
//   shouldPublish?: boolean;
// }

// export default async function (
//   browserContext: BrowserContext,
//   {
//     postUrl = "https://www.reddit.com/r/SatisfactoryGame/comments/1ihoih5/what_use_if_any_is_any_undefined/",
//     replyMessage = "reply to comment",
//     shouldPublish = false,
//   }: Options = {}
// ) {
//   const redditPage: Page = await browserContext.newPage();
//   const reddit = new Reddit(redditPage);
  
//   await redditPage.goto(postUrl);
//   await redditPage.waitForLoadState('load');

//   const comment = await reddit.findAndReplyToComment(replyMessage);
//   if (!comment) {
//     console.log("No comment found.");
//   } else {
//     console.log("Replied to comment:", comment);
//   }
// }