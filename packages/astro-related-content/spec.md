# Related Posts Plugin Specification

## Summary

This document specifies a reusable Astro integration that generates semantically related posts for Markdown and MDX content using vector embeddings.

The feature should provide a clean Astro-facing API, support local embedding generation with `transformers.js` by default, and be structured so that alternative embedding providers can be added later without redesigning the rest of the system.

This is a product and architecture specification, not an implementation guide.

## Goals

- Provide semantically related posts for one or more content sources in an Astro project.
- Keep the runtime API simple for application code.
- Remove any dependency on a vector database.
- Default to local embedding generation using `transformers.js`.
- Support incremental regeneration so unchanged content is not re-embedded.
- Be designed around an embedding-provider abstraction so future providers can be added with minimal impact.
- Work during normal Astro development and build workflows.
- Be understandable and maintainable as a small integration rather than a large subsystem.

## Non-Goals

- This feature does not need a database.
- This feature does not need server-side embedding generation at request time.
- This feature does not need to support every Astro content source shape in its first version.
- This feature does not need to embed arbitrary structured metadata beyond the chosen source text.
- This feature does not need to preserve compatibility with pre-release cache formats.

## Primary Use Case

An Astro site owner configures the plugin with one or more Markdown/MDX source directories. During `astro dev`, `astro build`, and `astro sync`, the plugin generates related-post data for each configured source. Application code imports a virtual module and asks for related posts by source name and post ID.

## User-Facing Behavior

The plugin must:

- generate related-post results for every configured source entry
- exclude the source post itself from its own related-post list
- return related posts ordered by descending semantic similarity
- limit results to a configurable maximum per post
- expose results through a stable virtual module import
- regenerate automatically during development when source files are added, changed, or removed

The plugin should produce deterministic results for unchanged content and unchanged embedding configuration.

## Supported Content Inputs

Version 1 should target file-based Markdown and MDX directories.

Each configured source must include:

- `name`: a stable logical source identifier
- `dir`: the directory to scan
- optional `include`: glob patterns controlling which files are included

Each content item must have:

- a file path that maps to a stable ID
- frontmatter with a title
- Markdown or MDX body content

The semantic embedding input should be derived from:

- the post title
- the post body converted to plain text

No other content fields are required by the core feature.

## Astro Integration Contract

The integration should be configured through a single plugin entry function:

`astroRelatedPosts(options)`

Configuration should be passed through the plugin options object only.

### Required Configuration

- `sources`

### Optional Configuration

- `rootDir`
- `codegenDir`
- `embeddings`
- `generation`

### Embedding Configuration

The embedding configuration should support:

- `model`
- `device`
- `dtype`
- `batchSize`
- `pooling`

### Generation Configuration

The generation configuration should support:

- `limit`
- `artifactDir`
- `modelCacheDir`
- `watch`

## Runtime API

The plugin must expose a virtual module:

`virtual:astro-related-content`

That virtual module must export:

- `getRelatedPosts(sourceName, id)`
- `getRelatedPostIds(sourceName, id)`

### `getRelatedPosts(sourceName, id)`

Returns an ordered array of objects with:

- `id`
- `score`

### `getRelatedPostIds(sourceName, id)`

Returns the ordered related post IDs only.

### Runtime Behavior

- Unknown source names should return an empty array.
- Unknown post IDs should return an empty array.
- The runtime API should be synchronous.
- The runtime API should not require the application to know the generated file layout.

## Generation Lifecycle

The plugin must generate related-post artifacts during:

- `astro dev`
- `astro build`
- `astro sync`

### Development Mode

In development mode, the plugin should:

- generate once on startup
- watch configured source directories
- regenerate when relevant files are added, changed, or removed
- avoid overlapping generation runs
- coalesce bursts of file events into safe follow-up generation rather than running multiple concurrent jobs

### Build and Sync Modes

In build and sync modes, the plugin should:

- generate required artifacts before application code depends on them
- make the virtual module available to TypeScript and Astro during those workflows

## Output Artifacts

The plugin should produce durable generated artifacts under an integration-owned directory in the Astro project.

At minimum, the plugin should write:

- runtime related-post data as a durable JSON artifact in the Astro project
- an internal vector cache as a durable JSON artifact in the Astro project
- any runtime wrapper artifact needed to back the virtual module

The application should consume the virtual module, not these files directly.

The default artifact directory should be `.astro-related-content/` in the project root, and it should be configurable. Projects may commit this directory so deploy builds can reuse locally generated related-content data and vectors.

## Embedding Provider Model

The system must be built around an embedding-provider abstraction.

The provider abstraction should own:

- default embedding configuration for that provider
- provider-specific cache metadata
- model cache location defaults
- embedding generation for a batch of posts

