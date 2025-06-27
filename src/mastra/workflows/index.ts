// index.ts
import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { step1 } from './step1';
import { step2 } from './step2';
import { step3 } from './step3';
import { step4 } from './step4';
import { step5 } from './step5';
import { step6 } from './step6';

export const repositoryAnalysisWorkflow = createWorkflow({
  id: 'リポジトリ解析ワークフロー',
  inputSchema: z.object({
    gitHubAccountName: z.string().describe("GitHubのアカウント名"),
    gitHubPrivateToken: z.string().optional().default("").describe("GitHubのプライベートリポジトリ用のトークン")
  }),
  outputSchema: z.object({
    yaml: z
      .string()
      .describe("yaml形式の出力結果"),
  }),
  steps: [ step1, step2, step3, step4, step5, step6 ],
})
.then(step1)
.then(step2)
.parallel([step3, step4, step5])
.then(step6)
.commit();