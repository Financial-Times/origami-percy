const core = require("@actions/core");
const exec = require("@actions/exec");
const io = require("@actions/io");
const fs = require("fs");
const { context, GitHub } = require("@actions/github");

(async () => {
  const isPullRequestLabelledWithPercy =
      context.payload.pull_request &&
      context.payload.pull_request.labels
        .map((label) => label.name)
        .includes("percy");
  try {
    const isDefaultBranch = context.ref.endsWith("/master") ||
      context.ref.endsWith("/main");
    if (isDefaultBranch || isPullRequestLabelledWithPercy) {
      if (isPullRequestLabelledWithPercy) {
        core.exportVariable(
          "PERCY_PULL_REQUEST",
          String(context.payload.pull_request.number)
        );
        core.exportVariable("PERCY_BRANCH", context.ref);
      }

      const componentConfig = JSON.parse(
        fs.readFileSync("./origami.json", "utf-8")
      );
      const demosConfig = componentConfig.demos || [];

      let npxPath = await io.which("npx", true);
      await exec.exec(`"${npxPath}" origami-build-tools@^10 install`, [], {
        cwd: "./",
      });
      if (componentConfig.brands) {
        for (const brand of componentConfig.brands) {
          await generateDemosFor(brand, demosConfig);
        }
      } else {
        await generateDemosFor("master", demosConfig);
      }

      await generatePercySnapshots();

      if (isPullRequestLabelledWithPercy) {
        const token = core.getInput("github-token", { required: true });
        const github = new GitHub(token);
        await github.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: "👋 Percy has finished running the visual regression testing!",
        });

        await github.issues.removeLabels({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          labels: ["percy"],
        });
      }
    }
  } catch (error) {
    if (isPullRequestLabelledWithPercy) {
      const token = core.getInput("github-token", { required: true });
      const github = new GitHub(token);
      await github.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: "👋 Percy failed to run!\n\n Here is the error message:\n\n>"+error.message,
      });
    }
    core.setFailed(error.message);
  }
})();

async function generateDemosFor(brand, demosConfig) {
  let npxPath = await io.which("npx", true);
  let outputDir = `demos/percy/${brand}`;
  const brandSupportedDemos = demosConfig.filter(
    d => !Array.isArray(d.brands) || d.brands.includes(brand)
  );
  const demoNames = brandSupportedDemos.map(d => d.name).join(',');
  await exec.exec(
    `"${npxPath}" origami-build-tools@^10 demo --brand=${brand} --demo-filter="${demoNames}"`,
    [],
    { cwd: "./" }
  );
  await io.mkdirP(outputDir);
  await io.mv("demos/local", outputDir);
}

async function generatePercySnapshots() {
  let npxPath = await io.which("npx", true);
  let outputDir = "demos/percy/";
  await exec.exec(`"${npxPath}" percy snapshot ${outputDir}`, [], {
    cwd: "./",
  });
}
