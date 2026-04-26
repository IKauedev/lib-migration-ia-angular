/**
 * GitLab REST API client.
 */

import fetch from "node-fetch";

export class GitLabClient {
    constructor(token, baseUrl = "https://gitlab.com") {
        this.token = token;
        this.base = `${baseUrl}/api/v4`;
    }

    headers() {
        return { "PRIVATE-TOKEN": this.token };
    }

    encodeId(projectPath) {
        return encodeURIComponent(projectPath);
    }

    async getProject(projectPath) {
        const res = await fetch(
            `${this.base}/projects/${this.encodeId(projectPath)}`, { headers: this.headers() },
        );
        if (!res.ok)
            throw new Error(
                `GitLab: projeto não encontrado (${res.status}) — verifique o path e token`,
            );
        return res.json();
    }

    async getDefaultBranch(projectPath) {
        const data = await this.getProject(projectPath);
        return data.default_branch;
    }

    async listFiles(projectPath, branch) {
        const allFiles = [];
        let page = 1;
        while (true) {
            const url =
                `${this.base}/projects/${this.encodeId(projectPath)}/repository/tree` +
                `?recursive=true&ref=${branch}&per_page=100&page=${page}`;
            const res = await fetch(url, { headers: this.headers() });
            if (!res.ok) break;
            const data = await res.json();
            if (!data.length) break;
            allFiles.push(...data.filter((f) => f.type === "blob"));
            page++;
        }
        return allFiles.map((f) => ({ path: f.path }));
    }

    async getFileContent(projectPath, filePath, branch) {
        const url =
            `${this.base}/projects/${this.encodeId(projectPath)}/repository/files` +
            `/${encodeURIComponent(filePath)}/raw?ref=${branch}`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok) return null;
        return res.text();
    }

    async createBranch(projectPath, newBranch, fromBranch) {
        const res = await fetch(
            `${this.base}/projects/${this.encodeId(projectPath)}/repository/branches`, {
                method: "POST",
                headers: {...this.headers(), "Content-Type": "application/json" },
                body: JSON.stringify({ branch: newBranch, ref: fromBranch }),
            },
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`GitLab: erro ao criar branch: ${err.message}`);
        }
        return res.json();
    }

    async createOrUpdateFile(projectPath, filePath, content, message, branch) {
        const encoded = encodeURIComponent(filePath);
        const checkRes = await fetch(
            `${this.base}/projects/${this.encodeId(projectPath)}/repository/files/${encoded}?ref=${branch}`, { headers: this.headers() },
        );
        const method = checkRes.ok ? "PUT" : "POST";

        const res = await fetch(
            `${this.base}/projects/${this.encodeId(projectPath)}/repository/files/${encoded}`, {
                method,
                headers: {...this.headers(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    branch,
                    content: Buffer.from(content).toString("base64"),
                    encoding: "base64",
                    commit_message: message,
                }),
            },
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`GitLab: erro ao enviar ${filePath}: ${err.message}`);
        }
        return res.json();
    }

    async createMergeRequest(
        projectPath,
        sourceBranch,
        targetBranch,
        title,
        description,
    ) {
        const res = await fetch(
            `${this.base}/projects/${this.encodeId(projectPath)}/merge_requests`, {
                method: "POST",
                headers: {...this.headers(), "Content-Type": "application/json" },
                body: JSON.stringify({
                    source_branch: sourceBranch,
                    target_branch: targetBranch,
                    title,
                    description,
                }),
            },
        );
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`GitLab: erro ao criar MR: ${err.message}`);
        }
        return res.json();
    }
}