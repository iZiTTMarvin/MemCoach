"""FastAPI 入口 — 面试模拟系统 API."""
# 核心依赖: FastAPI, LangChain, LangGraph, LlamaIndex, bge-m3 embeddings
import uuid
from datetime import datetime

from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.types import Command
from pydantic import BaseModel, Field

from backend.models import (
    StartInterviewRequest, ChatRequest, EndDrillRequest,
    RecordingAnalyzeRequest, RegisterRequest, LoginRequest,
    InterviewMode, InterviewPhase,
)
from backend.graphs.resume_interview import compile_resume_interview
from backend.graphs.topic_drill import (
    generate_drill_questions, evaluate_drill_answers,
)
from backend.graphs.review import generate_review
from backend.config import settings
from backend.indexer import load_topics, save_topics, _index_cache
from backend.memory import get_profile, update_profile_after_interview, llm_update_profile
from backend.storage.sessions import (
    create_session, append_message, save_review, save_drill_answers,
    get_session, list_sessions, list_sessions_by_topic,
    delete_session, list_distinct_topics,
)
from backend.graph import build_graph
from backend.auth import (
    init_users_table, ensure_default_user,
    create_user, authenticate_user, create_token, get_current_user,
)
from backend.project_analysis.pipeline import (
    AnalysisPipelineError,
    STATUS_ANALYZING,
    STATUS_CANCELLED,
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_FETCHING,
    STATUS_FILTERING,
    STATUS_QUEUED,
    cancel_analysis_job,
    create_analysis_job,
    get_analysis,
    resolve_repo_preview,
    run_analysis_job,
)

