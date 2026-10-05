# AI Agents And Human Workflows

Use the included software collection to explain how work moves between people,
AI agents, service records, tools, and model providers. Every object is a
photorealistic isometric sprite with transparent surroundings and a checked
one-cell anchor. The [collection browser](https://sebastianwessel.github.io/isostate/assets/)
shows the current inventory and searches labels, ids, tags, and product aliases.

Choose a story, open it in the editor, and replace the labels with your own
workflow. The illustrations describe roles; your application supplies the actual
agent execution, integration, and approval behavior. Provider and ServiceNow
objects are conceptual illustrations rather than official vendor logos.

## Choose The Right Object

These logical sprite ids are placeable. Sheet namespace ids are catalog
containers and cannot be used as an element's `asset`.

| Family | Logical sprite ids | What to explain |
|---|---|---|
| AI roles | `ai-agent`, `ai-orchestrator`, `ai-planner`, `ai-researcher`, `ai-tool-runner`, `ai-reviewer`, `ai-memory`, `ai-knowledge` | A general agent, coordination, planning, research, tool execution, result review, retained state, or knowledge available to an agent. |
| Knowledge and quality | `ai-rag`, `ai-embedding`, `ai-vector-search`, `ai-context`, `ai-prompt`, `ai-evaluation`, `ai-guardrail`, `ai-model-router` | Retrieval, embedding creation, similarity search, supplied context, instructions, quality measurement, validation boundaries, or model selection. |
| People | `human-requester`, `human-operator`, `human-approver`, `human-expert`, `human-team`, `human-handoff`, `human-escalation`, `human-feedback` | Who requests, handles, approves, advises, owns, receives, escalates, or improves the work. |
| Intake | `channel-email`, `channel-phone`, `channel-teams`, `channel-webform`, `channel-chat`, `channel-issue`, `channel-document`, `channel-webhook` | How a request or event arrives. |
| Control flow | `agent-workflow`, `agent-parallel`, `agent-router`, `agent-condition`, `agent-loop`, `agent-retry`, `agent-timeout`, `agent-error` | A workflow, parallel work, dispatch, decision, repetition, retry, deadline, or failure. |
| Workflow events | `agent-trigger`, `agent-schedule`, `agent-await-human`, `agent-approval`, `agent-rejection`, `agent-escalation`, `agent-audit`, `agent-complete` | When work starts, waits, receives a decision, transfers ownership, records a decision, or completes. |
| ServiceNow | `servicenow-interaction`, `servicenow-request`, `servicenow-requested-item`, `servicenow-request-task`, `servicenow-catalog-item`, `servicenow-incident`, `servicenow-problem`, `servicenow-change` | Conversation, order, ordered item, fulfillment task, catalog offering, interruption, root-cause work, or controlled change. |
| Providers | `provider-azure-foundry`, `provider-aws-bedrock`, `provider-anthropic`, `provider-openai`, `provider-google-vertex`, `provider-google-gemini`, `provider-local-model`, `provider-hugging-face` | The hosting platform, model API, or local model endpoint. |
| Infrastructure | `infra-redis-cache`, `infra-redis-stream`, `infra-redis-pubsub`, `infra-vector-database`, `infra-object-storage`, `infra-knowledge-base`, `infra-api-tool`, `infra-secret-vault` | Cached data, event streams, live messaging, retrieval storage, file storage, knowledge sources, tools, or credential access. |
| Architecture | `architecture-browser`, `architecture-api-gateway`, `architecture-service`, `architecture-database`, `architecture-cache`, `architecture-queue`, `architecture-worker`, `architecture-load-balancer`, `architecture-storage`, `architecture-cloud`, `architecture-container`, `architecture-observability` | The services and infrastructure supporting the workflow. |
| Classic workflow | `workflow-start`, `workflow-end`, `workflow-task`, `workflow-decision`, `workflow-event` | General process steps without an agent-specific role. |
| Business process | `process-approval`, `process-document`, `process-scheduler` | General approvals, documents, and scheduled work. |

Choose the role that answers the viewer's question. `ai-reviewer` is an agent
reviewing a result; `human-approver` is a person making a decision;
`agent-await-human` is the workflow's waiting state. `ai-rag` describes retrieval
augmentation, while `infra-vector-database` describes the store it may query.
`ai-model-router` selects models; `agent-router` routes workflow work.

Redis assets deliberately separate caching, Streams, and Pub/Sub. Label each
with the behavior you are explaining, such as “cached context”, “task event
stream”, or “live updates”. A single generic Redis object can obscure which of
these roles matters to the story.

## Keep ServiceNow Records Distinct

| Sprite | Label suggestion | Meaning |
|---|---|---|
| `servicenow-interaction` | Interaction | A conversation between a requester and a human or virtual fulfiller. |
| `servicenow-catalog-item` | Catalog item | A reusable offering selected from the service catalog. |
| `servicenow-request` | Request / REQ | The submitted order containing one or more requested items. |
| `servicenow-requested-item` | Requested item / RITM | An individual ordered catalog item within a request. |
| `servicenow-request-task` | Catalog task / SCTASK | Work required to fulfill a requested item; also called a request task. |
| `servicenow-incident` | Incident | Work to restore a disrupted service. |
| `servicenow-problem` | Problem | Investigation and management of the cause behind incidents. |
| `servicenow-change` | Change | A planned, assessed change to a service or configuration. |

The intake conversation can lead to a request or incident. It does not need to
be drawn as the same record. For a catalog request, show the catalog offering,
REQ, RITM, and fulfillment task as separate objects when their distinction is
part of the explanation. Do not draw an incident as a generic catalog order.

These meanings follow ServiceNow's official [interaction documentation](https://www.servicenow.com/docs/r/servicenow-platform/interaction-management/create-interactions.html),
[request tracking example](https://www.servicenow.com/docs/r/it-service-management/procurement/t_TrackReqFromServiceCatalog.html),
[request task templates](https://www.servicenow.com/docs/r/servicenow-platform/service-catalog/c_CreatingExecutionPlanTasks.html),
and [problem management overview](https://www.servicenow.com/uk/products/itsm/what-is-problem-management.html).

## Name Model Platforms Clearly

| Sprite | Display label | Search aliases / distinction |
|---|---|---|
| `provider-azure-foundry` | Microsoft Foundry (Azure) | Azure Foundry, Azure AI Foundry, Azure AI Studio. The stable sprite id retains the original Azure wording. |
| `provider-aws-bedrock` | Amazon Bedrock | AWS Bedrock; a managed model platform. |
| `provider-anthropic` | Anthropic / Claude | A model provider and its Claude models. |
| `provider-openai` | OpenAI | OpenAI API, GPT. |
| `provider-google-vertex` | Google Vertex AI | Vertex AI; now part of Gemini Enterprise Agent Platform. This platform can serve Gemini models. |
| `provider-google-gemini` | Google Gemini | Gemini models / Gemini API; distinguish the model family from Vertex AI hosting. |
| `provider-local-model` | Local model | Your locally hosted inference endpoint. |
| `provider-hugging-face` | Hugging Face | A model hub or hosted inference service, as your label specifies. |

Microsoft documents the transition from Azure AI Foundry to Microsoft Foundry
in its [Foundry overview](https://learn.microsoft.com/en-us/azure/foundry/what-is-foundry).
The provider/platform distinction follows the official
[Amazon Bedrock overview](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
and [Google Cloud platform overview](https://cloud.google.com/products/gemini-enterprise-agent-platform)
and [Gemini API documentation](https://ai.google.dev/gemini-api/docs).
Google now presents Vertex AI within Gemini Enterprise Agent Platform; the
collection preserves the familiar Vertex AI label and stable sprite id, with
the current platform name available as a search alias.
Use your deployment's product name in a label rather than changing the sprite id.

## Example 1: Migrate A Human Workflow

[Open the migration example](https://sebastianwessel.github.io/isostate/editor/?example=agentic-workflow)
or download its [YAML](https://sebastianwessel.github.io/isostate/scenes/agentic-workflow.isostate.yaml)
and [compiled module](https://sebastianwessel.github.io/isostate/scenes/agentic-workflow.isostate.js).

The four stops build one story through scene deltas:

1. **Manual baseline:** requester → email → interaction → human triage → fulfillment.
2. **Agentic automation:** retain intake and the interaction; replace manual
   fulfillment with AI triage, REQ, RITM, catalog task, knowledge lookup, and a
   prepared tool action.
3. **Human review:** add a waiting state and an approver. A separate expert lane
   shows where an unclear case can be escalated. The action remains prepared.
4. **Completed:** remove the waiting and escalation branch; show the approved
   action executing, the closed task, completion, and the decision audit.

Only changed objects appear in later scenes. Every connection attached to a
removed object is explicitly removed in the same delta. This example explains
approval before execution: adapt the branch conditions and responsibilities to
your own process.

For example, a label update preserves the existing position and styling:

```yaml
- id: completed
  update:
    elements:
      - id: task-label
        text: { value: "Task closed" }
```

## Example 2: Providers, Retrieval, And Tools

[Open the routing example](https://sebastianwessel.github.io/isostate/editor/?example=provider-routing)
or download its [YAML](https://sebastianwessel.github.io/isostate/scenes/provider-routing.isostate.yaml)
and [compiled module](https://sebastianwessel.github.io/isostate/scenes/provider-routing.isostate.js).

1. **Select provider:** an orchestrator can route work to Microsoft Foundry,
   Amazon Bedrock, or Google Vertex AI.
2. **Retrieve context:** select Bedrock, remove the other provider branches, and
   introduce RAG, a vector store, and cached context.
3. **Execute tools:** add a tool runner, an API tool, a Redis Stream for events,
   and validation of the result.
4. **Review and complete:** a human reviews the validated output before delivery.

The providers are alternatives, not a required chain. The diagram is a visual
explanation of your architecture rather than executable routing logic. Replace
Bedrock with a different provider sprite when explaining another deployment.

## Place, Label, And Connect

Copy the collection into your public asset folder as described in
[Software Architecture Assets](./software-architecture-assets.md). The editor
loads `/assets/software-architecture/manifest.json` and registers every logical
sprite. Placing one copies its checked crop and anchor into your scene's header.
For manual authoring, start with an example's header rather than guessing pixel
rectangles or duplicating a sheet namespace as a placeable asset.

Use whole grid cells and `size: 1` for these sprites. Use caption labels for
short object names and separate label cells for longer explanations. Keep
branch outcome labels beside their lane, close to the destination they explain.

```yaml
- id: reviewer
  asset: human-approver
  at: [4, 10]
  size: 1
- id: reviewer-label
  asset: text
  layer: labels
  at: [4, 10]
  text:
    value: Human approval
    placement: caption
    fontSize: 10
    fill: var(--iso-label)
```

Draw real connections rather than stretching arrow illustrations:

```yaml
connections:
  - id: waiting-to-reviewer
    from: { element: waiting, side: auto }
    to: { element: reviewer, side: auto }
    routing: { mode: orthogonal, avoid: objects }
    style: { stroke: "var(--iso-flow)", strokeWidth: 2 }
    end: arrow
```

Define `--iso-label` and `--iso-flow` in your host CSS. Split a large workflow
into scene stops so the active objects and connections stay within 50 objects
and remain legible on a phone. The examples keep each resolved stop under that
limit. Validate and compile after editing; see [Use The CLI](./use-the-cli.md).
