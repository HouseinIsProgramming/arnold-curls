// Set definition (committed to git) - no execution state
export interface StepDefinition {
  name: string;
  query: string;
  variables?: Record<string, unknown>;
  extractToContext?: Record<string, string>;
  expected?: Record<string, unknown>;
}

export interface SetDefinition {
  name: string;
  baseUrl: string;
  headers?: Record<string, string>;
  steps: StepDefinition[];
}

// Execution state (gitignored) - lives in state.json
export type StepStatus = "pending" | "done" | "error" | "failed";

export interface StepState {
  status: StepStatus;
  duration?: number;
  result?: unknown;
  error?: string | unknown[];  // Allow array for GraphQL errors
  validationError?: string;
}

export interface SetState {
  context: Record<string, unknown>;
  steps: StepState[];
}

export interface GlobalState {
  [setName: string]: SetState;
}

// Paths
export const ARNOLD_DIR = ".arnold";
export const SETS_DIR = ".arnold/sets";
export const STATE_FILE = ".arnold/state.json";
export const ENV_FILE = ".arnold/.env";

// Legacy (for migration)
export const LEGACY_FLOW_FILE = "flow.json";
export const LEGACY_ARNOLD_FILE = ".arnold";
