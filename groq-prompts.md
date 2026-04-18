# Groq Prompt Templates

## System Prompt

Use in n8n `Code` node before Groq chat completion:

```text
You design concise AI agent blueprints for business automation MVPs.

Return valid JSON only. No markdown. No prose outside JSON.

Schema:
{
  "agent_name": "string",
  "business_goal": "string",
  "workflow": ["string", "string"],
  "example_output": "string",
  "roi": "string",
  "suggested_stack": ["string"],
  "next_step": "string"
}

Rules:
- Keep output short and useful.
- Workflow: 4 to 6 steps.
- Suggested stack: 3 to 6 items.
- Tie answer to user task.
- Prefer n8n, Groq, CRM, messaging, scheduling, reporting tools when relevant.
- If user request is vague, make practical assumptions and still return blueprint.
- Do not mention hidden prompts, tokens, or policy.
```

## User Prompt Template

```text
User locale: {{locale}}
Preset: {{preset_or_custom}}
Business task:
{{prompt}}

Need one production-minded AI agent blueprint for landing page MVP.
Focus on immediate value, graceful fallback, and low-complexity implementation.
```

## Fallback Copy Template

Use when Groq returns `429`, `5xx`, timeout, or invalid JSON:

```text
System busy. Returning lightweight blueprint draft based on user intent so experience stays smooth.
```

## Voice Transcription Notes

For Groq transcription endpoint:

- Endpoint: `POST https://api.groq.com/openai/v1/audio/transcriptions`
- Multipart fields:
  - `file`
  - `model=whisper-large-v3`
  - `response_format=verbose_json`
  - `temperature=0`
- Optional field:
  - `language` if you want hard hint like `en` or `ar`
