# Memos Application Overview

## 1. Application Summary
**Memos** is a privacy-first, self-hosted note-taking service designed as a lightweight alternative to tools like Notion or Obsidian, but with a focus on "quick capture" (like Twitter/X) and complete data ownership. It is built with a **Go** backend and a **React** frontend.

## 2. Base Features (Out-of-the-Box)
The original repository comes with a robust set of features focused on simplicity and performance:

*   **🔒 Privacy-First**: Zero telemetry, self-hosted, and complete data ownership.
*   **📝 Markdown Support**: Full support for standard markdown syntax including lists, code blocks, and links.
*   **⚡ High Performance**: Built with Go and React for instant loading and low latency.
*   **🔗 API Access**: Comprehensive gRPC and REST APIs for integrations.
*   **🎨 UI/UX**:
    *   Clean, minimal interface with Dark Mode support.
    *   "GitHub-style" contribution graph for tracking memo activity.
    *   Responsive design for mobile and desktop.
    *   PWA (Progressive Web App) installability.
*   **🏷️ Organization**: Tagging system, pinned notes, and memo resources (attachments).
*   **👥 Social Features**: Basic user roles (Host, Admin, User) and the ability to share memos publicly.

## 3. Our Custom Enhancements
We have significantly extended the functionality of Memos, specifically focusing on **AI automation** and **mobile native feel**.

### 📱 Feature A: PWA Native Quick Capture
*Objective*: Transform the mobile web experience into something that feels like a native iOS/Android app.
*   **Bottom-Anchored Editor**: We relocated the input box from the top of the feed to the bottom of the screen (sticky footer) specifically for mobile PWA users.
*   **Standalone Detection**: Implemented a smart `useStandaloneMode` hook that detects when the app is installed on a home screen vs. running in a browser tab.
*   **Smart Layouts**:
    *   The editor automatically handles iPhone "Safe Areas" (the home bar area) to prevent UI overlap.
    *   The top editor is programmatically hidden when the bottom editor is active to avoid redundancy.
    *   Added premium UI touches like `backdrop-blur` and soft shadows.

### 🤖 Feature B: AI Daily Journal Pipeline
*Objective*: Automate the processing of raw thoughts (voice notes, images) into structured daily summaries.
*   **n8n Integration**: configured workflows to ingest data from Memos via Webhooks.
*   **Multi-Modal Processing**:
    *   **Audio**: Planned integration with Whisper for transcribing voice memos.
    *   **Vision**: Planned integration with GPT-4o for analyzing uploaded images.
*   **System Notifications**:
    *   extended the backend `UserService` (Protobuf/gRPC) to support a new `CreateUserNotification` endpoint.
    *   Built a new `SystemNotificationMessage` UI component to render AI-generated summaries directly in the user's inbox.
    *   This pipeline allows "passive journaling"—you just dump raw info, and the system summarizes it for you.

## 4. Technology Stack
*   **Backend**: Go (Golang), gRPC, SQLite/MySQL/PostgreSQL
*   **Frontend**: React, TypeScript, Tailwind CSS, Vite
*   **Protocol**: gRPC-Web / Connect-Go
*   **Infrastructure**: Docker, n8n (external automation)
