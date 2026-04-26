/**
 * Git provider factory and repo argument parsing.
 * Detects whether a repo URL/path targets GitHub or GitLab.
 */

export { GitHubClient }
from "./github.js";
export { GitLabClient }
from "./gitlab.js";

/**
 * Normalises a repo argument to "owner/repo" form.
 * Handles full HTTPS URLs and short "owner/repo" strings.
 * @param {string} repo
 * @returns {string}
 */
export function parseRepoArg(repo) {
    const urlMatch = repo.match(/(?:github\.com|gitlab[^/]*)\/(.+)/);
    if (urlMatch) return urlMatch[1].replace(/\.git$/, "");
    return repo.replace(/\.git$/, "");
}

/**
 * Detects which Git provider to use based on tokens/URL.
 * @param {string} repo
 * @param {{ githubToken?: string, gitlabToken?: string }} opts
 * @returns {"github"|"gitlab"}
 */
export function detectProvider(repo, opts) {
    if (opts.githubToken || process.env.GITHUB_TOKEN) return "github";
    if (opts.gitlabToken || process.env.GITLAB_TOKEN) return "gitlab";
    if (repo.includes("gitlab")) return "gitlab";
    return "github";
}