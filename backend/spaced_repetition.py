"""间隔重复系统 — SM-2 算法。

为每个薄弱点维护复习调度：
- 答对了 → 间隔拉长（1天 → 3天 → 7天 → ...）
- 答错了 → 间隔重置到 1 天
- 每次出题时优先出"到期需要复习"的知识点
"""
from datetime import date, timedelta

from backend.memory import _load_profile, _save_profile


def sm2_update(sr_state: dict, score_0_10: float) -> dict:
    """SM-2 算法更新

    Args:
        sr_state: 当前间隔重复状态 {interval_days, ease_factor, repetitions, ...}
        score_0_10: 0-10 分制分数（映射到 SM-2 quality 0-5）

    Returns:
        更新后的 SR 状态字典
    """
    # Map 0-10 to SM-2 quality 0-5
    quality = min(5, int(score_0_10 / 2))
    ef = sr_state.get("ease_factor", 2.5)
    reps = sr_state.get("repetitions", 0)

    if quality >= 3:  # Pass
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 3
        else:
            interval = int(sr_state.get("interval_days", 1) * ef)
        reps += 1
    else:  # Fail — reset
        interval = 1
        reps = 0

    # Update ease factor (never below 1.3)
    ef = max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))

    return {
        "interval_days": interval,
        "ease_factor": round(ef, 2),
        "repetitions": reps,
        "next_review": (date.today() + timedelta(days=interval)).isoformat(),
        "last_score": score_0_10,
    }


def get_due_reviews(user_id: str, topic: str = None) -> list[dict]:
    """获取需要复习的薄弱点

    返回按 ease_factor 排序的薄弱点列表（最难的最先复习）
    """
    profile = _load_profile(user_id)
    today = date.today().isoformat()
    due = []

    for wp in profile.get("weak_points", []):
        if wp.get("improved"):
            continue
        if topic and wp.get("topic") != topic:
            continue
        sr = wp.get("sr", {})
        next_review = sr.get("next_review", "2000-01-01")
        if next_review <= today:
            due.append(wp)

    # Hardest first (lowest ease_factor)
    due.sort(key=lambda x: x.get("sr", {}).get("ease_factor", 2.5))
    return due


def update_weak_point_sr(topic: str, point_text: str, score: float, user_id: str):
    """评估后更新特定薄弱点的间隔重复状态

    按 topic + point 文本子串匹配
    """
    profile = _load_profile(user_id)

    for wp in profile.get("weak_points", []):
        if wp.get("improved"):
            continue
        if topic and wp.get("topic") != topic:
            continue
        # Fuzzy match: point_text is contained in the weak point or vice versa
        if point_text.lower() in wp["point"].lower() or wp["point"].lower() in point_text.lower():
            sr = wp.get("sr", {})
            wp["sr"] = sm2_update(sr, score)
            _save_profile(profile, user_id)
            return True

    return False


def init_sr_for_existing_points(user_id: str):
    """为尚未有 SR 状态的现有薄弱点初始化"""
    profile = _load_profile(user_id)
    changed = False

    for wp in profile.get("weak_points", []):
        if wp.get("improved"):
            continue
        if "sr" not in wp:
            wp["sr"] = {
                "interval_days": 1,
                "ease_factor": 2.5,
                "repetitions": 0,
                "next_review": date.today().isoformat(),
                "last_score": None,
            }
            changed = True

    if changed:
        _save_profile(profile, user_id)
