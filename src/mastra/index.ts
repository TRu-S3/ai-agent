import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { repositoryAnalysisWorkflow } from "./workflows/index";
import { publicRepositoryAnalysisAgent } from "./agents/index"
import { LibSQLStore } from "@mastra/libsql";
import { recommendWorkflow } from "./workflows/recommend-workflow";
import { integratedWorkflow } from "./workflows/integrated-workflow";

import { getYamlResult, getAllYamlResults } from './workflows/integrated-workflow';

export const mastra = new Mastra({
    server: {
        port: 4111,
        timeout: 3600000,  // 3600s
        cors: {
            origin: ["http://localhost:3000", "http://localhost:3001", "*"], // Allow frontend origins
            allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowHeaders: ["Content-Type", "Authorization", "Accept"],
            credentials: false,
        },
        routes: [
            {
                method: "GET",
                path: "/api/yaml-results/:username",
                handler: async (req, res) => {
                    const username = req.params.username;
                    const result = getYamlResult(username);
                    
                    if (!result) {
                        return res.status(404).json({ error: "YAML result not found for user" });
                    }
                    
                    return res.json({
                        username,
                        yaml: result.yaml,
                        recommendations: result.recommendations,
                        timestamp: result.timestamp
                    });
                },
            },
            {
                method: "GET", 
                path: "/api/yaml-results",
                handler: async (req, res) => {
                    const results = getAllYamlResults();
                    return res.json(results);
                },
            },
            {
                method: "POST",
                path: "/api/test-yaml-save",
                handler: async (req, res) => {
                    // Direct access to memory store for testing
                    const yamlResultsStore = new Map();
                    const saveYamlResult = (username, yaml, recommendations) => {
                        yamlResultsStore.set(username, {
                            yaml,
                            recommendations,
                            timestamp: Date.now()
                        });
                    };
                    
                    const testYaml = `public:
  github_username: testuser
  analysis_date: "2025-06-29"
  total_repositories: 5
  overall_languages:
    most_common_language: JavaScript
    language_distribution:
      JavaScript: "40%"
      TypeScript: "30%"
      Python: "20%"
      HTML: "10%"
  technical_insights:
    frameworks: ["React", "Node.js", "Express"]
    package_managers: ["npm"]
    build_tools: ["webpack", "vite"]
    testing_tools: ["jest", "mocha"]
    has_tests: true
    ci_cd: ["GitHub Actions"]
    containerization: ["Docker"]
  commit_analysis:
    total_commits: 150
    active_weeks: 12
    average_commits_per_week: 12
  summary: "Test user with JavaScript expertise"`;

                    const testRecommendations = [
                        { username: "kentcdodds", name: "Kent C. Dodds", reason: "JavaScript expert", compatibility_score: 95 },
                        { username: "addyosmani", name: "Addy Osmani", reason: "Performance optimization expert", compatibility_score: 92 },
                        { username: "sindresorhus", name: "Sindre Sorhus", reason: "Prolific JavaScript contributor", compatibility_score: 90 }
                    ];

                    saveYamlResult("testuser", testYaml, testRecommendations);
                    
                    return res.json({ 
                        success: true, 
                        message: "Test YAML data saved successfully",
                        saved: { username: "testuser", hasYaml: true, hasRecommendations: true }
                    });
                },
            }
        ],
    },
    agents: {
        publicRepositoryAnalysisAgent,
    },
    workflows: { 
        repositoryAnalysisWorkflow,
        recommendWorkflow,
        integratedWorkflow
    },
    storage: new LibSQLStore({
        url: ":memory:"
    }),
    logger: new PinoLogger({
        name: "Mastra",
        level: "debug",
    }),
});

