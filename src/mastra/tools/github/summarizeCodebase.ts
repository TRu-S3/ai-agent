import { createTool } from "@mastra/core/tools";
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import fs from "fs/promises";
import { z } from "zod";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);


const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
});

export const summarizeCodebaseOutputSchema = z.object({
  success: z.boolean().describe("分析が成功したかどうか"),
  summaries: z.record(
    z.string().describe("各リポジトリのパス"),
    z.string().describe("そのリポジトリに対する要約")
  )
});

export const summarizeCodebaseTool = createTool({
  id: "code-summarizer",
  description: "与えられたリポジトリを解析し、どのようなことが記述されているかを包括的にまとめてください。",
  inputSchema: z.object({
    localRepoPaths: z.array(z.string()).describe("分析するリポジトリのローカルパス配列"),
  }),
  outputSchema: summarizeCodebaseOutputSchema,
  execute: async ({ context }) => {
    const { localRepoPaths } = context;

    const summaries: Record<string, string> = {};

    for (const repoRoot of localRepoPaths) {
      try {
        // README.mdが豊富であればファイルの中身を分析
        const readmePath = path.join(repoRoot, "README.md");
        const readmeContent = await fs.readFile(readmePath, "utf-8").catch(() => "なし");

        const score = scoreReadmeQuality(readmeContent);
        if (score >= 7) {
          const readme_summary = await readmeChecker(repoRoot, readmeContent);
          if (readme_summary.length > 100 || !readme_summary.includes("自動生成")) {
            summaries[repoRoot] = readme_summary;  // README.mdによって生成されたsummaryであるかを示すフラグをつけてもいいかもしれない
            continue;
          }
        }

        // README.mdが豊富でない場合は、ファイルの中身から情報を収集する
        const importantFiles = await selectImportantFiles(repoRoot);  // AIで重要なファイルだけ20個まで抽出
        const fileSummaries = await summarizeFiles(importantFiles, repoRoot);  // 各ファイルの中身を読み込んでまとめる処理
        const combinedSummary = await combineSummaries(fileSummaries);  // 各ファイルの情報をまとめる

        summaries[repoRoot] = combinedSummary;
      } catch (err) {
        summaries[repoRoot] = `リポジトリの分析に失敗しました: ${(err as Error).message}`;
      }
    }

    return {
      success: true,
      summaries,
    };
  }
});


const excludeDirs = [
  "node_modules", "dist", "build", "coverage", "out",
  ".next", ".turbo", ".cache", ".eslintcache", ".parcel-cache",
  "__pycache__", ".pytest_cache", ".mypy_cache",
  "target", ".gradle",
  "public", ".docusaurus", ".svelte-kit", ".vuepress", ".vitepress",
  ".git", ".hg", ".svn", ".idea", ".vscode",
  ".nyc_output", ".coverage", "reports", "test-results"
];

async function getFileStructure(repoRoot:string) {
  let fileStructure = "";
  try {
    const { stdout } = await execAsync(`tree -I '${excludeDirs}'`, { 
      cwd: repoRoot,
    });
    fileStructure = stdout.trim();
  } catch (err) {
    fileStructure = "ファイル構造の取得に失敗しました。";
  }
  return fileStructure
}

async function selectImportantFiles(repoRoot: string): Promise<string[]> {
  const fileTreeText = await getFileStructure(repoRoot);
  const model = google("gemini-2.0-flash-001");
  const prompt = `
The following is the file structure of a repository.

From this list, select **up to 20 files** that are most likely to have been implemented by the developer and are considered important in terms of functionality or architecture.

"Important" refers to files that:
- Contain developer-related information
- Are core parts of the application logic
- Include custom business logic
- Handle routing
- Implement key UI components

Please **exclude** dependency files, configuration files, templates, static assets (like images or icons), and files that are likely auto-generated.

Do not include README.md.

Return your answer in the following JSON format:
{
  "files": [
    "relative/path1",
    "relative/path2",
    ...
  ]
}

File structure:
${fileTreeText}
`;

/*
以下はあるリポジトリのファイル構成です。
この中から、開発者が実装した可能性が高く、かつ機能的・構造的に重要度が高そうなファイルを最大20個まで列挙してください。
重要度が高いとは、「開発者自身に関する情報」「アプリケーションの動作に影響する中核部分」「独自のビジネスロジック」「ルーティング」「UIの主要部分」などを意味します。
また、依存ファイルや設定ファイル、テンプレートファイル、画像などの静的アセットは除外してください。

出力形式：ファイルパスのみを改行区切りで列挙してください

ファイル構成：
${fileTreeText}
*/
  console.log("🤖 selectImportantFiles: prompt =>", prompt.substring(0, 1000) + " ..."); ////////////////////////////////////////
  const result = await generateText({ model, prompt });
  console.log("🤖 selectImportantFiles: AI response =>", result.text.substring(0, 1000) + " ...");///////////////////////////////////////////////
  const cleaned_result = result.text.replace(/```(?:json)?\s*|\s*```/g, "").trim();
  const parsed = JSON.parse(cleaned_result);
  return parsed.files;
}


