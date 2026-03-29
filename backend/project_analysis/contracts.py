"""项目分析模块的数据契约定义。"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, model_validator


class AnalysisStatus(str, Enum):
    """项目分析任务状态。"""

    QUEUED = "queued"
    FETCHING = "fetching"
    FILTERING = "filtering"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class EvidenceSourceType(str, Enum):
    """证据来源类型。"""

    FILE = "file"
    CONFIG = "config"
    DIRECTORY = "directory"
    DEPENDENCY = "dependency"


class EvidenceItem(BaseModel):
    """单条证据信息。"""

    source_type: EvidenceSourceType
    source_path: str = Field(min_length=1, max_length=1024)
    reason: str = Field(min_length=1, max_length=2000)
    snippet: str = Field(default="", max_length=4000)
    line_start: int | None = Field(default=None, ge=1)
    line_end: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_line_range(self) -> "EvidenceItem":
        """校验行号范围合法性。"""
        if self.line_start is not None and self.line_end is not None:
            if self.line_end < self.line_start:
                raise ValueError("line_end must be >= line_start")
        return self


class InterviewQuestionItem(BaseModel):
    """项目深挖题条目。"""

    question: str = Field(min_length=1, max_length=2000)
    reference_answer_points: list[str] = Field(default_factory=list)
    follow_up_directions: list[str] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_answer_points(self) -> "InterviewQuestionItem":
        """至少包含一个参考答题点。"""
        if not self.reference_answer_points:
            raise ValueError("reference_answer_points must not be empty")
        return self


class ModuleSummaryItem(BaseModel):
    """关键模块摘要。"""

    module_name: str = Field(min_length=1, max_length=256)
    summary: str = Field(min_length=1, max_length=2000)
    ownership_match: bool | None = None


class ProjectBreakdown(BaseModel):
    """项目拆解结果。"""

    core_features: list[str] = Field(default_factory=list)
    key_modules: list[ModuleSummaryItem] = Field(default_factory=list)
    tech_stack: list[str] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    ownership_alignment: list[str] = Field(default_factory=list)


class ProjectAnalysisMetadata(BaseModel):
    """分析元信息。"""

    repo_url: str = Field(min_length=1, max_length=2048)
    repo_name: str = Field(min_length=1, max_length=256)
    branch: str = Field(min_length=1, max_length=256)
    commit_sha: str = Field(min_length=7, max_length=64)
    analyzed_at: str | None = None


class ProjectAnalysisResult(BaseModel):
    """项目分析完整结果。"""

    metadata: ProjectAnalysisMetadata
    questions: list[InterviewQuestionItem] = Field(default_factory=list)
    breakdown: ProjectBreakdown = Field(default_factory=ProjectBreakdown)
    resume_draft: str = ""
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

