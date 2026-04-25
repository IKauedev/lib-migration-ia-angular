import fetch from 'node-fetch';

// ─── GitHub ───────────────────────────────────────────────────────────────────

export class GitHubClient {
  constructor(token) {
    this.token = token;
    this.base = 'https://api.github.com';
  }

  headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async getRepo(owner, repo) {
    const res = await fetch(`${this.base}/repos/${owner}/${repo}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub: repo não encontrado (${res.status}) — verifique owner/repo e token`);
    return res.json();
  }

  async getDefaultBranch(owner, repo) {
    const data = await this.getRepo(owner, repo);
    return data.default_branch;
  }

  async listFiles(owner, repo, branch, path = '') {
    const url = `${this.base}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub: erro ao listar arquivos (${res.status})`);
    const data = await res.json();
    return (data.tree || []).filter(f => f.type === 'blob');
  }

  async getFileContent(owner, repo, filePath, branch) {
    const url = `${this.base}/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.content) return null;
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async createBranch(owner, repo, newBranch, fromBranch) {
    // Get SHA of source branch
    const refRes = await fetch(`${this.base}/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`, {
      headers: this.headers(),
    });
    const refData = await refRes.json();
    const sha = refData.object?.sha;
    if (!sha) throw new Error('Não foi possível obter SHA da branch base');

    const res = await fetch(`${this.base}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub: erro ao criar branch: ${err.message}`);
    }
    return res.json();
  }

  async createOrUpdateFile(owner, repo, filePath, content, message, branch, existingSha = null) {
    const url = `${this.base}/repos/${owner}/${repo}/contents/${filePath}`;
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      branch,
    };
    if (existingSha) body.sha = existingSha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub: erro ao enviar arquivo ${filePath}: ${err.message}`);
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
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, head, base }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitHub: erro ao criar PR: ${err.message}`);
    }
    return res.json();
  }
}

// ─── GitLab ───────────────────────────────────────────────────────────────────

export class GitLabClient {
  constructor(token, baseUrl = 'https://gitlab.com') {
    this.token = token;
    this.base = `${baseUrl}/api/v4`;
  }

  headers() {
    return { 'PRIVATE-TOKEN': this.token };
  }

  encodeId(projectPath) {
    return encodeURIComponent(projectPath);
  }

  async getProject(projectPath) {
    const res = await fetch(`${this.base}/projects/${this.encodeId(projectPath)}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`GitLab: projeto não encontrado (${res.status}) — verifique o path e token`);
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
      const url = `${this.base}/projects/${this.encodeId(projectPath)}/repository/tree?recursive=true&ref=${branch}&per_page=100&page=${page}`;
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) break;
      const data = await res.json();
      if (!data.length) break;
      allFiles.push(...data.filter(f => f.type === 'blob'));
      page++;
    }
    return allFiles.map(f => ({ path: f.path }));
  }

  async getFileContent(projectPath, filePath, branch) {
    const url = `${this.base}/projects/${this.encodeId(projectPath)}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${branch}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) return null;
    return res.text();
  }

  async createBranch(projectPath, newBranch, fromBranch) {
    const res = await fetch(`${this.base}/projects/${this.encodeId(projectPath)}/repository/branches`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: newBranch, ref: fromBranch }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitLab: erro ao criar branch: ${err.message}`);
    }
    return res.json();
  }

  async createOrUpdateFile(projectPath, filePath, content, message, branch) {
    const encoded = encodeURIComponent(filePath);
    // Check if exists
    const checkRes = await fetch(
      `${this.base}/projects/${this.encodeId(projectPath)}/repository/files/${encoded}?ref=${branch}`,
      { headers: this.headers() }
    );
    const method = checkRes.ok ? 'PUT' : 'POST';

    const res = await fetch(
      `${this.base}/projects/${this.encodeId(projectPath)}/repository/files/${encoded}`,
      {
        method,
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch, content: Buffer.from(content).toString('base64'), encoding: 'base64', commit_message: message }),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitLab: erro ao enviar ${filePath}: ${err.message}`);
    }
    return res.json();
  }

  async createMergeRequest(projectPath, sourceBranch, targetBranch, title, description) {
    const res = await fetch(`${this.base}/projects/${this.encodeId(projectPath)}/merge_requests`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_branch: sourceBranch, target_branch: targetBranch, title, description }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`GitLab: erro ao criar MR: ${err.message}`);
    }
    return res.json();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function parseRepoArg(repo) {
  // Formats: owner/repo  |  https://github.com/owner/repo  |  https://gitlab.com/group/project
  const urlMatch = repo.match(/(?:github\.com|gitlab[^/]*)\/(.+)/);
  if (urlMatch) return urlMatch[1].replace(/\.git$/, '');
  return repo.replace(/\.git$/, '');
}

export function detectProvider(repo, opts) {
  if (opts.githubToken || process.env.GITHUB_TOKEN) return 'github';
  if (opts.gitlabToken || process.env.GITLAB_TOKEN) return 'gitlab';
  if (repo.includes('gitlab')) return 'gitlab';
  return 'github'; // default
}
