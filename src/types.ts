export interface FlowStep {
  name: string;
  query: string;
  variables?: Record<string, unknown>;
  extractToContext?: Record<string, string>;
  expected?: Record<string, unknown>;
  status: "pending" | "done" | "error" | "failed";
  result?: unknown;
  error?: string;
  validationError?: string;
  duration?: number;
}

export interface Flow {
  name: string;
  baseUrl: string;
  headers?: Record<string, string>;
  context: Record<string, unknown>;
  steps: FlowStep[];
}

export const FLOW_FILE = "flow.json";
