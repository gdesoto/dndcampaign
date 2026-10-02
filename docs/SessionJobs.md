# Session summary and suggestion jobs

Summary generation and suggestion generation are separate workflow steps with
distinct `SummaryJobKind` values. A summary job consumes the session's read-only
transcript. A suggestion job consumes a summary source identified by
`summaryJobId` or `summaryDocumentId`; the request schema requires at least one.
Requests carry campaign/session identity and a `trackingId` that correlates the
provider response with the stored job. Both synchronous and asynchronous modes
are represented in the request contracts.

## Results and callbacks

Both job kinds receive results at `POST /api/webhooks/n8n/summary`. Payloads can
contain summary content, proposed entity changes, status, and metadata. When
the n8n webhook secret is configured, the handler checks it before validating
and processing the payload. The accepted header names are `x-webhook-secret`
and `x-n8n-webhook-secret`; the handler also accepts the `secret` query parameter.

The service finds the job by `trackingId`. Summary content is retained in job
metadata for review. Proposed changes become pending suggestion records; a
summary-generation response that also contains suggestions creates or updates a
separate suggestion-generation job for that review step. Completed result
processing moves the job to `READY_FOR_REVIEW`; failed provider results record a
failure and its error information.

## Review and application

Applying a summary writes the session's versioned summary document and associates
it with the job. Suggestion review exposes editable proposed values and individual
Apply/Discard actions. These operations use typed actions on canonical resource
PATCH endpoints. Generated proposals are distinct from the campaign records
they may change; review determines whether they are applied or discarded.

The session parent owns one combined jobs resource. Latest-job views use that
response, while selected historical jobs fetch their details separately. Drafts
and job selection follow the lifetimes described in
[SessionWorkspaceOwnership.md](SessionWorkspaceOwnership.md).

## Source references

- [Request and callback schemas](../shared/schemas/summarization.ts) and
  [callback JSON schema](../shared/schemas/n8n-summary-response.schema.json).
- [Summary service](../server/services/summary.service.ts),
  [suggestion service](../server/services/summary-suggestion.service.ts), and
  [webhook handler](../server/api/webhooks/n8n/summary.post.ts).
- [Suggestion review](../app/components/session/SummarySuggestionList.vue).
- [OpenAPI](../public/openapi.json) for current routes and payloads.
