# ​Architecture Code Samples
## Overview

This repository contains sanitized extractions from a proprietary production application I recently architected. It demonstrates a microservice-oriented approach to handling complex AI-generated data streams. 

## Why I shared this code:
I am sharing these specific modules to demonstrate non-trivial logic in both React frontend architecture and serverless microservice orchestration.

Note: Proprietary business logic, AI system prompts, and configuration secrets have been safely removed to protect my client's intellectual property.

## 1. React Frontend Architecture (TipTapEditor.tsx)
- Demonstrates advanced React state management and custom hook implementation.
- Showcases the extension of a complex rich-text editor (TipTap) with custom Nodes and interactive floating menus.
- Handles dynamic synchronization between code and visual rendering modes.

## 2. Microservice Orchestration (generate-bio.js)
- Demonstrates a resilient serverless microservice handling complex API orchestration.
- Implements custom exponential backoff and retry logic (generateWithRetry) to gracefully handle 503/service unavailable states.
- Features scalable rate-limiting using Vercel KV (Redis) and strict input validation.
