# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Synapse is a new kind of operating system where AI is the OS layer — the AI is not an app running on the OS, it *is* the operating system.

## Current State

This repository is at project inception. Only a `README.md` exists. There is no build system, source code, or configuration yet.

**Update this file as the project grows** — add commands, architecture notes, and conventions as they are established.

## When the Project Grows

Once code is added, document the following here:

- **Build / dev commands** (how to install, start, test, lint)
- **Monorepo structure** if applicable (e.g. `apps/`, `packages/`)
- **Key architectural decisions** — how AI interfaces with the OS layer, IPC model, process model, etc.
- **Environment variables** required to run the project
- **Testing approach** — unit, integration, e2e and how to run a single test
