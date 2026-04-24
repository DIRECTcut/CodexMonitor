// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { WorkspaceInfo } from "@/types";
import { useComposerController } from "./useComposerController";

const {
  useComposerImagesMock,
  useQueuedSendMock,
  baseHandleSendMock,
  queueMessageMock,
  removeQueuedMessageMock,
  clearActiveImagesMock,
  setImagesForThreadMock,
  removeImagesForThreadMock,
} = vi.hoisted(() => ({
  useComposerImagesMock: vi.fn(),
  useQueuedSendMock: vi.fn(),
  baseHandleSendMock: vi.fn(),
  queueMessageMock: vi.fn(),
  removeQueuedMessageMock: vi.fn(),
  clearActiveImagesMock: vi.fn(),
  setImagesForThreadMock: vi.fn(),
  removeImagesForThreadMock: vi.fn(),
}));

vi.mock("../../composer/hooks/useComposerImages", () => ({
  useComposerImages: (...args: unknown[]) => useComposerImagesMock(...args),
}));

vi.mock("../../threads/hooks/useQueuedSend", () => ({
  useQueuedSend: (...args: unknown[]) => useQueuedSendMock(...args),
}));

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "CodexMonitor",
  path: "/tmp/codex-monitor",
  connected: true,
  settings: { sidebarCollapsed: false },
};

function makeOptions(
  overrides: Partial<Parameters<typeof useComposerController>[0]> = {},
): Parameters<typeof useComposerController>[0] {
  return {
    activeThreadId: "thread-1",
    activeTurnId: null,
    activeWorkspaceId: "ws-1",
    activeWorkspace: workspace,
    isProcessing: false,
    isReviewing: false,
    queueFlushPaused: false,
    steerEnabled: false,
    followUpMessageBehavior: "queue",
    appsEnabled: true,
    connectWorkspace: vi.fn(),
    startThreadForWorkspace: vi.fn(),
    sendUserMessage: vi.fn(),
    sendUserMessageToThread: vi.fn(),
    rollbackThreadForWorkspace: vi.fn(),
    startFork: vi.fn(),
    startReview: vi.fn(),
    startResume: vi.fn(),
    startCompact: vi.fn(),
    startApps: vi.fn(),
    startMcp: vi.fn(),
    startFast: vi.fn(),
    startStatus: vi.fn(),
    ...overrides,
  };
}

describe("useComposerController", () => {
  beforeEach(() => {
    baseHandleSendMock.mockReset();
    queueMessageMock.mockReset();
    removeQueuedMessageMock.mockReset();
    clearActiveImagesMock.mockReset();
    setImagesForThreadMock.mockReset();
    removeImagesForThreadMock.mockReset();
    useComposerImagesMock.mockReturnValue({
      activeImages: [],
      attachImages: vi.fn(),
      pickImages: vi.fn(),
      removeImage: vi.fn(),
      clearActiveImages: clearActiveImagesMock,
      setImagesForThread: setImagesForThreadMock,
      removeImagesForThread: removeImagesForThreadMock,
    });
    useQueuedSendMock.mockReturnValue({
      activeQueue: [],
      handleSend: baseHandleSendMock,
      queueMessage: queueMessageMock,
      removeQueuedMessage: removeQueuedMessageMock,
    });
  });

  it("rolls back one turn and resends the edited message", async () => {
    const rollbackThreadForWorkspace = vi.fn().mockResolvedValue("thread-1");
    const sendUserMessageToThread = vi.fn().mockResolvedValue({ status: "sent" });
    const { result } = renderHook(() =>
      useComposerController(
        makeOptions({ rollbackThreadForWorkspace, sendUserMessageToThread }),
      ),
    );

    const item = {
      id: "msg-1",
      turnId: "turn-1",
      kind: "message" as const,
      role: "user" as const,
      text: "Original prompt",
      images: ["img-1"],
    };

    await act(async () => {
      const didSave = await result.current.submitEditedLastMessage(item, "Edited prompt");
      expect(didSave).toBe(true);
    });

    expect(rollbackThreadForWorkspace).toHaveBeenCalledWith("ws-1", "thread-1", 1);
    expect(sendUserMessageToThread).toHaveBeenCalledWith(
      workspace,
      "thread-1",
      "Edited prompt",
      ["img-1"],
    );
    expect(baseHandleSendMock).not.toHaveBeenCalled();
  });

  it("blocks resend when rollback fails", async () => {
    const rollbackThreadForWorkspace = vi.fn().mockResolvedValue(null);
    const sendUserMessageToThread = vi.fn();
    const { result } = renderHook(() =>
      useComposerController(
        makeOptions({ rollbackThreadForWorkspace, sendUserMessageToThread }),
      ),
    );

    const item = {
      id: "msg-1",
      turnId: "turn-1",
      kind: "message" as const,
      role: "user" as const,
      text: "Original prompt",
    };

    await act(async () => {
      const didSave = await result.current.submitEditedLastMessage(item, "Edited prompt");
      expect(didSave).toBe(false);
    });

    expect(sendUserMessageToThread).not.toHaveBeenCalled();
  });

  it("returns false when resend fails after rollback", async () => {
    const rollbackThreadForWorkspace = vi.fn().mockResolvedValue("thread-1");
    const sendUserMessageToThread = vi
      .fn()
      .mockResolvedValueOnce({ status: "blocked" });
    const { result } = renderHook(() =>
      useComposerController(
        makeOptions({ rollbackThreadForWorkspace, sendUserMessageToThread }),
      ),
    );

    const item = {
      id: "msg-1",
      turnId: "turn-1",
      kind: "message" as const,
      role: "user" as const,
      text: "Original prompt",
    };

    await act(async () => {
      const didSave = await result.current.submitEditedLastMessage(item, "Edited prompt");
      expect(didSave).toBe(false);
    });

    expect(rollbackThreadForWorkspace).toHaveBeenCalledTimes(1);
  });
});
