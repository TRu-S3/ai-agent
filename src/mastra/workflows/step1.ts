import { createStep } from '@mastra/core';
import { z } from "zod";
import axios from "axios";
import { generateText } from 'ai';
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { config } from "dotenv";
config({ path: '../.env' });

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
});

export const step1 = createStep({
    id: 'gather-repository-info',
    description: '対象GitHubアカウントのフォーク以外のリポジトリURLを全て取得します。',
    inputSchema: z.object({
        gitHubAccountName: z.string(),
        gitHubPrivateToken: z.string().optional().default(""),
    }),
    outputSchema: z.object({
        gitHubAccountName: z.string(),
        gitHubPrivateToken: z.string().optional().default(""),
        repositoryUrls: z.array(z.string()).describe("対象アカウントのことがわかるGitHubリポジトリをAIセレクトで5つ選んで返す"),
    }),
    execute: async ({ inputData }) => {
        const { gitHubAccountName, gitHubPrivateToken } = inputData;
        const reposNum = 5

        try {
            const allRepo =  await getAllRepositories(gitHubAccountName, gitHubPrivateToken);
            
            if (!allRepo) {
                throw new Error(`GitHubユーザー "${gitHubAccountName}" は存在しません。`);
            }
            // 対象者のことがよくわかるリポジトリを5つ選択
            const selectedUrls = await selectUsefulRepos(gitHubAccountName, allRepo, reposNum);
            
            return {
                gitHubAccountName: gitHubAccountName,
                gitHubPrivateToken: gitHubPrivateToken,
                repositoryUrls: selectedUrls
            };
        } catch (error: any) {
            console.error(`リポジトリの列挙に失敗: ${error.message}`);
            return {
                gitHubAccountName: gitHubAccountName,
                gitHubPrivateToken: gitHubPrivateToken,
                repositoryUrls: [],
            };
        }
    },
})

async function getAllRepositories(gitHubAccountName: string, gitHubPrivateToken: string): Promise<any|undefined> {
    const perPage = 50;
    const page = 1;

    // 認証ヘッダーの準備
    const headers: any = {
        "User-Agent": "github-repo-cloner",
        "Accept": "application/vnd.github.v3+json"
    };

    if (gitHubPrivateToken) {
        headers["Authorization"] = `token ${gitHubPrivateToken}`;
    }

    // 認証されたユーザーのリポジトリを取得する場合
    const endpoint = gitHubPrivateToken 
        ? `https://api.github.com/user/repos?visibility=public&affiliation=owner`  // 認証されたユーザー自身のリポジトリ
        : `https://api.github.com/users/${gitHubAccountName}/repos`;  // パブリックリポジトリのみ

    const params: any = {
        per_page: perPage,
        page: page,
        affiliation: "owner",
        visibility: gitHubPrivateToken ? 'private' : 'public'
    };

    

    const res = await axios.get(endpoint, {
        params: params,
        headers: headers,
    });


    if (res.status === 404) {
        return undefined
    }

    return res.data
}

async function selectUsefulRepos(gitHubAccountName: string, repos: any[], reposNum: number) {
    const model = google("gemini-2.0-flash-001");

    const repoSummaries = repos.map(repo => {
    return `Repository URL: ${repo.html_url}
Name: ${repo.name}
Description: ${repo.description ?? "なし"}
Language: ${repo.language ?? "不明"}
Stars: ${repo.stargazers_count}
Forks: ${repo.forks_count}
Open Issues: ${repo.open_issues_count}
Has Issues: ${repo.has_issues}
Has Projects: ${repo.has_projects}
Has Wiki: ${repo.has_wiki}
Has Downloads: ${repo.has_downloads}
Has Discussions: ${repo.has_discussions}
Created At: ${repo.created_at}
Updated At: ${repo.updated_at}
Last Push: ${repo.pushed_at}
Size (KB): ${repo.size}
Allow Forking: ${repo.allow_forking}
Topics: ${repo.topics.length > 0 ? repo.topics.join(", ") : "なし"}
---------------------------`;
}).join("\n\n");

const prompt = `
Below is a list of GitHub repository information. From these, please select up to ${reposNum} repositories that best reflect the user's profile, technical skill level, or activity.
Output only the URLs of the selected repositories in plain text as a bullet list.
${repoSummaries}
`;
/*
以下はGitHubのリポジトリ情報のリストです。それぞれのリポジトリについて、ユーザーの情報、技術レベルや活動状況がよくわかりそうなものを最大${reposNum}つ選んでください。
選んだリポジトリのURLだけを箇条書きでテキスト形式で出力してください。
${repoSummaries}
*/

    const chosenRepos = await generateText({
    model: model,
    prompt: prompt,
    });

    const repoUrlRegex = new RegExp(`https://github\\.com/${gitHubAccountName}/[A-Za-z0-9_.-]+`, "gi");
    const selectedRepoUrls = chosenRepos.text.match(repoUrlRegex) ?? [];

    return selectedRepoUrls;
}
