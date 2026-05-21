# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1](https://github.com/philnash/astro-components/compare/17b101c93d4dc51037beb389b032449502039f7f...39e8af3359e57d25574dcb392ebea591b8877ee7) - 2026-05-21

### Fixed

- Injects TypeScript declarations for `virtual:astro-related-content` into consuming Astro apps so `astro check` and editors can resolve the virtual module.
- Uses a checked-in `virtual-module.d.ts` file as the single source for the package and injected virtual module types.

## [0.1.0](https://github.com/philnash/astro-components/tree/17b101c93d4dc51037beb389b032449502039f7f/packages/astro-related-content) - 2026-05-04

### Added

- First release of the Astro related content integration.
- Adds collection-based related content generation for Astro content collections.
- Adds the `virtual:astro-related-content` runtime API with `getRelatedContent`, `getRelatedContentIds`, and `getRelatedContentMatches`.
- Adds the default Transformers.js embedding provider with durable vector caching.
- Adds custom embedding provider support and a deterministic fixture provider for tests and demos.
