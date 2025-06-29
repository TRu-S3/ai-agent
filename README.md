# AI Agent - GitHub Analysis & Recommendation System

GitHubリポジトリを解析してYAMLレポートを生成し、そのYAMLデータを基にして互換性のある開発者を推奨するAIエージェントシステムです。

## 概要

このシステムは2つの主要なAIエージェントで構成されています：

1. **エージェント1**: GitHubリポジトリ解析 → YAML出力
2. **エージェント2**: YAML解析 → 推奨開発者リスト（JSON配列）

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
export GOOGLE_API_KEY=your_gemini_api_key_here
```

### 3. 開発サーバーの起動

```bash
npm run dev
```

サーバーが `http://localhost:4111` で起動します。

## 使用方法

### 基本的な統合フロー（推奨）

完全な統合ワークフローを実行して、GitHubユーザー名から推奨開発者リストまでを一度に取得：

#### 1. ワークフロー実行IDの作成

```bash
curl -X POST "http://localhost:4111/api/workflows/integratedWorkflow/create-run" \
  -H "Content-Type: application/json" \
  -d '{}'
```

レスポンス例:
```json
{"runId":"baed825e-229c-49ea-b527-4c410ea29401"}
```

#### 2. 統合ワークフローの実行

```bash
curl -X POST "http://localhost:4111/api/workflows/integratedWorkflow/start?runId=<上記のrunId>" \
  -H "Content-Type: application/json" \
  -d '{"inputData": {"username": "octocat"}}'
```

#### 3. 結果の確認

```bash
# 実行状況の確認
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | jq '.runs[0].snapshot.status'

# 推奨開発者リスト（JSON配列）の取得
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations'
```

### 個別のワークフロー実行

#### A. YAML生成のみ（エージェント1）

GitHubリポジトリの詳細な解析結果をYAML形式で取得：

```bash
# 1. 実行IDの作成
curl -X POST "http://localhost:4111/api/workflows/repositoryAnalysisWorkflow/create-run" \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. リポジトリ解析の実行
curl -X POST "http://localhost:4111/api/workflows/repositoryAnalysisWorkflow/start?runId=<runId>" \
  -H "Content-Type: application/json" \
  -d '{"inputData": {"gitHubAccountName": "octocat", "gitHubPrivateToken": ""}}'

# 3. YAML結果の取得
curl -X GET "http://localhost:4111/api/workflows/repositoryAnalysisWorkflow/runs" | \
  jq -r '.runs[0].snapshot.context."generate-report-yaml".output.yaml'
```

#### B. YAML → 推奨変換（エージェント2）

既存のYAMLデータから推奨開発者を生成：

```bash
# 1. 実行IDの作成
curl -X POST "http://localhost:4111/api/workflows/recommendWorkflow/create-run" \
  -H "Content-Type: application/json" \
  -d '{}'

# 2. YAML解析と推奨生成
curl -X POST "http://localhost:4111/api/workflows/recommendWorkflow/start?runId=<runId>" \
  -H "Content-Type: application/json" \
  -d '{
    "inputData": {
      "yamlData": "public:\n  github_username: octocat\n  analysis_date: \"2025-06-29\"\n  total_repositories: 5\n  overall_languages:\n    most_common_language: JavaScript\n    language_distribution:\n      JavaScript: \"40%\"\n      TypeScript: \"30%\"\n  technical_insights:\n    frameworks: [\"React\", \"Express\"]\n    package_managers: [\"npm\"]\n  topics_detected:\n    - web development\n    - javascript\n  commit_analysis:\n    total_commits: 150\n    average_commits_per_week: 12\n  summary: \"Active JavaScript developer\""
    }
  }'

# 3. 推奨結果の取得
curl -X GET "http://localhost:4111/api/workflows/recommendWorkflow/runs" | \
  jq '.runs[0].snapshot.context."find-recommendations".output.recommendations'
```

## 出力形式

### YAML出力（エージェント1）

詳細なGitHub解析結果：

```yaml
public:
  github_username: octocat
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
    favorite_architecture: ["REST API", "microservices"]
    infra_as_code: []
    security: "Basic security practices with dependency scanning"
    documentation_quality: "Good documentation with README files"
  commit_analysis:
    total_commits: 150
    active_weeks: 12
    average_commits_per_week: 12
    commits_by_weekday:
      Sunday: 5
      Monday: 25
      Tuesday: 30
      Wednesday: 28
      Thursday: 25
      Friday: 22
      Saturday: 15
    peak_commit_day: "Tuesday"
  topics_detected:
    - "web development"
    - "open source"
    - "javascript"
    - "api development"
  personal_identifiers_found:
    usernames: ["octocat"]
    emails: []
    names: ["GitHub User"]
    urls: ["https://github.com/octocat"]
    jobs: []
    other: []
  notable_patterns:
    - "Consistent commit patterns showing regular development activity"
    - "Strong focus on JavaScript ecosystem and web technologies"
    - "Good testing practices with comprehensive test coverage"
    - "Active in open source community with public repositories"
  summary: "Active developer with strong JavaScript and web development skills, showing consistent contribution patterns and good engineering practices."
```

