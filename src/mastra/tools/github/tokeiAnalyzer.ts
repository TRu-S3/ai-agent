import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const tokeiAnalyzerOutputSchema = z
  .object({
    success: z.boolean().describe("tokeiによる分析が成功したかどうか"),
    message: z.string().describe("分析処理の詳細メッセージ"),
    statistics: z.any().optional().describe("tokeiコマンドの生データ出力（JSONなど）"),
    languageSummary: z
      .record(
        z.string(),
        z.object({
          files: z.number().describe("該当言語のファイル数"),
          lines: z.number().describe("該当言語の総行数"),
          code: z.number().describe("該当言語のコード行数"),
          comments: z.number().describe("該当言語のコメント行数"),
          blanks: z.number().describe("該当言語の空白行数"),
          complexity: z.number().optional().describe("該当言語のコード複雑度指標（任意）"),
        })
      )
      .optional()
      .describe("言語別統計情報"),
    totalSummary: z
      .object({
        files: z.number().describe("総ファイル数"),
        lines: z.number().describe("総行数"),
        code: z.number().describe("総コード行数"),
        comments: z.number().describe("総コメント行数"),
        blanks: z.number().describe("総空白行数"),
        commentRatio: z.number().describe("コード行に対するコメント行の割合"),
      })
      .optional()
      .describe("総合統計情報"),
  })
  .describe("tokei分析ツールの出力形式");


/**
 * tokei分析ツール
 * リポジトリの言語統計情報を収集し、コード複雑度や保守性も分析します
 */
export const tokeiAnalyzerTool = createTool({
    id: "tokei-analyzer",
    description: "tokeiを使ってリポジトリの言語統計とコード複雑度を分析します",
    inputSchema: z.object({
        repositoryPath: z.string().describe("リポジトリのパス"),
        format: z
            .enum(["json", "toml", "cbor", "yaml"])
            .optional()
            .default("json")
            .describe("出力フォーマット"),
        sortBy: z
            .enum(["files", "lines", "code", "comments", "blanks"])
            .optional()
            .default("code")
            .describe("ソート方法"),
        excludePatterns: z
            .array(z.string())
            .optional()
            .default(["**/.gitignore","**/package-lock.json","**/node_modules/**"])
            .describe("自動生成されたと思われるファイルや画像ファイルなど、ユーザーが実装していないであろうファイル・ディレクトリのパターンの配列"),
    }),
    outputSchema: tokeiAnalyzerOutputSchema,
    execute: async ({ context }) => {
        const { repositoryPath, format, sortBy, excludePatterns } = context;

        try {
            // tokeiがインストールされているか確認
            try {
                await execAsync("which tokei");
            } catch (error) {
                return {
                    success: false,
                    message:
                        'tokeiがインストールされていません。"brew install tokei" または "cargo install tokei" でインストールしてください。',
                };
            }

            console.log(`🚀 コマンド実行中: cd "${repositoryPath}" && tokei --output ${format}`);

            // tokeiコマンドを構築
            let command = `cd "${repositoryPath}" && tokei --output ${format}`;

            if (sortBy) {
                command += ` --sort ${sortBy}`;
            }

            const allExcludePatterns = [
            ...DEFAULT_EXCLUDE_PATTERNS,
            ...(excludePatterns ?? []),
            ];

            allExcludePatterns.forEach(pattern => {
            command += ` --exclude "${pattern}"`;
            });

            // tokeiコマンド実行
            const { stdout, stderr } = await execAsync(command);

            if (stderr) {
                return {
                    success: false,
                    message: `tokeiの実行中にエラーが発生しました: ${stderr}`,
                };
            }

            // 結果をパース
            let statistics;
            try {
                statistics = format === "json" ? JSON.parse(stdout) : stdout;
            } catch (error: any) {
                return {
                    success: false,
                    message: `tokeiの出力をパースできませんでした: ${error.message}`,
                };
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

            if (format === "json") {
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
            }

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
                success: true,
                message: "tokeiによる言語統計分析が完了しました。",
                statistics,
                languageSummary,
                totalSummary,
            };
        } catch (error: any) {
            return {
                success: false,
                message: `tokeiの実行に失敗しました: ${error.message}`,
            };
        }
    },
});

const DEFAULT_EXCLUDE_PATTERNS = [
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