const { Job } = require('@brigadecore/brigadier');
// TODO: The notifyInfoAsync method requires a Microsoft Teams webhook.
// https://confluence-engineering.dentsuaegis.com/display/GD/Send+notifications+to+Teams+channel
// or comment them out until ready
class Pipeline {
  async buildAsync(e, project, branch, prefix) {
    // TODO: If not "node", specify alternative docker container for your build
    // Ensure version matches your Dockerfile.pipeline otherwise npm install may not be download
    // compatible dependencies.
    var build = new Job('build', 'node');
    build.storage.enabled = true;

    let taskFactory = new devops.BuildTaskFactory(e, project, branch, prefix);
    build.tasks = [
      'cd /src',

      taskFactory.gitVersion(),

      // TODO: Remove npmVersion if NOT a node project.
      taskFactory.npmVersion(),
      'set -x',
      // Build
      'npm install -g husky --legacy-peer-deps',
      'npm install --legacy-peer-deps',
      'npm install husky',
      // TODO: Run lint etc. as required
      'npm run lint',
      'npm run test:c',
      'npm run build:prod',
        taskFactory.storeBuild(),
    ];
    return build.run();
  }
async runTests(teamEnv, e, project, options) {
    const coreEnv = devops.Utilities.getCoreEnvFromTeamEnv(teamEnv);
    const testManager = new devops.TestManager(
      teamEnv,
      e,
      project,
      coreEnv,
      project.secrets[teamEnv + '_storageAcc'],
      `${teamEnv}-bdd-results`,
      {
        imageRepository: options.imageRepository,
        imageTag: options.imageTag,
        appSuffix: '',
        reportPortalEnabled: false,
        createUrlFn: (testType, envSuffix) =>
          `https://test-results.${coreEnv}.aorondemand.dentsu.app/${teamEnv}-bdd-results/${envSuffix}/${devops.Utilities.getAppName()}/${testType}/report/index.html`,
      },
    );
    let triggerTestOptions = {
      runTests: true,
      testType: options.testType,
      waitForJob: options.waitForJob,
      debug: options.debug,
        envVars: options.envVars,
    };
    await testManager.triggerTestJobAsync(triggerTestOptions);
  }
