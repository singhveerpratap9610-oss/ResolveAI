---
name: IncidAI classifier asset packaging
description: Keep the processed historical ticket corpus available to the API in development and production builds.
---

The historical corpus is a runtime dependency of the API, not only a development reference. Keep it packaged with the API distribution and check classifier readiness after a fresh build.

**Why:** The API development workflow starts from its package directory, while the production runner may start from the project root. Resolving the corpus only from the current working directory caused the classifier to start unavailable.

**How to apply:** When changing service layout or build/run commands, preserve the packaged corpus and verify `/api/healthz` reports the classifier as ready.
