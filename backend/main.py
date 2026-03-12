import os
import re
from typing import Dict, List, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1")

if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY in environment.")

client = OpenAI(api_key=OPENAI_API_KEY)
app = FastAPI(title="Appy Health Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# In-memory session store
# -----------------------------
SESSIONS: Dict[str, dict] = {}


# -----------------------------
# Models
# -----------------------------
class ChatRequest(BaseModel):
    session_id: str
    user_message: Optional[str] = None
    user_profile: Optional[dict] = None


class ChatResponse(BaseModel):
    session_id: str
    state: str
    reply: str
    collected_info: dict


# -----------------------------
# Conversation states
# -----------------------------
StateType = Literal[
    "greeting",
    "symptom_collection",
    "insurance_collection",
    "done",
    "emergency"
]


# -----------------------------
# Session management
# -----------------------------
def get_or_create_session(session_id: str, user_profile: Optional[dict] = None) -> dict:
    if session_id not in SESSIONS:
        collected_info = {
            "symptom": None,
            "duration": None,
            "severity": None,
            "doctor_or_department": None,
            "gender": None,
            "birth_date": None,
            "insurance_provider": None,
            "insurance_plan": None,
            "member_id": None,
        }
        # Pre-fill fields from user profile
        if user_profile:
            for field in ("insurance_provider", "insurance_plan", "member_id", "gender"):
                if user_profile.get(field):
                    collected_info[field] = user_profile[field]
            if user_profile.get("birthDate"):
                collected_info["birth_date"] = user_profile["birthDate"]

        SESSIONS[session_id] = {
            "state": "greeting",
            "history": [],
            "collected_info": collected_info,
            "user_profile": user_profile or {},
        }
    return SESSIONS[session_id]


# -----------------------------
# Emergency detection
# -----------------------------
def detect_emergency(text: str) -> bool:
    patterns = [
        r"chest pain", r"shortness of breath", r"can't breathe",
        r"trouble breathing", r"passed out", r"unconscious",
        r"heavy bleeding", r"stroke", r"suicidal",
        r"hurt myself", r"hurt others", r"kill myself",
        r"harm myself", r"harm others",
    ]
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


# -----------------------------
# Info extraction
# -----------------------------
def maybe_extract_basic_info(text: str, info: dict) -> dict:
    if info["symptom"] is None:
        info["symptom"] = text[:120]

    for pattern in [r"(\d+\s*days?)", r"(\d+\s*weeks?)", r"(\d+\s*months?)",
                    r"(\d+\s*hours?)", r"(since yesterday)", r"(since today)",
                    r"(for a week)", r"(for two weeks)", r"(for a few days)"]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m and info["duration"] is None:
            info["duration"] = m.group(1)
            break

    for pattern in [r"\b(mild)\b", r"\b(moderate)\b", r"\b(severe)\b", r"\b(very severe)\b"]:
        m = re.search(pattern, text, re.IGNORECASE)
        if m and info["severity"] is None:
            info["severity"] = m.group(1)
            break

    insurance_keywords = [
        "aetna", "cigna", "unitedhealthcare", "uhc",
        "blue cross", "blue shield", "medicare",
        "medicaid", "humana", "kaiser", "anthem",
    ]
    lower = text.lower()
    for kw in insurance_keywords:
        if kw in lower and info["insurance_provider"] is None:
            info["insurance_provider"] = kw
            break

    return info


def extract_optional_info(text: str, info: dict) -> dict:
    """Extract gender, birth date, and member ID from free text."""
    # Gender
    if info["gender"] is None:
        gender_patterns = [
            (r"\b(male|man)\b", "Male"),
            (r"\b(female|woman)\b", "Female"),
            (r"\bnon.?binary\b", "Non-binary"),
        ]
        for pattern, value in gender_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                info["gender"] = value
                break

    # Birth date — MM/DD/YYYY, YYYY, or "Month Day, Year"
    if info["birth_date"] is None:
        m = re.search(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b", text)
        if m:
            info["birth_date"] = m.group(1)
        else:
            m = re.search(
                r"\b(January|February|March|April|May|June|July|August|"
                r"September|October|November|December)\s+\d{1,2},?\s+\d{4}\b",
                text, re.IGNORECASE
            )
            if m:
                info["birth_date"] = m.group(0)
            else:
                m = re.search(r"\bborn\s+(?:in\s+)?(\d{4})\b", text, re.IGNORECASE)
                if m:
                    info["birth_date"] = m.group(1)

    # Member ID
    if info["member_id"] is None:
        m = re.search(r"(?:member[\s_-]?id[:\s]*)?([A-Z]{2,}\d{4,}|\d{6,})", text, re.IGNORECASE)
        if m:
            info["member_id"] = m.group(1)

    return info


def extract_insurance_info(text: str, info: dict) -> dict:
    lower = text.lower()
    insurance_keywords = [
        "aetna", "cigna", "unitedhealthcare", "uhc",
        "blue cross", "blue shield", "medicare",
        "medicaid", "humana", "kaiser", "anthem",
    ]
    if info["insurance_provider"] is None:
        for kw in insurance_keywords:
            if kw in lower:
                info["insurance_provider"] = kw
                break

    if info["insurance_plan"] is None:
        m = re.search(r"\b(PPO|HMO|EPO|POS)\b", text, re.IGNORECASE)
        if m:
            info["insurance_plan"] = m.group(1).upper()

    if info["member_id"] is None:
        m = re.search(r"(member[\s_-]?id[:\s]*[A-Za-z0-9\-]+)", text, re.IGNORECASE)
        if m:
            info["member_id"] = m.group(1)

    return info


def missing_symptom_fields(info: dict) -> List[str]:
    fields = []
    if not info["symptom"]: fields.append("symptom")
    if not info["duration"]: fields.append("duration")
    if not info["severity"]: fields.append("severity")
    return fields


def missing_insurance_fields(info: dict) -> List[str]:
    fields = []
    if not info["insurance_provider"]: fields.append("insurance_provider")
    if not info["insurance_plan"]: fields.append("insurance_plan")
    return fields


# -----------------------------
# State transition logic
# -----------------------------
def determine_next_state(current_state: str, info: dict) -> str:
    if current_state == "symptom_collection":
        if not missing_symptom_fields(info):
            # Stay in symptom_collection until optional profile fields are gathered
            if not info.get("gender") or not info.get("birth_date"):
                return "symptom_collection"
            return "done" if not missing_insurance_fields(info) else "insurance_collection"
    elif current_state == "insurance_collection":
        if not missing_insurance_fields(info):
            # Ask for member_id before finishing
            if not info.get("member_id"):
                return "insurance_collection"
            return "done"
    return current_state


# -----------------------------
# Dynamic AI prompt builder
# -----------------------------
def get_missing_profile_hints(user_profile: dict) -> List[str]:
    """Return human-readable hints for missing required profile fields."""
    hints = []
    if not user_profile.get("firstName") or not user_profile.get("lastName"):
        hints.append("their full name (so we can personalize their care)")
    if not (user_profile.get("home_address_1") and user_profile.get("home_city")
            and user_profile.get("home_state") and user_profile.get("home_zip")):
        hints.append("their home address (needed to find nearby in-network providers)")
    return hints


def build_dynamic_prompt(state: str, info: dict, user_profile: dict) -> str:
    name = user_profile.get("firstName", "")
    address_city = user_profile.get("home_city", "")
    has_address = bool(user_profile.get("home_address_1") and user_profile.get("home_city"))

    # Summarize what's been collected
    collected_parts = []
    if info.get("symptom"):      collected_parts.append(f"concern: {info['symptom'][:80]}")
    if info.get("duration"):     collected_parts.append(f"duration: {info['duration']}")
    if info.get("severity"):     collected_parts.append(f"severity: {info['severity']}")
    if info.get("insurance_provider"): collected_parts.append(f"insurance: {info['insurance_provider']}")
    if info.get("insurance_plan"):     collected_parts.append(f"plan: {info['insurance_plan']}")
    collected_str = "; ".join(collected_parts) if collected_parts else "nothing yet"

    prompt = f"""You are Appy Health's care coordinator — warm, empathetic, and efficient.
You help patients find the right mental health or medical provider.

{"Patient name: " + name if name else ""}
{"Patient city: " + address_city if address_city else ""}
Info collected so far: {collected_str}

Tone rules:
- Sound like a knowledgeable, caring human — never robotic or scripted
- Keep responses to 2–3 sentences max
- Never list questions with numbers or bullets
- If the patient just shared something difficult, acknowledge it with genuine empathy before moving on
- Speak naturally, as if in a real conversation

"""

    if state == "symptom_collection":
        missing = missing_symptom_fields(info)
        if missing:
            missing_map = {
                "symptom": "what they're experiencing",
                "duration": "how long it's been going on",
                "severity": "how severe it is (mild, moderate, or severe)",
            }
            missing_str = ", ".join(missing_map[f] for f in missing if f in missing_map)
            prompt += (
                f"Your goal: gently gather more detail. Still needed: {missing_str}. "
                "Ask about one thing at a time — weave it naturally into the conversation. "
                "Lead with empathy if they just described their symptoms."
            )
        else:
            # Symptoms complete — ask for optional profile fields before insurance
            missing_optional = []
            if not info.get("gender"):     missing_optional.append("gender")
            if not info.get("birth_date"): missing_optional.append("date of birth")

            if missing_optional:
                optional_str = " and ".join(missing_optional)
                prompt += (
                    f"Symptoms are fully collected. Before moving to insurance, "
                    f"ask for {optional_str} — these help match providers appropriately. "
                    "Keep it light and natural, one question at a time."
                )
            else:
                prompt += (
                    "You have all symptom and personal info. "
                    "Transition naturally to asking about insurance (provider and plan type). Keep it brief."
                )

    elif state == "insurance_collection":
        missing_ins = missing_insurance_fields(info)
        if missing_ins:
            ins_map = {
                "insurance_provider": "their insurance provider (e.g. Aetna, Cigna, Blue Cross)",
                "insurance_plan": "their plan type (PPO, HMO, EPO, or POS)",
            }
            missing_str = " and ".join(ins_map[f] for f in missing_ins if f in ins_map)
            prompt += (
                f"Ask specifically for: {missing_str}. "
                "Be brief and conversational — don't repeat what you already know."
            )
        else:
            # Provider and plan confirmed — now ask for member ID if missing
            if not info.get("member_id"):
                prompt += (
                    "Insurance provider and plan are confirmed. "
                    "Ask for their member ID — it helps verify coverage. "
                    "Mention it's optional but useful. Keep it brief."
                )
            else:
                prompt += (
                    "All insurance details including member ID are confirmed. "
                    "Warmly let them know everything is in order and you're ready to find matches."
                )

    elif state == "done":
        prompt += (
            "All required chat information has been collected. "
            "Confirm you're ready to find great provider matches. "
            "Be helpful and natural — discuss provider preferences, scheduling, or answer any questions.\n"
        )
        missing_hints = get_missing_profile_hints(user_profile)
        if missing_hints:
            hints_str = " and ".join(missing_hints)
            prompt += (
                f"Important: their profile is still missing {hints_str}. "
                "After your confirmation, gently mention this — explain that completing their profile "
                "helps find better, more personalized matches. Keep it friendly, not pushy."
            )

    return prompt


# -----------------------------
# OpenAI call
# -----------------------------
def call_openai(messages: List[dict]) -> str:
    response = client.responses.create(
        model=OPENAI_MODEL,
        input=messages
    )
    return response.output_text.strip()


def build_emergency_reply() -> str:
    return (
        "I'm really sorry to hear that — what you're describing sounds serious and needs immediate attention. "
        "Please call 911 or go to your nearest emergency room right away. "
        "If someone is with you, ask them to help you get there now."
    )


# -----------------------------
# Routes
# -----------------------------
@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    session = get_or_create_session(req.session_id, req.user_profile)
    state: StateType = session["state"]
    history = session["history"]
    info = session["collected_info"]

    # ── Greeting ──────────────────────────────────────────────────────────────
    if state == "greeting":
        first_name = (req.user_profile or {}).get("firstName", "")
        if first_name:
            reply = f"Hello {first_name}! I'm Appy Health's care coordinator. How are you feeling today?"
        else:
            reply = "Hi there! I'm Appy Health's care coordinator. How are you feeling today?"
        session["state"] = "symptom_collection"
        session["history"].append({"role": "assistant", "content": reply})
        return ChatResponse(session_id=req.session_id, state=session["state"], reply=reply, collected_info=info)

    if not req.user_message or not req.user_message.strip():
        raise HTTPException(status_code=400, detail="user_message is required after greeting.")

    user_message = req.user_message.strip()

    # ── Emergency check ───────────────────────────────────────────────────────
    if detect_emergency(user_message):
        reply = build_emergency_reply()
        session["state"] = "emergency"
        session["history"].append({"role": "user", "content": user_message})
        session["history"].append({"role": "assistant", "content": reply})
        return ChatResponse(session_id=req.session_id, state="emergency", reply=reply, collected_info=info)

    # ── Extract info from message ─────────────────────────────────────────────
    info = maybe_extract_basic_info(user_message, info)
    info = extract_optional_info(user_message, info)
    if state == "insurance_collection":
        info = extract_insurance_info(user_message, info)
    session["collected_info"] = info

    # ── Determine next state ──────────────────────────────────────────────────
    new_state = determine_next_state(state, info)
    session["state"] = new_state

    # ── Generate AI response ──────────────────────────────────────────────────
    if new_state == "emergency":
        reply = build_emergency_reply()
    else:
        system_prompt = build_dynamic_prompt(new_state, info, session.get("user_profile", {}))
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        reply = call_openai(messages)

    session["history"].append({"role": "user", "content": user_message})
    session["history"].append({"role": "assistant", "content": reply})

    return ChatResponse(session_id=req.session_id, state=new_state, reply=reply, collected_info=info)


@app.get("/session/{session_id}")
def get_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    SESSIONS.pop(session_id, None)
    return {"ok": True, "session_id": session_id}
