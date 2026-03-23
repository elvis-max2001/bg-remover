#!/bin/bash

# 配置变量
CLOUDFLARE_API_TOKEN="cfut_7DZksmu7laA56XgiHcu1uw22JMLiWUf7r2MWIsv63412dfc4"
ACCOUNT_ID="7272dfe2b633545a8380caad01d51283"
PROJECT_NAME="bg-remover"
GITHUB_REPO="elvis-max2001/bg-remover"
PRODUCTION_BRANCH="main"

# 创建 Pages 项目并连接 GitHub
curl -X POST "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "'${PROJECT_NAME}'",
    "production_branch": "'${PRODUCTION_BRANCH}'",
    "source": {
      "type": "github",
      "config": {
        "owner": "elvis-max2001",
        "repo_name": "bg-remover",
        "production_branch": "'${PRODUCTION_BRANCH}'",
        "pr_comments_enabled": true,
        "deployments_enabled": true
      }
    },
    "build_config": {
      "build_command": "npm run build",
      "destination_dir": "dist",
      "root_dir": "frontend"
    }
  }'
