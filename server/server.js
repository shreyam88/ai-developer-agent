const express = require("express");
const { parse } = require("@babel/parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const srcPath = path.join(__dirname, "..", "src");

/* =========================
   CHAT HISTORY
========================= */

const chatHistory = [];

const MAX_HISTORY = 20;

function addToHistory(role, content) {
  chatHistory.push({
    role,
    content,
  });

  if (chatHistory.length > MAX_HISTORY) {
    chatHistory.splice(
      0,
      chatHistory.length - MAX_HISTORY
    );
  }
}

function getHistoryText() {
  if (chatHistory.length === 0) {
    return "No previous conversation.";
  }

  return chatHistory
    .map((item) => {
      const role =
        item.role === "user"
          ? "USER"
          : "ASSISTANT";

      return `${role}: ${item.content}`;
    })
    .join("\n\n");
}

/* =========================
   FILE PATH
========================= */

function getSrcPath(filename) {
  return path.join(
    srcPath,
    path.basename(filename)
  );
}

/* =========================
   JSX VALIDATION
========================= */

function isValidJSX(code) {
  try {
    parse(code, {
      sourceType: "module",
      plugins: ["jsx"],
    });

    return true;
  } catch (error) {
    console.log(
      "❌ JSX Validation Error:",
      error.message
    );

    return false;
  }
}

/* =========================
   CLEAN CODE
========================= */

function cleanCode(code) {
  return code
    .trim()
    .replace(/^```jsx\s*/i, "")
    .replace(/^```javascript\s*/i, "")
    .replace(/^```js\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

/* =========================
   OLLAMA
========================= */

async function callOllama(
  prompt,
  stream = false
) {
  console.log(
    "🧠 Sending request to Ollama..."
  );

  const response = await fetch(
    "http://127.0.0.1:11434/api/generate",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        model: "llama3.2",
        prompt,
        stream,

        options: {
          num_predict: 1200,
          temperature: 0.2,
        },
      }),
    }
  );

  console.log(
    "🧠 Ollama status:",
    response.status
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Ollama error ${response.status}: ${errorText}`
    );
  }

  return response;
}

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    message:
      "AI Developer Agent Backend is running 🚀",
  });
});

/* =========================
   FILE LIST
========================= */

app.get("/api/files", (req, res) => {
  try {
    const files =
      fs.readdirSync(srcPath);

    res.json({
      files,
    });
  } catch (error) {
    console.error(
      "❌ Files Error:",
      error
    );

    res.status(500).json({
      error:
        "Files read nahi ho pa rahi hain.",
    });
  }
});

/* =========================
   READ FILE
========================= */

app.get(
  "/api/files/:filename",
  (req, res) => {
    const filename =
      path.basename(
        req.params.filename
      );

    const filePath =
      getSrcPath(filename);

    try {
      const content =
        fs.readFileSync(
          filePath,
          "utf-8"
        );

      res.json({
        filename,
        content,
      });
    } catch (error) {
      console.error(
        "❌ Read Error:",
        error
      );

      res.status(404).json({
        error:
          `${filename} nahi mili.`,
      });
    }
  }
);

/* =========================
   CREATE FILE
========================= */

app.post(
  "/api/files/create",
  (req, res) => {
    const {
      filename,
      content,
    } = req.body;

    if (!filename) {
      return res.status(400).json({
        error:
          "Filename required hai.",
      });
    }

    const safeFilename =
      path.basename(filename);

    const filePath =
      getSrcPath(safeFilename);

    const fileContent =
      content || "";

    if (
      safeFilename.endsWith(
        ".jsx"
      )
    ) {
      if (
        !isValidJSX(
          fileContent
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid JSX. File create nahi hui.",
        });
      }
    }

    try {
      fs.writeFileSync(
        filePath,
        fileContent,
        "utf-8"
      );

      console.log(
        `✅ Created: ${safeFilename}`
      );

      res.json({
        success: true,
        message:
          "File successfully create ho gayi.",
        filename:
          safeFilename,
      });
    } catch (error) {
      console.error(
        "❌ Create Error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "File create nahi ho paayi.",
      });
    }
  }
);

/* =========================
   UPDATE FILE
========================= */

