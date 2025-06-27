import { createStep } from "@mastra/core";
import { z } from "zod";
import { execSync } from "child_process";

export const commitAnalyzerOutputSchema = z.object({
  totalCommits: z.number().describe("対象リポジトリ群の総コミット数"),
  activeWeeks: z.number().describe("1回以上コミットがあった週の数"),
  averageCommitsPerWeek: z.number().describe("総コミット数 ÷ 活動週数（活動週数0の場合は全週数で割る）"),
  commitsByWeekday: z
    .array(z.number())
    .length(7)
    .describe("日曜〜土曜の曜日別コミット合計"),
  peakDay: z.string().describe("コミットが最も多い曜日（文字列）"),
  failedRepos: z.array(z.string()).describe("統計情報取得に失敗したリポジトリURLのリスト"),
});

export const step3 = createStep({
  id: "commit-analyzer",
  description: "ローカルclone済みのGitリポジトリからgit logを使ってコミット統計を集計・解析します",
  inputSchema: z.object({
    gitHubAccountName: z.string(), 
    localRepoPaths: z.array(z.string()).describe("clone済みリポジトリのローカルパス配列"),
  }),
  outputSchema: commitAnalyzerOutputSchema,
  execute: async ({ inputData }) => {
    const { localRepoPaths } = inputData;

    const commitsByWeekday = new Array(7).fill(0);
    let totalCommits = 0;
    const activeWeeksSet = new Set<string>();
    let failedRepos: string[] = [];

    for (const repoPath of localRepoPaths) {
      try {
        // git logで日付取得（ISO 8601形式）、曜日（0=日曜）、週番号を抽出
        // --no-merges でマージコミット除外も可能
        const gitLogOutput = execSync(
          `git -C "${repoPath}" log --no-merges --date=iso --pretty=format:%cd`,
          { encoding: "utf-8" }
        );

        const lines = gitLogOutput.trim().split("\n");
        totalCommits += lines.length;

        for (const dateStr of lines) {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) continue;

          // 曜日 (0=日曜〜6=土曜)
          const day = date.getDay();
          commitsByWeekday[day]++;

          // ISO週番号取得
          const week = getISOWeek(date);
          const year = date.getUTCFullYear();
          activeWeeksSet.add(`${year}-W${week}`);
        }
      } catch (e) {
        failedRepos.push(repoPath);
      }
    }

    const activeWeeks = activeWeeksSet.size;
    const divisor = activeWeeks > 0 ? activeWeeks : 1;
    const averageCommitsPerWeek = totalCommits / divisor;

    const weekDaysNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let peakDayIndex = 0;
    let peakCommits = 0;
    commitsByWeekday.forEach((count, idx) => {
      if (count > peakCommits) {
        peakCommits = count;
        peakDayIndex = idx;
      }
    });
    const peakDay = weekDaysNames[peakDayIndex];

    return {
      totalCommits,
      activeWeeks,
      averageCommitsPerWeek,
      commitsByWeekday,
      peakDay,
      failedRepos,
    };
  },
});

// ISO週番号取得のヘルパー関数
function getISOWeek(date: Date): number {
  const tmpDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = tmpDate.getUTCDay() || 7;
  tmpDate.setUTCDate(tmpDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmpDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmpDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return weekNo;
}
