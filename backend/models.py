"""数据模型 — LangGraph 状态 (TypedDict) + API 模型 (Pydantic)"""
from __future__ import annotations

from enum import Enum
from typing import Annotated, TypedDict
from pydantic import BaseModel, Field
from langgraph.graph import add_messages


# ── 枚举类型 ──

class SessionStatus(str, Enum):
    """会话生命周期状态"""
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class InterviewMode(str, Enum):
    RESUME = "resume"
    TOPIC_DRILL = "topic_drill"
    RECORDING = "recording"


class InterviewPhase(str, Enum):
    GREETING = "greeting"
    SELF_INTRO = "self_intro"
    TECHNICAL = "technical"
    PROJECT_DEEP_DIVE = "project_deep_dive"
    REVERSE_QA = "reverse_qa"
    END = "end"


# ── LangGraph 状态（TypedDict 保持最大兼容性）──

class ResumeInterviewState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    phase: str           # InterviewPhase value
    resume_context: str
    questions_asked: list[str]
    phase_question_count: int
    is_finished: bool
    last_eval: dict          # Latest inline eval from interviewer {score, should_advance, brief}
    eval_history: list       # All evals accumulated across the interview


class TopicDrillState(TypedDict, total=False):
    messages: Annotated[list, add_messages]
    topic: str
    topic_name: str
    knowledge_context: str
    difficulty: int
    questions_asked: list[str]
    scores: list[dict]
    weak_points: list[str]
    total_questions: int
    is_finished: bool


# ── API 模型（Pydantic）──

class StartInterviewRequest(BaseModel):
    mode: InterviewMode
    topic: str | None = None


class ChatRequest(BaseModel):
    session_id: str
    message: str


class EndDrillRequest(BaseModel):
    answers: list[dict] = Field(default_factory=list)  # [{question_id: int, answer: str}]


class RecordingAnalyzeRequest(BaseModel):
    transcript: str
    recording_mode: str = "dual"  # "dual" | "solo"
    company: str | None = None
    position: str | None = None


# ── 认证模型 ──

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""
    access_code: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class GitHubConnectStartRequest(BaseModel):
    redirect_path: str = "/project-analysis"
