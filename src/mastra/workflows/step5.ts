import { createStep } from "@mastra/core";
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
    gitHubAccountName: z.string(),
    localRepoPaths: z.array(z.string()),
    repoSummaries: z.string().describe("全リポジトリの要約"),
    insightsSummaries: z.string().describe("全リポジトリの特徴のまとめ")
});

export const step5 = createStep({
    id: "code-summarizer",
    description: "与えられたリポジトリを解析し、どのようなことが記述されているかを包括的にまとめます。",
    inputSchema: z.object({
        gitHubAccountName: z.string(),
        localRepoPaths: z.array(z.string()).describe("分析するリポジトリのローカルパス配列"),
    }),
    outputSchema: summarizeCodebaseOutputSchema,
    execute: async ({ inputData }) => {
        const { localRepoPaths } = inputData;

        const combinedFileSummaries: Record<string, string> = {};
        const extractInsights: Record<string, string> = {};
        const selectFileNum = 20;

        for (const repoRoot of localRepoPaths) {
            try {
                // README.mdが豊富であればファイルの中身を分析
                const readmePath = path.join(repoRoot, "README.md");
                const readmeContent = await fs.readFile(readmePath, "utf-8").catch(() => "なし");

                const score = scoreReadmeQuality(readmeContent);
                if (score >= 7) {
                const readme_summary = await readmeChecker(repoRoot, readmeContent);
                if (readme_summary.length > 100 || !readme_summary.includes("自動生成")) {
                    combinedFileSummaries[repoRoot] = readme_summary;  // README.mdによって生成されたsummaryであるかを示すフラグをつけてもいいかもしれない
                    continue;
                }
                }

                // README.mdが豊富でない場合は、ファイルの中身から情報を収集する
                const importantFiles = await selectImportantFiles(repoRoot, selectFileNum);  // AIで重要なファイルだけ20個まで抽出
                const fileSummaries = await summarizeFiles(importantFiles, repoRoot);  // 各ファイルの中身を読み込んでまとめる処理
                const { combinedFileSummary, extractInsight} = await combineFileSummaries(fileSummaries);  // 各ファイルの情報をまとめる

                combinedFileSummaries[repoRoot] = combinedFileSummary;
                extractInsights[repoRoot] = extractInsight


            } catch (err) {
                combinedFileSummaries[repoRoot] = `リポジトリの分析に失敗しました: ${(err as Error).message}`;
                extractInsights[repoRoot] = `リポジトリの分析に失敗しました: ${(err as Error).message}`;
            }
        }

        const repoSummaries = await combineRepoSummaries(combinedFileSummaries)
        const insightsSummaries = await combineInsightSummaries(extractInsights)

        return {
            gitHubAccountName: inputData.gitHubAccountName,
            localRepoPaths: localRepoPaths,
            repoSummaries: repoSummaries,
            insightsSummaries: insightsSummaries
        }
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

async function selectImportantFiles(repoRoot: string, selectFileNum: number): Promise<string[]> {
  const fileTreeText = await getFileStructure(repoRoot);
  const model = google("gemini-2.0-flash-001");
  const prompt = `
The following is the file structure of a repository.

From this list, select **up to ${selectFileNum} files** that are most likely to have been implemented by the developer and are considered important in terms of functionality or architecture.

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

async function combineFileSummaries(summaries: Record<string, string>): Promise<{
  combinedFileSummary: string;
  extractInsight: string;
}> {
    const combinedText = Object.entries(summaries)
        .map(([file, summary]) => `■ ${file}\n${summary}`)
        .join("\n\n");

    const combinedSummaryText = await generateText({
        model: google("gemini-2.0-flash-001"),
        prompt: `
The following is a summary of multiple files. Please provide a clear and easy-to-understand overview in Japanese of what kind of application it is overall, and what structure and technologies it is built with.
Also, briefly summarize information about the user, their areas of expertise or features, and the technology stack they use.  
At this time, do not mention specific variable or function names.

${combinedText}
`});
/*
以下は複数ファイルのまとめです。全体としてどんなアプリケーションで、どのような構造・技術で成り立っているかを日本語でわかりやすくまとめてください。
ユーザーに関する情報、ユーザーの得意な分野や機能、技術スタック等を簡潔に要約してください。この時具体的な変数/関数名についての言及はしないでください。

${combinedText}
*/

    console.log("🤖 combineSummaries: AI response =>", combinedSummaryText.text.substring(0, 1000) + " ...");///////////////////////////////////////////

    const extractInsight = await generateText({
        model: google("gemini-2.0-flash-001"),
        prompt: `
The following is a summary of multiple files. 

Based on the following text, extract information from the following three categories and return the result in the specified JSON format.

[Required Output Format]
\`\`\`json
{
  "technicalInsights": {
    "frameworks": [Detected frameworks, e.g., React, Flask, Spring Boot],
    "packageManagers": [e.g., npm, pipenv, bundler],
    "buildTools": [e.g., webpack, gradle, make],
    "testingTools": [e.g., jest, pytest, mocha, RSpec],
    "hasTests": [true/false],
    "ciCd": [e.g., GitHub Actions, CircleCI — determined from '.github/workflows/' or 'circleci/' presence],
    "containerization": [e.g., Docker, Kubernetes],
    "favorite_architecture": [e.g., clean architecture, monolith, microservices — inferred from README or structure],
    "infraAsCode": [Mention if IaC tools like Terraform or Ansible are used],
    "security": [Assess security awareness based on presence of security policy files, absence of '.env' in Git, use of GitHub Secrets, etc.],
    "documentation_quality": [Assessment of documentation detail and quality]
  },
  "topicsDetected": [Key topics inferred from README or project structure, e.g., Web development, CLI tools, Machine learning],
  "personalIdentifiersFound": {
    "usernames": [Usernames or IDs found on GitHub],
    "emails": [e.g., xxx@example.com],
    "names": [Real names or usernames],
    "urls": [External links such as personal websites or social media],
    "jobs": [Job-related info],
    "other": [Other strings related to personal information]
  }
}
\`\`\`


<-------------------------------------------------------------->
${combinedText}
`});
    console.log("🤖 extractInsight: AI response =>", extractInsight.text.substring(0, 1000) + " ...");///////////////////////////////////////////


  return {
    combinedFileSummary: combinedSummaryText.text,
    extractInsight: extractInsight.text
  };
}

async function combineRepoSummaries(combinedFileSummaries: Record<string, string>): Promise<string> {
  
    const combinedText = Object.entries(combinedFileSummaries)
        .map(([file, summary]) => `■ ${file}\n${summary}`)
        .join("\n\n");

    const repoSummaries = await generateText({
    model: google("gemini-2.0-flash-001"),
    prompt: `
The following is a summary of multiple repository. Please provide a clear and easy-to-understand overview in Japanese of what kind of application it is overall, and what structure and technologies it is built with.
Also, briefly summarize information about the user, their areas of expertise or features, and the technology stack they use.  
At this time, do not mention specific variable or function names.

Please **combine** the information from all of them into a **single** summary, removing duplicates where appropriate and providing an aggregated overview.

<-------------------------------------------------------------->
${combinedText}
`});
    console.log("🤖 repoSummaries: AI response =>", repoSummaries.text.substring(0, 1000) + " ...");///////////////////////////////////////////

    return repoSummaries.text
}


async function combineInsightSummaries(extractInsights: Record<string, string>): Promise<string> {
  
    const combinedText = Object.entries(extractInsights)
        .map(([file, summary]) => `■ ${file}\n${summary}`)
        .join("\n\n");

    const insightsSummaries = await generateText({
    model: google("gemini-2.0-flash-001"),
    prompt: `
The following are multiple JSON-formatted summaries extracted from different repositories.
Each summary follows a structure with fields such as "technicalInsights", "topicsDetected", and "personalIdentifiersFound".

Please **combine** the information from all of them into a **single** summary, removing duplicates where appropriate and providing an aggregated overview.

Respond only in the following JSON format:
\`\`\`json
{
  "technicalInsights": {
    "frameworks": [Detected frameworks, e.g., React, Flask, Spring Boot],
    "packageManagers": [e.g., npm, pipenv, bundler],
    "buildTools": [e.g., webpack, gradle, make],
    "testingTools": [e.g., jest, pytest, mocha, RSpec],
    "hasTests": [true/false],
    "ciCd": [e.g., GitHub Actions, CircleCI — determined from '.github/workflows/' or 'circleci/' presence],
    "containerization": [e.g., Docker, Kubernetes],
    "favorite_architecture": [e.g., clean architecture, monolith, microservices — inferred from README or structure],
    "infraAsCode": [Mention if IaC tools like Terraform or Ansible are used],
    "security": [Assess security awareness based on presence of security policy files, absence of '.env' in Git, use of GitHub Secrets, etc.],
    "documentation_quality": [Assessment of documentation detail and quality]
  },
  "topicsDetected": [Key topics inferred from README or project structure, e.g., Web development, CLI tools, Machine learning],
  "personalIdentifiersFound": {
    "usernames": [Usernames or IDs found on GitHub],
    "emails": [e.g., xxx@example.com],
    "names": [Real names or usernames],
    "urls": [External links such as personal websites or social media],
    "jobs": [Job-related info],
    "other": [Other strings related to personal information]
  }
}
\`\`\`

<-------------------------------------------------------------->
${combinedText}
`});
    console.log("🤖 insightsSummaries: AI response =>", insightsSummaries.text.substring(0, 1000) + " ...");///////////////////////////////////////////

    return insightsSummaries.text
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

export async function readmeChecker(repoPath: string, readmeContent: string): Promise<string> { 
  const model = google("gemini-2.0-flash-001");
  const fileStructure = await getFileStructure(repoPath)
  const readmeCheckerInstructionPrompt = `
Please review the contents of the following README.md file. 
If you determine that it was written manually by a human developer, provide a concise summary in English based on the README.md content, including information about the developer, their areas of expertise or features, and the technology stack used. Do not mention any specific variable or function names.
If you determine that it was not written manually by a human developer, respond with "Auto-generated" only.

When making the judgment about whether it is auto-generated, please also consider whether the following file structure matches the README.md content.
${fileStructure}

---
${readmeContent}
---
`;
/*
  以下のREADME.mdの内容を確認し、人間の開発者が手作業で書いたもので書いたものだと判定した場合は
  README.mdの内容から、開発者に関する情報、開発者の得意な分野や機能、技術スタック等を英語で簡潔に要約してください。この時具体的な変数/関数名についての言及はしないでください。
  人間の開発者が手作業で書いたものでないと判定した場合は "自動生成" とだけ答えてください。

  なお、自動生成の判定には以下のファイル構造とREADME.mdの内容がマッチしていそうかも判断材料にしてください。
  ${fileStructure}
*/
  console.log("🤖 readmeChecker: prompt =>", readmeCheckerInstructionPrompt.substring(0, 1000) + " ...");////////////////////////////////

  const summary = await generateText({
    model: model,
    prompt: readmeCheckerInstructionPrompt,
  });
  console.log("🤖 readmeChecker: AI response =>", summary.text.substring(0, 1000) + " ...");///////////////////////////////////////
  return summary.text
} 
