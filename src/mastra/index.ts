import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { repositoryAnalysisAgent } from "./agents";

export const mastra = new Mastra({
    server: {
        port: 8080,
        timeout: 30000,
        cors: {
            origin: ["*"], // Allow specific origins or '*' for all
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization"],
            credentials: false,
        },
    },
    agents: {
        repositoryAnalysisAgent,
    },
    logger: new PinoLogger({
        name: "Mastra",
        level: "debug",
    }),
});

