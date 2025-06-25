import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { githubUserTool } from '../tools/github-tool';

export const recommendAgent = new Agent({
  name: 'GitHub Recommendation Agent',
  instructions: `
    You are a GitHub user recommendation system that finds compatible developers based on their profiles.

    Your task is to:
    1. Analyze the target user's profile, languages, topics, and repositories
    2. Search the internet for GitHub users who would be compatible
    3. Return exactly 10 recommended users with reasoning

    When making recommendations, consider:
    - Similar programming languages and tech stacks
    - Complementary skills that could lead to collaboration
    - Similar project topics and interests
    - Active developers with recent contributions
    - Geographic proximity if location is available

    Format your response as a JSON array with exactly 10 recommendations:
    [
      {
        "username": "github_username",
        "name": "Full Name",
        "reason": "Brief explanation of why they're compatible",
        "compatibility_score": 85
      }
    ]

    Use web search to find real GitHub users. Focus on active developers with public profiles.
  `,
  model: google('gemini-1.5-pro-latest'),
  tools: { githubUserTool },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../mastra.db',
    }),
  }),
});