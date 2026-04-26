/**
 * GitHub REST API client.
 */

import fetch from "node-fetch";

export class GitHubClient {
    constructor(token) {
        this.token = token;
        this.base = "https://api.github.com";
    }

    headers() {
        return {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        };
    }

    async getRepo(owner, repo) {
        const res = await fetch(`${this.base}/repos/${owner}/${repo}`, {
            headers: this.headers(),
        });
        if (!res.ok)
            throw new Error(
                `GitHub: repo não encontrado (${res.status}) — verifique owner/repo e token`,
            );
        return res.json();
    }

    async getDefaultBranch(owner, repo) {
        const data = await this.getRepo(owner, repo);
        return data.default_branch;
    }

    async listFiles(owner, repo, branch, filePath = "") {
        const url = `${this.base}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok)
            throw new Error(`GitHub: erro ao listar arquivos (${res.status})`);
        const data = await res.json();
        return (data.tree || []).filter((f) => f.type === "blob");
    }

    async getFileContent(owner, repo, filePath, branch) {
        const url = `${this.base}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.content) return null;
        return Buffer.from(data.content, "base64").toString("utf-8");
    }

    async createBranch(owner, repo, newBranch, fromBranch) {
        const refRes = await fetch(
            `${this.base}/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`, { headers: this.headers() },
        );
        const refData = await refRes.json();
        const sha = refData.object && refData.object.sha;
        if (!sha) throw new Error("Não foi possível obter SHA da branch base");

        const res = await fetch(`${this.base}/repos/${owner}/${repo}/git/refs`, {
            method: "POST",
            headers: {...this.headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`GitHub: erro ao criar branch: ${err.message}`);
        }
        return res.json();
    }

    async createOrUpdateFile(
        owner,
        repo,
        filePath,
        content,
        message,
        branch,
        existingSha = null,
    ) {
        const url = `${this.base}/repos/${owner}/${repo}/contents/${filePath}`;
        const body = {
            message,
            content: Buffer.from(content).toString("base64"),
            branch,
        };
        if (existingSha) body.sha = existingSha;

        const res = await fetch(url, {
            method: "PUT",
            headers: {...this.headers(), "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(
                `GitHub: erro ao enviar arquivo ${filePath}: ${err.message}`,
            );
        }
        return res.json();
    }

    async getFileSha(owner, repo, filePath, branch) {
        const url = `${this.base}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok) return null;
        const data = await res.json();
        return data.sha || null;
    }

    async createPullRequest(owner, repo, head, base, title, body) {
        const res = await fetch(`${this.base}/repos/${owner}/${repo}/pulls`, {
            method: "POST",
            headers: {...this.headers(), "Content-Type": "application/json" },
            body: JSON.stringify({ title, body, head, base }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`GitHub: erro ao criar PR: ${err.message}`);
        }
        return res.json();
    }
}