import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

const llm = google('gemini-1.5-pro-latest');

const recommendAgent = new Agent({
  name: 'GitHub Recommendation Agent',
  model: llm,
  instructions: `
    You are a GitHub user recommendation expert. Analyze the provided user profile and find 10 compatible GitHub users.

    Based on the user's:
    - Programming languages
    - Project topics
    - Repository descriptions
    - Profile information

    Search the internet for real GitHub users and recommend exactly 10 people who would be good matches for collaboration or networking.

    Consider:
    - Similar tech stacks for collaboration
    - Complementary skills
    - Active contributors
    - Shared interests in topics/domains

    Return a JSON array with exactly 10 recommendations:
    [
      {
        "username": "actual_github_username",
        "name": "Their display name",
        "reason": "Why they're a good match (1-2 sentences)",
        "compatibility_score": 75
      }
    ]
  `,
});

const analyzeUser = createStep({
  id: 'analyze-user',
  description: 'Analyze GitHub user profile and repositories',
  inputSchema: z.object({
    username: z.string().describe('GitHub username to analyze'),
  }),
  outputSchema: z.object({
    profile: z.object({
      username: z.string(),
      name: z.string(),
      bio: z.string(),
      location: z.string(),
      company: z.string(),
      followers: z.number(),
      publicRepos: z.number(),
    }),
    languages: z.array(z.string()),
    topics: z.array(z.string()),
    topRepositories: z.array(z.object({
      name: z.string(),
      language: z.string(),
      stars: z.number(),
      description: z.string(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { username } = inputData;
    
    // Fetch user profile
    const userResponse = await fetch(`https://api.github.com/users/${username}`);
    if (!userResponse.ok) {
      throw new Error(`User '${username}' not found`);
    }
    const user = await userResponse.json();

    // Fetch user repositories
    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=10`);
    const repos = await reposResponse.json();

    // Extract languages and topics
    const languages = [...new Set(repos.filter((r: any) => r.language).map((r: any) => r.language))];
    const topics = [...new Set(repos.flatMap((r: any) => r.topics || []))];

    return {
      profile: {
        username: user.login,
        name: user.name || user.login,
        bio: user.bio || '',
        location: user.location || '',
        company: user.company || '',
        followers: user.followers,
        publicRepos: user.public_repos,
      },
      languages,
      topics,
      topRepositories: repos.slice(0, 5).map((repo: any) => ({
        name: repo.name,
        language: repo.language || 'Unknown',
        stars: repo.stargazers_count,
        description: repo.description || '',
      })),
    };
  },
});

const findRecommendations = createStep({
  id: 'find-recommendations',
  description: 'Find compatible GitHub users for recommendations',
  inputSchema: z.object({
    profile: z.object({
      username: z.string(),
      name: z.string(),
      bio: z.string(),
      location: z.string(),
      company: z.string(),
      followers: z.number(),
      publicRepos: z.number(),
    }),
    languages: z.array(z.string()),
    topics: z.array(z.string()),
    topRepositories: z.array(z.object({
      name: z.string(),
      language: z.string(),
      stars: z.number(),
      description: z.string(),
    })),
  }),
  outputSchema: z.object({
    recommendations: z.string(),
  }),
  execute: async ({ inputData }) => {
    const userProfile = inputData;
    
    const prompt = `Analyze this GitHub user profile and find 10 compatible developers:

Profile: ${JSON.stringify(userProfile, null, 2)}

Search the internet for real GitHub users who would be good matches. Return exactly 10 recommendations as a JSON array.`;

    const response = await recommendAgent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let recommendationsText = '';
    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
      recommendationsText += chunk;
    }

    return {
      recommendations: recommendationsText,
    };
  },
});

export const recommendWorkflow = createWorkflow({
  id: 'github-recommendations',
  inputSchema: z.object({
    username: z.string().describe('GitHub username to get recommendations for'),
  }),
  outputSchema: z.object({
    recommendations: z.string(),
  }),
})
  .then(analyzeUser)
  .then(findRecommendations);

recommendWorkflow.commit();