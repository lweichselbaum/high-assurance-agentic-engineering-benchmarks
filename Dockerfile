# Reproducible environment for the benchmark. Node from .nvmrc, pnpm from package.json, Playwright's Chromium,
# asciinema for the terminal recordings, and the Claude Code CLI as one of the agent products used (the other,
# Google Antigravity, is driven through tools/run-external.sh from wherever it is installed).
FROM node:22.22.2-bookworm

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate \
 && apt-get update && apt-get install -y --no-install-recommends python3-pip \
 && pip3 install --break-system-packages asciinema==2.4.0 \
 && npm install -g @anthropic-ai/claude-code@2.1.259 \
 && npx --yes playwright@1.56.1 install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /work
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY arm-a-vibe/package.json arm-a-vibe/
COPY arm-b-harness/package.json arm-b-harness/
RUN pnpm install --frozen-lockfile
COPY . .
# The Claude Code CLI needs credentials at run time (mount ~/.claude or set ANTHROPIC_API_KEY); other agents bring their own.
CMD ["bash", "-lc", "pnpm bench:a && pnpm bench:b && pnpm results"]