app.put(
  "/api/files/:filename",
  (req, res) => {
    const filename =
      path.basename(
        req.params.filename
      );

    const {
      content,
    } = req.body;

    if (
      content === undefined
    ) {
      return res.status(400).json({
        error:
          "Content required hai.",
      });
    }

    const filePath =
      getSrcPath(filename);

    try {
      fs.writeFileSync(
        filePath,
        content,
        "utf-8"
      );

      console.log(
        `✅ Updated: ${filename}`
      );

      res.json({
        success: true,
        message:
          "File successfully update ho gayi.",
        filename,
      });
    } catch (error) {
      console.error(
        "❌ Update Error:",
        error
      );

      res.status(500).json({
        success: false,
        error:
          "File update nahi ho paayi.",
      });
    }
  }
);
app.post("/api/chat/clear", (req, res) => {
  chatHistory.length = 0;

  console.log("🗑️ Chat history cleared.");

  res.json({
    success: true,
    message: "Chat history clear ho gayi.",
  });
});

/* =========================
   CHAT
========================= */

app.post(
  "/api/chat",
  async (req, res) => {
    const {
      message,
    } = req.body;

    if (
      !message ||
      !message.trim()
    ) {
      return res.status(400).json({
        reply:
          "❌ Message empty hai.",
      });
    }

    console.log(
      "\n================================="
    );

    console.log(
      "USER:",
      message
    );

    console.log(
      "================================="
    );

    try {
      const lowerMessage =
        message.toLowerCase();

      /* =========================
         READ FILE
      ========================= */

      const readMatch =
        message.match(
          /(?:read|open|show|explain)\s+(?:the\s+)?(?:contents?\s+of\s+)?([A-Za-z0-9_.-]+\.(?:jsx|js|css|json|txt))/i
        );

      if (readMatch) {
        const filename =
          path.basename(
            readMatch[1]
          );

        const filePath =
          getSrcPath(filename);

        console.log(
          `📖 Reading: ${filename}`
        );

        if (
          !fs.existsSync(
            filePath
          )
        ) {
          return res.json({
            reply:
              `❌ ${filename} nahi mili.`,
          });
        }

        const content =
          fs.readFileSync(
            filePath,
            "utf-8"
          );

        const prompt = `
You are an AI Developer Agent.

Explain the following existing project file.

FILE NAME:
${filename}

ACTUAL FILE CONTENT:
--------------------
${content}
--------------------

USER REQUEST:
${message}

RULES:
- Explain ONLY the code that actually exists.
- Do not invent functionality.
- Do not claim something exists if it does not.
- Keep the explanation beginner friendly.
`;

        const ollamaResponse =
          await callOllama(
            prompt,
            false
          );

        const data =
          await ollamaResponse.json();

        const reply =
          data.response ||
          "File explanation nahi mili.";

        addToHistory(
          "user",
          message
        );

        addToHistory(
          "assistant",
          reply
        );

        return res.json({
          reply,
        });
      }

      /* =========================
         DELETE FILE
      ========================= */

      const deleteMatch =
        message.match(
          /(?:delete|remove)\s+(?:the\s+)?([A-Za-z0-9_.-]+\.(?:jsx|js|css|json|txt))/i
        );

      if (deleteMatch) {
        const filename =
          path.basename(
            deleteMatch[1]
          );

        const filePath =
          getSrcPath(filename);

        console.log(
          `🗑️ Delete request: ${filename}`
        );

        if (
          !fs.existsSync(
            filePath
          )
        ) {
          return res.json({
            reply:
              `❌ ${filename} nahi mili.`,
          });
        }

        fs.unlinkSync(
          filePath
        );

        console.log(
          `✅ Deleted: ${filename}`
        );

        const reply =
          `✅ ${filename} successfully delete ho gayi!`;

        addToHistory(
          "user",
          message
        );

        addToHistory(
          "assistant",
          reply
        );

        return res.json({
          reply,
        });
      }

      /* =========================
         APP.JSX BUTTON
      ========================= */

      const isAddButtonRequest =
        lowerMessage.includes(
          "app.jsx"
        ) &&
        lowerMessage.includes(
          "button"
        ) &&
        (
          lowerMessage.includes(
            "add"
          ) ||
          lowerMessage.includes(
            "create"
          )
        );

      if (
        isAddButtonRequest
      ) {
        const appFilePath =
          getSrcPath(
            "App.jsx"
          );

        if (
          !fs.existsSync(
            appFilePath
          )
        ) {
          return res.json({
            reply:
              "❌ App.jsx nahi mili.",
          });
        }

        const existingCode =
          fs.readFileSync(
            appFilePath,
            "utf-8"
          );

        let buttonText =
          "Click Me";

        const quotedText =
          message.match(
            /["']([^"']+)["']/
          );

        if (quotedText) {
          buttonText =
            quotedText[1];
        }

        const button = `
          <button type="button">
            ${buttonText}
          </button>
`;

        let updatedCode;

        const formIndex =
          existingCode.lastIndexOf(
            "</form>"
          );

        if (
          formIndex !== -1
        ) {
          updatedCode =
            existingCode.slice(
              0,
              formIndex
            ) +
            button +
            existingCode.slice(
              formIndex
            );
        } else {
          const mainIndex =
            existingCode.lastIndexOf(
              "</main>"
            );

          if (
            mainIndex === -1
          ) {
            return res.json({
              reply:
                "❌ App.jsx mein suitable location nahi mili.",
            });
          }

          updatedCode =
            existingCode.slice(
              0,
              mainIndex
            ) +
            button +
            existingCode.slice(
              mainIndex
            );
        }

        if (
          !isValidJSX(
            updatedCode
          )
        ) {
          return res.json({
            reply:
              "❌ Modified JSX invalid hai. File update nahi hui.",
          });
        }

        fs.writeFileSync(
          appFilePath,
          updatedCode,
          "utf-8"
        );

        console.log(
          "✅ App.jsx modified."
        );

        const reply =
          `✅ App.jsx mein "${buttonText}" button successfully add ho gaya!`;

        addToHistory(
          "user",
          message
        );

        addToHistory(
          "assistant",
          reply
        );

        return res.json({
          reply,
        });
      }

      /* =========================
         CREATE REACT COMPONENT
      ========================= */

      const isCreateReactFileRequest =
        (
          lowerMessage.includes(
            "create"
          ) ||
          lowerMessage.includes(
            "make"
          ) ||
          lowerMessage.includes(
            "build"
          )
        ) &&
        (
          lowerMessage.includes(
            ".jsx"
          ) ||
          lowerMessage.includes(
            "react component"
          )
        );

      if (
        isCreateReactFileRequest
      ) {
        const filenameMatch =
          message.match(
            /([A-Za-z0-9_-]+\.jsx)/i
          );

        if (
          !filenameMatch
        ) {
          return res.json({
            reply:
              "❌ JSX filename nahi mila.",
          });
        }

        const filename =
          path.basename(
            filenameMatch[1]
          );

        console.log(
          `🟢 Creating: ${filename}`
        );

        const prompt = `
Create a React JSX component.

Filename:
${filename}

User request:
${message}

STRICT RULES:
- Return ONLY valid React JSX code.
- No explanation.
- No markdown.
- No code fences.
- Use a functional component.
- Export the component as default.
- Properly close every JSX tag.
- Do not add unrelated features.
`;

        const ollamaResponse =
          await callOllama(
            prompt,
            false
          );

        const data =
          await ollamaResponse.json();

        const componentCode =
          cleanCode(
            data.response || ""
          );

        if (
          !isValidJSX(
            componentCode
          )
        ) {
          return res.json({
            reply:
              `❌ ${filename} ka generated JSX invalid hai. File create nahi hui.`,
          });
        }

        const filePath =
          getSrcPath(
            filename
          );

        fs.writeFileSync(
          filePath,
          componentCode,
          "utf-8"
        );

        console.log(
          `✅ Created: ${filename}`
        );

        const reply =
          `✅ ${filename} successfully create ho gayi!`;

        addToHistory(
          "user",
          message
        );

        addToHistory(
          "assistant",
          reply
        );

        return res.json({
          reply,
        });
      }

      /* =========================
         MODIFY JSX
      ========================= */

      const modifyMatch =
        message.match(
          /(?:modify|update|change|edit)\s+([A-Za-z0-9_.-]+\.jsx)/i
        );

      if (
        modifyMatch
      ) {
        const filename =
          path.basename(
            modifyMatch[1]
          );

        const filePath =
          getSrcPath(filename);

        console.log(
          `🛠️ Modifying: ${filename}`
        );

        if (
          !fs.existsSync(
            filePath
          )
        ) {
          return res.json({
            reply:
              `❌ ${filename} nahi mili.`,
          });
        }

        const oldCode =
          fs.readFileSync(
            filePath,
            "utf-8"
          );

        const prompt = `
You are an AI Developer Agent.

Modify this existing React JSX file.

FILE:
${filename}

CURRENT CODE:
--------------------
${oldCode}
--------------------

USER REQUEST:
${message}

STRICT RULES:
1. Return ONLY complete modified JSX code.
2. No markdown.
3. No code fences.
4. No explanation.
5. Preserve existing functionality.
6. Make ONLY requested changes.
7. Return valid JSX.
8. Keep imports correct.
9. Keep export default correct.
10. Do not invent unrelated features.
`;

        const ollamaResponse =
          await callOllama(
            prompt,
            false
          );

        const data =
          await ollamaResponse.json();

        const newCode =
          cleanCode(
            data.response || ""
          );

        if (
          !isValidJSX(
            newCode
          )
        ) {
          console.log(
            "❌ Invalid JSX. Original preserved."
          );

          return res.json({
            reply:
              `❌ AI ne invalid JSX generate kiya. ${filename} ki original file safe rakhi gayi.`,
          });
        }

        const backupPath =
          `${filePath}.backup`;

        fs.writeFileSync(
          backupPath,
          oldCode,
          "utf-8"
        );

        fs.writeFileSync(
          filePath,
          newCode,
          "utf-8"
        );

        console.log(
          `✅ Modified: ${filename}`
        );

        const reply =
          `✅ ${filename} successfully modify ho gayi!`;

        addToHistory(
          "user",
          message
        );

        addToHistory(
          "assistant",
          reply
        );

        return res.json({
          reply,
        });
      }

      /* =========================
         NORMAL AI STREAMING
         WITH CHAT HISTORY
      ========================= */

      console.log(
        "🤖 Normal AI streaming request..."
      );

      /*
        Current message ko history mein
        add karne se pehle old history
        capture kar rahe hain.
      */

      const previousHistory =
        getHistoryText();

      const prompt = `
You are an AI Developer Agent.

You are having a continuous conversation
with the user.

Previous conversation:
======================
${previousHistory}
======================

Current user message:
${message}

Instructions:
- Understand the previous conversation.
- Use previous messages when relevant.
- Answer the current question directly.
- Do not repeat unnecessary information.
- If the user refers to something discussed earlier,
  use the conversation context.
- Be helpful and beginner friendly.
`;

      /*
        User message history mein save karo.
      */

      addToHistory(
        "user",
        message
      );

      const ollamaResponse =
        await callOllama(
          prompt,
          true
        );

      console.log(
        "✅ Ollama stream connected."
      );

      res.status(200);

      res.setHeader(
        "Content-Type",
        "text/plain; charset=utf-8"
      );

      res.setHeader(
        "Cache-Control",
        "no-cache, no-transform"
      );

      res.setHeader(
        "X-Accel-Buffering",
        "no"
      );

      const reader =
        ollamaResponse.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";
      let fullResponse = "";

      while (true) {
        const {
          done,
          value,
        } = await reader.read();

        if (done) {
          break;
        }

        buffer +=
          decoder.decode(
            value,
            {
              stream: true,
            }
          );

        const lines =
          buffer.split("\n");

        buffer =
          lines.pop() || "";

        for (
          const line of lines
        ) {
          if (
            !line.trim()
          ) {
            continue;
          }

          try {
            const data =
              JSON.parse(line);

            if (
              data.response
            ) {
              fullResponse +=
                data.response;

              res.write(
                data.response
              );
            }
          } catch (error) {
            console.log(
              "⚠️ JSON chunk skipped:",
              error.message
            );
          }
        }
      }

      /* =========================
         FINAL BUFFER
      ========================= */

      if (
        buffer.trim()
      ) {
        try {
          const data =
            JSON.parse(
              buffer
            );

          if (
            data.response
          ) {
            fullResponse +=
              data.response;

            res.write(
              data.response
            );
          }
        } catch (error) {
          console.log(
            "⚠️ Final JSON warning:",
            error.message
          );
        }
      }

      /*
        Assistant response history mein save.
      */

      addToHistory(
        "assistant",
        fullResponse
      );

      res.end();

      console.log(
        "✅ Streaming completed."
      );

      console.log(
        "💬 Chat history:",
        chatHistory.length,
        "messages"
      );
    } catch (error) {
      console.error(
        "\n❌ SERVER ERROR:"
      );

      console.error(
        error
      );

      if (
        !res.headersSent
      ) {
        return res.status(500).json({
          reply:
            `❌ Backend/AI error: ${error.message}`,
        });
      }

      res.end();
    }
  }
);

/* =========================
   START SERVER
========================= */

const PORT = 5000;

app.listen(
  PORT,
  () => {
    console.log(
      "\n🚀 AI Developer Agent Backend"
    );

    console.log(
      "📡 Server: http://localhost:5000"
    );

    console.log(
      "🧠 Ollama: http://localhost:11434"
    );

    console.log(
      `📂 Source: ${srcPath}`
    );

    console.log(
      "💬 Chat History: Enabled"
    );

    console.log(
      "\n✅ Server ready!\n"
    );
  }
);