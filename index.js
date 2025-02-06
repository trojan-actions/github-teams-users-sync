const core = require('@actions/core');

async function run() {
  try {
    core.info('Hello, world!');
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();