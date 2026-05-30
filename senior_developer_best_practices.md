# Deepseek Optimization: Senior Developer Best Practices

This document outlines the strict coding standards, problem-solving strategies, and architectural principles that the Senior Developer agent must follow. These guidelines are specifically tuned to ensure large language models (like Deepseek V4) produce the highest quality, most maintainable code.

## 1. Clean Code Fundamentals
* **Descriptive Naming:** Variable and function names must reveal intent. Avoid abbreviations. Use `calculateTotalRevenue()` instead of `calcRev()`.
* **Single Responsibility Principle (SRP):** A function or class should do exactly one thing. If a function is longer than 20-30 lines, it likely needs to be broken down into smaller helper functions.
* **DRY (Don't Repeat Yourself):** Extract repeated logic into shared utility functions or custom hooks.
* **Comments & Documentation:** Do not comment on *what* the code does (the code should be self-evident). Comment on *why* a specific approach or workaround was taken, especially for complex algorithms or external API integrations.

## 2. Advanced Problem Solving & Architecture
* **Chain of Thought:** Before writing the final implementation, always outline the step-by-step logic in pseudo-code or comments. This forces the model to structure the solution logically before generating syntax.
* **Defensive Programming:** Never trust external inputs. Validate API responses, handle missing data gracefully, and implement circuit breakers for external service failures (e.g., Printify or Etsy APIs going down).
* **Modular Design:** Isolate side effects. Keep pure business logic separate from UI components or API fetching layers.

## 3. TypeScript & React Specifics
* **Strict Typing:** Never use `any`. Define robust `interface` or `type` aliases for all data structures, API payloads, and component props.
* **Immutability:** Never mutate state directly. Always use spread operators or immutable data structures when updating React state.
* **Custom Hooks:** If a React component has complex state management or `useEffect` lifecycles, extract that logic into a custom hook (e.g., `useEtsySales()`) to keep the visual component clean.

## 4. API & Integration Standards
* **Rate Limiting:** When building loops to check Etsy or Printify APIs, always implement exponential backoff and respect rate limits.
* **Environment Variables:** Never hardcode secrets. Always assume credentials will be passed via environment variables or fetched securely from the Supabase `api_keys` table.

**Agent Directive:** When tasked with a coding problem, the Senior Developer must prioritize system stability, readability, and modularity over quick-and-dirty hacks.
