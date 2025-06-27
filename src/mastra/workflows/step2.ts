import { createStep } from "@mastra/core";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

/**
 * クローン操作の結果を表すスキーマ
 */
export const cloneOutputSchema = z
    .object({
        gitHubAccountName: z.string(),
        localRepoPaths: z
            .array(z.string())
            .describe("クローンされたリポジトリの絶対パス（フルパス）"),
    })
    .describe("リポジトリクローン操作の結果");

/**
 * GitHub リポジトリをクローンするツール
 * LFS対応とサブモジュール処理も可能
 */
export const step2 = createStep({
    id: "clone-repository",
    description: "GitHub リポジトリをクローンして、コード解析やファイル処理を可能にします",
    inputSchema: z.object({
        gitHubAccountName: z.string(),
        repositoryUrls: z
            .array(z.string())
            .describe("リポジトリのURL（例: https://github.com/user/repo）- クローンするGitHubリポジトリのリストを指定します"),
    }),
    outputSchema: cloneOutputSchema,
    execute: async ({ inputData }) => {
        const { repositoryUrls } = inputData;

        const cloneResults = await Promise.all(
            repositoryUrls.map(async (url) => {
                return await cloneRepository(url);
            })
        );
    return {
        gitHubAccountName: inputData.gitHubAccountName,
        localRepoPaths: cloneResults.map((r) => r.localRepoPaths),
    };
 
    },
});


async function cloneRepository(repositoryUrl: string): Promise<{
  localRepoPaths: string;
}> {
    try {

        // パスの有効性を確認
        const { protocol, hostname, pathname } = new URL(repositoryUrl);
        if (!/^https?:$/.test(protocol) || hostname !== "github.com") {
            throw new Error("無効なURLです。GitHubリポジトリのみ許可されています。");
        }

        // リポジトリ名を取得
        const repoName = pathname.split("/").pop()?.replace(/\.git$/, "") || "repo";
        const fullPath = path.resolve(process.cwd(), repoName);

        // ディレクトリが既に存在するか確認
        if (fs.existsSync(fullPath)) {
            return {
                localRepoPaths: fullPath,
            };
        }

        // クローンコマンドを構築
        let command = `git clone ${repositoryUrl}`;

        // コマンド実行
        const { stdout, stderr } = await execAsync(command);

        return {
            localRepoPaths: fullPath,
        };
    } catch (error: any) {
        return {
            localRepoPaths: "",
        };
    }
}