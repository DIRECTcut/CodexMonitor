// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BranchInfo, WorkspaceInfo } from "@/types";
import { MainHeader } from "./MainHeader";

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "CodexMonitor",
  path: "/tmp/codex-monitor",
  connected: true,
  settings: { sidebarCollapsed: false },
};

const branches: BranchInfo[] = [
  {
    name: "main",
    lastCommit: Date.now(),
  },
];

describe("MainHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the active conversation id when a thread is open", () => {
    render(
      <MainHeader
        workspace={workspace}
        threadId="thread-123"
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        branchName="main"
        branches={branches}
        onCheckoutBranch={vi.fn()}
        onCreateBranch={vi.fn()}
        onToggleTerminal={vi.fn()}
        isTerminalOpen={false}
      />,
    );

    expect(screen.getByText("Conversation")).toBeTruthy();
    expect(screen.getByText("thread-123")).toBeTruthy();
  });

  it("hides the conversation id when no thread is open", () => {
    render(
      <MainHeader
        workspace={workspace}
        threadId={null}
        openTargets={[]}
        openAppIconById={{}}
        selectedOpenAppId=""
        onSelectOpenAppId={vi.fn()}
        branchName="main"
        branches={branches}
        onCheckoutBranch={vi.fn()}
        onCreateBranch={vi.fn()}
        onToggleTerminal={vi.fn()}
        isTerminalOpen={false}
      />,
    );

    expect(screen.queryByText("Conversation")).toBeNull();
  });
});
