# The web UI: Next.js in front, the Python pipeline behind it in the same image.
# Build from the repository root: docker compose build web

FROM node:22-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.13-slim AS python
ENV PYTHONDONTWRITEBYTECODE=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
WORKDIR /build
COPY . .
RUN pip install --no-cache-dir .

FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TRADINGAGENTS_IN_DOCKER=1 \
    PATH="/opt/venv/bin:$PATH" \
    PYTHON=python \
    NODE_ENV=production
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=python /opt/venv /opt/venv
# Time-zone data, so TZ sets the clock scheduled jobs run by.
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home appuser \
 && install -d -m 0755 -o appuser -g appuser /home/appuser/.tradingagents
USER appuser

# The bridge runs `python -m cli.web_bridge` from the folder above web/.
WORKDIR /home/appuser/app
COPY --from=python --chown=appuser:appuser /build .
COPY --from=web --chown=appuser:appuser /web/.next ./web/.next
COPY --from=web --chown=appuser:appuser /web/node_modules ./web/node_modules
COPY --from=web --chown=appuser:appuser /web/package.json ./web/package.json

WORKDIR /home/appuser/app/web
EXPOSE 3210
# Inside the container it listens on every interface; compose publishes it on 127.0.0.1 only.
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3210"]
