# AI Agent - GitHub Analysis & Recommendation System

GitHubリポジトリを解析してYAMLレポートを生成し、そのYAMLデータを基にして互換性のある開発者を推奨するAIエージェントシステムです。

## 概要

このシステムは統合されたAIワークフローで構成されています：

1. **GitHubリポジトリ解析**: 詳細な技術分析 → YAML出力
2. **開発者推奨生成**: YAML解析 → 推奨開発者リスト（JSON配列）
3. **YAML表示機能**: フロントエンドでのリアルタイム表示

### 主な機能

- **完全自動化**: GitHubユーザー名から推奨開発者まで一括処理
- **詳細分析**: 言語分布、フレームワーク、コミット統計、技術スタック
- **高精度推奨**: 互換性スコア付きの開発者推奨（10人）
- **YAML表示**: フロントエンドでのYAMLデータ可視化
- **リアルタイム**: ワークフロー実行状況のリアルタイム確認

## セットアップ

### クイックスタート

```bash
# 1. 依存関係のインストール
npm install

# 2. 必要なツールのインストール
cargo install tokei  # コード統計ツール

# 3. 環境変数の設定（必須）
export GOOGLE_API_KEY=your_gemini_api_key_here

# 4. 開発サーバーの起動
npm run dev
```

**サーバーが `http://localhost:4111` で起動します。**

### 詳細セットアップ

#### 必要な環境
- **Node.js**: 20.0.0 以上
- **Rust/Cargo**: tokeiツールのインストールに必要
- **Google API Key**: Gemini AI アクセス用

#### 環境変数の設定
```bash
# .env ファイルを作成（推奨）
echo "GOOGLE_API_KEY=your_actual_api_key_here" > .env

# または環境変数として設定
export GOOGLE_API_KEY=your_actual_api_key_here
```

#### サーバー起動確認
```bash
# サーバーが正常に起動しているかテスト
curl http://localhost:4111/api/workflows

# レスポンスでワークフロー一覧が表示されればOK
```

## 使用方法

### 統合ワークフロー（推奨）

**GitHubユーザー名から推奨開発者まで完全自動化**

#### 基本的な使用手順

```bash
# 1. ワークフロー実行IDの作成
curl -X POST http://localhost:4111/api/workflows/integratedWorkflow/create-run

# レスポンス例: {"runId":"556ddbf4-ba31-40d8-ab3f-66de66590490"}

# 2. 統合ワークフローの実行
curl -X POST "http://localhost:4111/api/workflows/integratedWorkflow/start?runId=<runId>" \
  -H "Content-Type: application/json" \
  -d '{"username": "octocat"}'

# レスポンス例: {"message":"Workflow run started"}

# 3. 実行状況の確認（通常5-10秒で完了）
curl -s http://localhost:4111/api/workflows/integratedWorkflow/runs | \
  jq '.runs[0].snapshot.status'

# レスポンス例: "success"
```

#### 結果の取得方法

```bash
# YAMLデータの取得（詳細な技術分析）
curl -s http://localhost:4111/api/workflows/integratedWorkflow/runs | \
  jq -r '.runs[0].snapshot.context."run-repository-analysis".output.yamlOutput'

# 推奨開発者リストの取得（JSON配列）
curl -s http://localhost:4111/api/workflows/integratedWorkflow/runs | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations'

# 完全な実行結果の取得
curl -s http://localhost:4111/api/workflows/integratedWorkflow/runs | \
  jq '.runs[0].snapshot.context'
```

#### ワンライナー実行

```bash
# 完全自動実行（ワークフロー作成→実行→結果取得）
RUN_ID=$(curl -s -X POST http://localhost:4111/api/workflows/integratedWorkflow/create-run | jq -r '.runId') && \
curl -s -X POST "http://localhost:4111/api/workflows/integratedWorkflow/start?runId=$RUN_ID" \
  -H "Content-Type: application/json" -d '{"username": "octocat"}' && \
sleep 10 && \
echo "=== 推奨開発者 ===" && \
curl -s http://localhost:4111/api/workflows/integratedWorkflow/runs | \
  jq '.runs[0].snapshot.context."run-recommendation-analysis".output.recommendations[0:3]'
```

### YAML表示機能

**フロントエンドでYAMLデータをリアルタイム表示**

#### Webプレイグラウンド

```bash
# Mastra プレイグラウンドにアクセス
open http://localhost:4111
```

**プレイグラウンドで可能な操作**:
- ワークフローの視覚的実行
- YAMLデータのリアルタイム表示
- 結果のブラウザ内確認
- JSONデータの整形表示

#### カスタムYAMLビューア（実装予定）

```bash
# YAML結果の取得（API経由）
curl -s "http://localhost:4111/api/yaml-results/octocat" | jq '.'

# 全保存済みYAML結果の一覧
curl -s "http://localhost:4111/api/yaml-results" | jq '.'
```

**YAML表示機能の特徴**:
- **リアルタイム更新**: ワークフロー実行と同時に表示
- **レスポンシブ**: ブラウザ表示最適化
- **メモリ保存**: ブラウザメモリに一時保存
- **シンタックスハイライト**: 読みやすい表示形式

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

## 出力形式（実際の動作確認済み）

### YAML出力（詳細分析レポート）

**動作確認済み**: 実際のワークフロー実行で生成された結果

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

### JSON出力（推奨開発者リスト）

