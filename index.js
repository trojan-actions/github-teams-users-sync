const axios = require('axios');
const core = require('@actions/core');
const { GitHub } = require('@actions/github/lib/utils');
const { retry } = require('@octokit/plugin-retry');
const { throttling } = require('@octokit/plugin-throttling');

const MyOctokit = GitHub.plugin(throttling, retry);
const token = core.getInput("token", { required: true });
const org = core.getInput("org", { required: true });

const PORT_CLIENT_ID = core.getInput("port_client_id", { required: true });
const PORT_CLIENT_SECRET = core.getInput("port_client_secret", { required: true });

const API_URL = "https://api.getport.io/v1";
const blueprintId = "_team";

const octokit = new MyOctokit({
  auth: token,
  request: { retries: 3, retryAfter: 180 },
  throttle: {
    onRateLimit: (retryAfter, options) => {
      console.warn(`⚠️ Rate limit hit for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds.`);
      if (options.request.retryCount === 0) return true;
    },
    onAbuseLimit: (retryAfter, options) => {
      console.warn(`🚨 Abuse detection triggered for request ${options.method} ${options.url}. Waiting ${retryAfter} seconds before retrying.`);
    },
  },
});

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
              email
            }
          }
        }
      }
    }
  }
`;

async function fetchGitHubTeams() {
  let hasNextPage = true;
  let cursor = null;
  let teams = [];

  try {
    while (hasNextPage) {
      const response = await octokit.graphql(GET_TEAMS_QUERY, { org, cursor });
      if (!response.organization) throw new Error("Invalid GitHub response: No organization found");

      const teamNodes = response.organization.teams.nodes;
      teams = [...teams, ...teamNodes];

      hasNextPage = response.organization.teams.pageInfo.hasNextPage;
      cursor = response.organization.teams.pageInfo.endCursor;
    }
  } catch (error) {
    throw error;
  }

  return teams;
}

function formatDataForPort(teams) {
  let githubUsers = {};
  try {
    teams.forEach((team) => {
      const teamId = team.databaseId.toString();
      team.members.nodes.forEach((user) => {
        const userId = user.id;
        if (!githubUsers[userId]) {
          githubUsers[userId] = {
            identifier: userId,
            title: user.login,
            blueprint: "githubUser",
            relations: { githubTeams: [] },
          };
        }
        githubUsers[userId].relations.githubTeams.push(teamId);
      });
    });
  } catch (error) {
    throw error;
  }
  return { entities: Object.values(githubUsers) };
}

async function getPortAccessToken() {
  try {
    const response = await axios.post(`${API_URL}/auth/access_token`, {
      clientId: PORT_CLIENT_ID,
      clientSecret: PORT_CLIENT_SECRET,
    });
    return response.data.accessToken;
  } catch (error) {
    console.error("❌ Failed to get Port.io access token:", error.message);
  }
}

async function sendDataToPort(portAccessToken, formattedData) {
  try {
    const response = await axios.post(
      `${API_URL}/blueprints/${blueprintId}/entities?upsert=true`,
      formattedData,
      { headers: { Authorization: `Bearer ${portAccessToken}` } }
    );
    return response.data;
  } catch (error) {
    console.error("❌ Failed to send data to Port.io:", error.response?.data || error.message);
    throw error;
  }
}

(async () => {
  try {
    const teams = await fetchGitHubTeams();
    if (!teams.length) throw new Error("No GitHub teams found");

    const formattedData = formatDataForPort(teams);

    const portAccessToken = await getPortAccessToken();

    const response = await sendDataToPort(portAccessToken, formattedData);

  } catch (error) {
    core.setFailed(error.message);
  }
})();