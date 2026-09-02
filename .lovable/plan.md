# System Design Architect — AI agent

An AI agent that helps you design systems before you build them: it interviews you, produces a full design doc with an architecture diagram, recommends a concrete tech stack and infrastructure, and critiques designs you already have. Each design lives in its own saved thread.

## Does this actually work well?

Honest assessment: yes for the parts that matter, with limits.

Works well:
- Structured design docs (requirements, capacity math, API, data model, trade-offs, failure modes) — this is highly patterned work and models are strong at it.
- Interview-style requirement elicitation. Most bad designs come from unstated requirements; an agent that keeps asking "what's the read:write ratio, what's the consistency requirement, what's the p99 target" is genuinely valuable.
- Critique of an existing design. Checklist-driven review catches real gaps: single points of failure, missing idempotency, unbounded queues, hot partitions.
- Stack and infra recommendations with reasoning about trade-offs.

Limits to be aware of:
- It won't know your org's constraints, existing systems, budget, or team skills unless you tell it. The interview step exists for this reason.
- Capacity estimates are order-of-magnitude sanity checks, not benchmarks.
- Recommendations converge on mainstream choices. Treat it as a strong senior reviewer, not an oracle.

Design decision from this: the agent is opinionated and forced to state trade-offs and rejected alternatives for every major choice, and every claim it grounds in an uploaded book is cited. That is what separates it from generic chat.

## What gets built

**Thread-based workspace.** Sidebar of design projects, each at its own URL, each reloadable. Login required; designs are saved to your account.

**Four modes per thread**, chosen when you start a design:
1. Interview — the agent asks clarifying questions in rounds (scale, latency, consistency, budget, team), then converges on a design.
2. Design doc — one-shot generation from a problem statement.
3. Review — you paste an existing design and get a scored critique.
4. Stack/infra advisor — recommends languages, frameworks, databases, queues, cache, cloud services, deployment topology, with cost and operational trade-offs.

**Design doc structure** the agent always follows:
- Functional and non-functional requirements
- Back-of-envelope capacity estimates (QPS, storage, bandwidth)
- High-level architecture + Mermaid diagram
- API design and data model
- Deep dives on the 2–3 hardest components
- Tech stack and infrastructure recommendation with alternatives and why-not
- Bottlenecks, failure modes, scaling path
- Open questions and risks

**Knowledge grounding (both sources):**
- Built-in canonical principles baked into the agent: distributed systems fundamentals, CAP/PACELC, consistency models, caching and sharding strategies, queueing, idempotency, observability, SRE reliability practice, common architecture patterns.
- Your uploaded books/PDFs: upload to your library, the system chunks and embeds them, and the agent retrieves relevant passages during design work and cites which source and section it drew on. Retrieval is a tool the agent calls when it needs grounding, not on every message.

**Diagrams** render live as Mermaid inside the chat, with the source viewable and copyable.

**Export** each finished design as Markdown.

## Technical approach

- Lovable Cloud for auth, database, file storage, and vector search (pgvector).
- Tables: `profiles`, `threads`, `messages`, `documents`, `document_chunks` (with embeddings), `designs` (structured doc snapshots). RLS on everything, scoped to the owner; grants issued alongside each table.
- Chat streams through a TanStack server route at `/api/chat` using the AI SDK with the Lovable AI Gateway. Chat model `google/gemini-3.1-pro-preview` for design reasoning depth; embeddings for the book index.
- Agent tools: `search_design_knowledge` (vector search over uploaded books), `render_diagram`, `save_design_section`. Tool activity shown collapsed in the transcript.
- Chat UI built from AI Elements primitives; messages persisted per thread and restored on reload.
- PDF upload → text extraction → chunk → embed → store, run in a server function with visible processing status per document.

## Build order

1. Cloud enablement, auth, schema with RLS.
2. Threads + routed chat with streaming and persistence.
3. System-design agent prompt, mode selection, structured doc output, Mermaid rendering.
4. Book library: upload, extraction, embedding, retrieval tool with citations.
5. Review mode, stack advisor, Markdown export, polish.
