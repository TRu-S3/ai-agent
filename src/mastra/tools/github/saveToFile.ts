import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

/**
 * 保存結果のスキーマ
 */
export const saveFileOutputSchema = z
  .object({
    success: z.boolean().describe("ファイルの保存に成功したかどうか"),
    message: z.string().describe("保存処理の詳細メッセージ"),
    savedFilePath: z
      .string()
      .describe("保存されたファイルの絶対パス"),
  })
  .describe("ファイル保存結果");

/**
 * 分析結果(YAML)をファイルに保存するツール
 */
export const saveToFileTool = createTool({
  id: "save-to-file",
  description: "リポジトリの分析結果をYAMLファイルに保存します",
  inputSchema: z.object({
    gitHubAccountName: z
        .string()
        .describe("GitHubアカウント名"),
    content: z
      .string()
      .describe("保存するYAML文字列"),
  }),
  outputSchema: saveFileOutputSchema,
  execute: async ({ context }) => {
    const { gitHubAccountName, content } = context;

    try {
      const cleaned = cleanObject(content);
      const yamlString = yaml.dump(cleaned || {}, {
        lineWidth: -1,
        styles: { '!!str': 'plain' },
      });

      const outputDir = path.resolve(process.cwd(), "results");
      const filePath = path.resolve(outputDir, `${gitHubAccountName}_result.yaml`);

      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(filePath, yamlString, "utf-8");

      return {
        success: true,
        message: `ファイルを保存しました: ${filePath}`,
        savedFilePath: filePath,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `ファイル保存に失敗しました: ${error.message}`,
        savedFilePath: "",
      };
    }
  },
});


// 再帰的にnull, false, 0, [], {} を除外する関数
function cleanObject(obj: any): any {
  if (Array.isArray(obj)) {
    const filtered = obj
      .map(cleanObject)
      .filter((item) => item !== undefined && item !== null);
    return filtered.length > 0 ? filtered : undefined;
  }

  if (typeof obj === "object" && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleaned = cleanObject(value);
      if (
        cleaned !== undefined &&
        cleaned !== null &&
        cleaned !== false &&
        cleaned !== 0 &&
        (typeof cleaned !== "object" || Object.keys(cleaned).length > 0)
      ) {
        result[key] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  // 単純な値
  if (valueIsEmpty(obj)) {
    return undefined;
  }

  return obj;
}

function valueIsEmpty(value: any): boolean {
  return (
    value === null ||
    value === false ||
    value === 0 ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && Object.keys(value || {}).length === 0)
  );
}