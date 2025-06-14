import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { repositoryAnalysisAgent } from "./agents";

export const mastra = new Mastra({
    agents: {
        repositoryAnalysisAgent,
    },
    logger: createLogger({
        name: "GitHub Repository Analysis Agent",
        level: "info",
    }),
});