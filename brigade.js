const { Job } = require('@brigadecore/brigadier');
const devops = require('devops-brigade');

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

  /**
   * Run tests
   * @param {string} teamEnv - teamEnv in which tests should be run
   * @param {object} e - brigade event object
   * @param {object} project - brigade project object
   * @param {object} options - additional options to control the tests
   * @param {string} options.runTests - should be true for running tests
   * @param {string} options.testType - the test type(eg 'sanity'/'full')
   * @param {boolean} options.waitForJob - true, in case pipeline should wait for tests to finish
   * @param {boolean} options.debug - true, to enable debugging
   * @param {object} options.envVars - the environment variables to pass to test container
   * @param {string} options.testRepository - the test container image repository
   * @param {string} options.imageTag - the test container image tag
   */

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

  /**
   * Run tests
   * @param {string} teamEnv - teamEnv in which tests should be run
   * @param {object} e - brigade event object
   * @param {object} project - brigade project object
   * @param {object} options - additional options to control the tests
   * @param {string} options.runTests - should be true for running tests
   * @param {string} options.testType - the test type(eg 'sanity'/'full')
   * @param {boolean} options.waitForJob - true, in case pipeline should wait for tests to finish
   * @param {boolean} options.debug - true, to enable debugging
   * @param {object} options.envVars - the environment variables to pass to test container
   * @param {string} options.testRepository - the test container image repository
   * @param {string} options.imageTag - the test container image tag
   */

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

  async deployAsync(teamEnv, e, project) {
    const coreEnv = devops.Utilities.getCoreEnvFromTeamEnv(teamEnv);
    let values = {
      envs: {
        node_env: 'dev',
        graphql_api_url:
          coreEnv === 'prod'
            ? `https://aorondemand-gateway.creative.dentsu.app/backend`
            : `https://aorondemand-gateway.${coreEnv}.creative.dentsu.app/backend`,
        graphql_websocket_url:
          coreEnv === 'prod'
            ? `wss://aorondemand-gateway.creative.dentsu.app/backend/subscriptions`
            : `wss://aorondemand-gateway.${coreEnv}.creative.dentsu.app/backend/subscriptions`,
        file_upload_max_size: 26214400,
        file_types:
          'zip|webm|docx|pdf|doc|docm|png|jpg|jpeg|mp4|xls|ppt|psd|indd|tif|pptx|csv|html|txt|xlsx|rar|7zip',
        port: 80,
        core_env: coreEnv,
        issuer: project.secrets[`${teamEnv}_app_issuer`],
        client_id: project.secrets[`${teamEnv}_client_id`],
        okta_enable: project.secrets[`${teamEnv}_okta_enable`],
        assets_url: project.secrets[`${teamEnv}_assets_url`],
        file_upload_min_size:
          project.secrets[`${teamEnv}_file_upload_min_size`],
        maintenance_enable: project.secrets[`${teamEnv}_maintenance_enable`],
        cl_app_url: project.secrets[`${teamEnv}_cl_app_url`],
      },
      virtual_service: {
        host: `${coreEnv}.creative.dentsu.app`,
        original_host: `dentsuondemand.${coreEnv}.creative.dentsu.app`,
      },
      port: 80,
      image: {
        tag: '${APP_VER}',
        repository: `${
          project.secrets.app_container_reg
        }/${devops.Utilities.getAppName()}`,
      },
    };

    if (coreEnv === 'prod') {
      values.virtual_service.host = `creative.dentsu.app`;
      values.virtual_service.original_host = `dentsuondemand.creative.dentsu.app`;
    }

    return await devops.Standard.helmDeployAsync(teamEnv, {
      values: values,
      useHelm3: true,
    });
  }

  async onPushDevelop(e, project) {
    await this.buildAsync(e, project);
    await devops.JSStages.staticAnalysisAsync({
      testInclusions: ['**/*.test.js'],
      testExclusions: ['src/coverage/*'],
      componentTestEnabled: false,
      unitTestEnabled: false,
    });
    await devops.Standard.submitToIqServerAsync({ debug: false });
    await devops.Standard.packageAsync();
    await this.deployAsync(`${project.secrets.team_name}-int`, e, project);

    // TODO: customise the polling URL to match your endpoint,
    // remember svc.cluster.local addresses only allowed for envs on same cluster as CI
    // await devops.Standard.pollHealthAsync(`https://[yourteamenv]-[appname].az.[yourbase].gdpdentsu.net/api/health`);
    // TODO: Add component tests against the dev environment here
    await devops.Standard.approveAsync();
    await this.deployAsync(`${project.secrets.team_name}-int`, e, project);
    // TODO: deploy to further environments such as "int" and run integration tests.

    await this.runTests(`${project.secrets.team_name}-int`, e, project, {
      runTests: true,
      testType: 'full',
      waitForJob: false,
      imageRepository: 'gdoci02p7rg.azurecr.io/aor-on-demand-qa',
      imageTag: 'latest',
    });

    // const semver = await devops.Utilities.getSemVerAsync();
    // await devops.Utilities.notifyInfoAsync(`Deployment to test complete`, `Deployed version ${semver}`);
  }

  async onPushOther(e, project, branch) {
    await this.buildAsync(e, project);
  }

  async onDeploy(e, project, teamEnv, version) {
    const coreEnv = devops.Utilities.getCoreEnvFromTeamEnv(teamEnv);
    await this.deployAsync(teamEnv, e, project);
    //    await devops.Utilities.notifyInfoAsync(
    //    `Deployment`,
    //      `Deployment to ${teamEnv} of ${version} complete`,
    //    );
    await this.runTests(`${project.secrets.team_name}-${coreEnv}`, e, project, {
      runTests: true,
      testType: 'full',
      waitForJob: false,
      imageRepository: 'gdoci02p7rg.azurecr.io/aor-on-demand-qa',
      imageTag: 'latest',
    });
  }

  async onPushHotfix(e, project, branch) {
    await this.buildAsync(e, project, branch);
    await devops.Standard.packageAsync();
    const teamEnv = `${project.secrets.team_name}-nft`;
    await devops.Standard.approveAsync();
    await this.deployAsync(teamEnv, e, project);
    await this.runTests(`${project.secrets.team_name}-nft`, e, project, {
      runTests: true,
      testType: 'full',
      waitForJob: false,
      imageRepository: 'gdoci02p7rg.azurecr.io/aor-on-demand-qa',
      imageTag: 'latest',
    });
  }
}
// TODO: notification via teams on error - remove if not using teams

// devops.Events.enableNotifyOnError();
devops.Events.register(new Pipeline());

exports.Pipeline = Pipeline;
