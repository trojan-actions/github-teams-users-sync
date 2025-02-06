# GitHub Teams to Port.io Sync Action

> A GitHub Action that synchronizes teams and user memberships from GitHub to Port.io for enhanced identity mapping.

## Overview

This action fetches all teams and their members from a GitHub organization and syncs them to Port.io, maintaining user-team relationships and identity mapping.

## Usage

```yml
name: Sync Teams to Port.io

on:
  schedule:
    - cron: '0 0 * * *'  # Runs daily at midnight
  workflow_dispatch:      # Allows manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Sync GitHub Teams to Port.io
        uses: trojan-actions/github-teams-users-sync@main
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          org: 'your-organization'
          port_client_id: ${{ secrets.PORT_CLIENT_ID }}
          port_client_secret: ${{ secrets.PORT_CLIENT_SECRET }}
```

## Required Inputs

| Name | Description | Required |
|------|-------------|----------|
| `token` | GitHub PAT with `read:org` scope | Yes |
| `org` | GitHub organization name | Yes |
| `port_client_id` | Port.io API Client ID | Yes |
| `port_client_secret` | Port.io API Client Secret | Yes |

## Features

- Fetches all teams and members from GitHub organization
- Maintains team-member relationships
- Handles API rate limiting and retries
- Supports GraphQL for efficient data fetching
- Automatic pagination for large organizations

## Authentication

### GitHub Authentication
Create a Personal Access Token with `read:org` scope to allow the action to read team data.

### Port.io Authentication
Provide your Port.io credentials through action inputs for API access.

## Development

```bash
npm install
npm run build
```

## License

[MIT License](LICENSE)

---
For more information on Port.io integration, visit: [Port.io Documentation](https://docs.getport.io)
