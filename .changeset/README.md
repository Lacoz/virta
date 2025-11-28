# Changesets

This directory stores the release management configuration for the monorepo. We use [Changesets](https://github.com/changesets/changesets) to coordinate version bumps and changelogs across packages.

### Authoring a changeset
- Run `pnpm changeset` from the repo root.
- Choose the packages that changed and select an appropriate bump type.
- Commit the generated markdown file under `.changeset/` along with your code changes.

### Versioning and publishing
- Run `pnpm version:packages` to apply pending changesets and update package versions.
- Run `pnpm release` to publish updated packages (after building and testing).