The rest of the plugin should remain provider-agnostic.

That means the following concerns should not be provider-specific:

- source scanning
- content parsing
- content hashing
- vector-cache orchestration
- ranking
- runtime artifact generation
- Astro integration wiring

## Default Provider

The default provider should use `transformers.js`.

The default provider should:

- run locally without a database
- support configurable model, device, dtype, batch size, and pooling
- support a local model cache directory
- support normalized embedding output suitable for similarity ranking

The plugin should be designed so that future providers such as Ollama or OpenAI can be added later without changing the app-facing API or the core generation flow.

## Similarity and Ranking

Related-post ranking should be based on vector similarity between normalized embeddings.

Requirements:

- use normalized embeddings
- use dot-product scoring for ranking
- return the top N related posts per source item
- exclude the source item from its own ranked results
- use deterministic tie-breaking when scores are equal

The exact ranking math should remain stable across reruns given identical inputs and identical embedding settings.

## Incremental Regeneration

The plugin must support incremental reuse of embeddings.

Requirements:

- compute a stable content hash from the exact semantic input used for embedding
- store per-post hash and embedding vector in a generator cache
- reuse an existing embedding when the content hash has not changed
- regenerate embeddings only for changed or newly added posts
- remove cache entries for deleted posts
- still rebuild the final related-post rankings from the full current embedding set

## Cache Invalidation Rules

The vector cache must be invalidated when the embedding metadata changes.

Metadata should include enough information to detect relevant changes, such as:

- provider identity
- model
- device
- dtype
- pooling
- generator version
- any other provider-specific settings that materially affect the vector output

If metadata no longer matches, the plugin should discard the cached vectors and regenerate them.

## Provider Extensibility Requirements

The provider abstraction should be strong enough that adding a new provider only requires new provider code plus configuration wiring.

A future provider should be able to define:

- how embeddings are generated
- what settings it supports
- how its metadata is represented for cache invalidation
- what defaults it wants to apply
- where provider-specific model artifacts should be cached

Adding a new provider should not require redesigning:

- the virtual module API
- the source parsing model
- the cache file ownership model
- the ranking logic
- the Astro lifecycle integration

## Error Handling

The plugin should fail clearly when:

- no sources are configured
- a post is missing required title data
- embedding generation fails
- a required embedding is missing during ranking
- batch-size configuration is invalid

Development-mode regeneration failures should be surfaced through Astro logging.

The plugin should not silently produce partial or misleading related-post data.

## TypeScript Requirements

The plugin should ship clear TypeScript types for:

- plugin options
- embedding options
- generation options
- the runtime virtual module API
- the related-post score shape

TypeScript consumers should be able to import the virtual module without relying only on transient generated types.

## Performance Requirements

The plugin should be optimized for practical local use, not theoretical maximum throughput.

Requirements:

- unchanged runs should reuse cached embeddings and avoid unnecessary embedding work
- generation should avoid overlapping runs
- batch size should be configurable
- model downloads should be cached separately from related-post data
- the runtime API should read precomputed data only and do no embedding work

## Simplicity Requirements

The design should prefer explicit, understandable behavior over clever abstractions.

That means:

- the Astro integration should be easy to trace
- the generation flow should be readable end to end
- provider-specific logic should live with the provider
- the runtime interface should be small
- artifacts should be few and purposeful

Extensibility is required, but it should not come at the cost of making the current default path difficult to understand.

## Testing Requirements

The plugin should have automated coverage for the major behaviors.

At minimum, tests should verify:

- option resolution and defaulting
- invalid batch-size rejection
- runtime data generation
- virtual-module behavior
- related-post ranking order and self-exclusion
- cache reuse on unchanged content
- cache invalidation when embedding metadata changes
- serialized generation behavior under concurrent trigger conditions

Tests should avoid requiring real model downloads or real GPU access by using test doubles for embedding generation where appropriate.

## Acceptance Criteria

The feature is complete when all of the following are true:

- an Astro project can configure the plugin for one or more Markdown/MDX sources
- the plugin generates related-post data during `astro dev`, `astro build`, and `astro sync`
- application code can import `virtual:astro-related-content`
- related posts are returned in deterministic score order
- unchanged content reuses cached embeddings
- embedding metadata changes invalidate the cache
- the design cleanly isolates provider-specific behavior behind an embedding-provider abstraction
- the default provider uses `transformers.js`
- the runtime path requires no database and no request-time embedding work

## Future Evolution

This design should make the following future enhancements straightforward:

- additional embedding providers
- additional source adapters beyond file-based Markdown/MDX
- configurable embedding-input composition
- optional provider-specific advanced settings
- more plugin-level integration tests using Astro fixtures

Those future enhancements should not require changing the current user-facing runtime API.
