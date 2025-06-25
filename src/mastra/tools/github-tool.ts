import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface GitHubUser {
  login: string;
  name: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  location: string;
  company: string;
  blog: string;
}

interface GitHubRepo {
  name: string;
  language: string;
  stargazers_count: number;
  description: string;
  topics: string[];
}

export const githubUserTool = createTool({
  id: 'get-github-user',
  description: 'Get GitHub user profile and repository information',
  inputSchema: z.object({
    username: z.string().describe('GitHub username'),
  }),
  outputSchema: z.object({
    profile: z.object({
      username: z.string(),
      name: z.string(),
      bio: z.string(),
      location: z.string(),
      company: z.string(),
      followers: z.number(),
      following: z.number(),
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
  execute: async ({ context }) => {
    return await getGitHubUserInfo(context.username);
  },
});

const getGitHubUserInfo = async (username: string) => {
  // Get user profile
  const userResponse = await fetch(`https://api.github.com/users/${username}`);
  if (!userResponse.ok) {
    throw new Error(`User '${username}' not found`);
  }
  const user = (await userResponse.json()) as GitHubUser;

  // Get user repositories
  const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=10`);
  const repos = (await reposResponse.json()) as GitHubRepo[];

  // Extract languages and topics
  const languages = [...new Set(repos.filter(r => r.language).map(r => r.language))];
  const topics = [...new Set(repos.flatMap(r => r.topics || []))];

  return {
    profile: {
      username: user.login,
      name: user.name || user.login,
      bio: user.bio || '',
      location: user.location || '',
      company: user.company || '',
      followers: user.followers,
      following: user.following,
      publicRepos: user.public_repos,
    },
    languages,
    topics,
    topRepositories: repos.slice(0, 5).map(repo => ({
      name: repo.name,
      language: repo.language || 'Unknown',
      stars: repo.stargazers_count,
      description: repo.description || '',
    })),
  };
};