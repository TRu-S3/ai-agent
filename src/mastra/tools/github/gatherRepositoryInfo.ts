import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import axios from "axios";

/**
 * 指定されたユーザーのリポジトリの列挙ができたか
 */
export const gatherRepoOutputSchema = z
    .object({
        success: z.boolean().describe("クローン操作が成功したかどうか"),
        message: z.string().describe("操作結果の詳細メッセージ"),
        userGitUrl: z
            .string()
            .optional()
            .describe("指定されたアカウントが持つgithubプロフィールのURL名"),
        repositoryUrls: z
            .array(z.string())
            .optional()
            .describe("指定されたアカウントが持つ全てのリポジトリのURL"),
        forkedRepoCount: z
            .number()
            .optional()
            .describe("forkされたリポジトリ数"),
    })
    .describe("リポジトリ洗い出しの結果");

/**
 * 指定されたユーザーのリポジトリを列挙するツール
 */
export const gatherRepositoryInfoTool = createTool({
    id: "gather-repository-info",
    description: "指定されたアカウントの全GitHubリポジトリURLを洗い出します",
    inputSchema: z.object({
        gitHubAccountName: z
            .string()
            .describe("GitHubアカウント名"),
    }),
    outputSchema: gatherRepoOutputSchema,
execute: async ({ context }) => {
    const { gitHubAccountName } = context;

    try {
        const perPage = 100;
        let page = 1;
        let allRepoUrls: string[] = [];
        let forkedRepoCount = 0;

        while (true) {
            const res = await axios.get(
                `https://api.github.com/users/${gitHubAccountName}/repos`,
                {
                    params: {
                        per_page: perPage,
                        page: page,
                    },
                    headers: {
                        "User-Agent": "public-repo-cloner",
                    },
                }
            );

            if (res.status === 404) {
                throw new Error(`GitHubユーザー "${gitHubAccountName}" は存在しません。`);
            }

            const repos = res.data;
            if (repos.length === 0) break;

            for (const repo of repos) {
                if (repo.fork) {
                    forkedRepoCount++;
                    continue;
                }
                allRepoUrls.push(repo.html_url);
            }

            if (repos.length < perPage) break;
            page++;
        }

        return {
            success: true,
            message: `${gitHubAccountName}のリポジトリの列挙に成功しました`,
            userGitUrl: `https://github.com/${gitHubAccountName}`,
            repositoryUrls: allRepoUrls,
            forkedRepoCount: forkedRepoCount
        };
    } catch (error: any) {
        console.error(`リポジトリの列挙に失敗: ${error.message}`);
        return {
            success: false,
            message: `リポジトリの列挙に失敗しました: ${error.message}`,
            userGitUrl: `https://github.com/${gitHubAccountName}`,
            repositoryUrls: [],
        };
    }
},
});

