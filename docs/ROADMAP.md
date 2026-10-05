# Quizlab Reader Roadmap

> This is a maintainer-level list of areas of active work, not a dated release
> plan. The authoritative version is `package.json`
> ([releases](https://github.com/ozymandias-get/quizlab/releases)).

## Vision

A local-first desktop workspace that pairs deep PDF reading with embedded AI web
sessions, in-page automation, and clear privacy boundaries.

## Near-Term Focus

| Area                                                                               | Priority |
| ---------------------------------------------------------------------------------- | -------- |
| PDF reading quality — rendering, navigation, selection, text extraction            | High     |
| AI workspace reliability — managed-view lifecycle, session health, selector repair | High     |
| Settings and onboarding — clearer defaults, safer Google web-session flows         | Medium   |
| Documentation and tests kept aligned with the shipped feature set                  | Medium   |

## Medium-Term Ideas

- Richer PDF annotation workflows (persistent highlights, notes)
- Export paths for study notes and session results
- Broader localization and accessibility work

Deliberately out of scope: a cloud backend, and a default PDF file association
on Windows (the app adds a right-click entry only).

## How to Contribute

- [GitHub Issues](https://github.com/ozymandias-get/quizlab/issues)
- [GitHub Discussions](https://github.com/ozymandias-get/quizlab/discussions)

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the development workflow and
[ARCHITECTURE.md](ARCHITECTURE.md) for the boundaries changes must respect.
