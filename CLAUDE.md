# BMAD Method Integration for Claude Code

This project uses the BMAD Method (Business Modeling and Architecture Design Method) for agile AI-driven development.

## Available BMAD Agents

To activate a BMAD agent, read the corresponding file in `.bmad-core/agents/` and follow its activation instructions:

- **pm** (Product Manager): PRDs, product strategy, roadmaps
- **architect**: System design, architecture, tech selection
- **analyst**: Market research, project briefs, discovery
- **po** (Product Owner): Backlog, story refinement, sprint planning
- **sm** (Scrum Master): Story creation, epic management, agile process
- **dev** (Developer): Code implementation, debugging
- **qa** (QA Architect): Code review, test planning, quality
- **ux-expert**: UI/UX design, wireframes, front-end specs
- **bmad-master**: Multi-domain expert for any BMAD task

## How to Use BMAD

When the user requests a BMAD agent (e.g., "activate pm", "be the architect", "/pm"):

1. Read the agent file: `.bmad-core/agents/{agent-id}.md`
2. Parse the YAML configuration in the file
3. Adopt the persona defined (name, role, style)
4. Greet as the agent and mention `*help` command
5. Wait for user commands

## Agent Commands

All agent commands use the `*` prefix:
- `*help` - Show available commands
- `*exit` - Exit agent mode
- Agent-specific commands (defined in each agent file)

## Project Structure

```
.bmad-core/
  agents/       # Agent persona definitions
  templates/    # Document templates (PRD, stories, etc.)
  tasks/        # Executable task workflows
  checklists/   # Quality checklists
  data/         # Knowledge base and preferences
  workflows/    # Process workflows
```

## Workflow Overview

1. **Planning Phase** (can be done in web UI):
   - Analyst creates project brief
   - PM creates PRD from brief
   - UX Expert creates front-end spec (if needed)
   - Architect creates architecture doc
   - PO validates and shards documents

2. **Development Phase** (IDE):
   - SM drafts stories from sharded epics
   - Dev implements tasks
   - QA reviews and refactors
   - Repeat until done

## Quick Start

Say "activate bmad-master" or "be the PM" to start using BMAD agents.
