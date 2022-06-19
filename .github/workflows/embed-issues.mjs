/** This scripts searches for an issue query in a markdown file and
    embeds the resulting list of issues. */

import { readFile, writeFile } from "fs/promises";
import path from "path";
import { Octokit } from "@octokit/core";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const embedWithRepoIssuesUrl = /^<!-- embed-issues (?<repo>[^ ]+) -->/;

const isEmbedStart = (line) => embedWithRepoIssuesUrl.test(line);
const isEmbedEnd = (line) => /^<!-- embed-issues-end -->/.test(line);

const source = await readFile(
  path.join(process.cwd(), process.argv[process.argv.length - 1]),
  "utf-8"
);

const result = [];

let isEmbedContent = false;
for (const line of source.split("\n")) {
  if (isEmbedStart(line)) {
    isEmbedContent = true;
    result.push(line);
    const matches = embedWithRepoIssuesUrl.exec(line);
    const repos = matches[1].split(",");

    const issues = [];

    for (const repo of repos) {
      const res = await octokit.request(
        `GET /repos/distributeaid/${repo}/issues`,
        {
          labels: "good first issue",
          state: "open",
          sort: "created",
          direction: "desc",
        }
      );
      console.debug(`Found ${(res?.data ?? []).length} issues in ${repo}`);
      issues.push(...(res?.data ?? []));
    }
    if (issues.length === 0) {
      result.push(
        `*There are currently no **good first issues** in the ${repos
          .map(
            (repo) =>
              `[${repo}](https://github.com/distributeaid/${repo}/issues?q=is%3Aissue+label%3A%22good+first+issue%22+is%3Aopen)`
          )
          .join(", or ")} project.*`
      );
    }
    for (const { number, title, html_url } of issues.sort(
      ({ created_at: c1 }, { created_at: c2 }) => c2.localeCompare(c1)
    )) {
      result.push(`- [#${number} ${title}](${html_url})`);
    }
  }
  if (isEmbedEnd(line)) {
    isEmbedContent = false;
  }
  if (!isEmbedContent) result.push(line);
}

await writeFile(
  path.join(process.cwd(), process.argv[process.argv.length - 1]),
  result.join("\n"),
  "utf-8"
);
