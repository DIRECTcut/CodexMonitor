// @vitest-environment jsdom
import { useCallback, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";
import { expectOpenedFileTarget } from "../test/fileLinkAssertions";
import { Messages } from "./Messages";

const useFileLinkOpenerMock = vi.fn(
  (_workspacePath: string | null, _openTargets: unknown[], _selectedOpenAppId: string) => ({
    openFileLink: openFileLinkMock,
    showFileLinkMenu: showFileLinkMenuMock,
  }),
);
const openFileLinkMock = vi.fn();
const showFileLinkMenuMock = vi.fn();
const { exportMarkdownFileMock } = vi.hoisted(() => ({
  exportMarkdownFileMock: vi.fn(),
}));
const { askMock } = vi.hoisted(() => ({
  askMock: vi.fn(),
}));

vi.mock("../hooks/useFileLinkOpener", () => ({
  useFileLinkOpener: (
    workspacePath: string | null,
    openTargets: unknown[],
    selectedOpenAppId: string,
  ) => useFileLinkOpenerMock(workspacePath, openTargets, selectedOpenAppId),
}));

vi.mock("@services/tauri", async () => {
  const actual = await vi.importActual<typeof import("@services/tauri")>(
    "@services/tauri",
  );
  return {
    ...actual,
    exportMarkdownFile: exportMarkdownFileMock,
  };
});

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: (...args: unknown[]) => askMock(...args),
}));