app = FastAPI(title="MemCoach", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter(prefix="/api")

# 内存中的图实例（简历模式）
_graphs: dict[str, dict] = {}
# 专项训练会话数据
_drill_sessions: dict[str, dict] = {}


class ProjectAnalysisResolveRequest(BaseModel):
    """项目分析仓库解析请求."""

    repo_url: str


class ProjectAnalysisCreateRequest(BaseModel):
    """项目分析任务创建请求."""

    repo_url: str
    branch: str | None = None
    role_summary: str = ""
    owned_scopes: list[str] = Field(default_factory=list)


def _analysis_public_view(record: dict, include_result: bool = False) -> dict:
    """返回前端可直接消费的分析任务视图."""
    status = record.get("status")
    base = {
        "analysis_id": record.get("analysis_id"),
        "repo_url": record.get("repo_url"),
        "repo_name": record.get("repo_name"),
        "branch": record.get("branch"),
        "commit_sha": record.get("commit_sha"),
        "analysis_time": ((record.get("result") or {}).get("metadata") or {}).get("analyzed_at"),
        "status": status,
        "role_summary": record.get("role_summary", ""),
        "owned_scopes": record.get("owned_scopes", []),
        "error_code": record.get("error_code"),
        "error_message": record.get("error_message"),
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
        "metadata": record.get("metadata", {}),
        "message": _analysis_status_message(status),
        "progress_message": _analysis_status_message(status),
    }
    if include_result:
        base["result"] = record.get("result", {})
    return base


def _analysis_status_message(status: str | None) -> str:
    """返回状态对应的可展示提示。"""
    mapping = {
        STATUS_QUEUED: "任务已创建，等待分析。",
        STATUS_FETCHING: "正在拉取仓库快照。",
        STATUS_FILTERING: "正在过滤高价值文件。",
        STATUS_ANALYZING: "正在生成项目深挖问题与拆解结果。",
        STATUS_COMPLETED: "分析已完成。",
        STATUS_FAILED: "分析失败，请查看错误信息。",
        STATUS_CANCELLED: "分析任务已取消。",
    }
    return mapping.get(status or "", "未知状态。")


def _build_project_practice_questions(record: dict) -> list[dict]:
    """将项目分析 questions 转换为专项训练题目结构。"""
    result = record.get("result") or {}
    questions = result.get("questions") or []
    practice_questions: list[dict] = []
    for index, question in enumerate(questions, start=1):
        practice_questions.append(
            {
                "id": index,
                "question": question.get("question") or f"项目问题 {index}",
                "difficulty": 3,
                "focus_area": "project_analysis",
                "reference_answer_points": question.get("reference_answer_points", []),
                "follow_up_directions": question.get("follow_up_directions", []),
                "evidence": question.get("evidence", []),
            }
        )
    return practice_questions


def _evaluate_project_practice_answers(questions: list[dict], answers: list[dict]) -> tuple[list[dict], dict, str]:
    """对项目答题训练做最小可用评估，避免依赖知识库 topic。"""
    answer_map = {a["question_id"]: a["answer"] for a in answers}
    scores: list[dict] = []
    total_score = 0.0
    answered_count = 0
    new_weak_points: list[str] = []
    new_strong_points: list[str] = []

    for question in questions:
        qid = question["id"]
        answer = (answer_map.get(qid) or "").strip()
        reference_points = question.get("reference_answer_points", [])

        if not answer:
            scores.append(
                {
                    "question_id": qid,
                    "score": None,
                    "assessment": "未作答",
                    "improvement": "先尝试围绕项目事实给出完整表达。",
                    "difficulty": question.get("difficulty", 3),
                }
            )
            new_weak_points.append(f"Q{qid}: 未能围绕项目问题给出回答")
            continue

        answered_count += 1
        score = 8 if len(answer) >= 80 else 6 if len(answer) >= 30 else 4
        total_score += score
        assessment = "回答较完整，已覆盖项目背景与实现细节。" if score >= 8 else "回答有基本框架，但可以补充更多项目事实与取舍。" if score >= 6 else "回答过短，缺少足够的项目细节支撑。"
        improvement = "补充你负责的模块、具体实现与权衡过程。"
        scores.append(
            {
                "question_id": qid,
                "score": score,
                "assessment": assessment,
                "improvement": improvement,
                "difficulty": question.get("difficulty", 3),
                "reference_answer_points": reference_points,
            }
        )
        if score >= 8:
            new_strong_points.append(f"Q{qid}: 能较完整表达项目实现与思路")
        else:
            new_weak_points.append(f"Q{qid}: 项目表达还不够具体")

    avg_score = round(total_score / answered_count, 1) if answered_count else 0
    overall = {
        "avg_score": avg_score,
        "summary": "项目答题训练已完成。当前评估基于回答完整度与项目表达覆盖度给出。",
        "new_weak_points": new_weak_points,
        "new_strong_points": new_strong_points,
    }
    review = _format_drill_review(questions, answers, scores, overall)
    return scores, overall, review


@app.on_event("startup")
def preload_models():
    """启动时预加载 bge-m3 embedding model + 初始化向量存储"""
    from backend.llm_provider import get_embedding, get_llama_llm
    from backend.indexer import _init_llama_settings
    from backend.vector_memory import init_memory_table
    import logging
    logger = logging.getLogger("uvicorn")
    logger.info("Pre-loading bge-m3 embedding model...")
    get_embedding()
    _init_llama_settings()
    logger.info("Embedding model ready.")

    # Init tables + default user
    init_memory_table()
    init_users_table()
    ensure_default_user()
    logger.info("Database tables initialized.")


# ── 认证端点（无需认证）──

@router.get("/auth/config")
def auth_config():
    """获取注册是否开放的配置"""
    return {"allow_registration": settings.allow_registration}


@router.post("/auth/register")
def register(req: RegisterRequest):
    """用户注册"""
    user = create_user(req.email, req.password, req.name)
    token = create_token(user["id"])
    return {"token": token, "user": user}


@router.post("/auth/login")
def login(req: LoginRequest):
    """用户登录"""
    user = authenticate_user(req.email, req.password)
    if not user:
        raise HTTPException(401, "Invalid email or password")
    token = create_token(user["id"])
    return {"token": token, "user": user}


@router.get("/")
def root():
    return {"service": "MemCoach", "version": "0.2.0"}


# ── 简历管理 ──

@router.get("/resume/status")
def resume_status(user_id: str = Depends(get_current_user)):
    """检查简历是否存在"""
    resume_dir = settings.user_resume_path(user_id)
    if not resume_dir.exists():
        return {"has_resume": False}
    files = [f for f in resume_dir.iterdir() if f.suffix.lower() == ".pdf"]
    if not files:
        return {"has_resume": False}
    f = files[0]
    return {"has_resume": True, "filename": f.name, "size": f.stat().st_size}


@router.post("/resume/upload")
async def upload_resume(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    """上传简历 PDF，替换现有简历"""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")

    resume_dir = settings.user_resume_path(user_id)
    resume_dir.mkdir(parents=True, exist_ok=True)

    # Remove old resumes
    for old in resume_dir.iterdir():
        if old.is_file():
            old.unlink()

    # Save new file
    dest = resume_dir / file.filename
    content = await file.read()
    dest.write_bytes(content)

    # Clear index cache so next query rebuilds from new resume
    _index_cache.pop((user_id, "resume"), None)
    cache_dir = settings.user_index_cache_path(user_id) / "resume"
    if cache_dir.exists():
        import shutil
        shutil.rmtree(cache_dir)

    return {"ok": True, "filename": file.filename, "size": len(content)}


# ── 语音转文本 ──

@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    """通过 DashScope ASR 将短音频转写为文本"""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio file.")

    try:
        from backend.transcribe import transcribe_audio
        suffix = "." + (file.filename or "audio.webm").rsplit(".", 1)[-1]
        text = transcribe_audio(audio_bytes, suffix=suffix)
        return {"text": text}
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")


# ── 录音复盘端点 ──

@router.post("/recording/transcribe")
async def recording_transcribe(
    file: UploadFile = File(...),
    mode: str = Form("dual"),
    user_id: str = Depends(get_current_user),
):
    """转写录音音频"""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio file.")

    suffix = "." + (file.filename or "audio.webm").rsplit(".", 1)[-1]

    try:
        from backend.transcribe import transcribe_audio
        text = transcribe_audio(audio_bytes, suffix=suffix)
        return {"transcript": text, "segments": []}
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")


@router.post("/recording/analyze")
async def recording_analyze(req: RecordingAnalyzeRequest, user_id: str = Depends(get_current_user)):
    """分析录音转写文本：dual 模式提取问答对，solo 模式做整体评估"""
    session_id = str(uuid.uuid4())

    if req.recording_mode == "dual":
        return await _analyze_dual(req, session_id, user_id)
    else:
        return await _analyze_solo(req, session_id, user_id)


async def _analyze_dual(req: RecordingAnalyzeRequest, session_id: str, user_id: str):
    """双轨模式：将录音结构化为问答对 → 评估 → 更新画像"""
    from backend.graphs.topic_drill import _parse_json_response
    from backend.llm_provider import get_langchain_llm
    from backend.prompts.recording import RECORDING_STRUCTURE_PROMPT, RECORDING_DUAL_EVAL_PROMPT
    from langchain_core.messages import SystemMessage

    llm = get_langchain_llm()

    # Step 1: LLM structures transcript into Q&A pairs
    structure_prompt = RECORDING_STRUCTURE_PROMPT.format(
        transcript=req.transcript[:8000],
    )
    response = llm.invoke([
        SystemMessage(content="你是面试记录分析引擎。只返回 JSON，不要其他内容。"),
        HumanMessage(content=structure_prompt),
    ])

    try:
        structured = _parse_json_response(response.content)
    except Exception:
        raise HTTPException(500, "录音结构化失败，LLM 返回格式异常。请重试。")

    qa_pairs = structured.get("qa_pairs", [])
    if not qa_pairs:
        raise HTTPException(400, "未能从录音中提取出有效的问答对。请检查转写文本。")

    # Convert to drill-compatible format
    questions = []
    answers = []
    for pair in qa_pairs:
        qid = pair.get("id", len(questions) + 1)
        questions.append({
            "id": qid,
            "question": pair["question"],
            "difficulty": 3,
            "focus_area": pair.get("focus_area", ""),
        })
        answers.append({
            "question_id": qid,
            "answer": pair.get("answer", ""),
        })

    # Create session
    create_session(session_id, mode="recording", questions=questions, user_id=user_id)

    # Step 2: Evaluate Q&A pairs (recording-specific prompt, no topic binding)
    qa_lines = []
    for q, a in zip(questions, answers):
        qa_lines.append(
            f"### Q{q['id']} ({q.get('focus_area', '')})\n"
            f"**题目**: {q['question']}\n**回答**: {a['answer']}"
        )

    eval_prompt = RECORDING_DUAL_EVAL_PROMPT.format(
        qa_pairs="\n\n".join(qa_lines),
    )
    eval_response = llm.invoke([
        SystemMessage(content="你是面试评估引擎。只返回 JSON，不要其他内容。"),
        HumanMessage(content=eval_prompt),
    ])

    try:
        eval_result = _parse_json_response(eval_response.content)
    except Exception:
        raise HTTPException(500, "评估失败，LLM 返回格式异常。请重试。")

    scores = eval_result.get("scores", [])
    overall = eval_result.get("overall", {})

    for s in scores:
        s.setdefault("difficulty", 3)

    # Step 3: Format review + save
    review = _format_drill_review(questions, answers, scores, overall)
    save_drill_answers(session_id, answers, user_id=user_id)
    save_review(session_id, review, scores, overall.get("new_weak_points", []), overall, user_id=user_id)

    # Step 4: Update profile (topic=None, weak/strong points carry their own topic)
    await _update_recording_profile(overall, scores, len(questions), user_id)

    return {
        "session_id": session_id,
        "mode": "recording",
        "recording_mode": "dual",
        "review": review,
        "scores": scores,
        "overall": overall,
        "questions": questions,
        "answers": answers,
    }


async def _analyze_solo(req: RecordingAnalyzeRequest, session_id: str, user_id: str):
    """独奏模式：整体评估候选人的技术表达能力"""
    from backend.graphs.topic_drill import _parse_json_response
    from backend.llm_provider import get_langchain_llm
    from backend.prompts.recording import RECORDING_SOLO_EVAL_PROMPT
    from langchain_core.messages import SystemMessage

    create_session(session_id, mode="recording", user_id=user_id)

    llm = get_langchain_llm()
    eval_prompt = RECORDING_SOLO_EVAL_PROMPT.format(
        transcript=req.transcript[:8000],
    )
    response = llm.invoke([
        SystemMessage(content="你是录音评估引擎。只返回 JSON，不要其他内容。"),
        HumanMessage(content=eval_prompt),
    ])

    try:
        eval_result = _parse_json_response(response.content)
    except Exception:
        raise HTTPException(500, "评估失败，LLM 返回格式异常。请重试。")

    topics_covered = eval_result.get("topics_covered", [])
    overall = eval_result.get("overall", {})

    # Format review
    review = _format_solo_review(topics_covered, overall)

    # Build scores-like structure for profile update
    scores = [
        {"question_id": t.get("id", i + 1), "score": t.get("score"), "difficulty": 3}
        for i, t in enumerate(topics_covered)
    ]

    # Save to DB
    save_review(session_id, review, scores, overall.get("new_weak_points", []), overall, user_id=user_id)

    # Update profile (topic=None, points carry their own topic labels)
    await _update_recording_profile(overall, scores, max(len(topics_covered), 1), user_id)

    return {
        "session_id": session_id,
        "mode": "recording",
        "recording_mode": "solo",
        "review": review,
        "topics_covered": topics_covered,
        "overall": overall,
    }


async def _update_recording_profile(overall: dict, scores: list, total_items: int, user_id: str):
    """从录音分析更新画像，无单一话题标签，薄弱点自带话题"""
    valid = []
    for s in scores:
        try:
            valid.append(float(s["score"]))
        except (TypeError, ValueError, KeyError):
            pass

    await llm_update_profile(
        mode="recording",
        topic=None,
        new_weak_points=overall.get("new_weak_points", []),
        new_strong_points=overall.get("new_strong_points", []),
        topic_mastery={},
        communication=overall.get("communication_observations", {}),
        user_id=user_id,
        thinking_patterns=overall.get("thinking_patterns"),
        session_summary=overall.get("summary", ""),
        avg_score=overall.get("avg_score"),
        answer_count=len(valid),
        session_weight=0.3,
    )


def _format_solo_review(topics_covered: list, overall: dict) -> str:
    """格式化独奏模式评估为可读报告"""
    lines = [f"## 整体评价\n\n{overall.get('summary', '')}\n\n**平均分: {overall.get('avg_score', '-')}/10**\n"]

    if topics_covered:
        lines.append("---\n\n## 涉及知识点\n")
        for t in topics_covered:
            score = t.get("score", "-")
            lines.append(f"### {t.get('topic', '未知')} — {score}/10")
            if t.get("assessment"):
                lines.append(f"**评价**: {t['assessment']}")
            if t.get("understanding"):
                lines.append(f"**理解程度**: {t['understanding']}")
            if t.get("errors"):
                lines.append(f"**错误**: {', '.join(t['errors'])}")
            if t.get("missing"):
                lines.append(f"**遗漏**: {', '.join(t['missing'])}")
            lines.append("")

    if overall.get("new_weak_points"):
        lines.append("---\n\n## 薄弱点")
        for wp in overall["new_weak_points"]:
            lines.append(f"- {wp.get('point', wp) if isinstance(wp, dict) else wp}")

    if overall.get("new_strong_points"):
        lines.append("\n## 亮点")
        for sp in overall["new_strong_points"]:
            lines.append(f"- {sp.get('point', sp) if isinstance(sp, dict) else sp}")

    return "\n".join(lines)


# ── 话题管理 ──

@router.get("/topics")
def get_topics(user_id: str = Depends(get_current_user)):
    """获取可用的训练话题列表"""
    return load_topics(user_id)


@router.post("/topics")
def create_topic(body: dict, user_id: str = Depends(get_current_user)):
    """创建新话题"""
    key = body.get("key", "").strip()
    name = body.get("name", "").strip()
    icon = body.get("icon", "📝").strip()
    if not key or not name:
        raise HTTPException(400, "key and name are required")

    topics = load_topics(user_id)
    if key in topics:
        raise HTTPException(409, f"Topic '{key}' already exists")

    dir_name = body.get("dir", key).strip()
    topics[key] = {"name": name, "icon": icon, "dir": dir_name}
    save_topics(topics, user_id)

    # Create knowledge directory with README
    topic_dir = settings.user_knowledge_path(user_id) / dir_name
    topic_dir.mkdir(parents=True, exist_ok=True)
    readme = topic_dir / "README.md"
    if not readme.exists():
        readme.write_text(f"# {name}\n", encoding="utf-8")

    return {"ok": True, "key": key}


@router.delete("/topics/{key}")
def delete_topic(key: str, user_id: str = Depends(get_current_user)):
    """删除话题"""
    topics = load_topics(user_id)
    if key not in topics:
        raise HTTPException(404, f"Topic '{key}' not found")

    del topics[key]
    save_topics(topics, user_id)

    # Clear index cache
    _index_cache.pop((user_id, key), None)

    return {"ok": True}


# ── 用户画像 ──

@router.get("/profile")
def get_user_profile(user_id: str = Depends(get_current_user)):
    """获取用户累积的面试画像"""
    return get_profile(user_id)


@router.get("/profile/due-reviews")
def get_due_reviews_endpoint(topic: str = None, user_id: str = Depends(get_current_user)):
    """获取需要间隔重复复习的薄弱点"""
    from backend.spaced_repetition import get_due_reviews as _get_due
    return _get_due(user_id, topic)


@router.get("/profile/topic/{topic}/history")
def get_topic_history(topic: str, user_id: str = Depends(get_current_user)):
    """获取指定话题的会话历史"""
    sessions = list_sessions_by_topic(topic, user_id=user_id)
    return sessions


@router.post("/profile/topic/{topic}/retrospective")
async def generate_retrospective(topic: str, user_id: str = Depends(get_current_user)):
    """基于所有历史会话生成话题综合回顾报告"""
    from backend.prompts.interviewer import TOPIC_RETROSPECTIVE_PROMPT
    from backend.memory import _load_profile, _save_profile
    from backend.llm_provider import get_langchain_llm
    from langchain_core.messages import SystemMessage, HumanMessage

    # Gather all sessions for this topic
    sessions = list_sessions_by_topic(topic, user_id=user_id)
    if not sessions:
        raise HTTPException(400, "该领域暂无训练记录")

    profile = _load_profile(user_id)
    topic_display = {k: v["name"] for k, v in load_topics(user_id).items()}
    topic_name = topic_display.get(topic, topic)
    mastery = profile.get("topic_mastery", {}).get(topic, {})

    # Format session history — only include answered questions
    history_lines = []
    for s in sessions:
        date = s["created_at"][:10]
        scores = s.get("scores", [])
        valid_scores = [sc for sc in scores if isinstance(sc.get("score"), (int, float))]
        avg = round(sum(sc["score"] for sc in valid_scores) / len(valid_scores), 1) if valid_scores else None

        # Summary section only (before per-question breakdown)
        review = s.get("review") or ""
        summary_part = review.split("## 逐题复盘")[0].strip()

        # Per-question scores — answered only
        score_lines = []
        for sc in valid_scores:
            line = f"- Q{sc.get('question_id', '?')}: {sc['score']}/10"
            if sc.get("assessment"):
                line += f" — {sc['assessment']}"
            score_lines.append(line)

        history_lines.append(
            f"### {date} (答题 {len(valid_scores)}/10, 平均 {avg or '无'}/10)\n"
            f"{summary_part}\n"
            + ("\n".join(score_lines) + "\n" if score_lines else "")
        )

    mastery_score = mastery.get("score", mastery.get("level", 0) * 20)
    mastery_text = f"{mastery_score}/100 — {mastery.get('notes', '')}" if mastery_score > 0 else "暂无评估"

    prompt = TOPIC_RETROSPECTIVE_PROMPT.format(
        topic_name=topic_name,
        session_history="\n".join(history_lines),
        mastery_info=mastery_text,
    )

    llm = get_langchain_llm()
    response = llm.invoke([
        SystemMessage(content="你是面试教练。用 markdown 生成回顾报告。"),
        HumanMessage(content=prompt),
    ])

    retrospective = response.content.strip()

    # Cache in profile
    profile.setdefault("topic_mastery", {}).setdefault(topic, {})["retrospective"] = retrospective
    profile["topic_mastery"][topic]["retrospective_at"] = datetime.now().isoformat()
    _save_profile(profile, user_id)

    return {
        "topic": topic,
        "topic_name": topic_name,
        "retrospective": retrospective,
        "session_count": len(sessions),
    }


# ── 面试会话 ──

@router.post("/interview/start")
async def start_interview(req: StartInterviewRequest, user_id: str = Depends(get_current_user)):
    """启动新的面试会话"""
    session_id = str(uuid.uuid4())[:8]

    if req.mode == InterviewMode.TOPIC_DRILL:
        # ── Drill mode: generate 10 questions upfront ──
        topics = load_topics(user_id)
        if not req.topic or req.topic not in topics:
            raise HTTPException(400, f"Invalid topic. Available: {list(topics.keys())}")

        try:
            questions = generate_drill_questions(req.topic, user_id)
        except RuntimeError as e:
            raise HTTPException(500, str(e))
        create_session(session_id, req.mode.value, req.topic, questions=questions, user_id=user_id)
        _drill_sessions[session_id] = {"topic": req.topic, "questions": questions, "user_id": user_id}

        return {
            "session_id": session_id,
            "mode": req.mode.value,
            "topic": req.topic,
            "questions": questions,
        }
    else:
        # ── Resume mode: LangGraph interactive interview ──
        graph = compile_resume_interview(user_id)
        initial_state = {}
        config = {"configurable": {"thread_id": session_id}}

        result = graph.invoke(initial_state, config)

        ai_message = ""
        for msg in reversed(result["messages"]):
            if isinstance(msg, AIMessage):
                ai_message = msg.content
                break

        create_session(session_id, req.mode.value, req.topic, user_id=user_id)
        append_message(session_id, "assistant", ai_message, user_id=user_id)
        _graphs[session_id] = {
            "graph": graph, "config": config,
            "mode": req.mode, "topic": req.topic,
            "user_id": user_id,
        }

        return {
            "session_id": session_id,
            "mode": req.mode.value,
            "topic": req.topic,
            "message": ai_message,
        }


@router.post("/interview/chat")
async def chat(req: ChatRequest, user_id: str = Depends(get_current_user)):
    """发送用户回答，获取下一轮面试官响应（仅简历模式）"""
    if req.session_id not in _graphs:
        raise HTTPException(404, "Session not found. It may have expired (in-memory only).")

    entry = _graphs[req.session_id]
    if entry.get("user_id") != user_id:
        raise HTTPException(403, "Access denied.")

    graph = entry["graph"]
    config = entry["config"]

    result = graph.invoke(Command(resume=req.message), config)

    append_message(req.session_id, "user", req.message, user_id=user_id)

    is_finished = False
    if isinstance(result, dict):
        is_finished = result.get("is_finished", False)
        phase = result.get("phase", "")
        if phase in (InterviewPhase.END.value, "end"):
            is_finished = True

    ai_message = ""
    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage):
            ai_message = msg.content
            break

    append_message(req.session_id, "assistant", ai_message, user_id=user_id)

    return {
        "session_id": req.session_id,
        "message": ai_message,
        "is_finished": is_finished,
    }


@router.post("/interview/end/{session_id}")
async def end_interview(session_id: str, body: EndDrillRequest = None,
                        user_id: str = Depends(get_current_user)):
    """结束面试 → 评估 → 生成报告 → 更新画像"""

    # ── Drill mode: batch evaluate ──
    if session_id in _drill_sessions:
        entry = _drill_sessions[session_id]
        if entry.get("user_id") != user_id:
            raise HTTPException(403, "Access denied.")

        topic = entry["topic"]
        questions = entry["questions"]
        answers = body.answers if body and body.answers else []

        if entry.get("mode") == "project_analysis":
            save_drill_answers(session_id, answers, user_id=user_id)
            scores, overall, review = _evaluate_project_practice_answers(questions, answers)
            save_review(session_id, review, scores, overall.get("new_weak_points", []), overall, user_id=user_id)
            del _drill_sessions[session_id]
            return {
                "session_id": session_id,
                "mode": "topic_drill",
                "review": review,
                "scores": scores,
                "overall": overall,
            }

        # Save answers to SQLite
        save_drill_answers(session_id, answers, user_id=user_id)

        # Batch evaluate (1 LLM call)
        eval_result = evaluate_drill_answers(topic, questions, answers, user_id)
        scores = eval_result.get("scores", [])
        overall = eval_result.get("overall", {})

        # Attach difficulty from questions to scores (for mastery calculation)
        q_diff = {q["id"]: q.get("difficulty", 3) for q in questions}
        for s in scores:
            s.setdefault("difficulty", q_diff.get(s.get("question_id"), 3))

        # Generate review text from eval
        review = _format_drill_review(questions, answers, scores, overall)

        # Save to SQLite
        save_review(session_id, review, scores, overall.get("new_weak_points", []), overall, user_id=user_id)

        # Update spaced repetition state for evaluated weak points
        from backend.spaced_repetition import update_weak_point_sr
        for s in scores:
            wp = s.get("weak_point")
            sc = s.get("score")
            if wp and isinstance(sc, (int, float)):
                update_weak_point_sr(topic, wp, sc, user_id)

        # Update profile (1 LLM call via Mem0 pipeline — uses overall data)
        await _update_drill_profile(topic, overall, scores, len(questions), user_id)

        del _drill_sessions[session_id]

        return {
            "session_id": session_id,
            "mode": "topic_drill",
            "review": review,
            "scores": scores,
            "overall": overall,
        }

    # ── Resume mode: existing flow ──
    if session_id not in _graphs:
        raise HTTPException(404, "Session not found.")

    entry = _graphs[session_id]
    if entry.get("user_id") != user_id:
        raise HTTPException(403, "Access denied.")

    graph = entry["graph"]
    config = entry["config"]

    state = graph.get_state(config)
    messages = state.values.get("messages", [])
    scores = state.values.get("scores", [])
    weak_points = state.values.get("weak_points", [])
    eval_history = state.values.get("eval_history", [])
    topic_name = state.values.get("topic_name", entry.get("topic"))

    review = generate_review(
        mode=entry["mode"],
        messages=messages,
        scores=scores,
        weak_points=weak_points,
        topic=topic_name,
        eval_history=eval_history,
    )

    extraction = await update_profile_after_interview(
        mode=entry["mode"].value,
        topic=entry.get("topic"),
        messages=messages,
        user_id=user_id,
        scores=scores,
    )

    # Persist dimension_scores + avg_score into session for later review loading
    resume_overall = {}
    if extraction.get("dimension_scores"):
        resume_overall["dimension_scores"] = extraction["dimension_scores"]
    if extraction.get("avg_score"):
        resume_overall["avg_score"] = extraction["avg_score"]
    save_review(session_id, review, scores, weak_points, overall=resume_overall, user_id=user_id)

    del _graphs[session_id]

    return {
        "session_id": session_id,
        "mode": "resume",
        "review": review,
        "profile_update": {
            "new_weak_points": extraction.get("weak_points", []),
            "new_strong_points": extraction.get("strong_points", []),
            "session_summary": extraction.get("session_summary", ""),
        },
        "dimension_scores": extraction.get("dimension_scores"),
        "avg_score": extraction.get("avg_score"),
    }


def _format_drill_review(questions, answers, scores, overall) -> str:
    """将专项训练评估格式化为可读报告"""
    answer_map = {a["question_id"]: a["answer"] for a in answers}
    score_map = {s["question_id"]: s for s in scores}

    lines = [f"## 整体评价\n\n{overall.get('summary', '')}\n\n**平均分: {overall.get('avg_score', '-')}/10**\n"]

    lines.append("---\n\n## 逐题复盘\n")
    for q in questions:
        qid = q["id"]
        s = score_map.get(qid, {})
        answer = answer_map.get(qid, "")

        # Unanswered: one-line summary only
        if not answer:
            lines.append(f"### Q{qid} ({q.get('focus_area', '')}) — 未作答")
            lines.append(f"**题目**: {q['question']}\n")
            continue

        score = s.get("score", "-")
        assessment = s.get("assessment", "")
        understanding = s.get("understanding", "")
        missing = s.get("key_missing", [])

        lines.append(f"### Q{qid} ({q.get('focus_area', '')}) — {score}/10")
        lines.append(f"**题目**: {q['question']}")
        lines.append(f"**你的回答**: {answer}")
        if assessment:
            lines.append(f"**点评**: {assessment}")
        improvement = s.get("improvement", "")
        if improvement:
            lines.append(f"**改进建议**: {improvement}")
        if understanding:
            lines.append(f"**理解程度**: {understanding}")
        if missing:
            lines.append(f"**遗漏关键点**: {', '.join(missing)}")
        lines.append("")

    if overall.get("new_weak_points"):
        lines.append("---\n\n## 薄弱点")
        for wp in overall["new_weak_points"]:
            lines.append(f"- {wp.get('point', wp) if isinstance(wp, dict) else wp}")

    if overall.get("new_strong_points"):
        lines.append("\n## 亮点")
        for sp in overall["new_strong_points"]:
            lines.append(f"- {sp.get('point', sp) if isinstance(sp, dict) else sp}")

    return "\n".join(lines)


async def _update_drill_profile(topic: str, overall: dict, scores: list,
                                total_questions: int, user_id: str):
    """从专项训练评估更新画像（Mem0 风格）"""
    # Compute mastery score (0-100) from per-question scores + difficulty
    valid = []
    for s in scores:
        try:
            valid.append((float(s["score"]), float(s.get("difficulty", 3))))
        except (TypeError, ValueError, KeyError):
            pass
    mastery = overall.get("topic_mastery", {})
    coverage = len(valid) / total_questions if total_questions else 0
    session_weight = coverage * 0.4  # 1/10 answered → 0.04, 10/10 → 0.4

    if valid:
        # contribution = (difficulty/5) × (score/10), unanswered = 0
        contributions = [(d / 5) * (s / 10) for s, d in valid]
        mastery["score"] = round(sum(contributions) / total_questions * 100, 1)
    mastery.pop("level", None)  # migrate away from old Lv1-5

    await llm_update_profile(
        mode="topic_drill",
        topic=topic,
        new_weak_points=overall.get("new_weak_points", []),
        new_strong_points=overall.get("new_strong_points", []),
        topic_mastery=mastery,
        communication=overall.get("communication_observations", {}),
        user_id=user_id,
        thinking_patterns=overall.get("thinking_patterns"),
        session_summary=overall.get("summary", ""),
        avg_score=overall.get("avg_score"),
        answer_count=len(scores),
        session_weight=session_weight,
    )


# ── 知识管理端点 ──

@router.get("/knowledge/{topic}/core")
async def get_core_knowledge(topic: str, user_id: str = Depends(get_current_user)):
    """获取话题的核心知识文件列表"""
    topics = load_topics(user_id)
    if topic not in topics:
        raise HTTPException(400, f"Unknown topic: {topic}")
    topic_dir = settings.user_knowledge_path(user_id) / topics[topic]["dir"]
    if not topic_dir.exists():
        return []
    files = []
    for f in sorted(topic_dir.glob("*.md")):
        files.append({"filename": f.name, "content": f.read_text(encoding="utf-8")})
    return files


@router.put("/knowledge/{topic}/core/{filename}")
async def update_core_knowledge(topic: str, filename: str, body: dict,
                                user_id: str = Depends(get_current_user)):
    """更新核心知识文件"""
    topics = load_topics(user_id)
    if topic not in topics:
        raise HTTPException(400, f"Unknown topic: {topic}")
    topic_dir = settings.user_knowledge_path(user_id) / topics[topic]["dir"]
    filepath = topic_dir / filename
    if not filepath.exists():
        raise HTTPException(404, f"File not found: {filename}")
    filepath.write_text(body.get("content", ""), encoding="utf-8")
    # Clear index cache so next retrieval rebuilds
    _index_cache.pop((user_id, topic), None)
    return {"ok": True}


@router.delete("/knowledge/{topic}/core/{filename}")
async def delete_core_knowledge(topic: str, filename: str,
                                user_id: str = Depends(get_current_user)):
    """删除核心知识文件"""
    topics = load_topics(user_id)
    if topic not in topics:
        raise HTTPException(400, f"Unknown topic: {topic}")
    topic_dir = settings.user_knowledge_path(user_id) / topics[topic]["dir"]
    filepath = topic_dir / filename
    if not filepath.exists():
        raise HTTPException(404, f"File not found: {filename}")
    filepath.unlink()
    _index_cache.pop((user_id, topic), None)
    return {"ok": True}


@router.post("/knowledge/{topic}/core")
async def create_core_knowledge(topic: str, body: dict,
                                user_id: str = Depends(get_current_user)):
    """创建新的核心知识文件"""
    topics = load_topics(user_id)
    if topic not in topics:
        raise HTTPException(400, f"Unknown topic: {topic}")
    filename = body.get("filename", "").strip()
    if not filename or not filename.endswith(".md"):
        raise HTTPException(400, "Filename must end with .md")
    topic_dir = settings.user_knowledge_path(user_id) / topics[topic]["dir"]
    topic_dir.mkdir(parents=True, exist_ok=True)
    filepath = topic_dir / filename
    if filepath.exists():
        raise HTTPException(409, f"File already exists: {filename}")
    filepath.write_text(body.get("content", ""), encoding="utf-8")
    _index_cache.pop((user_id, topic), None)
    return {"ok": True, "filename": filename}


@router.post("/knowledge/{topic}/generate")
async def generate_core_knowledge(topic: str, user_id: str = Depends(get_current_user)):
    """使用 LLM 生成话题的基础知识内容"""
    topics = load_topics(user_id)
    if topic not in topics:
        raise HTTPException(400, f"Unknown topic: {topic}")
    from backend.llm_provider import get_langchain_llm
    from langchain_core.messages import SystemMessage, HumanMessage

    topic_name = topics[topic].get("name", topic)

    llm = get_langchain_llm()
    resp = llm.invoke([
        SystemMessage(content="你是一位资深技术面试官，擅长梳理技术领域的核心知识体系。"),
        HumanMessage(content=(
            f"请为「{topic_name}」这个技术领域生成一份核心知识梳理，作为面试出题和评分的参考依据。\n\n"
            "要求：\n"
            "- 用 Markdown 格式\n"
            "- 以 `# {topic_name}` 作为标题\n"
            "- 列出该领域最核心的 8-12 个知识点，每个用二级标题\n"
            "- 每个知识点下用简洁的要点说明关键概念、原理、常见面试考点\n"
            "- 重点覆盖：核心概念、工作原理、最佳实践、常见陷阱\n"
            "- 保持简洁实用，面向面试准备场景\n"
            "- 直接输出 Markdown 内容，不要包裹在代码块中"
        )),
    ])
    content = resp.content.strip()

    topic_dir = settings.user_knowledge_path(user_id) / topics[topic]["dir"]
    topic_dir.mkdir(parents=True, exist_ok=True)
    readme = topic_dir / "README.md"
    readme.write_text(content, encoding="utf-8")
    _index_cache.pop((user_id, topic), None)

    return {"ok": True, "content": content}


@router.get("/knowledge/{topic}/high_freq")
async def get_high_freq(topic: str, user_id: str = Depends(get_current_user)):
    """获取话题的高频题库"""
    topics = load_topics(user_id)
    if topic not in topics:
        raise HTTPException(400, f"Unknown topic: {topic}")
    filepath = settings.user_high_freq_path(user_id) / f"{topic}.md"
    if not filepath.exists():
        return {"content": ""}
    return {"content": filepath.read_text(encoding="utf-8")}


@router.put("/knowledge/{topic}/high_freq")
async def update_high_freq(topic: str, body: dict, user_id: str = Depends(get_current_user)):
    """更新话题的高频题库"""
    topics = load_topics(user_id)
    if topic not in topics:
        raise HTTPException(400, f"Unknown topic: {topic}")
    hf_dir = settings.user_high_freq_path(user_id)
    hf_dir.mkdir(parents=True, exist_ok=True)
    filepath = hf_dir / f"{topic}.md"
    filepath.write_text(body.get("content", ""), encoding="utf-8")
    return {"ok": True}


# ── 知识图谱 ──

@router.get("/graph/{topic}")
def get_topic_graph(topic: str, user_id: str = Depends(get_current_user)):
    """构建话题的题目关系图"""
    return build_graph(topic, user_id)


# ── 参考答案 ──

@router.post("/interview/reference-answer")
async def generate_reference_answer(body: dict, user_id: str = Depends(get_current_user)):
    """使用 LLM + 知识库生成题目参考回答"""
    topic = body.get("topic", "").strip()
    question = body.get("question", "").strip()
    if not topic or not question:
        raise HTTPException(400, "topic and question are required")

    from backend.indexer import retrieve_topic_context
    from backend.llm_provider import get_langchain_llm
    from backend.prompts.interviewer import REFERENCE_ANSWER_PROMPT
    from langchain_core.messages import HumanMessage

    topics = load_topics(user_id)
    topic_name = topics.get(topic, {}).get("name", topic)

    refs = retrieve_topic_context(topic, question, user_id, top_k=3)
    knowledge_context = "\n\n".join(refs) if refs else "（暂无参考材料）"

    prompt = REFERENCE_ANSWER_PROMPT.format(
        topic_name=topic_name,
        question=question,
        knowledge_context=knowledge_context,
    )

    llm = get_langchain_llm()
    resp = llm.invoke([HumanMessage(content=prompt)])
    return {"reference_answer": resp.content.strip()}


# ── 历史记录 ──

@router.get("/interview/review/{session_id}")
async def get_review(session_id: str, user_id: str = Depends(get_current_user)):
    """获取已完成会话的评估报告"""
    session = get_session(session_id, user_id=user_id)
    if not session:
        raise HTTPException(404, "Session not found.")
    if not session.get("review"):
        raise HTTPException(400, "Interview not yet reviewed.")
    return session


@router.get("/interview/history")
async def get_history(
    limit: int = 20,
    offset: int = 0,
    mode: str = None,
    topic: str = None,
    user_id: str = Depends(get_current_user),
):
    """获取历史面试会话列表（支持过滤和分页）"""
    return list_sessions(user_id=user_id, limit=limit, offset=offset, mode=mode, topic=topic)


@router.delete("/interview/session/{session_id}")
async def delete_session_endpoint(session_id: str, user_id: str = Depends(get_current_user)):
    """删除会话记录"""
    deleted = delete_session(session_id, user_id=user_id)
    if not deleted:
        raise HTTPException(404, "Session not found.")
    return {"ok": True}


@router.get("/interview/topics")
async def get_interview_topics(user_id: str = Depends(get_current_user)):
    """获取已完成会话中的不同话题（用于过滤下拉框）"""
    return list_distinct_topics(user_id=user_id)


# ── 项目分析（Phase 1）──

@router.post("/project-analysis/resolve")
async def project_analysis_resolve(
    req: ProjectAnalysisResolveRequest,
    user_id: str = Depends(get_current_user),
):
    """解析公开 GitHub 仓库并返回默认分支与可选分支."""
    try:
        return resolve_repo_preview(req.repo_url, user_id)
    except AnalysisPipelineError as e:
        raise HTTPException(400, str(e))


@router.post("/project-analysis")
async def project_analysis_create(
    req: ProjectAnalysisCreateRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """创建项目分析任务，并通过后台任务执行分析."""
    try:
        record = create_analysis_job(
            repo_url=req.repo_url,
            user_id=user_id,
            branch=req.branch,
            role_summary=req.role_summary,
            owned_scopes=req.owned_scopes,
        )
    except AnalysisPipelineError as e:
        raise HTTPException(400, str(e))

    background_tasks.add_task(run_analysis_job, record["analysis_id"], user_id)
    return _analysis_public_view(record)


@router.get("/project-analysis/{analysis_id}")
async def project_analysis_status(analysis_id: str, user_id: str = Depends(get_current_user)):
    """查询项目分析任务状态."""
    record = get_analysis(analysis_id, user_id)
    if not record:
        raise HTTPException(404, "Analysis not found.")
    return _analysis_public_view(record)


@router.get("/project-analysis/{analysis_id}/status")
async def project_analysis_status_alias(analysis_id: str, user_id: str = Depends(get_current_user)):
    """查询项目分析任务状态（前端轮询别名接口）。"""
    record = get_analysis(analysis_id, user_id)
    if not record:
        raise HTTPException(404, "Analysis not found.")
    return _analysis_public_view(record)


@router.post("/project-analysis/{analysis_id}/cancel")
async def project_analysis_cancel(analysis_id: str, user_id: str = Depends(get_current_user)):
    """取消尚未结束的项目分析任务。"""
    record = cancel_analysis_job(analysis_id, user_id)
    if not record:
        raise HTTPException(404, "Analysis not found.")
    return _analysis_public_view(record)


@router.get("/project-analysis/{analysis_id}/result")
async def project_analysis_result(analysis_id: str, user_id: str = Depends(get_current_user)):
    """获取项目分析结果（仅 completed 状态可读取）."""
    record = get_analysis(analysis_id, user_id)
    if not record:
        raise HTTPException(404, "Analysis not found.")
    if record.get("status") != STATUS_COMPLETED:
        raise HTTPException(409, f"Analysis not completed. Current status: {record.get('status')}")
    return _analysis_public_view(record, include_result=True)


@router.post("/project-analysis/{analysis_id}/practice")
async def project_analysis_practice(analysis_id: str, user_id: str = Depends(get_current_user)):
    """将项目分析结果桥接为一次专项训练会话。"""
    record = get_analysis(analysis_id, user_id)
    if not record:
        raise HTTPException(404, "Analysis not found.")
    if record.get("status") != STATUS_COMPLETED:
        raise HTTPException(409, "Analysis not completed.")

    questions = _build_project_practice_questions(record)
    if not questions:
        raise HTTPException(400, "Analysis result does not contain practice questions.")

    session_id = str(uuid.uuid4())[:8]
    topic = f"project::{record.get('repo_name', 'analysis')}"
    create_session(session_id, mode="topic_drill", topic=topic, questions=questions, user_id=user_id)
    _drill_sessions[session_id] = {
        "topic": topic,
        "questions": questions,
        "user_id": user_id,
        "mode": "project_analysis",
        "analysis_id": analysis_id,
        "result": record.get("result", {}),
    }
    return {
        "session_id": session_id,
        "mode": "topic_drill",
        "topic": topic,
        "questions": questions,
    }


app.include_router(router)
