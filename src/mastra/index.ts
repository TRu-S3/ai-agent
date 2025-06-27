import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { repositoryAnalysisWorkflow } from "./workflows/index";
import { publicRepositoryAnalysisAgent } from "./agents/index"
import { LibSQLStore } from "@mastra/libsql";


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
    workflows: { repositoryAnalysisWorkflow },
     storage: new LibSQLStore({
        url: ":memory:"
    }),
    logger: new PinoLogger({
        name: "Mastra",
        level: "debug",
    }),
});