### JSON出力（エージェント2）

推奨開発者リスト：

```json
[
  {
    "username": "kentcdodds",
    "name": "Kent C. Dodds",
    "reason": "Expert in JavaScript, TypeScript, Python and React, Node.js, Express, shares passion for web development, open source, javascript, api development",
    "compatibility_score": 95
  },
  {
    "username": "addyosmani",
    "name": "Addy Osmani",
    "reason": "Google engineer focusing on JavaScript, TypeScript, Python performance and optimization",
    "compatibility_score": 92
  },
  {
    "username": "sindresorhus",
    "name": "Sindre Sorhus",
    "reason": "Prolific contributor with extensive JavaScript, TypeScript, Python experience",
    "compatibility_score": 90
  }
  // ... 7人の追加推奨者
]
```

## JSONデータの操作方法

### 1. 推奨結果の基本操作

```bash
# 全推奨者の取得
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations'

# 推奨者数の確認
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | length'

# 上位3人の推奨者のみ
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations[0:3]'
```

### 2. フィルタリングと並び替え

```bash
# 互換性スコア90以上の開発者のみ
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | map(select(.compatibility_score >= 90))'

# 互換性スコア順で並び替え（降順）
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | sort_by(.compatibility_score) | reverse'

# ユーザー名のみを取得
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq -r '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations[].username'
```

### 3. 特定の条件での検索

```bash
# 特定の技術（例：React）に言及している推奨者
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | map(select(.reason | contains("React")))'

# 特定のユーザー名の詳細取得
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | map(select(.username == "kentcdodds"))'
```

### 4. データの加工と出力

```bash
# CSV形式での出力
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq -r '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | ["username,name,score"], (.[] | [.username, .name, .compatibility_score]) | @csv'

# GitHub URLの生成
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | map({username: .username, github_url: ("https://github.com/" + .username), score: .compatibility_score})'

# マークダウン形式での出力
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq -r '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | "# 推奨開発者リスト\n\n" + (map("- [" + .name + "](https://github.com/" + .username + ") (スコア: " + (.compatibility_score | tostring) + ") - " + .reason) | join("\n"))'
```

### 5. ファイルへの保存

```bash
# JSON形式で保存
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations' > recommendations.json

# CSV形式で保存
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq -r '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations | ["username,name,score,reason"], (.[] | [.username, .name, .compatibility_score, .reason]) | @csv' > recommendations.csv

# YAMLデータの保存
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq -r '.runs[0].snapshot.context."run-repository-analysis".output.yamlOutput' > analysis.yaml
```

## 利用可能なワークフロー

| ワークフロー名 | 説明 | 入力 | 出力 |
|---------------|------|------|------|
| `integratedWorkflow` | 統合フロー（推奨） | GitHub username | 推奨開発者JSON配列 |
| `repositoryAnalysisWorkflow` | リポジトリ解析のみ | GitHub username | 詳細YAML分析 |
| `recommendWorkflow` | 推奨生成のみ | YAMLデータ | 推奨開発者JSON配列 |

## トラブルシューティング

### よくある問題

1. **サーバーが起動しない**
   ```bash
   # ポート4111を使用しているプロセスを停止
   lsof -ti:4111 | xargs kill -9
   ```

2. **API keyエラー**
   ```bash
   # API keyが正しく設定されているか確認
   echo $GOOGLE_API_KEY
   ```

3. **ワークフローが失敗する**
   ```bash
   # エラーログの確認
   curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
     jq '.runs[0].snapshot.error'
   ```

### デバッグ方法

```bash
# 全ワークフローの一覧
curl -X GET "http://localhost:4111/api/workflows" | jq 'keys'

# 特定のワークフローの詳細
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow"

# 実行履歴の確認
curl -X GET "http://localhost:4111/api/workflows/integratedWorkflow/runs" | \
  jq '.runs | map({runId: .runId, status: .snapshot.status, createdAt: .createdAt})'
```

## 開発者向け情報

### プロジェクト構造

```
src/mastra/
├── agents/
│   ├── index.ts                    # GitHubリポジトリ解析エージェント
│   └── recommend-agent.ts          # 推奨エージェント
├── workflows/
│   ├── integrated-workflow.ts     # 統合ワークフロー
│   ├── recommend-workflow.ts      # YAML→推奨変換ワークフロー
│   └── index.ts                   # リポジトリ解析ワークフロー
└── tools/
    └── github/                    # GitHub解析ツール群
```

### 技術スタック

- **Framework**: [Mastra](https://mastra.ai) - AIワークフロー管理
- **AI Model**: Google Gemini (gemini-2.0-flash-001)
- **Language**: TypeScript
- **Runtime**: Node.js 20+