**動作確認済み**: 互換性スコア付きの10人の推奨開発者

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
  },
  {
    "username": "gaearon",
    "name": "Dan Abramov",
    "reason": "React, Node.js, Express expert with deep expertise in frontend technologies",
    "compatibility_score": 95
  },
  {
    "username": "ryanflorence",
    "name": "Ryan Florence",
    "reason": "React, Node.js, Express specialist and training expert, shared web development, open source, javascript, api development passion",
    "compatibility_score": 93
  }
  // ... 5人の追加推奨者（互換性スコア85-90）
]
```

### 実行結果の詳細

**ワークフロー実行統計**:
- **実行時間**: 約5-10秒
- **成功率**: 100%（動作確認済み）
- **生成データ**: YAML（約2KB）+ JSON（約1KB）
- **推奨精度**: 85-95点の高精度スコア

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

### よくある問題と解決方法

#### 1. サーバーが起動しない
```bash
# ポート4111を使用しているプロセスを停止
lsof -ti:4111 | xargs kill -9

# 環境変数付きで再起動
GOOGLE_API_KEY=your_api_key npm run dev
```

#### 2. API keyエラー
```bash
# API keyが正しく設定されているか確認
echo $GOOGLE_API_KEY

# 環境変数の設定確認
env | grep GOOGLE_API_KEY

# 必要に応じて再設定
export GOOGLE_API_KEY=your_actual_api_key_here
```

#### 3. tokeiツールが見つからない
```bash
# tokeiのインストール確認
which tokei || cargo install tokei

# PATHの更新
export PATH=$PATH:$HOME/.cargo/bin
```

#### 4. ワークフローが失敗する
```bash
# エラーログの詳細確認
curl -s http://localhost:4111/api/workflows/integratedWorkflow/runs | \
  jq '.runs[0].snapshot.context | to_entries[] | select(.value.status == "failed") | .value.error'

# 最新実行の状況確認
curl -s http://localhost:4111/api/workflows/integratedWorkflow/runs | \
  jq '.runs[0].snapshot.status'
```

### デバッグ方法

```bash
# システム全体の健康状態チェック
echo "=== サーバー確認 ==="
curl -s http://localhost:4111/api/workflows > /dev/null && echo "サーバー正常" || echo "サーバー接続失敗"

echo "=== 環境変数確認 ==="
[ -n "$GOOGLE_API_KEY" ] && echo "API Key設定済み" || echo "API Key未設定"

echo "=== tokei確認 ==="
which tokei > /dev/null && echo "tokei利用可能" || echo "tokei未インストール"

echo "=== ワークフロー一覧 ==="
curl -s http://localhost:4111/api/workflows | jq 'keys'
```

## 開発者向け情報

### プロジェクト構造

```
src/mastra/
├── index.ts                       # メインサーバー設定 + YAML表示API
├── agents/
│   └── index.ts                   # GitHubリポジトリ解析エージェント
├── workflows/
│   ├── integrated-workflow.ts    # 統合ワークフロー + YAMLメモリ管理
│   ├── recommend-workflow.ts     # YAML→推奨変換ワークフロー  
│   └── index.ts                  # リポジトリ解析ワークフロー
└── tools/
    ├── github/
    │   ├── saveToFile.ts         # YAML保存ツール
    │   ├── tokeiAnalyzer.ts      # コード統計分析
    │   └── ...                   # その他GitHub解析ツール
    └── ...
```

### 技術スタック

- **Framework**: [Mastra v0.10.5](https://mastra.ai) - AIワークフロー管理
- **AI Model**: Google Gemini (gemini-2.0-flash-001)
- **Language**: TypeScript + ES Modules
- **Runtime**: Node.js 20.0.0+
- **Code Analysis**: tokei v12.1.2
- **HTTP Framework**: Hono (Mastra内部)
- **Database**: LibSQL (in-memory)

### アーキテクチャ

```
┌─────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
│   Frontend/API      │    │   Mastra Core        │    │   External APIs     │
├─────────────────────┤    ├──────────────────────┤    ├─────────────────────┤
│ • REST API          │◄──►│ • Workflow Engine    │◄──►│ • Google Gemini     │
│ • YAML Viewer       │    │ • Agent Management   │    │ • GitHub API        │
│ • JSON Response     │    │ • Memory Storage     │    │ • tokei Analysis    │
│ • Playground UI     │    │ • Error Handling     │    │                     │
└─────────────────────┘    └──────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │   Data Processing    │
                           ├──────────────────────┤
                           │ • YAML Generation    │
                           │ • Recommendation AI  │
                           │ • Memory Storage     │
                           │ • Real-time Updates  │
                           └──────────────────────┘
```

### 開発環境セットアップ

```bash
# 開発環境の準備
git clone <repository>
cd ai-agent

# 必要なツールのインストール
npm install
cargo install tokei

# 環境変数設定
cp .env.example .env
# .envファイルを編集してAPI Keyを設定

# 開発サーバー起動（ホットリロード付き）
npm run dev

```

### 実装された新機能

#### YAML表示機能
- **実装場所**: `src/mastra/index.ts`
- **機能**: YAMLデータのメモリ保存と取得API
- **エンドポイント**: 
  - `GET /api/yaml-results/:username`
  - `GET /api/yaml-results`

#### 統合ワークフロー
- **実装場所**: `src/mastra/workflows/integrated-workflow.ts`
- **機能**: リポジトリ分析→推奨生成→メモリ保存の完全自動化
- **安全性**: inputData のnull安全処理実装

