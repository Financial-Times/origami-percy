const core = require("@actions/core");
const exec = require("@actions/exec");
const io = require("@actions/io");
const fs = require("fs");
const { context, GitHub } = require("@actions/github");

(async () => {
  try {
    const isPullRequestLabelledWithPercy =
      context.payload.pull_request &&
      context.payload.pull_request.labels
        .map((label) => label.name)
        .includes("percy");

    const isMasterBranch = context.ref.endsWith("/master");
    if (isMasterBranch || isPullRequestLabelledWithPercy) {
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

      let npxPath = await io.which("npx", true);
      await exec.exec(`"${npxPath}" origami-build-tools install`, [], {
        cwd: "./",
      });
      if (componentConfig.brands) {
        for (const brand of componentConfig.brands) {
          await generateDemosFor(brand);
        }
      } else {
        await generateDemosFor("master");
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
    core.setFailed(error.message);
  }
})();

async function generateDemosFor(brand) {
  let npxPath = await io.which("npx", true);
  let outputDir = `demos/percy/${brand}`;
  await exec.exec(
    `"${npxPath}" origami-build-tools demo --brand=${brand}`,
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
