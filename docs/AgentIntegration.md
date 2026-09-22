# Agent integration

The repository exposes a stateless MCP Streamable HTTP endpoint at `POST /mcp`.
It uses the official Model Context Protocol TypeScript SDK inside the existing
Nuxt/Nitro server, so it shares the application's port and deployment. The
adapter translates campaign tools into the HTTP API; campaign permissions,
resource permissions, campaign scoping, validation, DM-only visibility, and
audit behavior remain owned by the API.

## Configuration

Open **Settings → API keys** (`/settings/api-keys`) to create a key. Choose its
campaigns, resource read/write permissions, and optional expiration, then copy
the secret shown once. For a campaign assistant, grant only the content read
and write permissions it needs. Keys cannot manage account settings,
memberships, other keys, or generation jobs. Revoke a key from the same page
when it is no longer needed. Existing installations must apply the API-key
database migration with `yarn db:migrate:deploy` before using this page.

Configure the MCP client with the application URL and the scoped secret. The
client sends the secret as `Authorization: Bearer <key>` on every MCP request;
the key is never a tool argument. No separate MCP process, port, environment
secret, or stdio command is required.

```text
Endpoint: https://vault.example.com/mcp
Authorization: Bearer dnd_live_replace_with_a_scoped_key
Content-Type: application/json
Accept: application/json, text/event-stream
```

The endpoint accepts server-to-server requests without an `Origin` header. If a
browser sends `Origin`, it must exactly match the configured public application
URL (`NUXT_PUBLIC_APP_URL`, for example `https://vault.example.com`). The existing
Docker port and reverse proxy serve `/mcp`; no additional container is needed.
Cookie authentication is not accepted by this endpoint. Invalid or
revoked bearer keys are rejected before MCP initialization and tool discovery.

## Tools

Tools are intentionally resource-specific: campaigns, characters, glossary,
quests, sessions, session summaries, transcripts, and encounters (including
combatants, conditions, initiative, events, summaries, and turns). Each tool
description states the API permission it needs. There is no arbitrary URL or
database tool, and AI generation or transcription jobs are not exposed.

Start with `campaigns_list` to discover the campaigns permitted by the key.

`dice_roll` uses the same dice calculation utility as the browser roller. Pass
`notation` such as `d20`, `2d6+3`, or `2d6+3-d4` (up to 200 characters,
1–100 dice per term, 2–1000 sides). It returns individual rolls, signed term
subtotals, and the total. Agents should prefer this tool for rolls instead of
inventing results or generating their own random numbers. The optional `mode`
accepts `normal` (default), `advantage`, or `disadvantage`. Advantage and
disadvantage require a single d20 with an optional integer modifier, such as
`d20+5`. Both dice are returned in `rolls`, alongside `selectedRoll`, `modifier`,
`total`, `notation`, and `mode`; the modifier is applied once. Normal mode
preserves the expression's `terms` and subtotals and also returns `mode`.
Rolls are not saved and do not update encounters. The tool requires a
valid API key but no campaign resource permission.

`transcript_read` reads lines with `startLine` and `limit`, or searches with
`q`, `contextLines`, `offset`, and `limit`. Line numbers are 1-based. An omitted
`versionId` always resolves to the latest transcript version; responses include
the resolved version and total line count. Search results are merged passages
and include matching line numbers, `totalMatches`, `totalResults`, and
`hasMore`.

`transcript_update` edits the `documentId` returned by `transcript_read`, while
`session_summary_update` edits the document ID returned by the session document
endpoint. They accept bounded `content` and an optional `format`; the API
verifies document ownership and the corresponding `transcripts.write` or
`summaries.write` permission.

`dndcampaign://openapi` is an MCP resource containing the current API contract.
`openapi_get` returns contract metadata by default or one selected path/schema,
which is useful when a client prefers tools over resources.

All API errors are returned as MCP tool errors with the API status, stable error
code, message, and validation fields when present. REST responses are returned
complete; transcript search and line reads use their explicit pagination
parameters for large content.

## API contract

The canonical HTTP API contract is [`public/openapi.json`](../public/openapi.json).
Bearer authentication uses `Authorization: Bearer <key>` and is available on
the supported API operations alongside existing session-cookie authentication.
Bearer keys are scoped and can be revoked or expire; an MCP connection does not
broaden their campaign or resource permissions.
