import type { WorkflowPersistenceAdapter } from "../executor";
import type { WorkflowEntityRef, WorkflowEntityState } from "../types";

function makeKey(ref: WorkflowEntityRef): string {
  return `${ref.workspaceId}:${ref.entityType}:${ref.entityId}`;
}

export class InMemoryWorkflowAdapter implements WorkflowPersistenceAdapter {
  private states = new Map<string, WorkflowEntityState>();

  private writes = new Map<string, number>();

  seed(ref: WorkflowEntityRef, state: WorkflowEntityState): void {
    this.states.set(makeKey(ref), {
      stageId: state.stageId,
      updatedAt: state.updatedAt,
      revision: state.revision,
    });
  }

  getWriteCount(ref: WorkflowEntityRef): number {
    return this.writes.get(makeKey(ref)) ?? 0;
  }

  getCurrentState(ref: WorkflowEntityRef): WorkflowEntityState | null {
    const current = this.states.get(makeKey(ref));
    if (!current) {
      return null;
    }

    return {
      stageId: current.stageId,
      updatedAt: current.updatedAt,
      revision: current.revision,
    };
  }

  async getState(ref: WorkflowEntityRef): Promise<WorkflowEntityState | null> {
    return this.getCurrentState(ref);
  }

  async setStage(params: {
    ref: WorkflowEntityRef;
    nextStageId: string;
    occurredAt: string;
    expected?: { updatedAt?: string; revision?: string };
  }): Promise<{ updatedAt: string; revision?: string }> {
    const key = makeKey(params.ref);
    const current = this.states.get(key);
    if (!current) {
      throw new Error("State not found");
    }

    this.states.set(key, {
      stageId: params.nextStageId,
      updatedAt: params.occurredAt,
      revision: current.revision,
    });

    this.writes.set(key, (this.writes.get(key) ?? 0) + 1);

    return {
      updatedAt: params.occurredAt,
      revision: current.revision,
    };
  }
}
