import axios from "axios";
import core from "@actions/core";
import { GitHub } from "@actions/github/lib/utils";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";

const MyOctokit = GitHub.plugin(throttling, retry);
const token = core.getInput("token", { required: true });
const org = core.getInput("org", { required: true });

const PORT_CLIENT_ID = core.getInput("port_client_id", { required: true });
const PORT_CLIENT_SECRET = core.getInput("port_client_secret", { required: true });

const API_URL = "https://api.getport.io/v1";
const blueprintId = "_team";

// Initialize GitHub API client with throttling
const octokit = new MyOctokit({
  auth: token,
  request: { retries: 3, retryAfter: 180 },
  throttle: {
    onRateLimit: (retryAfter, options) => {
      console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);
      if (options.request.retryCount === 0) {
        console.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onAbuseLimit: (retryAfter, options) => {
      console.warn(`Abuse detected for request ${options.method} ${options.url}`);
    },
  },
});

// GraphQL query to fetch GitHub teams and users
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

// Fetch all GitHub teams and their members
async function fetchGitHubTeams() {
  let hasNextPage = true;
  let cursor = null;
  let teams = [];

  while (hasNextPage) {
    const response = await octokit.graphql(GET_TEAMS_QUERY, { org, cursor });
    const teamNodes = response.organization.teams.nodes;

    teams = [...teams, ...teamNodes];

    hasNextPage = response.organization.teams.pageInfo.hasNextPage;
    cursor = response.organization.teams.pageInfo.endCursor;
  }

  return teams;
}

// Format data for Port.io API
function formatDataForPort(teams) {
  let githubUsers = {};

  teams.forEach((team) => {
    const teamId = team.databaseId.toString();

    team.members.nodes.forEach((user) => {
      const userId = user.id; // Using GitHub user ID as identifier

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

  return { entities: Object.values(githubUsers) };
}

// Authenticate with Port.io API
async function getPortAccessToken() {
  const response = await axios.post(`${API_URL}/auth/access_token`, {
    clientId: PORT_CLIENT_ID,
    clientSecret: PORT_CLIENT_SECRET,
  });

  return response.data.accessToken;
}

// Send data to Port.io
async function sendDataToPort(portAccessToken, formattedData) {
  const config = {
    headers: { Authorization: `Bearer ${portAccessToken}` },
  };

  const response = await axios.post(
    `${API_URL}/blueprints/${blueprintId}/entities?upsert=true`,
    formattedData,
    config
  );

  return response.data;
}

// Main function to run the GitHub Action
(async () => {
  try {
    console.log("🔄 Fetching GitHub teams and users...");
    const teams = await fetchGitHubTeams();
    
    if (!teams || teams.length === 0) {
      throw new Error("No teams found");
    }

    console.log("🔄 Formatting data for Port.io...");
    const formattedData = formatDataForPort(teams);

    console.log("🔄 Authenticating with Port.io...");
    const portAccessToken = await getPortAccessToken();

    console.log("🚀 Sending data to Port.io...");
    const response = await sendDataToPort(portAccessToken, formattedData);

    if (!response) {
      throw new Error("No response received from Port.io");
    }

    console.log(" Successfully updated Port.io with GitHub teams!");
    console.log("Response:", JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("❌ Error:", {
      message: error.message,
      stack: error.stack,
      details: error.response?.data
    });
    core.setFailed(error.message);
  }
})();