# n8n Workflow Design: Voice-to-Value Lead Capture

This workflow (v2.4.6 compatible) transforms a raw audio multipart upload into a high-fidelity structured lead response.

## 1. Webhook Intake (Node 1)
- **HTTP Method**: POST
- **Path**: `voice-to-value-lead`
- **Response Mode**: On Received
- **Binary Property**: `file`

## 2. Groq Whisper (Node 2)
- **Operation**: Transcription
- **Model**: `whisper-large-v3`
- **File Input**: `{{ $binary.file }}`
- **Language**: Auto-detect (supports English/Arabic)

## 3. Groq LLM: Lead Structuring (Node 3)
- **Model**: `openai/gpt-oss-20b` (or equivalent high-reasoning model)
- **System Prompt**:
```text
You are a senior business analyst at GrindCTRL. 
Extract lead intelligence from this transcript.
Output ONLY a valid JSON object with:
{
  "transcript": "Original transcript",
  "summary": "One sentence business summary",
  "details": {
    "name": "Extracted name or company",
    "location": "Mentioned location",
    "scale": "Team size or project scale",
    "pain_point": "Primary challenge"
  },
  "qualification": "High/Medium/Low",
  "urgency": "Immediate/Soon/Neutral",
  "follow_up": "A concise, professional 1-sentence follow-up draft.",
  "next_action": "Specific next engineering or strategy step"
}
```

## 4. HTTP Response (Node 4)
- **Response Code**: 200
- **Body**: `{{ $node["Groq LLM"].json }}`

---

## Frontend JSON Payload (Multipart Form Data)
- `file`: (Binary Audio Blob)
- `locale`: (Current language string, e.g., "en" or "ar")

## Backend JSON Response Contract
```json
{
  "transcript": "I need an AI system for my medical clinic in Riyadh...",
  "summary": "Medical clinic in Riyadh seeking administrative automation.",
  "details": {
    "name": "Riyadh Medical Clinic",
    "location": "Riyadh",
    "scale": "Clinical Staff",
    "pain_point": "Admin fatigue"
  },
  "qualification": "High",
  "urgency": "Immediate",
  "follow_up": "I will draft an HIPAA-compliant patient intake automation protocol.",
  "next_action": "Verify Riyadh-specific compliance requirements."
}
```
