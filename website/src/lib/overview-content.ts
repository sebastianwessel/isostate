/** The homepage tells one request's journey through a software system. */
export const overviewChapters = [
	{
		id: 'request-received',
		label: 'Request',
		title: 'A request begins with a person.',
		description:
			'A browser starts the journey. The small document is our request: follow it as the system picks up the work.',
		note: 'Architecture gives the story a place to start. Movement gives it a direction.',
		code: `- id: request-received
  elements:
    - id: browser
      asset: architecture-browser
      at: [1, 8]
    - id: request
      asset: process-document
      at: [1, 7]`
	},
	{
		id: 'api-entry',
		label: 'API',
		title: 'Give the system a front door.',
		description:
			'The gateway rises into place and the same document moves toward it. A dotted connection carries the request from the browser into the API.',
		note: 'Add the gateway once. Update the request position as the reader advances.',
		code: `- id: api-entry
  add:
    elements:
      - id: gateway
        asset: architecture-api-gateway
        at: [4, 8]
        enter: rise-from-ground
  update:
    elements:
      - id: request
        at: [4, 7]`
	},
	{
		id: 'service-and-data',
		label: 'Service',
		title: 'Show where the work happens.',
		description:
			'A service and its database enter together. The request continues across the architecture while the completed gateway settles into a green status.',
		note: 'Photorealistic assets describe the components; connections describe their relationships.',
		code: `- id: service-and-data
  add:
    connections:
      - id: service-to-data
        from: {element: service}
        to: {element: database}
        style: {pattern: dotted}
        message: {kind: orb, count: 1}
  update:
    elements:
      - id: request
        at: [7, 7]`
	},
	{
		id: 'background-work',
		label: 'Work',
		title: 'Move long-running work off the request path.',
		description:
			'A queue and worker arrive above the service. The document changes direction and moves into the background workflow. The architecture now explains what happens over time.',
		note: 'Position changes interpolate continuously, including when you scroll backward.',
		code: `- id: background-work
  add:
    elements:
      - id: worker
        asset: architecture-worker
        at: [7, 2]
        activity: {state: processing}
  update:
    elements:
      - id: request
        at: [7, 1]`
	},
	{
		id: 'ai-review',
		label: 'AI review',
		title: 'Let an agent prepare the result.',
		description:
			'An AI reviewer slides into the workflow. The request travels to the agent while the worker finishes. Animated messages make the direction of the handoff visible.',
		note: 'Processing and completion states help readers distinguish active work from finished work.',
		code: `- id: ai-review
  add:
    elements:
      - id: reviewer
        asset: ai-reviewer
        at: [10, 2]
        enter: slide-in-right
        activity: {state: processing}
  update:
    elements:
      - id: request
        at: [10, 1]`
	},
	{
		id: 'human-approval',
		label: 'Approval',
		title: 'Make the human decision explicit.',
		description:
			'The agent hands its prepared result to a person. An amber connection and waiting status mark the approval boundary; the handoff asset shows who is passing work to whom.',
		note: 'A process is easier to understand when the person responsible for the decision is visible.',
		code: `- id: human-approval
  add:
    elements:
      - id: approver
        asset: human-approver
        at: [13, 2]
        activity:
          state: waiting
          color: "#c68927"
  update:
    elements:
      - id: request
        at: [13, 1]`
	},
	{
		id: 'result-delivered',
		label: 'Delivered',
		title: 'Close the loop with a visible outcome.',
		description:
			'Approval turns green. The in-flight document and temporary handoff leave the scene, and the delivered result enters beside the browser. One journey, told with additions, movement, and exits.',
		note: 'The finished architecture stays in view. Scroll back to retrace every stage.',
		code: `- id: result-delivered
  add:
    elements:
      - id: result
        asset: workflow-end
        at: [1, 2]
        enter: fade-in-grow
  remove:
    elements:
      - id: request
        exit: fade-out-shrink`
	}
] as const;
