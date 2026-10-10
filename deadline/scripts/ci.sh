#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
sh -n scripts/remote-deploy.sh
npm run lint --prefix backend
npm run format:check --prefix backend
npm test --prefix backend
npm run build --prefix backend
npm audit --audit-level=high --prefix backend
npm run lint --prefix frontend
npm run format:check --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
npm audit --audit-level=high --prefix frontend
