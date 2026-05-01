export { GitHubClient }
from "./github.js";
export { GitLabClient }
from "./gitlab.js";

 
export function parseRepoArg(repo) {
    const urlMatch = repo.match(/(?:github\.com|gitlab[^/]*)\/(.+)/);
    if (urlMatch) return urlMatch[1].replace(/\.git$/, "");
    return repo.replace(/\.git$/, "");
}

 
export function detectProvider(repo, opts) {
    if (opts.githubToken || process.env.GITHUB_TOKEN) return "github";
    if (opts.gitlabToken || process.env.GITLAB_TOKEN) return "gitlab";
    if (repo.includes("gitlab")) return "gitlab";
    return "github";
}
