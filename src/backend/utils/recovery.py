import json
import os
import time
import uuid
from typing import Any, Dict, Iterable, List

from utils.structures import AntTask


def _task_id(task_state: Dict[str, Any]) -> str:
    return str(task_state.get("task_id", ""))


def _session_id(saved_at: float | None = None) -> str:
    timestamp = int((saved_at or time.time()) * 1000)
    return f"{timestamp}-{uuid.uuid4().hex[:8]}"


def _has_session_tasks(session: Dict[str, Any]) -> bool:
    return any(session.get(key) for key in ("queued", "ongoing", "completed"))


class RecoveryStore:
    def __init__(self, opt: Dict[str, Any]):
        recovery_file = opt.get("RECOVERY_state_file")
        if recovery_file is None:
            recovery_file = os.path.join(
                opt.get("LOGGER_log_dir", "./ant_runner_logs"),
                "ant_recovery_state.json",
            )

        self.path = os.path.abspath(recovery_file)

    def load(self) -> Dict[str, Any]:
        if not os.path.exists(self.path):
            return self.empty_history()

        try:
            with open(self.path, "r", encoding="utf-8") as file:
                snapshot = json.load(file)
        except (OSError, json.JSONDecodeError):
            return self.empty_history()

        return self.normalize_history(snapshot)

    def write(
        self,
        queued: Iterable[AntTask],
        ongoing: Iterable[AntTask],
        completed: Iterable[AntTask],
        carried_history: Dict[str, Any] | None = None,
    ) -> None:
        current_session = {
            "session_id": _session_id(),
            "saved_at": time.time(),
            "queued": [task.to_state_dict() for task in queued],
            "ongoing": [task.to_state_dict() for task in ongoing],
            "completed": [task.to_state_dict() for task in completed],
        }

        history = self.normalize_history(carried_history)
        sessions = [current_session] if _has_session_tasks(current_session) else []
        sessions.extend(history.get("sessions", []))
        self.write_history({"version": 2, "sessions": sessions, "hidden": history.get("hidden", [])})

    def write_history(self, history: Dict[str, Any]) -> None:
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        normalized = self.normalize_history(history)
        tmp_path = f"{self.path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as file:
            json.dump(normalized, file, ensure_ascii=False, indent=2, sort_keys=True)
            file.flush()
            os.fsync(file.fileno())
        os.replace(tmp_path, self.path)

        try:
            dir_fd = os.open(os.path.dirname(self.path), os.O_DIRECTORY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except OSError:
            pass

    @staticmethod
    def empty_session(saved_at: float | None = None, session_id: str | None = None) -> Dict[str, Any]:
        return {
            "session_id": session_id or _session_id(saved_at),
            "saved_at": saved_at,
            "queued": [],
            "ongoing": [],
            "completed": [],
        }

    @staticmethod
    def empty_history() -> Dict[str, Any]:
        return {
            "version": 2,
            "sessions": [],
            "hidden": [],
        }

    @staticmethod
    def empty_snapshot() -> Dict[str, Any]:
        return RecoveryStore.empty_history()

    @staticmethod
    def normalize_session(session: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(session, dict):
            return RecoveryStore.empty_session()

        normalized = RecoveryStore.empty_session(
            saved_at=session.get("saved_at"),
            session_id=str(session.get("session_id") or _session_id(session.get("saved_at"))),
        )

        for key in ("queued", "ongoing", "completed"):
            value = session.get(key, [])
            if isinstance(value, list):
                normalized[key] = [item for item in value if isinstance(item, dict) and _task_id(item)]

        return normalized

    @staticmethod
    def normalize_history(history: Dict[str, Any] | None) -> Dict[str, Any]:
        if not isinstance(history, dict):
            return RecoveryStore.empty_history()

        if isinstance(history.get("sessions"), list):
            sessions = [
                RecoveryStore.normalize_session(session)
                for session in history.get("sessions", [])
                if isinstance(session, dict)
            ]
        else:
            legacy_session = RecoveryStore.empty_session(saved_at=history.get("saved_at"))
            for key in ("queued", "ongoing", "completed"):
                value = history.get(key, [])
                if isinstance(value, list):
                    legacy_session[key] = [item for item in value if isinstance(item, dict) and _task_id(item)]
            sessions = [legacy_session]

        sessions = [session for session in sessions if _has_session_tasks(session)]
        sessions.sort(key=lambda session: session.get("saved_at") or 0, reverse=True)
        hidden = history.get("hidden", [])
        if not isinstance(hidden, list):
            hidden = []
        hidden = [item for item in hidden if isinstance(item, dict) and _task_id(item)]

        return {
            "version": 2,
            "sessions": sessions,
            "hidden": hidden,
        }

    @staticmethod
    def has_tasks(history: Dict[str, Any]) -> bool:
        normalized = RecoveryStore.normalize_history(history)
        return any(_has_session_tasks(session) for session in normalized.get("sessions", [])) or bool(normalized.get("hidden"))

    @staticmethod
    def has_session_tasks(history: Dict[str, Any]) -> bool:
        normalized = RecoveryStore.normalize_history(history)
        return any(_has_session_tasks(session) for session in normalized.get("sessions", []))

    @staticmethod
    def select_tasks(history: Dict[str, Any], section: str, task_ids: List[str]) -> List[AntTask]:
        selected_ids = set(task_ids or [])
        tasks = []
        for session in RecoveryStore.normalize_history(history).get("sessions", []):
            tasks.extend(
                AntTask.from_state_dict(task_state)
                for task_state in session.get(section, [])
                if _task_id(task_state) in selected_ids
            )
        return tasks

    @staticmethod
    def normalize_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        normalized = []
        for entry in entries or []:
            if not isinstance(entry, dict):
                continue
            session_id = str(entry.get("session_id", ""))
            section = str(entry.get("section", ""))
            task_id = str(entry.get("task_id", ""))
            if session_id and section in {"ongoing", "queued", "completed", "hidden"} and task_id:
                normalized.append({
                    "session_id": session_id,
                    "section": section,
                    "task_id": task_id,
                })
        return normalized

    @staticmethod
    def select_entries(history: Dict[str, Any], entries: List[Dict[str, Any]]) -> List[tuple[Dict[str, str], AntTask]]:
        selected_entries = {
            (entry["session_id"], entry["section"], entry["task_id"])
            for entry in RecoveryStore.normalize_entries(entries)
        }
        selected_tasks = []

        for session in RecoveryStore.normalize_history(history).get("sessions", []):
            session_id = session.get("session_id")
            for section in ("ongoing", "queued", "completed"):
                for task_state in session.get(section, []):
                    task_id = _task_id(task_state)
                    if (session_id, section, task_id) in selected_entries:
                        selected_tasks.append((
                            {
                                "session_id": session_id,
                                "section": section,
                                "task_id": task_id,
                            },
                            AntTask.from_state_dict(task_state),
                        ))

        normalized = RecoveryStore.normalize_history(history)
        for task_state in normalized.get("hidden", []):
            task_id = _task_id(task_state)
            if ("hidden", "hidden", task_id) in selected_entries:
                selected_tasks.append((
                    {
                        "session_id": "hidden",
                        "section": "hidden",
                        "task_id": task_id,
                        "hidden_from_section": task_state.get("_hidden_from_section", "completed"),
                    },
                    AntTask.from_state_dict(task_state),
                ))

        return selected_tasks

    @staticmethod
    def remove_entries(history: Dict[str, Any], entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        selected_entries = {
            (entry["session_id"], entry["section"], entry["task_id"])
            for entry in RecoveryStore.normalize_entries(entries)
        }
        normalized_history = RecoveryStore.normalize_history(history)
        remaining_sessions = []

        for session in normalized_history.get("sessions", []):
            next_session = RecoveryStore.empty_session(
                saved_at=session.get("saved_at"),
                session_id=session.get("session_id"),
            )
            session_id = session.get("session_id")

            for section in ("ongoing", "queued", "completed"):
                next_session[section] = [
                    task_state
                    for task_state in session.get(section, [])
                    if (session_id, section, _task_id(task_state)) not in selected_entries
                ]

            if _has_session_tasks(next_session):
                remaining_sessions.append(next_session)

        remaining_hidden = [
            task_state
            for task_state in normalized_history.get("hidden", [])
            if ("hidden", "hidden", _task_id(task_state)) not in selected_entries
        ]
        return RecoveryStore.normalize_history({
            "version": 2,
            "sessions": remaining_sessions,
            "hidden": remaining_hidden,
        })

    @staticmethod
    def add_hidden_tasks(history: Dict[str, Any], tasks: Iterable[AntTask]) -> Dict[str, Any]:
        normalized = RecoveryStore.normalize_history(history)
        hidden_by_id = {_task_id(task_state): task_state for task_state in normalized.get("hidden", [])}
        for task in tasks:
            task_state = task.to_state_dict()
            task_state["_hidden_from_section"] = "completed"
            hidden_by_id[task.task_id] = task_state
        normalized["hidden"] = list(hidden_by_id.values())
        return RecoveryStore.normalize_history(normalized)

    @staticmethod
    def hide_entries(history: Dict[str, Any], entries: List[Dict[str, Any]]) -> Dict[str, Any]:
        selected = RecoveryStore.select_entries(history, entries)
        next_history = RecoveryStore.remove_entries(history, [entry for entry, _task in selected])
        normalized = RecoveryStore.normalize_history(next_history)
        hidden_by_id = {_task_id(task_state): task_state for task_state in normalized.get("hidden", [])}
        for entry, task in selected:
            task_state = task.to_state_dict()
            task_state["_hidden_from_section"] = entry["section"]
            hidden_by_id[task.task_id] = task_state
        normalized["hidden"] = list(hidden_by_id.values())
        return RecoveryStore.normalize_history(normalized)

    @staticmethod
    def entries_from_legacy_selection(history: Dict[str, Any], section: str, task_ids: List[str]) -> List[Dict[str, str]]:
        selected_ids = set(task_ids or [])
        return [
            {
                "session_id": session.get("session_id"),
                "section": section,
                "task_id": _task_id(task_state),
            }
            for session in RecoveryStore.normalize_history(history).get("sessions", [])
            for task_state in session.get(section, [])
            if _task_id(task_state) in selected_ids
        ]