---
name: watsonx-orchestrate
description: explains how to work with watsonx-orchestrate (also: wxo, orchestrate) and the corresponding adk (cli). How to create & update agents, tools and other entities in orchestrate. Use this whenever asked anything wxo / orchestrate / watsonx orchestrate related.
---

# watsonx Orchestrate

Use the `uv run orchestrate` command. It is the CLI for interacting with watsonx Orchestrate.

First activate the correct environment in Orchestrate.

Feel free to import `WXO_API_KEY` and `WXO_ENV_NAME` from `.env` and pass them to the ADK to authenticate.

```sh
uv run orchestrate env activate <env-name>

# or

set -a; source .env; set +a; uv run orchestrate env activate "$WXO_ENV_NAME" --api-key "$WXO_API_KEY"
```

The environment name is configured in `.env` as `WXO_ENV_NAME`.

Use `uv run orchestrate --help` to find out what you can do with the CLI.

## This Codebase

When working on agents, edit the YAMLs and upload them to Orchestrate to see if your changes work.

Agent definitions are in `wxo/agents/`.
Tools are in `wxo/tools/`.

## Debugging

### Running Prompts To Test

```sh
uv run orchestrate chat ask --agent-name <agent-name> [OPTIONS] "<your prompt>"
```

### Getting Agent Run Logs

Use this to get agent run logs:

```sh
uv run orchestrate observability traces search --last 1h --agent-name event_monitor_agent
```

## Examples

Example of importing Python tools in Orchestrate:

```sh
uv run orchestrate tools import -k python -f my-tool.py -r requirements.txt -a app1 -a app2
```

Example shape of an agent YAML:

```yaml
spec_version: v1
kind: native
name: example_agent
description: ...
context_access_enabled: true
context_variables: []
llm: groq/openai/gpt-oss-120b
style: default
instructions: |
  ...
collaborators: []
tools: []
plugins: {}
knowledge_base: []
```

Example of a tool:

```python
# test_tool.py
from ibm_watsonx_orchestrate.agent_builder.tools import tool

@tool()
def my_tool(input: str) -> str:
    """Executes the tool's action based on the provided input.

    Args:
        input (str): The tool's input.

    Returns:
        str: The tool's output.
    """

    # functionality of the tool

    return f"Hello, {input}"
```
