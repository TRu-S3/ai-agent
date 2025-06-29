import { createStep } from "@mastra/core";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const tokeiAnalyzerOutputSchema = z.object({
  mostCommonLanguage: z.string().describe("最もコード行数の多い言語"),
  languageDistribution: z.record(z.string(), z.string()).describe("言語ごとのコード行の割合（%表記）"),
});

/**
 * tokei分析ツール
 * リポジトリの言語統計情報を収集し、コード複雑度や保守性も分析します
 */
export const step4 = createStep({
    id: "tokei-analyzer",
    description: "tokeiを使ってリポジトリの言語統計とコード複雑度を分析します",
    inputSchema: z.object({
        gitHubAccountName: z.string(), 
        hasGitHubPrivateToken: z.boolean(),
        localRepoPaths: z.array(z.string()).describe("ローカルにクローン済みしたリポジトリのパスの配列"),
    }),
    outputSchema: tokeiAnalyzerOutputSchema,
    execute: async ({ inputData }) => {
        const { localRepoPaths } = inputData;

        // tokeiがインストールされているか確認
        try {
            await execAsync("which tokei");
        } catch (error) {
            console.error('tokeiがインストールされていません。"brew install tokei" または "cargo install tokei" でインストールしてください。');
            return {
                mostCommonLanguage: "",
                languageDistribution: {},
            };
        }

        const allRepoAnalysisResults: Array<{ languageSummary: Record<string, { code: number }> }> = [];
        
        for (const repoPath of localRepoPaths) {
            const result = await analysisRepo(repoPath); 
            
            if (result) {
                console.log(`--- 成功: ${repoPath} の分析が完了しました ---`);
                allRepoAnalysisResults.push(result);
            } else {
                console.error(`--- 失敗: ${repoPath} の分析中にエラーが発生しました ---`);
            }
        }

        // 言語ごとのコード行数を集計
        const totalCodeByLanguage: Record<string, number> = {};

        allRepoAnalysisResults.forEach(({ languageSummary }) => {
            Object.entries(languageSummary).forEach(([lang, stats]) => {
            totalCodeByLanguage[lang] = (totalCodeByLanguage[lang] || 0) + stats.code;
            });
        });

        // mostCommonLanguage の決定
        let mostCommonLanguage = "";
        let maxCode = 0;
        for (const [lang, code] of Object.entries(totalCodeByLanguage)) {
            if (code > maxCode) {
            maxCode = code;
            mostCommonLanguage = lang;
            }
        }

        // 全言語のコード合計
        const totalCodeAllLang = Object.values(totalCodeByLanguage).reduce(
            (acc, code) => acc + code,
            0
        );

        // languageDistribution の計算（%文字列で保持）
        const languageDistribution: Record<string, string> = {};
        for (const [lang, code] of Object.entries(totalCodeByLanguage)) {
            const percentage = ((code / totalCodeAllLang) * 100).toFixed(2);
            languageDistribution[lang] = `${percentage}%`;
        }

        // 結果返却
        return {
            mostCommonLanguage,
            languageDistribution,
        };
    },
});

const EXCLUDE_PATTERNS = [
  "**/.gitignore",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.vscode/**",
  "**/*.svg",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.ico",
  "**/*.lock",
  "**/*.log",
  "**/.DS_Store",
  "**/coverage/**",
  "**/target/**",
  "**/out/**",
  "**/*.exe",
  "**/*.dll",
];

async function analysisRepo(repositoryPath: string): Promise<any | undefined> {
    try {
        
        console.log(`🚀 コマンド実行中: cd "${repositoryPath}" && tokei --output json`);

        // tokeiコマンドを構築
        let command = `cd "${repositoryPath}" && tokei --output json`;

        EXCLUDE_PATTERNS.forEach(pattern => {
            command += ` --exclude "${pattern}"`;
        });

        // tokeiコマンド実行
        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
            console.error(`tokei stderr for ${repositoryPath}: ${stderr}`);
            return undefined;
        }

        // 結果をパース
        let statistics;
        try {
            statistics = JSON.parse(stdout);
        } catch (error: any) {
            console.error(`Failed to parse tokei output for ${repositoryPath}: ${error.message}`);
            return undefined;
        }

        // 言語ごとのサマリーを作成
        const languageSummary: Record<
            string,
            {
                files: number;
                lines: number;
                code: number;
                comments: number;
                blanks: number;
                complexity?: number;
            }
        > = {};

        let totalFiles = 0;
        let totalLines = 0;
        let totalCode = 0;
        let totalComments = 0;
        let totalBlanks = 0;

        Object.entries(statistics).forEach(
            ([lang, data]: [string, any]) => {
                if (lang !== "Total") {
                    const { blanks, code, comments, files, lines } =
                        data;

                    languageSummary[lang] = {
                        files,
                        lines,
                        code,
                        comments,
                        blanks,
                        // 複雑度の計算（仮の計算方法、実際にはもっと複雑）
                        complexity:
                            Math.round((comments / (code || 1)) * 100) /
                            100,
                    };

                    totalFiles += files;
                    totalLines += lines;
                    totalCode += code;
                    totalComments += comments;
                    totalBlanks += blanks;
                }
            }
        );
    

        const totalSummary = {
            files: totalFiles,
            lines: totalLines,
            code: totalCode,
            comments: totalComments,
            blanks: totalBlanks,
            commentRatio:
                Math.round((totalComments / (totalCode || 1)) * 100) / 100,
        };

        return {
            statistics: statistics,
            languageSummary: languageSummary,
            totalSummary: totalSummary,
        };
    } catch (error: any) {
        console.error(`tokei execution failed for ${repositoryPath}: ${error.message}`);
        // 予期せぬエラーの場合、undefined を返す
        return undefined;
    }
}
