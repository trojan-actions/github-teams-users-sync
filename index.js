const core = require('@actions/core');
const { HttpClient } = require('@actions/http-client');
const { GitHub } = require('@actions/github/lib/utils');
const { retry } = require('@octokit/plugin-retry');
const { throttling } = require('@octokit/plugin-throttling');

const API_URL = "https://api.getport.io/v1";
const BLUEPRINT_ID = "githubUser";

async function initOctokit(token) {
  const MyOctokit = GitHub.plugin(throttling, retry);
  return new MyOctokit({
    auth: token,
    request: { retries: 3 },
    throttle: {
      onRateLimit: (retryAfter, options) => {
        core.warning(`Request quota exhausted for ${options.method} ${options.url}`);
        if (options.request.retryCount <= 2) {
          core.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (retryAfter, options) => {
        core.warning(`Secondary rate limit hit for ${options.method} ${options.url}`);
        return true;
      },
      onAbuseLimit: (retryAfter, options) => {
        core.warning(`Abuse limit hit for ${options.method} ${options.url}`);
        return false;
      }
    }
  });
}

async function fetchTeamData(octokit, org, cursor = null) {
  const response = await octokit.graphql(GET_TEAMS_QUERY, { org, cursor });
  return response.organization?.teams;
}

async function getAllTeams(octokit, org) {
  let teams = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const teamsData = await fetchTeamData(octokit, org, cursor);
    if (!teamsData) throw new Error("No teams found");
    
    teams = [...teams, ...teamsData.nodes];
    hasNextPage = teamsData.pageInfo.hasNextPage;
    cursor = teamsData.pageInfo.endCursor;
  }
  
  return teams;
}

function mapTeamsToUsers(teams) {
  const users = {};
  console.log(teams);
  teams.forEach(team => {
    team.members.nodes.forEach(user => {
      if (!users[user.id]) {
        users[user.id] = {
          identifier: user.id,
          title: user.login,
          blueprint: "githubUser",
          relations: { githubTeams: [] }
        };
      }
      users[user.id].relations.githubTeams.push(team.databaseId.toString());
    });
    console.log(team);
  });
  return { entities: Object.values(users) };
}

async function getPortToken(clientId, clientSecret) {
  const http = new HttpClient('port-action');
  const response = await http.postJson(`${API_URL}/auth/access_token`, {
    clientId,
    clientSecret
  });
  return response.result.accessToken;
}

async function updatePort(token, data) {
  const http = new HttpClient('port-action', [], {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return http.postJson(
    `${API_URL}/blueprints/${BLUEPRINT_ID}/entities?upsert=true`,
    data
  );
}

async function run() {
  try {
    const token = core.getInput("token", { required: true });
    const org = core.getInput("org", { required: true });
    const portClientId = core.getInput("port_client_id", { required: true });
    const portClientSecret = core.getInput("port_client_secret", { required: true });

    const octokit = await initOctokit(token);
    const teams = await getAllTeams(octokit, org);
    const userData = mapTeamsToUsers(teams);
    const portToken = await getPortToken(portClientId, portClientSecret);
    await updatePort(portToken, userData);

    core.info(`Successfully synced ${userData.entities.length} users`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

const GET_TEAMS_QUERY = `
  query ($org: String!, $cursor: String) {
    organization(login: $org) {
      teams(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          name
          databaseId
          slug
          members(first: 100) {
            nodes {
              login
              id
            }
          }
        }
      }
    }
  }
`;

run();