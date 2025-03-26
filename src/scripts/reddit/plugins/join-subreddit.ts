import { BrowserContext } from 'playwright-core';
import Reddit from "../page.js";

interface JoinOptions {
  postUrl?: string;
}

export default async function (
  browserContext: BrowserContext,
  {
    postUrl = "https://www.reddit.com/r/SatisfactoryGame/",
  }: JoinOptions = {}
) {
  const redditPage = await browserContext.newPage();
  const reddit = new Reddit(redditPage); 
  
  await redditPage.goto(postUrl);
  await redditPage.waitForLoadState('load');

  return await reddit.checkAndJoinSubreddit();
}