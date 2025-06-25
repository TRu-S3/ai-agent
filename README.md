# GitHub Recommendations - AI Agent

AI-powered GitHub user recommendation system that analyzes a target user's profile and suggests 10 compatible developers for collaboration or networking.

## Overview

This project uses the Mastra framework to orchestrate an AI workflow that:
1. Fetches GitHub user profile and repository data via GitHub API
2. Analyzes programming languages, project topics, and contributions
3. Uses Google's Gemini 1.5 Pro AI model to find compatible developers
4. Returns personalized recommendations with compatibility scores

## Prerequisites

- Node.js >= 20.9.0
- Google AI API key (for Gemini model)

## Environment Setup

Create a `.env` file in the project root with your Google AI API key:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

You can get a Google AI API key from [Google AI Studio](https://makersuite.google.com/app/apikey).

## Installation

```bash
# Install dependencies
npm install
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Build and Start
```bash
# Build the project
npm run build

# Start the application
npm start
```

## Usage

The application exposes a workflow called `recommendWorkflow` that accepts a GitHub username and returns AI-generated recommendations.

### Input Schema
```json
{
  "username": "github_username"
}
```

### Output
The workflow returns 10 recommended GitHub users with:
- Username and display name
- Compatibility reason
- Compatibility score
- Brief profile summary

## Project Structure

```
src/mastra/
├── index.ts                    # Main Mastra configuration
├── workflows/
│   └── recommend-workflow.ts   # Main recommendation workflow
├── agents/
│   └── recommend-agent.ts      # AI agent configuration
└── tools/
    └── github-tool.ts          # GitHub API integration
```

## How It Works

1. **User Analysis**: Fetches target user's GitHub profile, repositories, languages, and topics
2. **AI Processing**: Gemini AI analyzes the data to find users with:
   - Similar programming languages and tech stacks
   - Complementary skills for collaboration
   - Similar project interests
   - Active contribution patterns
   - Geographic proximity (when available)
3. **Recommendations**: Returns 10 compatible users with detailed reasoning

## Configuration

The system uses:
- **Storage**: LibSQL in-memory database (can be changed to persistent file storage)
- **Logging**: Pino logger with info level
- **AI Model**: Google Gemini 1.5 Pro Latest
- **API**: GitHub REST API (no authentication required for public data)

## Features

- Real-time GitHub data fetching
- AI-powered compatibility analysis
- Structured recommendation output
- Memory storage for agent context
- Comprehensive error handling
- TypeScript with Zod validation

## Limitations

- Requires active internet connection for GitHub API and Google AI
- Limited to public GitHub repositories and profiles
- Recommendation quality depends on target user's public activity
- Rate limited by GitHub API (60 requests/hour for unauthenticated requests)