async function summarizeFiles(files: string[], repoRoot: string): Promise<Record<string, string>> {
  const summaries: Record<string, string> = {};
  const model = google("gemini-2.0-flash-001");

  for (const file of files) {
    const fullPath = path.join(repoRoot, file);

    // ファイルの存在をチェック
    if (!(await fs.access(fullPath).then(() => true).catch(() => false))) continue;

    const content = await fs.readFile(fullPath, "utf-8");

    // 長い場合は分割（例：4000トークンくらいでカット）
    const chunks = content.match(/[\s\S]{1,4000}/g) || [];

    let combinedSummary = "";

    for (const chunk of chunks) {
      const result = await generateText({
        model,
        prompt: `
The following is a portion of code or content.
If it appears to be a profile or reference material, provide a detailed summary in English focusing on user-related information.
If it appears to be source code or an implementation, provide a concise English summary of its purpose, content, and functionality, without mentioning specific variable or function names.
${chunk}
`
/* 
以下はコードの一部です。
もし内容がプロフィールやその他の資料である場合は、ユーザーに関する情報に関する内容を英語で詳細にまとめてください。
もし内容が何かしらの実装である場合は目的、内容、機能を英語で簡潔に要約してください。 この時具体的な変数/関数名についての言及はしないでください。
*/
});
    console.log(`🤖 summarizeFiles: file=${file} chunk=${chunks.length} AI response =>`, result.text.substring(0, 1000) + " ...");///////////////////////////////////////

      combinedSummary += result.text + "\n";
    }
    summaries[file] = combinedSummary.trim();
  }
  return summaries;
}

async function combineSummaries(summaries: Record<string, string>): Promise<string> {
  const combinedText = Object.entries(summaries)
    .map(([file, summary]) => `■ ${file}\n${summary}`)
    .join("\n\n");

  const result = await generateText({
    model: google("gemini-2.0-flash-001"),
    prompt: `
The following are summaries of multiple source files.
Based on this information, please describe in clear and concise English **what kind of application this is**, including its **overall structure, technologies used, and main functionalities**.
${combinedText}
`});
/*
以下は複数ファイルの要約です。全体としてどんなアプリケーションで、どのような構造・技術で成り立っているかを日本語でわかりやすくまとめてください。
${combinedText}
*/

  console.log("🤖 combineSummaries: AI response =>", result.text.substring(0, 1000) + " ...");///////////////////////////////////////////
  return result.text;
}


export function scoreReadmeQuality(readmeContent: string): number {
  let score = 0;

  // 正規化して扱いやすくする
  const content = readmeContent.trim();
  const lines = content.split("\n").map(line => line.trim());
  const wordCount = content.split(/\s+/).length;
  const contentLower = content.toLowerCase();

  // --- 加点ロジック ---

  // H1 タイトル
  if (lines[0]?.startsWith("#")) score += 1;

  // セクション見出し（##）が2個以上
  const sectionCount = lines.filter(line => /^##\s+/.test(line)).length;
  if (sectionCount >= 2) score += 2;

  // コードブロック（```）がある
  if ((content.match(/```/g) || []).length >= 2) score += 2;

  // "install", "usage", "features" などのキーワードを含む
  const keywords = ["install", "installation", "usage", "feature", "how to", "example"];
  if (keywords.some(k => contentLower.includes(k))) score += 1;

  // バッジやリンク（Markdown形式の ![...](...) や [...](...)）
  if (/\[\!\[.+?\]\(.+?\)\]/.test(content)) score += 1;
  if ((content.match(/\[[^\]]+\]\([^)]+\)/g) || []).length >= 3) score += 1;

  // --- 減点ロジック ---

  // 文字数・行数が極端に少ない
  if (wordCount < 100) score -= 2;
  if (lines.length < 5) score -= 1;

  // セクション数が0なら減点
  if (sectionCount === 0) score -= 1;

  // スコアを0〜10にクリップ
  return Math.max(0, Math.min(score, 10));
}

export async　function readmeChecker(repoPath: string, readmeContent: string): Promise<string> { 
  const model = google("gemini-2.0-flash-001");
  const fileStructure = await getFileStructure(repoPath)
  const readmeCheckerInstructionPrompt = `
以下のREADME.mdの内容を確認してください。
これは人間の開発者が手作業で書いたものですか？それとも自動生成されたものですか？
手作業であれば、README.mdの内容を要約し、目的、使用技術、機能、使い方、構成を日本語で簡潔に説明してください。
そうでなければ "自動生成" とだけ答えてください。

なお、自動生成の判定には以下のファイル構造とREADME.mdの内容がマッチしていそうかも判断材料にしてください。
${fileStructure}

---
${readmeContent}
---
`;
  console.log("🤖 readmeChecker: prompt =>", readmeCheckerInstructionPrompt.substring(0, 1000) + " ...");////////////////////////////////

  const summary = await generateText({
    model: model,
    prompt: readmeCheckerInstructionPrompt,
  });
  console.log("🤖 readmeChecker: AI response =>", summary.text.substring(0, 1000) + " ...");///////////////////////////////////////
  return summary.text
} 
