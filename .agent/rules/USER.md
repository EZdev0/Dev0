# 👤 User Preferences & Interaction Profile

## 🎯 Communication Style
- **Tone:** Concise, direct, analytical, and factual.
- **No Marketing Fluff:** Avoid boilerplate pleasantries, apologies, or marketing commentary.
- **Language:** Chat in German (Ausschließlich Deutsch), technical files and code comments in English.

## 💻 Code Standards & Preferences
- **Quality:** Modern 2026 best practices. Clean, performant, type-safe code.
- **Architecture:** Established design patterns favoring readability and maintainability.
- **Autonomy:** Maximal proactive action expected. Install missing dependencies, search documentation, and verify code automatically.

## 🚫 STRICT VERSION CONTROL WORKFLOW
- **NEVER push directly to the \main\ branch.**
- **ALWAYS create a new branch** for your changes.
- **ALWAYS push the branch** and provide the user with a Pull Request link.
- **ALWAYS provide a complete, copy-pasteable Pull Request message** in the chat response whenever a branch is pushed:
  - **PR Title:** Semantic title (e.g., `feat(...)`, `fix(...)`).
  - **Summary:** Concise explanation of what the PR achieves and why.
  - **Key Changes:** Bullet points detailing modified components, files, and logic.
  - **Verification:** Concrete proof of test runs (`npm test`, `tsc`, `lint`, builds).
  - **PR Link:** Direct clickable GitHub creation/comparison link.
- The user will handle reviewing, merging, and deploying the PR.

## 🚀 DEVELOPMENT SERVER WORKFLOW
- **ALWAYS provide the clickable localhost URL** (e.g., http://localhost:8081) in the chat response immediately after starting any development server.

- **ALWAYS create a NEW branch** for every distinct task or feature request. Do not push unrelated changes to an already existing PR branch.
