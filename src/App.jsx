import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");

  const [loadingFile, setLoadingFile] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // =========================
  // LOAD FILES
  // =========================

  const loadFiles = async () => {
    try {
      const response = await fetch(`${API_URL}/api/files`);

      if (!response.ok) {
        throw new Error("Files API failed");
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error("Files load error:", error);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  // =========================
  // OPEN FILE
  // =========================

  const openFile = async (filename) => {
    setSelectedFile(filename);
    setLoadingFile(true);
    setFileContent("");

    try {
      const response = await fetch(
        `${API_URL}/api/files/${encodeURIComponent(filename)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "File read failed");
      }

      setFileContent(data.content || "");
    } catch (error) {
      console.error("File open error:", error);
      setFileContent(`Error: ${error.message}`);
    } finally {
      setLoadingFile(false);
    }
  };

  // =========================
  // CLOSE FILE
  // =========================

  const closeFile = () => {
    setSelectedFile(null);
    setFileContent("");
  };

  // =========================
  // NEW CHAT
  // =========================

  const handleNewChat = async () => {
    try {
      const response = await fetch(`${API_URL}/api/chat/clear`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("New Chat failed");
      }

      setMessages([]);
      setMessage("");
      closeFile();
    } catch (error) {
      console.error("New Chat error:", error);

      setMessages([]);
      setMessage("");
      closeFile();
    }
  };

  // =========================
  // STARTER PROMPT
  // =========================

  const handleStarterPrompt = (prompt) => {
  setMessage(prompt);
};

  // =========================
  // HANDLE CHAT
  // =========================

  const handleSubmit = async (event) => {
    event.preventDefault();

    const userMessage = message.trim();

    if (!userMessage || isThinking) {
      return;
    }

    setMessage("");
    setIsThinking(true);

    setMessages((previousMessages) => [
      ...previousMessages,
      {
        role: "user",
        content: userMessage,
      },
    ]);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Backend request failed.";

        try {
          const errorData = await response.json();

          if (errorData.reply) {
            errorMessage = errorData.reply;
          }

          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore JSON parsing error
        }

        throw new Error(errorMessage);
      }

      const contentType =
        response.headers.get("content-type") || "";

      // =========================
      // NORMAL JSON RESPONSE
      // =========================

      if (contentType.includes("application/json")) {
        const data = await response.json();

        const reply =
          data.reply ||
          data.message ||
          "Operation completed.";

        setMessages((previousMessages) => [
          ...previousMessages,
          {
            role: "assistant",
            content: reply,
          },
        ]);

        await loadFiles();

        return;
      }

      // =========================
      // STREAMING RESPONSE
      // =========================

      if (!response.body) {
        throw new Error("Streaming response body unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let aiResponse = "";

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: "",
        },
      ]);

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, {
          stream: true,
        });

        aiResponse += chunk;

        setMessages((previousMessages) => {
          const updatedMessages = [...previousMessages];
          const lastIndex = updatedMessages.length - 1;

          if (
            lastIndex >= 0 &&
            updatedMessages[lastIndex].role === "assistant"
          ) {
            updatedMessages[lastIndex] = {
              ...updatedMessages[lastIndex],
              content: aiResponse,
            };
          }

          return updatedMessages;
        });
      }

      const finalChunk = decoder.decode();

      if (finalChunk) {
        aiResponse += finalChunk;

        setMessages((previousMessages) => {
          const updatedMessages = [...previousMessages];
          const lastIndex = updatedMessages.length - 1;

          if (
            lastIndex >= 0 &&
            updatedMessages[lastIndex].role === "assistant"
          ) {
            updatedMessages[lastIndex] = {
              ...updatedMessages[lastIndex],
              content: aiResponse,
            };
          }

          return updatedMessages;
        });
      }

      await loadFiles();
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((previousMessages) => [
        ...previousMessages,
        {
          role: "assistant",
          content: `Error: ${error.message}`,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // =========================
  // FILE ICON
  // =========================

  const getFileIcon = (filename) => {
    if (filename.endsWith(".jsx")) {
      return "[JSX]";
    }

    if (filename.endsWith(".js")) {
      return "[JS]";
    }

    if (filename.endsWith(".css")) {
      return "[CSS]";
    }

    if (filename.endsWith(".json")) {
      return "[JSON]";
    }

    return "[FILE]";
  };

  return (
    <div className="app">

      {/* =========================
          HEADER
      ========================= */}

      <header className="header">
        <div className="header-left">
          <h1>AI Developer Agent</h1>

          <span className="status">
            Online
          </span>
        </div>

        <button
          type="button"
          className="new-chat-btn"
          onClick={handleNewChat}
          disabled={isThinking}
        >
          New Chat
        </button>
      </header>

      {/* =========================
          WORKSPACE
      ========================= */}

      <div className="workspace">

        {/* =========================
            FILE SIDEBAR
        ========================= */}

        <aside className="sidebar">

          <div className="sidebar-header">
            <h2>Files</h2>

            <button
              type="button"
              onClick={loadFiles}
              className="refresh-btn"
              title="Refresh files"
            >
              Refresh
            </button>
          </div>

          <div className="file-list">

            {files.length === 0 ? (
              <p className="no-files">
                No files found
              </p>
            ) : (
              files.map((file) => (
                <button
                  key={file}
                  type="button"
                  className={`file-item ${
                    selectedFile === file
                      ? "selected-file"
                      : ""
                  }`}
                  onClick={() => openFile(file)}
                >
                  <span className="file-icon">
                    {getFileIcon(file)}
                  </span>

                  <span className="file-name">
                    {file}
                  </span>
                </button>
              ))
            )}

          </div>
        </aside>

        {/* =========================
            MAIN AREA
        ========================= */}

        <main className="main-area">

          {selectedFile ? (

            <section className="file-viewer">

              <div className="file-viewer-header">
                <h2>{selectedFile}</h2>

                <button
                  type="button"
                  onClick={closeFile}
                  className="close-btn"
                >
                  Close
                </button>
              </div>

              {loadingFile ? (
                <div className="loading">
                  Loading file...
                </div>
              ) : (
                <pre className="code-viewer">
                  <code>{fileContent}</code>
                </pre>
              )}

            </section>

          ) : (

            <section className="chat-container">

              {/* =========================
                  WELCOME SCREEN
              ========================= */}

              {messages.length === 0 && (
                <div className="welcome">

                  <div className="welcome-icon">
                    AI
                  </div>

                  <h2>
                    Welcome to AI Developer Agent
                  </h2>

                  <p>
                    Your local AI assistant for understanding
                    and modifying React projects.
                  </p>

                  <div className="starter-grid">

                    <button
                      type="button"
                      className="starter-card"
                      onClick={() =>
                        handleStarterPrompt(
                          "Explain what this project does and list its main features."
                        )
                      }
                    >
                      <strong>
                        Explain my project
                      </strong>

                      <span>
                        Understand the project structure and features
                      </span>
                    </button>

                    <button
                      type="button"
                      className="starter-card"
                      onClick={() =>
                        handleStarterPrompt(
                          "Read App.jsx and explain its main responsibilities."
                        )
                      }
                    >
                      <strong>
                        Read a file
                      </strong>

                      <span>
                        Ask the AI to understand your source code
                      </span>
                    </button>

                    <button
                      type="button"
                      className="starter-card"
                      onClick={() =>
                        handleStarterPrompt(
                          'Create a React component named DemoCard.jsx with a card containing the text "Hello from AI Developer Agent".'
                        )
                      }
                    >
                      <strong>
                        Create a component
                      </strong>

                      <span>
                        Generate a new React component
                      </span>
                    </button>

                  </div>

                </div>
              )}

              {/* =========================
                  MESSAGES
              ========================= */}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message ${
                    msg.role === "user"
                      ? "user-message"
                      : "ai-message"
                  }`}
                >

                  <div className="message-role">
                    {msg.role === "user"
                      ? "You"
                      : "AI"}
                  </div>

                  <ReactMarkdown>
                    {msg.content}
                  </ReactMarkdown>

                </div>
              ))}

              {isThinking && (
                <div className="thinking">
                  AI is thinking...
                </div>
              )}

            </section>

          )}

        </main>

      </div>

      {/* =========================
          INPUT
      ========================= */}

      <form
        className="input-area"
        onSubmit={handleSubmit}
      >

        <input
          type="text"
          placeholder="Ask your AI Developer Agent..."
          value={message}
          disabled={isThinking}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
        />

        <button
          type="submit"
          disabled={
            isThinking ||
            !message.trim()
          }
        >
          {isThinking ? "..." : "Send"}
        </button>

      </form>

    </div>
  );
}

export default App;