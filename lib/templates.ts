export type TemplateKey =
  | "flowchart"
  | "sequence"
  | "class"
  | "er"
  | "state"
  | "gantt"
  | "pie"
  | "journey"
  | "git"
  | "mindmap";

export const TEMPLATES: Record<TemplateKey, { label: string; code: string }> = {
  flowchart: {
    label: "Flowchart",
    code: `flowchart TD
  A[Start] --> B{Is it working?}
  B -- Yes --> C[Ship it]
  B -- No --> D[Debug]
  D --> B`,
  },
  sequence: {
    label: "Sequence",
    code: `sequenceDiagram
  participant U as User
  participant A as App
  participant DB as Database
  U->>A: Submit form
  A->>DB: Insert record
  DB-->>A: OK
  A-->>U: Success`,
  },
  class: {
    label: "Class",
    code: `classDiagram
  class Animal {
    +String name
    +int age
    +eat()
    +sleep()
  }
  class Dog {
    +bark()
  }
  Animal <|-- Dog`,
  },
  er: {
    label: "ER",
    code: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  CUSTOMER {
    string name
    string email
  }
  ORDER {
    int id
    date createdAt
  }`,
  },
  state: {
    label: "State",
    code: `stateDiagram-v2
  [*] --> Idle
  Idle --> Loading: fetch()
  Loading --> Done: success
  Loading --> Error: failure
  Done --> [*]
  Error --> Idle: retry`,
  },
  gantt: {
    label: "Gantt",
    code: `gantt
  title Project plan
  dateFormat YYYY-MM-DD
  section Design
    Wireframes :a1, 2026-01-01, 5d
    Visual    :after a1, 4d
  section Build
    API       :2026-01-08, 7d
    UI        :2026-01-10, 8d`,
  },
  pie: {
    label: "Pie",
    code: `pie title Traffic sources
  "Organic" : 45
  "Direct"  : 30
  "Referral": 15
  "Social"  : 10`,
  },
  journey: {
    label: "Journey",
    code: `journey
  title Buying a coffee
  section Pre-order
    Open app:    5: Me
    Choose item: 4: Me
  section Pickup
    Wait:        2: Me
    Receive:     5: Me, Barista`,
  },
  git: {
    label: "Git graph",
    code: `gitGraph
  commit
  branch feature
  checkout feature
  commit
  commit
  checkout main
  merge feature
  commit`,
  },
  mindmap: {
    label: "Mindmap",
    code: `mindmap
  root((Project))
    Frontend
      React
      Tailwind
    Backend
      API
      Database
    Ops
      CI/CD`,
  },
};
