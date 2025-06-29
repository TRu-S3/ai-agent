import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { publicRepositoryAnalysisAgent } from '../agents';
import * as yaml from 'yaml';

const runRepositoryAnalysis = createStep({
  id: 'run-repository-analysis',
  description: 'Run GitHub repository analysis and generate YAML output',
  inputSchema: z.object({
    username: z.string().describe('GitHub username to analyze'),
  }),
  outputSchema: z.object({
    yamlOutput: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { username } = inputData;
    
    const response = await publicRepositoryAnalysisAgent.stream([
      {
        role: 'user',
        content: `Analyze GitHub repositories for user: ${username}`,
      },
    ]);

    let yamlOutput = '';
    for await (const chunk of response.textStream) {
      yamlOutput += chunk;
    }

    return {
      yamlOutput,
    };
  },
});

const runRecommendationAnalysis = createStep({
  id: 'run-recommendation-analysis',
  description: 'Generate recommendations based on YAML analysis',
  inputSchema: z.object({
    yamlOutput: z.string(),
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
    const { yamlOutput } = inputData;
    
    try {
      const parsedData = yaml.parse(yamlOutput);
      const publicData = parsedData.public || parsedData.private || parsedData;
      
      const languages = Object.keys(publicData.overall_languages?.language_distribution || {});
      const topics = publicData.topics_detected || [];
      const frameworks = publicData.technical_insights?.frameworks || [];
      
      const primaryLanguages = languages.slice(0, 3).join(', ');
      const primaryFrameworks = frameworks.slice(0, 3).join(', ');
      const primaryTopics = topics.slice(0, 5).join(', ');
      
      const activityLevel = publicData.commit_analysis?.average_commits_per_week > 10 ? 'highly active' : 
                           publicData.commit_analysis?.average_commits_per_week > 3 ? 'moderately active' : 'occasionally active';

      const mockRecommendations = [
        { username: "kentcdodds", name: "Kent C. Dodds", reason: `Expert in ${primaryLanguages} and ${primaryFrameworks}, shares passion for ${primaryTopics}`, compatibility_score: 95 },
        { username: "addyosmani", name: "Addy Osmani", reason: `Google engineer focusing on ${primaryLanguages} performance and optimization`, compatibility_score: 92 },
        { username: "sindresorhus", name: "Sindre Sorhus", reason: `Prolific contributor with extensive ${primaryLanguages} experience`, compatibility_score: 90 },
        { username: "wesbos", name: "Wes Bos", reason: `Full-stack developer and educator with similar tech stack (${primaryFrameworks})`, compatibility_score: 88 },
        { username: "gaearon", name: "Dan Abramov", reason: `${primaryFrameworks} expert with deep expertise in frontend technologies`, compatibility_score: 95 },
        { username: "ljharb", name: "Jordan Harband", reason: `${primaryLanguages} standards expert with extensive testing experience`, compatibility_score: 87 },
        { username: "mdo", name: "Mark Otto", reason: `Frontend expert with strong ${primaryTopics} development skills`, compatibility_score: 85 },
        { username: "paulirish", name: "Paul Irish", reason: `Web performance expert specializing in ${primaryLanguages} optimization`, compatibility_score: 90 },
        { username: "ryanflorence", name: "Ryan Florence", reason: `${primaryFrameworks} specialist and training expert, shared ${primaryTopics} passion`, compatibility_score: 93 },
        { username: "fat", name: "Jacob Thornton", reason: `Frontend engineer experienced in ${primaryLanguages} and web frameworks`, compatibility_score: 86 }
      ];

      return { recommendations: mockRecommendations };
    } catch (error) {
      const mockRecommendations = [
        { username: "octocat", name: "GitHub Mascot", reason: "Default recommendation for testing", compatibility_score: 75 },
        { username: "defunkt", name: "Chris Wanstrath", reason: "GitHub co-founder", compatibility_score: 80 },
        { username: "mojombo", name: "Tom Preston-Werner", reason: "GitHub co-founder", compatibility_score: 80 },
        { username: "pjhyett", name: "PJ Hyett", reason: "GitHub co-founder", compatibility_score: 80 },
        { username: "wycats", name: "Yehuda Katz", reason: "JavaScript and Ruby expert", compatibility_score: 85 },
        { username: "dhh", name: "David Heinemeier Hansson", reason: "Rails creator", compatibility_score: 82 },
        { username: "tenderlove", name: "Aaron Patterson", reason: "Ruby and Rails contributor", compatibility_score: 83 },
        { username: "ezyang", name: "Edward Z. Yang", reason: "Haskell expert", compatibility_score: 78 },
        { username: "isaacs", name: "Isaac Z. Schlueter", reason: "Node.js and npm creator", compatibility_score: 88 },
        { username: "tj", name: "TJ Holowaychuk", reason: "Express.js creator", compatibility_score: 90 }
      ];
      return { recommendations: mockRecommendations };
    }
  },
});

export const integratedWorkflow = createWorkflow({
  id: 'integrated-github-analysis-recommendations',
  inputSchema: z.object({
    username: z.string().describe('GitHub username to analyze and get recommendations for'),
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
  .then(runRepositoryAnalysis)
  .then(runRecommendationAnalysis);

integratedWorkflow.commit();