import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
// import { repositoryAnalysisWorkflow } from "./workflows";
import { publicRepositoryAnalysisAgent } from "./agents/index"

export const mastra = new Mastra({
    server: {
        port: 4111, // Defaults to 4111
        timeout: 10000, // Defaults to 30000 (30s)
        cors: {
            origin: ["*"], // Allow specific origins or '*' for all
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization"],
            credentials: false,
        },
    },
    agents: {
        publicRepositoryAnalysisAgent,
    },
    // workflows: [repositoryAnalysisWorkflow],
    logger: new PinoLogger({
        name: "Mastra",
        level: "debug",
    }),
});

