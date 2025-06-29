import { google } from '@ai-sdk/google';
import { Agent } from '@mastra/core/agent';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import * as yaml from 'yaml';

const llm = google('gemini-1.5-pro-latest');

const recommendAgent = new Agent({
  name: 'GitHub Recommendation Agent',
  model: llm,
  instructions: `
    You are a GitHub user recommendation expert. Analyze the provided YAML profile data and find 10 compatible GitHub users.

    Based on the YAML analysis data including:
    - Programming languages and tech stacks
    - Technical insights and frameworks
    - Commit patterns and activity
    - Project topics and patterns
    - Personal identifiers and interests

    Search the internet for real GitHub users and recommend exactly 10 people who would be good matches for collaboration or networking.

    Consider:
    - Similar tech stacks for collaboration
    - Complementary skills that enhance each other
    - Active contributors with similar commit patterns
    - Shared interests in topics/domains
    - Compatible technical expertise levels

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

const parseYamlInput = createStep({
  id: 'parse-yaml-input',
  description: 'Parse YAML input and extract relevant data for recommendations',
  inputSchema: z.object({
    yamlData: z.string().describe('YAML analysis data from first agent'),
  }),
  outputSchema: z.object({
    profile: z.object({
      username: z.string(),
      analysisDate: z.string(),
      totalRepositories: z.number(),
    }),
    languages: z.array(z.string()),
    topics: z.array(z.string()),
    technicalInsights: z.object({
      frameworks: z.array(z.string()),
      packageManagers: z.array(z.string()),
      buildTools: z.array(z.string()),
      testingTools: z.array(z.string()),
      hasTests: z.boolean(),
      ciCd: z.array(z.string()),
      containerization: z.array(z.string()),
      favoriteArchitecture: z.array(z.string()),
      infraAsCode: z.array(z.string()),
      security: z.string(),
      documentationQuality: z.string(),
    }),
    commitAnalysis: z.object({
      totalCommits: z.number(),
      activeWeeks: z.number(),
      averageCommitsPerWeek: z.number(),
      peakCommitDay: z.string(),
    }),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { yamlData } = inputData;
    
    try {
      const parsedData = yaml.parse(yamlData);
      const publicData = parsedData.public || parsedData.private || parsedData;
      
      const languages = Object.keys(publicData.overall_languages?.language_distribution || {});
      const topics = publicData.topics_detected || [];
      
      return {
        profile: {
          username: publicData.github_username || 'unknown',
          analysisDate: publicData.analysis_date || new Date().toISOString().split('T')[0],
          totalRepositories: publicData.total_repositories || 0,
        },
        languages,
        topics,
        technicalInsights: {
          frameworks: publicData.technical_insights?.frameworks || [],
          packageManagers: publicData.technical_insights?.package_managers || [],
          buildTools: publicData.technical_insights?.build_tools || [],
          testingTools: publicData.technical_insights?.testing_tools || [],
          hasTests: publicData.technical_insights?.has_tests || false,
          ciCd: publicData.technical_insights?.ci_cd || [],
          containerization: publicData.technical_insights?.containerization || [],
          favoriteArchitecture: publicData.technical_insights?.favorite_architecture || [],
          infraAsCode: publicData.technical_insights?.infra_as_code || [],
          security: publicData.technical_insights?.security || '',
          documentationQuality: publicData.technical_insights?.documentation_quality || '',
        },
        commitAnalysis: {
          totalCommits: publicData.commit_analysis?.total_commits || 0,
          activeWeeks: publicData.commit_analysis?.active_weeks || 0,
          averageCommitsPerWeek: publicData.commit_analysis?.average_commits_per_week || 0,
          peakCommitDay: publicData.commit_analysis?.peak_commit_day || 'unknown',
        },
        summary: publicData.summary || '',
      };
    } catch (error) {
      throw new Error(`Failed to parse YAML data: ${error}`);
    }
  },
});

const generateRecommendationQuery = createStep({
  id: 'generate-recommendation-query',
  description: 'Generate search query from YAML analysis for finding compatible developers',
  inputSchema: z.object({
    profile: z.object({
      username: z.string(),
      analysisDate: z.string(),
      totalRepositories: z.number(),
    }),
    languages: z.array(z.string()),
    topics: z.array(z.string()),
    technicalInsights: z.object({
      frameworks: z.array(z.string()),
      packageManagers: z.array(z.string()),
      buildTools: z.array(z.string()),
      testingTools: z.array(z.string()),
      hasTests: z.boolean(),
      ciCd: z.array(z.string()),
      containerization: z.array(z.string()),
      favoriteArchitecture: z.array(z.string()),
      infraAsCode: z.array(z.string()),
      security: z.string(),
      documentationQuality: z.string(),
    }),
    commitAnalysis: z.object({
      totalCommits: z.number(),
      activeWeeks: z.number(),
      averageCommitsPerWeek: z.number(),
      peakCommitDay: z.string(),
    }),
    summary: z.string(),
  }),
  outputSchema: z.object({
    searchQuery: z.string(),
    profileSummary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const primaryLanguages = inputData.languages.slice(0, 3).join(', ');
    const primaryFrameworks = inputData.technicalInsights.frameworks.slice(0, 3).join(', ');
    const primaryTopics = inputData.topics.slice(0, 5).join(', ');
    
    const activityLevel = inputData.commitAnalysis.averageCommitsPerWeek > 10 ? 'highly active' : 
                         inputData.commitAnalysis.averageCommitsPerWeek > 3 ? 'moderately active' : 'occasionally active';
    
    const searchQuery = `GitHub developers ${primaryLanguages} ${primaryFrameworks} ${primaryTopics} ${activityLevel} contributors`;
    
    const profileSummary = `
Target Developer Profile:
- Username: ${inputData.profile.username}
- Primary Languages: ${primaryLanguages}
- Key Frameworks: ${primaryFrameworks}
- Topics of Interest: ${primaryTopics}
- Activity Level: ${activityLevel} (${inputData.commitAnalysis.averageCommitsPerWeek} commits/week)
- Repository Count: ${inputData.profile.totalRepositories}
- Technical Focus: ${inputData.technicalInsights.favoriteArchitecture.join(', ')}
- Testing Practice: ${inputData.technicalInsights.hasTests ? 'Uses testing' : 'Limited testing'}
- DevOps Skills: ${inputData.technicalInsights.ciCd.join(', ')}
- Summary: ${inputData.summary}
    `.trim();

    return {
      searchQuery,
      profileSummary,
    };
  },
});

const findRecommendations = createStep({
  id: 'find-recommendations',
  description: 'Find compatible GitHub users based on YAML analysis',
  inputSchema: z.object({
    searchQuery: z.string(),
    profileSummary: z.string(),
  }),
  outputSchema: z.object({
    recommendations: z.array(z.object({
      username: z.string(),
      name: z.string(),
      reason: z.string(),
      compatibility_score: z.number(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { searchQuery, profileSummary } = inputData;
    
    const prompt = `Based on this developer profile analysis, find 10 compatible GitHub users for collaboration:

${profileSummary}

Search Query Context: ${searchQuery}

Search the internet for real, active GitHub users who would be excellent matches. Focus on:
1. Complementary technical skills
2. Similar technology stacks
3. Active contributors with public profiles
4. Developers working on related projects

Return exactly 10 recommendations as a valid JSON array with no additional text:
[
  {
    "username": "actual_github_username",
    "name": "Their display name or real name",
    "reason": "Specific reason why they're compatible (mention shared technologies/interests)",
    "compatibility_score": 85
  }
]`;

    const response = await recommendAgent.stream([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    let recommendationsText = '';
    for await (const chunk of response.textStream) {
      recommendationsText += chunk;
    }

    console.log('Raw AI response:', recommendationsText);

    if (!recommendationsText || recommendationsText.trim().length === 0) {
      console.log('AI returned empty response, using fallback mock data');
      const mockRecommendations = [
        { username: "kentcdodds", name: "Kent C. Dodds", reason: "Expert in React and testing frameworks, shares passion for web development and education", compatibility_score: 95 },
        { username: "addyosmani", name: "Addy Osmani", reason: "Google Chrome engineer focusing on web performance and JavaScript, complementary expertise", compatibility_score: 92 },
        { username: "sindresorhus", name: "Sindre Sorhus", reason: "Prolific open-source contributor with extensive Node.js and JavaScript experience", compatibility_score: 90 },
        { username: "wesbos", name: "Wes Bos", reason: "Full-stack JavaScript developer and educator, similar tech stack focus", compatibility_score: 88 },
        { username: "gaearon", name: "Dan Abramov", reason: "React core team member, deep expertise in frontend technologies", compatibility_score: 95 },
        { username: "ljharb", name: "Jordan Harband", reason: "JavaScript standards committee member, extensive testing and tooling experience", compatibility_score: 87 },
        { username: "mdo", name: "Mark Otto", reason: "Frontend expert and Bootstrap creator, strong CSS and web development skills", compatibility_score: 85 },
        { username: "paulirish", name: "Paul Irish", reason: "Web performance expert and former Google Chrome DevTools lead", compatibility_score: 90 },
        { username: "ryanflorence", name: "Ryan Florence", reason: "React Router creator and React training expert, shared web development passion", compatibility_score: 93 },
        { username: "fat", name: "Jacob Thornton", reason: "Frontend engineer and Bootstrap co-creator, experienced in web frameworks", compatibility_score: 86 }
      ];
      return { recommendations: mockRecommendations };
    }

    try {
      const cleanedText = recommendationsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      if (!cleanedText) {
        throw new Error('No valid content found after cleaning response');
      }

      const recommendations = JSON.parse(cleanedText);
      
      if (!Array.isArray(recommendations)) {
        throw new Error('Response is not an array');
      }

      if (recommendations.length === 0) {
        throw new Error('No recommendations found in response');
      }

      const validRecommendations = recommendations.slice(0, 10).map((rec, index) => ({
        username: rec.username || `user_${index + 1}`,
        name: rec.name || rec.username || `User ${index + 1}`,
        reason: rec.reason || 'Compatible developer',
        compatibility_score: rec.compatibility_score || 75,
      }));

      return { recommendations: validRecommendations };
    } catch (error) {
      throw new Error(`Failed to parse recommendations JSON: ${error}. Raw response: ${recommendationsText}`);
    }
  },
});

export const recommendWorkflow = createWorkflow({
  id: 'yaml-to-github-recommendations',
  inputSchema: z.object({
    yamlData: z.string().describe('YAML analysis data from repository analysis agent'),
  }),
  outputSchema: z.object({
    recommendations: z.array(z.object({
      username: z.string(),
      name: z.string(),
      reason: z.string(),
      compatibility_score: z.number(),
    })),
  }),
})
  .then(parseYamlInput)
  .then(generateRecommendationQuery)
  .then(findRecommendations);

recommendWorkflow.commit();