describe("Messages", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useFileLinkOpenerMock.mockClear();
    openFileLinkMock.mockReset();
    showFileLinkMenuMock.mockReset();
    exportMarkdownFileMock.mockReset();
    askMock.mockReset();
    askMock.mockResolvedValue(true);
  });

  it("renders image grid above message text and opens lightbox", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-1",
        kind: "message",
        role: "user",
        text: "Hello",
        images: ["data:image/png;base64,AAA"],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const bubble = container.querySelector(".message-bubble");
    const grid = container.querySelector(".message-image-grid");
    const markdown = container.querySelector(".markdown");
    expect(bubble).toBeTruthy();
    expect(grid).toBeTruthy();
    expect(markdown).toBeTruthy();
    if (grid && markdown) {
      expect(bubble?.firstChild).toBe(grid);
    }
    const openButton = screen.getByRole("button", { name: "Open image 1" });
    fireEvent.click(openButton);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("preserves newlines when images are attached", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-2",
        kind: "message",
        role: "user",
        text: "Line 1\n\n- item 1\n- item 2",
        images: ["data:image/png;base64,AAA"],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const markdown = container.querySelector(".markdown");
    expect(markdown).toBeTruthy();
    expect(markdown?.textContent ?? "").toContain("Line 1");
    expect(markdown?.textContent ?? "").toContain("item 1");
    expect(markdown?.textContent ?? "").toContain("item 2");
  });

  it("keeps literal [image] text when images are attached", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-3",
        kind: "message",
        role: "user",
        text: "Literal [image] token",
        images: ["data:image/png;base64,AAA"],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const markdown = container.querySelector(".markdown");
    expect(markdown?.textContent ?? "").toContain("Literal [image] token");
  });

  it("uses the table container as the visual bubble for assistant table-only messages", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-table-1",
        kind: "message",
        role: "assistant",
        text: [
          "src/features/app/hooks/useMainAppLayoutSurfaces.ts | category=clarity | Layout assembly is still too broad. | Split surface assembly by domain. | high",
          "",
          "src/features/threads/hooks/threadMessagingHelpers.ts | category=clarity | Helper responsibilities are too broad. | Split helpers by concern. | medium",
        ].join("\n"),
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".message-bubble-table-only")).toBeTruthy();
    expect(container.querySelector(".markdown-table-wrap")).toBeTruthy();
  });

  it("quotes a message into composer using markdown blockquote format", () => {
    const onQuoteMessage = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-quote-1",
        kind: "message",
        role: "assistant",
        text: "First line\nSecond line",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onQuoteMessage={onQuoteMessage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Quote message" }));
    expect(onQuoteMessage).toHaveBeenCalledWith("> First line\n> Second line\n\n");
  });

  it("quotes selected message fragment when text is highlighted", () => {
    const onQuoteMessage = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-quote-selection-1",
        kind: "message",
        role: "assistant",
        text: "Alpha beta gamma",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onQuoteMessage={onQuoteMessage}
      />,
    );

    const textNode = screen.getByText("Alpha beta gamma").firstChild;
    if (!(textNode instanceof Text)) {
      throw new Error("Expected message text node");
    }
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 10);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    const quoteButton = screen.getByRole("button", { name: "Quote message" });
    fireEvent.mouseDown(quoteButton);
    fireEvent.click(quoteButton);

    expect(onQuoteMessage).toHaveBeenCalledWith("> beta\n\n");
    selection?.removeAllRanges();
  });

  it("renders fork on only the latest assistant message and calls the fork handler", async () => {
    const onForkThread = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-old-assistant",
        kind: "message",
        role: "assistant",
        text: "Earlier assistant reply",
      },
      {
        id: "msg-user",
        kind: "message",
        role: "user",
        text: "Follow-up from user",
      },
      {
        id: "msg-latest-assistant",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onForkThread={onForkThread}
      />,
    );

    const forkButtons = screen.getAllByRole("button", { name: "Fork thread" });
    expect(forkButtons).toHaveLength(1);
    fireEvent.click(forkButtons[0] as Element);
    await waitFor(() => {
      expect(askMock).toHaveBeenCalledWith(
        "This will create a new thread from this point in the conversation history and leave the current thread unchanged.",
        expect.objectContaining({
          title: "Fork thread?",
          kind: "info",
          okLabel: "Fork",
          cancelLabel: "Cancel",
        }),
      );
    });
    await waitFor(() => {
      expect(onForkThread).toHaveBeenCalledTimes(1);
    });

    const messages = Array.from(container.querySelectorAll(".message"));
    expect(messages).toHaveLength(3);
    expect(messages[0]?.querySelector(".message-fork-button")).toBeNull();
    expect(messages[1]?.querySelector(".message-fork-button")).toBeNull();
    expect(messages[2]?.querySelector(".message-fork-button")).toBeTruthy();
  });

  it("shows a loading state on the fork button while the fork is pending", async () => {
    let resolveFork: (() => void) | null = null;
    const onForkThread = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFork = resolve;
        }),
    );
    const items: ConversationItem[] = [
      {
        id: "msg-latest-assistant",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onForkThread={onForkThread}
      />,
    );

    const forkButton = screen.getByRole("button", { name: "Fork thread" });
    fireEvent.click(forkButton);

    await waitFor(() => {
      expect(onForkThread).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole("button", { name: "Forking thread" }).hasAttribute("disabled"),
    ).toBe(true);

    await act(async () => {
      resolveFork?.();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Fork thread" }).hasAttribute("disabled"),
      ).toBe(false);
    });
  });

  it("does not trigger fork when confirmation is cancelled", async () => {
    askMock.mockResolvedValueOnce(false);
    const onForkThread = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-latest-assistant",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onForkThread={onForkThread}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fork thread" }));

    await waitFor(() => {
      expect(askMock).toHaveBeenCalledTimes(1);
    });
    expect(onForkThread).not.toHaveBeenCalled();
  });

  it("hides the fork action while the thread is processing", () => {
    const onForkThread = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-processing-assistant",
        kind: "message",
        role: "assistant",
        text: "Working on it",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        openTargets={[]}
        selectedOpenAppId=""
        onForkThread={onForkThread}
      />,
    );

    expect(screen.queryByRole("button", { name: "Fork thread" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rewind to here" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
  });

  it("renders edit only on the latest user message", () => {
    const onSubmitEditMessage = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "user-turn-1",
        turnId: "turn-1",
        kind: "message",
        role: "user",
        text: "Initial prompt",
      },
      {
        id: "assistant-turn-1",
        turnId: "turn-1",
        kind: "message",
        role: "assistant",
        text: "Initial reply",
      },
      {
        id: "user-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "user",
        text: "Latest prompt",
      },
      {
        id: "assistant-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "assistant",
        text: "Latest reply",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onSubmitEditMessage={onSubmitEditMessage}
      />,
    );

    const messages = Array.from(container.querySelectorAll(".message"));
    expect(messages[0]?.querySelector(".message-edit-button")).toBeNull();
    expect(messages[1]?.querySelector(".message-edit-button")).toBeNull();
    expect(messages[2]?.querySelector(".message-edit-button")).toBeTruthy();
    expect(messages[3]?.querySelector(".message-edit-button")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Edit message" })).toHaveLength(1);
  });

  it("keeps edit on the newest user bubble even when the assistant reply has a newer turn id", () => {
    const onSubmitEditMessage = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "user-1",
        turnId: "turn-1",
        kind: "message",
        role: "user",
        text: "1",
      },
      {
        id: "assistant-1",
        turnId: "turn-2",
        kind: "message",
        role: "assistant",
        text: "Reply to 1",
      },
      {
        id: "user-2",
        turnId: "turn-3",
        kind: "message",
        role: "user",
        text: "2",
      },
      {
        id: "assistant-2",
        turnId: "turn-4",
        kind: "message",
        role: "assistant",
        text: "Reply to 2",
      },
      {
        id: "user-3",
        turnId: "turn-5",
        kind: "message",
        role: "user",
        text: "3",
      },
      {
        id: "assistant-3",
        turnId: "turn-6",
        kind: "message",
        role: "assistant",
        text: "Reply to 3",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onSubmitEditMessage={onSubmitEditMessage}
      />,
    );

    const messages = Array.from(container.querySelectorAll(".message"));
    expect(messages[0]?.querySelector(".message-edit-button")).toBeNull();
    expect(messages[2]?.querySelector(".message-edit-button")).toBeNull();
    expect(messages[4]?.querySelector(".message-edit-button")).toBeTruthy();
    expect(messages[5]?.querySelector(".message-edit-button")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Edit message" })).toHaveLength(1);
  });

  it("opens an inline editor for the latest user message", async () => {
    const onSubmitEditMessage = vi.fn().mockResolvedValue(true);
    const items: ConversationItem[] = [
      {
        id: "user-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "user",
        text: "Latest prompt",
      },
      {
        id: "assistant-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "assistant",
        text: "Latest reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onSubmitEditMessage={onSubmitEditMessage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));

    const editor = await screen.findByRole("textbox", { name: "Edit message" });
    expect((editor as HTMLTextAreaElement).value).toBe("Latest prompt");
    expect(askMock).not.toHaveBeenCalled();
    expect(onSubmitEditMessage).not.toHaveBeenCalled();
  });

  it("saves inline edits and shows a loading state while save is pending", async () => {
    let resolveEdit: ((value: boolean) => void) | null = null;
    const onSubmitEditMessage = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveEdit = resolve;
        }),
    );
    const items: ConversationItem[] = [
      {
        id: "user-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "user",
        text: "Latest prompt",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onSubmitEditMessage={onSubmitEditMessage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    const editor = await screen.findByRole("textbox", { name: "Edit message" });
    fireEvent.change(editor, { target: { value: "Updated prompt" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSubmitEditMessage).toHaveBeenCalledWith(items[0], "Updated prompt");
    });
    expect(screen.getByRole("button", { name: "Saving" }).hasAttribute("disabled")).toBe(
      true,
    );

    await act(async () => {
      resolveEdit?.(true);
    });

    await waitFor(() => {
      expect(screen.queryByRole("textbox", { name: "Edit message" })).toBeNull();
    });
  });

  it("keeps the inline editor open when saving fails", async () => {
    const onSubmitEditMessage = vi.fn().mockResolvedValue(false);
    const items: ConversationItem[] = [
      {
        id: "user-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "user",
        text: "Latest prompt",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onSubmitEditMessage={onSubmitEditMessage}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
    const editor = await screen.findByRole("textbox", { name: "Edit message" });
    fireEvent.change(editor, { target: { value: "Still open" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSubmitEditMessage).toHaveBeenCalledWith(items[0], "Still open");
    });
    expect(screen.getByRole("textbox", { name: "Edit message" })).toBeTruthy();
  });

  it("hides the fork action when workspace or thread context is missing", () => {
    const onForkThread = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-contextless-assistant",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    const { rerender } = render(
      <Messages
        items={items}
        threadId={null}
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onForkThread={onForkThread}
      />,
    );

    expect(screen.queryByRole("button", { name: "Fork thread" })).toBeNull();

    rerender(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId={null}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onForkThread={onForkThread}
      />,
    );

    expect(screen.queryByRole("button", { name: "Fork thread" })).toBeNull();
  });

  it("renders rewind on historical assistant turns only and passes the turn-based count", async () => {
    const onRollbackThread = vi.fn().mockResolvedValue(undefined);
    const items: ConversationItem[] = [
      {
        id: "assistant-turn-1",
        turnId: "turn-1",
        kind: "message",
        role: "assistant",
        text: "First assistant reply",
      },
      {
        id: "user-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "user",
        text: "User follow-up",
      },
      {
        id: "assistant-turn-3-a",
        turnId: "turn-3",
        kind: "message",
        role: "assistant",
        text: "Assistant reply part one",
      },
      {
        id: "assistant-turn-3-b",
        turnId: "turn-3",
        kind: "message",
        role: "assistant",
        text: "Assistant reply part two",
      },
      {
        id: "assistant-turn-4",
        turnId: "turn-4",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onRollbackThread={onRollbackThread}
      />,
    );

    const messages = Array.from(container.querySelectorAll(".message"));
    expect(messages[0]?.querySelector(".message-rewind-button")).toBeTruthy();
    expect(messages[1]?.querySelector(".message-rewind-button")).toBeNull();
    expect(messages[2]?.querySelector(".message-rewind-button")).toBeTruthy();
    expect(messages[3]?.querySelector(".message-rewind-button")).toBeTruthy();
    expect(messages[4]?.querySelector(".message-rewind-button")).toBeNull();

    const rewindButtons = screen.getAllByRole("button", { name: "Rewind to here" });
    expect(rewindButtons).toHaveLength(3);

    fireEvent.click(rewindButtons[0] as Element);

    await waitFor(() => {
      expect(askMock).toHaveBeenCalledWith(
        "This will remove all turns after this point from the conversation history. File changes already made in the workspace will not be reverted.",
        expect.objectContaining({
          title: "Rewind conversation?",
          kind: "warning",
          okLabel: "Rewind",
          cancelLabel: "Cancel",
        }),
      );
    });
    expect(onRollbackThread).toHaveBeenCalledWith("turn-1", 3);
  });

  it("does not show rewind on non-message rows or the latest assistant turn", () => {
    const onRollbackThread = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "reasoning-1",
        turnId: "turn-1",
        kind: "reasoning",
        summary: "Thinking",
        content: "Working through the steps",
      },
      {
        id: "assistant-1",
        turnId: "turn-1",
        kind: "message",
        role: "assistant",
        text: "Historical assistant reply",
      },
      {
        id: "review-1",
        turnId: "turn-2",
        kind: "review",
        state: "completed",
        text: "Review completed",
      },
      {
        id: "assistant-2",
        turnId: "turn-2",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onRollbackThread={onRollbackThread}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Rewind to here" })).toHaveLength(1);
  });

  it("does not trigger rewind when confirmation is cancelled", async () => {
    askMock.mockResolvedValueOnce(false);
    const onRollbackThread = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "assistant-turn-1",
        turnId: "turn-1",
        kind: "message",
        role: "assistant",
        text: "First assistant reply",
      },
      {
        id: "assistant-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onRollbackThread={onRollbackThread}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rewind to here" }));

    await waitFor(() => {
      expect(askMock).toHaveBeenCalledTimes(1);
    });
    expect(onRollbackThread).not.toHaveBeenCalled();
  });

  it("shows a loading state on the rewind button while rollback is pending", async () => {
    let resolveRollback: (() => void) | null = null;
    const onRollbackThread = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRollback = resolve;
        }),
    );
    const items: ConversationItem[] = [
      {
        id: "assistant-turn-1",
        turnId: "turn-1",
        kind: "message",
        role: "assistant",
        text: "First assistant reply",
      },
      {
        id: "assistant-turn-2",
        turnId: "turn-2",
        kind: "message",
        role: "assistant",
        text: "Latest assistant reply",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onRollbackThread={onRollbackThread}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rewind to here" }));

    await waitFor(() => {
      expect(onRollbackThread).toHaveBeenCalledWith("turn-1", 1);
    });
    expect(
      screen
        .getByRole("button", { name: "Rewinding conversation" })
        .hasAttribute("disabled"),
    ).toBe(true);

    await act(async () => {
      resolveRollback?.();
    });

    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Rewind to here" })
          .hasAttribute("disabled"),
      ).toBe(false);
    });
  });

  it("opens linked review thread when clicking thread link", () => {
    const onOpenThreadLink = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "msg-thread-link",
        kind: "message",
        role: "assistant",
        text: "Detached review completed. [Open review thread](/thread/thread-review-1)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-parent"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onOpenThreadLink={onOpenThreadLink}
      />,
    );

    fireEvent.click(screen.getByText("Open review thread"));
    expect(onOpenThreadLink).toHaveBeenCalledWith("thread-review-1", "ws-1");
  });

  it("renders file references as compact links and opens them", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link",
        kind: "message",
        role: "assistant",
        text: "Refactor candidate: `iosApp/src/views/DocumentsList/DocumentListView.swift:111`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const fileLinkName = screen.getByText("DocumentListView.swift");
    const fileLinkLine = screen.getByText("L111");
    const fileLinkPath = screen.getByText("iosApp/src/views/DocumentsList");
    const fileLink = container.querySelector(".message-file-link");
    expect(fileLinkName).toBeTruthy();
    expect(fileLinkLine).toBeTruthy();
    expect(fileLinkPath).toBeTruthy();
    expect(fileLink).toBeTruthy();

    fireEvent.click(fileLink as Element);
    expectOpenedFileTarget(
      openFileLinkMock,
      "iosApp/src/views/DocumentsList/DocumentListView.swift",
      111,
    );
  });

  it("routes markdown href file paths through the file opener", () => {
    const linkedPath =
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx:244";
    const items: ConversationItem[] = [
      {
        id: "msg-file-href-link",
        kind: "message",
        role: "assistant",
        text: `Open [this file](${linkedPath})`,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByText("this file"));
    expectOpenedFileTarget(
      openFileLinkMock,
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx",
      244,
    );
  });

  it("routes absolute non-whitelisted file href paths through the file opener", () => {
    const linkedPath = "/custom/project/src/App.tsx:12";
    const items: ConversationItem[] = [
      {
        id: "msg-file-href-absolute-non-whitelisted-link",
        kind: "message",
        role: "assistant",
        text: `Open [app file](${linkedPath})`,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByText("app file"));
    expectOpenedFileTarget(openFileLinkMock, "/custom/project/src/App.tsx", 12);
  });

  it("decodes percent-encoded href file paths before opening", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-href-encoded-link",
        kind: "message",
        role: "assistant",
        text: "Open [guide](./docs/My%20Guide.md)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByText("guide"));
    expectOpenedFileTarget(openFileLinkMock, "./docs/My Guide.md");
  });

  it("routes absolute href file paths with #L anchors through the file opener", () => {
    const linkedPath =
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx#L244";
    const items: ConversationItem[] = [
      {
        id: "msg-file-href-anchor-link",
        kind: "message",
        role: "assistant",
        text: `Open [this file](${linkedPath})`,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByText("this file"));
    expectOpenedFileTarget(
      openFileLinkMock,
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx",
      244,
    );
  });

  it("routes Windows absolute href file paths with #L anchors through the file opener", () => {
    const linkedPath =
      "I:\\gpt-projects\\CodexMonitor\\src\\features\\settings\\components\\sections\\SettingsDisplaySection.tsx#L422";
    const items: ConversationItem[] = [
      {
        id: "msg-file-href-windows-anchor-link",
        kind: "message",
        role: "assistant",
        text: `Open [settings display](${linkedPath})`,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByText("settings display"));
    expectOpenedFileTarget(
      openFileLinkMock,
      "I:\\gpt-projects\\CodexMonitor\\src\\features\\settings\\components\\sections\\SettingsDisplaySection.tsx",
      422,
    );
  });

  it("routes dotless workspace href file paths through the file opener", () => {
    const linkedPath = "/workspace/CodexMonitor/LICENSE";
    const items: ConversationItem[] = [
      {
        id: "msg-file-href-workspace-dotless-link",
        kind: "message",
        role: "assistant",
        text: `Open [license](${linkedPath})`,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByText("license"));
    expectOpenedFileTarget(openFileLinkMock, linkedPath);
  });

  it("keeps non-file relative links as normal markdown links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-help-href-link",
        kind: "message",
        role: "assistant",
        text: "See [Help](/help/getting-started)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const helpLink = screen.getByText("Help").closest("a");
    expect(helpLink?.getAttribute("href")).toBe("/help/getting-started");
    fireEvent.click(screen.getByText("Help"));
    expect(openFileLinkMock).not.toHaveBeenCalled();
  });

  it("keeps route-like absolute links as normal markdown links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-help-workspace-route-link",
        kind: "message",
        role: "assistant",
        text: "See [Workspace Home](/workspace/settings)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const link = screen.getByText("Workspace Home").closest("a");
    expect(link?.getAttribute("href")).toBe("/workspace/settings");
    fireEvent.click(screen.getByText("Workspace Home"));
    expect(openFileLinkMock).not.toHaveBeenCalled();
  });

  it("keeps deep workspace route links as normal markdown links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-help-workspace-route-link-deep",
        kind: "message",
        role: "assistant",
        text: "See [Profile](/workspace/settings/profile)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const link = screen.getByText("Profile").closest("a");
    expect(link?.getAttribute("href")).toBe("/workspace/settings/profile");
    fireEvent.click(screen.getByText("Profile"));
    expect(openFileLinkMock).not.toHaveBeenCalled();
  });

  it("keeps dot-relative non-file links as normal markdown links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-help-dot-relative-href-link",
        kind: "message",
        role: "assistant",
        text: "See [Help](./help/getting-started)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const helpLink = screen.getByText("Help").closest("a");
    expect(helpLink?.getAttribute("href")).toBe("./help/getting-started");
    fireEvent.click(screen.getByText("Help"));
    expect(openFileLinkMock).not.toHaveBeenCalled();
  });

  it("does not crash or navigate on malformed codex-file links", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-malformed-file-link",
        kind: "message",
        role: "assistant",
        text: "Bad [path](codex-file:%E0%A4%A)",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByText("path"));
    expect(openFileLinkMock).not.toHaveBeenCalled();
  });

  it("hides file parent paths when message file path display is disabled", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-hidden-path",
        kind: "message",
        role: "assistant",
        text: "Refactor candidate: `iosApp/src/views/DocumentsList/DocumentListView.swift:111`",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        showMessageFilePath={false}
      />,
    );

    const fileName = container.querySelector(".message-file-link-name");
    const lineLabel = container.querySelector(".message-file-link-line");
    expect(fileName?.textContent).toBe("DocumentListView.swift");
    expect(lineLabel?.textContent).toBe("L111");
    expect(container.querySelector(".message-file-link-path")).toBeNull();
  });

  it("renders absolute file references as workspace-relative paths", () => {
    const workspacePath = "/Users/dimillian/Documents/Dev/CodexMonitor";
    const absolutePath =
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx:244";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-absolute-inside",
        kind: "message",
        role: "assistant",
        text: `Reference: \`${absolutePath}\``,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("Markdown.tsx")).toBeTruthy();
    expect(screen.getByText("L244")).toBeTruthy();
    expect(screen.getByText("src/features/messages/components")).toBeTruthy();

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).toBeTruthy();
    fireEvent.click(fileLink as Element);
    expectOpenedFileTarget(
      openFileLinkMock,
      "/Users/dimillian/Documents/Dev/CodexMonitor/src/features/messages/components/Markdown.tsx",
      244,
    );
  });

  it("renders absolute file references outside workspace using dotdot-relative paths", () => {
    const workspacePath = "/Users/dimillian/Documents/Dev/CodexMonitor";
    const absolutePath = "/Users/dimillian/Documents/Other/IceCubesApp/file.rs:123";
    const items: ConversationItem[] = [
      {
        id: "msg-file-link-absolute-outside",
        kind: "message",
        role: "assistant",
        text: `Reference: \`${absolutePath}\``,
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        workspacePath={workspacePath}
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("file.rs")).toBeTruthy();
    expect(screen.getByText("L123")).toBeTruthy();
    expect(screen.getByText("../../Other/IceCubesApp")).toBeTruthy();

    const fileLink = container.querySelector(".message-file-link");
    expect(fileLink).toBeTruthy();
    fireEvent.click(fileLink as Element);
    expectOpenedFileTarget(
      openFileLinkMock,
      "/Users/dimillian/Documents/Other/IceCubesApp/file.rs",
      123,
    );
  });

  it("does not re-render messages while typing when message props stay stable", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-stable-1",
        kind: "message",
        role: "assistant",
        text: "Stable content",
      },
    ];
    const openTargets: [] = [];
    function Harness() {
      const [draft, setDraft] = useState("");
      const handleOpenThreadLink = useCallback(() => {}, []);

      return (
        <div>
          <input
            aria-label="Draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Messages
            items={items}
            threadId="thread-stable"
            workspaceId="ws-1"
            isThinking={false}
            openTargets={openTargets}
            selectedOpenAppId=""
            onOpenThreadLink={handleOpenThreadLink}
          />
        </div>
      );
    }

    render(<Harness />);
    expect(useFileLinkOpenerMock).toHaveBeenCalledTimes(1);
    const input = screen.getByLabelText("Draft");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    expect(useFileLinkOpenerMock).toHaveBeenCalledTimes(1);
  });

  it("uses reasoning title for the working indicator and hides title-only reasoning rows", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-1",
        kind: "reasoning",
        summary: "Scanning repository",
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Scanning repository");
    expect(container.querySelector(".reasoning-inline")).toBeNull();
  });

  it("renders reasoning rows when there is reasoning body content", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-2",
        kind: "reasoning",
        summary: "Scanning repository\nLooking for entry points",
        content: "",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 2_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector(".reasoning-inline")).toBeTruthy();
    const reasoningDetail = container.querySelector(".reasoning-inline-detail");
    expect(reasoningDetail?.textContent ?? "").toContain("Looking for entry points");
    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Scanning repository");
  });

  it("uses content for the reasoning title when summary is empty", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-content-title",
        kind: "reasoning",
        summary: "",
        content: "Plan from content\nMore detail here",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_500}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Plan from content");
    const reasoningDetail = container.querySelector(".reasoning-inline-detail");
    expect(reasoningDetail?.textContent ?? "").toContain("More detail here");
    expect(reasoningDetail?.textContent ?? "").not.toContain("Plan from content");
  });

  it("does not show a stale reasoning label from a previous turn", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-old",
        kind: "reasoning",
        summary: "Old reasoning title",
        content: "",
      },
      {
        id: "assistant-msg",
        kind: "message",
        role: "assistant",
        text: "Previous assistant response",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 800}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Working");
    expect(workingText?.textContent ?? "").not.toContain("Old reasoning title");
  });

  it("keeps the latest title-only reasoning label without rendering a reasoning row", () => {
    const items: ConversationItem[] = [
      {
        id: "reasoning-title-only",
        kind: "reasoning",
        summary: "Indexing workspace",
        content: "",
      },
      {
        id: "tool-after-reasoning",
        kind: "tool",
        title: "Command: rg --files",
        detail: "/tmp",
        toolType: "commandExecution",
        output: "",
        status: "running",
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking
        processingStartedAt={Date.now() - 1_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const workingText = container.querySelector(".working-text");
    expect(workingText?.textContent ?? "").toContain("Indexing workspace");
    expect(container.querySelector(".reasoning-inline")).toBeNull();
  });

  it("shows polling fetch countdown text instead of done duration when requested", () => {
    vi.useFakeTimers();
    try {
      const items: ConversationItem[] = [
        {
          id: "assistant-msg-done",
          kind: "message",
          role: "assistant",
          text: "Completed response",
        },
      ];

      render(
        <Messages
          items={items}
          threadId="thread-1"
          workspaceId="ws-1"
          isThinking={false}
          lastDurationMs={4_000}
          showPollingFetchStatus
          pollingIntervalMs={12_000}
          openTargets={[]}
          selectedOpenAppId=""
        />,
      );

      expect(
        screen.getByText("New message will be fetched in 12 seconds"),
      ).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(
        screen.getByText("New message will be fetched in 11 seconds"),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps done duration text when polling fetch countdown is not requested", () => {
    const items: ConversationItem[] = [
      {
        id: "assistant-msg-done-default",
        kind: "message",
        role: "assistant",
        text: "Completed response",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        lastDurationMs={4_000}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("Done in 0:04")).toBeTruthy();
  });

  it("renders answered user input items with preview and expandable details", () => {
    const items: ConversationItem[] = [
      {
        id: "user-input-1",
        kind: "userInput",
        status: "answered",
        questions: [
          {
            id: "q1",
            header: "Confirm",
            question: "Proceed with deployment?",
            answers: ["Yes", "user_note: after running tests"],
          },
        ],
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(
      screen.getByText(/Proceed with deployment\?: Yes \+1/),
    ).toBeTruthy();
    expect(screen.queryByText("user_note: after running tests")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Toggle answered input details" }),
    );

    expect(screen.getByText("user_note: after running tests")).toBeTruthy();
  });

  it("merges consecutive explore items under a single explored block", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "Find routes" }],
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "routes.ts" }],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".explore-inline")).toBeTruthy();
    });
    expect(screen.queryByText(/tool calls/i)).toBeNull();
    const exploreItems = container.querySelectorAll(".explore-inline-item");
    expect(exploreItems.length).toBe(2);
    expect(container.querySelector(".explore-inline-title")?.textContent ?? "").toContain(
      "Explored",
    );
  });

  it("uses the latest explore status when merging a consecutive run", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-started",
        kind: "explore",
        status: "exploring",
        entries: [{ kind: "search", label: "starting" }],
      },
      {
        id: "explore-finished",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "finished" }],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".explore-inline").length).toBe(1);
    });
    const exploreTitle = container.querySelector(".explore-inline-title");
    expect(exploreTitle?.textContent ?? "").toContain("Explored");
  });

  it("does not merge explore items across interleaved tools", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-a",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "Find reducers" }],
      },
      {
        id: "tool-a",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: rg reducers",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "explore-b",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "useThreadsReducer.ts" }],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      const exploreBlocks = container.querySelectorAll(".explore-inline");
      expect(exploreBlocks.length).toBe(2);
    });
    const exploreItems = container.querySelectorAll(".explore-inline-item");
    expect(exploreItems.length).toBe(2);
    expect(screen.getByText(/rg reducers/i)).toBeTruthy();
  });

  it("preserves chronology when reasoning with body appears between explore items", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-1",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "first explore" }],
      },
      {
        id: "reasoning-body",
        kind: "reasoning",
        summary: "Reasoning title\nReasoning body",
        content: "",
      },
      {
        id: "explore-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "second explore" }],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".explore-inline").length).toBe(2);
    });
    const exploreBlocks = Array.from(container.querySelectorAll(".explore-inline"));
    const reasoningDetail = container.querySelector(".reasoning-inline-detail");
    expect(exploreBlocks.length).toBe(2);
    expect(reasoningDetail).toBeTruthy();
    const [firstExploreBlock, secondExploreBlock] = exploreBlocks;
    const firstBeforeReasoning =
      firstExploreBlock.compareDocumentPosition(reasoningDetail as Node) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    const reasoningBeforeSecond =
      (reasoningDetail as Node).compareDocumentPosition(secondExploreBlock) &
      Node.DOCUMENT_POSITION_FOLLOWING;
    expect(firstBeforeReasoning).toBeTruthy();
    expect(reasoningBeforeSecond).toBeTruthy();
  });

  it("does not merge across message boundaries and does not drop messages", async () => {
    const items: ConversationItem[] = [
      {
        id: "explore-before",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "search", label: "before message" }],
      },
      {
        id: "assistant-msg",
        kind: "message",
        role: "assistant",
        text: "A message between explore blocks",
      },
      {
        id: "explore-after",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "after message" }],
      },
    ];

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      const exploreBlocks = container.querySelectorAll(".explore-inline");
      expect(exploreBlocks.length).toBe(2);
    });
    expect(screen.getByText("A message between explore blocks")).toBeTruthy();
  });

  it("counts explore entry steps in the tool group summary", async () => {
    const items: ConversationItem[] = [
      {
        id: "tool-1",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git status --porcelain=v1",
        detail: "/repo",
        status: "completed",
        output: "",
      },
      {
        id: "explore-steps-1",
        kind: "explore",
        status: "explored",
        entries: [
          { kind: "read", label: "Messages.tsx" },
          { kind: "search", label: "toolCount" },
        ],
      },
      {
        id: "explore-steps-2",
        kind: "explore",
        status: "explored",
        entries: [{ kind: "read", label: "types.ts" }],
      },
      {
        id: "tool-2",
        kind: "tool",
        toolType: "commandExecution",
        title: "Command: git diff -- src/features/messages/components/Messages.tsx",
        detail: "/repo",
        status: "completed",
        output: "",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("5 tool calls")).toBeTruthy();
    });
  });

  it("re-pins to bottom on thread switch even when previous thread was scrolled up", () => {
    const items: ConversationItem[] = [
      {
        id: "msg-shared",
        kind: "message",
        role: "assistant",
        text: "Shared tail",
      },
    ];

    const { container, rerender } = render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const messagesNode = container.querySelector(".messages.messages-full");
    expect(messagesNode).toBeTruthy();
    const scrollNode = messagesNode as HTMLDivElement;

    Object.defineProperty(scrollNode, "clientHeight", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    scrollNode.scrollTop = 100;
    fireEvent.scroll(scrollNode);

    Object.defineProperty(scrollNode, "scrollHeight", {
      configurable: true,
      value: 900,
    });

    rerender(
      <Messages
        items={items}
        threadId="thread-2"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(scrollNode.scrollTop).toBe(900);
  });

  it("shows a plan-ready follow-up prompt after a completed plan tool item", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-1",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "- Step 1",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.getByText("Plan ready")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Implement this plan" }),
    ).toBeTruthy();
  });

  it("exports plan tool-call output from the conversation view", async () => {
    exportMarkdownFileMock.mockResolvedValueOnce("/tmp/plan-7.md");
    const items: ConversationItem[] = [
      {
        id: "plan-7",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "## Steps\n- Step 1",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const exportButton = await screen.findByRole("button", {
      name: "Export .md",
    });
    fireEvent.click(exportButton);

    await waitFor(() =>
      expect(exportMarkdownFileMock).toHaveBeenCalledWith(
        "## Steps\n- Step 1",
        "plan-7.md",
      ),
    );
  });

  it("hides the plan-ready follow-up once the user has replied after the plan", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-2",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
      {
        id: "user-after-plan",
        kind: "message",
        role: "user",
        text: "OK",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("hides the plan-ready follow-up when the plan tool item is still running", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-3",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "Generating plan...",
        status: "in_progress",
        output: "Partial plan",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={true}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("shows the plan-ready follow-up once the turn stops thinking even if the plan status stays in_progress", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-stuck-in-progress",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "Generating plan...",
        status: "in_progress",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.getByText("Plan ready")).toBeTruthy();
  });

  it("calls the plan follow-up callbacks", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-4",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    const sendChangesButton = screen.getByRole("button", { name: "Send changes" });
    expect((sendChangesButton as HTMLButtonElement).disabled).toBe(true);

    const textarea = screen.getByPlaceholderText(
      "Describe what you want to change in the plan...",
    );
    fireEvent.change(textarea, { target: { value: "Add error handling" } });

    expect((sendChangesButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(sendChangesButton);
    expect(onPlanSubmitChanges).toHaveBeenCalledWith("Add error handling");
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("dismisses the plan-ready follow-up when the plan is accepted", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-accept",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Implement this plan" }),
    );
    expect(onPlanAccept).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("does not render plan-ready tagged internal user messages", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-6",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
      {
        id: "internal-user",
        kind: "message",
        role: "user",
        text: "[[cm_plan_ready:accept]] Implement this plan.",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.queryByText(/cm_plan_ready/)).toBeNull();
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("hides the plan follow-up when an input-requested bubble is active", () => {
    const onPlanAccept = vi.fn();
    const onPlanSubmitChanges = vi.fn();
    const items: ConversationItem[] = [
      {
        id: "plan-5",
        kind: "tool",
        toolType: "plan",
        title: "Plan",
        detail: "completed",
        status: "completed",
        output: "Plan text",
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
        userInputRequests={[
          {
            workspace_id: "ws-1",
            request_id: 1,
            params: {
              thread_id: "thread-1",
              turn_id: "turn-1",
              item_id: "item-1",
              questions: [],
            },
          },
        ]}
        onUserInputSubmit={vi.fn()}
        onPlanAccept={onPlanAccept}
        onPlanSubmitChanges={onPlanSubmitChanges}
      />,
    );

    expect(screen.getByText("Input requested")).toBeTruthy();
    expect(screen.queryByText("Plan ready")).toBeNull();
  });

  it("renders hook rows through the standard tool renderer", () => {
    const items: ConversationItem[] = [
      {
        id: "hook-hook-1",
        kind: "tool",
        toolType: "hook",
        title: "Hook: session-start",
        detail: "command • sync • thread • session-start.sh • Preparing",
        status: "failed",
        output: "[error] Missing config",
        durationMs: 3100,
      },
    ];

    render(
      <Messages
        items={items}
        threadId="thread-1"
        workspaceId="ws-1"
        isThinking={false}
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("hook:")).toBeTruthy();
    expect(screen.getByText("session-start")).toBeTruthy();
    expect(screen.getByText("failed • 0:03")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Toggle tool details" }));
    expect(
      screen.getByText("command • sync • thread • session-start.sh • Preparing"),
    ).toBeTruthy();
    expect(screen.getByText("[error] Missing config")).toBeTruthy();
  });
});
