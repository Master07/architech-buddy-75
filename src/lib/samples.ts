export type Sample = {
  slug: string;
  title: string;
  summary: string;
  requirements: string[];
  capacity: { label: string; value: string; math: string }[];
  diagram: string;
  decisions: { choice: string; rejected: string; why: string }[];
  failures: { failure: string; mitigation: string }[];
  scaling: string[];
  /** True when the page shows an unedited document produced by the tool. */
  realDoc?: boolean;
};

export const SAMPLES: Sample[] = [
  {
    slug: "url-shortener",
    title: "Design a URL shortener",
    summary:
      "A public link shortener handling 100M new links per month with a 100:1 read-to-write ratio and redirects under 50 ms at p99.",
    requirements: [
      "Create a short link from a long URL; optional custom alias and expiry.",
      "Redirect short link to the long URL (HTTP 301/302).",
      "p99 redirect latency under 50 ms; 99.99% redirect availability.",
      "Links are never reassigned; abuse (phishing) links can be disabled.",
    ],
    capacity: [
      { label: "Writes", value: "~40 / s", math: "100M links / (30 × 86,400 s) ≈ 39 writes/s" },
      { label: "Reads", value: "~4,000 / s", math: "100:1 read ratio → ~3,900 redirects/s, peak ×3 ≈ 12k/s" },
      { label: "Storage (5 yrs)", value: "~3 TB", math: "6B links × ~500 bytes ≈ 3 TB" },
      { label: "Key space", value: "7 chars", math: "62^7 ≈ 3.5 trillion ≫ 6B links" },
    ],
    diagram: `flowchart LR
  C[Client] --> LB[Load balancer]
  LB --> API[Shortener API]
  LB --> R[Redirect service]
  API --> KGS[Key range allocator]
  API --> DB[(Key-value store)]
  R --> CACHE[(Cache)]
  CACHE -. miss .-> DB
  R --> Q[[Click events queue]]
  Q --> AN[Analytics]`,
    decisions: [
      {
        choice: "Pre-allocated key ranges per API node (base62 counter)",
        rejected: "Hashing the long URL (MD5 + truncate)",
        why: "Hashing needs collision checks on every write; ranges give guaranteed-unique keys with no coordination on the hot path.",
      },
      {
        choice: "Key-value store (e.g. DynamoDB / Cassandra)",
        rejected: "Single relational database",
        why: "Access is purely by key and grows to billions of rows; horizontal partitioning is simpler than sharding SQL.",
      },
      {
        choice: "302 redirect with cache headers",
        rejected: "301 permanent redirect",
        why: "301s are cached by browsers forever, which breaks click analytics and link disabling.",
      },
    ],
    failures: [
      { failure: "Cache cluster lost", mitigation: "Reads fall through to the store; store is sized for 3× normal read load for 15 minutes." },
      { failure: "Key allocator down", mitigation: "Each API node holds a buffered range of 10k keys, so writes continue for hours." },
      { failure: "Hot link (viral)", mitigation: "CDN caches redirects at the edge for 60 s." },
    ],
    scaling: [
      "Over 20k redirects/s: add edge caching of redirects.",
      "Over 10 TB: move cold links (no clicks in 1 year) to cheaper storage.",
    ],
  },
  {
    slug: "rate-limiter",
    realDoc: true,
    title: "Design a rate limiter",
    summary:
      "A distributed rate limiter in front of a public API: 50k requests/s across 20 gateway nodes, per-API-key limits, under 2 ms added latency.",
    requirements: [
      "Enforce per-key limits like 100 requests/minute, configurable per plan.",
      "Return HTTP 429 with Retry-After when limited.",
      "Add under 2 ms p99 latency; fail open if the limiter is unavailable.",
      "Limits accurate within ~5% across all gateway nodes.",
    ],
    capacity: [
      { label: "Checks", value: "50k / s", math: "Every API request = 1 counter increment" },
      { label: "Active keys", value: "~1M", math: "1M keys × ~64 bytes per bucket ≈ 64 MB" },
      { label: "Memory", value: "< 1 GB", math: "Fits comfortably in one Redis primary with replicas" },
      { label: "Network", value: "~10 MB/s", math: "50k × ~200 bytes round trip" },
    ],
    diagram: `flowchart LR
  C[Client] --> GW[API gateway nodes]
  GW -->|check + increment| RL[(Redis cluster)]
  GW --> SVC[Backend services]
  CFG[Limits config] --> GW
  GW -. fail open .-> SVC`,
    decisions: [
      {
        choice: "Sliding window counter (two fixed windows, weighted)",
        rejected: "Sliding window log",
        why: "The log stores every timestamp, so memory is ~100× higher; the counter is accurate to a few percent, which meets the requirement.",
      },
      {
        choice: "Central Redis with atomic Lua script",
        rejected: "Local in-memory counters per node",
        why: "With 20 nodes, local counters allow up to 20× the limit; a single atomic script keeps limits accurate.",
      },
      {
        choice: "Fail open",
        rejected: "Fail closed",
        why: "An outage of the limiter should not become an outage of the whole API.",
      },
    ],
    failures: [
      { failure: "Redis primary fails", mitigation: "Replica promoted in seconds; gateways fail open meanwhile and log the gap." },
      { failure: "Network latency spike", mitigation: "5 ms timeout on the check, then fail open." },
      { failure: "One key floods traffic", mitigation: "Local pre-filter blocks keys already over 2× their limit without calling Redis." },
    ],
    scaling: [
      "Over 200k checks/s: shard Redis by key hash.",
      "Multi-region: per-region limits with async reconciliation, accepting ~10% overshoot.",
    ],
  },
];

export function getSample(slug: string) {
  return SAMPLES.find((s) => s.slug === slug);
}
