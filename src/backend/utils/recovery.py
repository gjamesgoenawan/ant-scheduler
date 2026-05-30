import json
import os
import time
from typing import Any, Dict, Iterable, List

from utils.structures import AntTask


def _task_id(task_state: Dict[str, Any]) -> str:
    return str(task_state.get("task_id", ""))


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
            return self.empty_snapshot()

        try:
            with open(self.path, "r", encoding="utf-8") as file:
                snapshot = json.load(file)
        except (OSError, json.JSONDecodeError):
            return self.empty_snapshot()

        return self.normalize_snapshot(snapshot)

    def write(self, queued: Iterable[AntTask], ongoing: Iterable[AntTask], completed: Iterable[AntTask]) -> None:
        snapshot = {
            "version": 1,
            "saved_at": time.time(),
            "queued": [task.to_state_dict() for task in queued],
            "ongoing": [task.to_state_dict() for task in ongoing],
            "completed": [task.to_state_dict() for task in completed],
        }
        self.write_snapshot(snapshot)

    def write_snapshot(self, snapshot: Dict[str, Any]) -> None:
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        normalized = self.normalize_snapshot(snapshot)
        tmp_path = f"{self.path}.tmp"
        with open(tmp_path, "w", encoding="utf-8") as file:
            json.dump(normalized, file, ensure_ascii=False, indent=2, sort_keys=True)
        os.replace(tmp_path, self.path)

    @staticmethod
    def empty_snapshot() -> Dict[str, Any]:
        return {
            "version": 1,
            "saved_at": None,
            "queued": [],
            "ongoing": [],
            "completed": [],
        }

    @staticmethod
    def normalize_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(snapshot, dict):
            return RecoveryStore.empty_snapshot()

        normalized = RecoveryStore.empty_snapshot()
        normalized["version"] = snapshot.get("version", 1)
        normalized["saved_at"] = snapshot.get("saved_at")

        for key in ("queued", "ongoing", "completed"):
            value = snapshot.get(key, [])
            if isinstance(value, list):
                normalized[key] = [item for item in value if isinstance(item, dict) and _task_id(item)]

        return normalized

    @staticmethod
    def has_tasks(snapshot: Dict[str, Any]) -> bool:
        return any(snapshot.get(key) for key in ("queued", "ongoing", "completed"))

    @staticmethod
    def select_tasks(snapshot: Dict[str, Any], section: str, task_ids: List[str]) -> List[AntTask]:
        selected_ids = set(task_ids or [])
        return [
            AntTask.from_state_dict(task_state)
            for task_state in snapshot.get(section, [])
            if _task_id(task_state) in selected_ids
        ]