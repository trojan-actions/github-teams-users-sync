# GitHub Organization Member Contribution Action

> A GitHub Action to generate a report that contains member contribution data for a set interval belonging to a GitHub organization.

## Usage

By default the example [workflow](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions) below runs on a monthly [schedule](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events) using the amount of days from today interval as set in `action.yml` (default 30 days) and can also be triggered manually using a [workflow_dispatch](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#manual-events) event.

```yml
name: Member Contribution Report

on:
  schedule:
    - cron: '0 0 1 * *' # Runs on the first day of the month at 00:00
  workflow_dispatch:
    inputs:
      fromdate:
        description: 'Optional interval start date (format: yyyy-mm-dd)'
        required: false # Skipped if workflow dispatch input is not provided
      todate:
        description: 'Optional interval end date (format: yyyy-mm-dd)'
        required: false # Skipped if workflow dispatch input is not provided

jobs:
  member-contribution-report:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Get Member Contributions
        uses: nicklegan/github-org-member-contribution-action@v1.1.0
        with:
          token: ${{ secrets.ORG_TOKEN }}
          fromdate: ${{ github.event.inputs.fromdate }} # Used for workflow dispatch input
          todate: ${{ github.event.inputs.todate }} # Used for workflow dispatch input
```

## GitHub secrets

| Name                 | Value                                                            | Required |
| :------------------- | :--------------------------------------------------------------- | :------- |
| `ORG_TOKEN`          | A `repo`, `read:org`, `read:user` scoped [Personal Access Token] | `true`   |
| `ACTIONS_STEP_DEBUG` | `true` [Enables diagnostic logging]                              | `false`  |

[personal access token]: https://github.com/settings/tokens/new?scopes=repo,read:org,read:user&description=Member+Contribution+Action 'Personal Access Token'
[enables diagnostic logging]: https://docs.github.com/en/actions/managing-workflow-runs/enabling-debug-logging#enabling-runner-diagnostic-logging 'Enabling runner diagnostic logging'

:bulb: Disable [token expiration](https://github.blog/changelog/2021-07-26-expiration-options-for-personal-access-tokens/) to avoid failed workflow runs when running on a schedule.

## Action inputs

| Name              | Description                                                   | Default                     | Options                                                                                                                                                                            | Required |
| :---------------- | :------------------------------------------------------------ | :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------- |
| `org`             | Organization different than workflow context                  |                             |                                                                                                                                                                                    | `false`  |
| `days`            | Amount of days in the past to collect data for                | `30`                        |                                                                                                                                                                                    | `false`  |
| `sort`            | Column used to sort the acquired contribution data            | `commitContrib`             | `activeContrib`, `commitContrib`, `issueContrib`, `prContrib`, `prreviewContrib`, `repoIssueContrib`, `repoCommitContrib`, `repoPullRequestContrib` `repoPullRequestReviewContrib` | `false`  |
| `committer-name`  | The name of the committer that will appear in the Git history | `github-actions`            |                                                                                                                                                                                    | `false`  |
| `committer-email` | The committer email that will appear in the Git history       | `github-actions@github.com` |                                                                                                                                                                                    | `false`  |

## Workflow dispatch inputs

The additional option to retrieve historical contribution data using a custom date interval.
If the below fields are left empty during [workflow dispatch input](https://github.blog/changelog/2020-07-06-github-actions-manual-triggers-with-workflow_dispatch/), the default interval option of set days from the current date configured in `main.yml` will be used instead.

| Name                           | Value                                   | Required |
| :----------------------------- | :-------------------------------------- | :------- |
| `Optional interval start date` | A date matching the format `yyyy-mm-dd` | `false`  |
| `Optional interval end date`   | A date matching the format `yyyy-mm-dd` | `false`  |

## CSV layout

The results of all except the first two columns will be the sum of contributions for the requested interval per organization member.

| Column                   | Description                                                     |
| :----------------------- | :-------------------------------------------------------------- |
| Member                   | Username of the organization member                             |
| Has active contributions | Returns true if the member made contributions                   |
| Commits created          | Number of commits created by the org member                     |
| Issues opened            | Number of issues opened by the org member                       |
| PRs opened               | Number of pull requests opened by the org member                |
| PR reviews               | Number of pull request reviews given by the org member          |
| Issue spread             | Number of repos the org member opened issues in                 |
| Commit spread            | Number of repos the org member created commits in               |
| PR spread                | Number of repos the org member opened pull requests in          |
| PR review spread         | Number of repos the org member reviewed pull request reviews in |

A CSV report file to be saved in the repository `reports` folder using the following naming format: `organization-date-interval.csv`.

:bulb: If no contribution data for an org member is returned but `Has active contributions` returns `true`, the user was added to the organization during the requested interval which also counts as a contribution.

## GitHub App installation authentication

In large organizations to avoid hitting the 5000 requests per hour GitHub API rate limit, [authenticating as a GitHub App installation](https://docs.github.com/developers/apps/building-github-apps/authenticating-with-github-apps#authenticating-as-an-installation) would increase the [API request limit](https://docs.github.com/developers/apps/building-github-apps/rate-limits-for-github-apps#github-enterprise-cloud-server-to-server-rate-limits) in comparison to using a personal access token.

The authentication strategy can be integrated with the Octokit library by installing and configuring the [@octokit/auth-app](https://github.com/octokit/auth-app.js/#usage-with-octokit) npm module before [rebuilding](https://docs.github.com/actions/creating-actions/creating-a-javascript-action) the Action in a separate repository.
