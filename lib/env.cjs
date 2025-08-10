function assertEnv(vars) {
  const missing = vars.filter(v => !process.env[v]);
  if (missing.length) {
    throw new Error('Missing required environment variables: ' + missing.join(', '));
  }
}

module.exports = { assertEnv };
