import { createStep } from '@mastra/core';
import { commitAnalyzerOutputSchema } from './step3';
import { tokeiAnalyzerOutputSchema } from './step4';
import { z } from 'zod';
import fs from "fs";
import yaml from 'js-yaml';

export const step6 = createStep({
  id: "generate-report-yaml",
  description: "分析された全データを元に、統合YAMLレポートを生成します。",
  inputSchema: z.object({
    gitHubAccountName: z.string(),
    hasGitHubPrivateToken: z.boolean(),
    localRepoPaths: z.array(z.string()),
    tokeiData: tokeiAnalyzerOutputSchema,
    commitAnalysis: commitAnalyzerOutputSchema,
    repoSummaries: z.string(),
    insightsSummaries: z.string(),
    publicReposNum: z.number()
  }),
  outputSchema: z.object({
    yaml: z.string().describe("統合されたYAMLレポートの文字列")
  }),
  execute: async ({ inputData }) => {
    const commitAnalyzer = inputData['commit-analyzer'];
    const tokeiAnalyzer = inputData['tokei-analyzer'];
    const codeSummarizer = inputData['code-summarizer'];

    const insightsSummariesJSON = JSON.parse(
        codeSummarizer.insightsSummaries.replace(/```(?:json)?\s*|\s*```/g, "").trim()
    );

    const yamlData = {
      [codeSummarizer.hasGitHubPrivateToken ? 'private' : 'public']: {
        github_username: codeSummarizer.gitHubAccountName,
        analysis_date: new Date().toISOString().slice(0, 10),
        total_repositories: codeSummarizer.publicReposNum,

        overall_languages: {
          most_common_language: tokeiAnalyzer.mostCommonLanguage,
          language_distribution: tokeiAnalyzer.languageDistribution
        },

        technical_insightsSummariesJSON: {
          frameworks: insightsSummariesJSON.technicalInsights?.frameworks || [],
          package_managers: insightsSummariesJSON.technicalInsights?.packageManagers || [],
          build_tools: insightsSummariesJSON.technicalInsights?.buildTools || [],
          testing_tools: insightsSummariesJSON.technicalInsights?.testingTools || [],
          has_tests: insightsSummariesJSON.technicalInsights?.hasTests?.[0] ?? false,
          ci_cd: insightsSummariesJSON.technicalInsights?.ciCd || [],
          containerization: insightsSummariesJSON.technicalInsights?.containerization || [],
          favorite_architecture: insightsSummariesJSON.technicalInsights?.favorite_architecture || [],
          infra_as_code: insightsSummariesJSON.technicalInsights?.infraAsCode || [],
          security: insightsSummariesJSON.technicalInsights?.security || [],
          documentation_quality: insightsSummariesJSON.technicalInsights?.documentation_quality || [],
        },

        commit_analysis: {
          total_commits: commitAnalyzer.totalCommits,
          active_weeks: commitAnalyzer.activeWeeks,
          average_commits_per_week: commitAnalyzer.averageCommitsPerWeek,
          commits_by_weekday: {
            Sunday: commitAnalyzer.commitsByWeekday[0],
            Monday: commitAnalyzer.commitsByWeekday[1],
            Tuesday: commitAnalyzer.commitsByWeekday[2],
            Wednesday: commitAnalyzer.commitsByWeekday[3],
            Thursday: commitAnalyzer.commitsByWeekday[4],
            Friday: commitAnalyzer.commitsByWeekday[5],
            Saturday: commitAnalyzer.commitsByWeekday[6],
          },
          peak_commit_day: commitAnalyzer.peakDay
        },

        topics_detected: insightsSummariesJSON.topicsDetected,

        personal_identifiers_found: {
          usernames: insightsSummariesJSON.personalIdentifiersFound?.usernames || [],
          emails: insightsSummariesJSON.personalIdentifiersFound?.emails || [],
          names: insightsSummariesJSON.personalIdentifiersFound?.names || [],
          urls: insightsSummariesJSON.personalIdentifiersFound?.urls || [],
          jobs: insightsSummariesJSON.personalIdentifiersFound?.jobs || [],
          other: insightsSummariesJSON.personalIdentifiersFound?.other || [],
        },

        repository_summaries: codeSummarizer.repoSummaries
      }
    };


    
    // リポジトリの削除
    for (const repoPath of codeSummarizer.localRepoPaths) {
      if (fs.existsSync(repoPath)) {
        try {
          fs.rmSync(repoPath, { recursive: true, force: true });
        } catch (err) {
          console.warn(`削除失敗: ${repoPath}`, err);
        }
      }
    }

    return {
      yaml: yaml.dump(yamlData, { lineWidth: 120 })
    };
  }
});