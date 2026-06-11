import json
import os
import time
from typing import Any, Dict, List


def _default_slot_name(index: int) -> str:
    return f"Slot {index + 1}"


class EnvSlotStore:
    def __init__(self, opt: Dict[str, Any]):
        slot_file = opt.get("ENVVAR_slot_file")
        if slot_file is None:
            slot_file = os.path.join(
                opt.get("LOGGER_log_dir", "./ant_runner_logs"),
                "ant_envar_slots.json",
            )

        self.path = os.path.abspath(slot_file)
        self.slot_count = self._normalize_slot_count(opt.get("ENVVAR_slot_count", 8))

    @staticmethod
    def _normalize_slot_count(value: Any) -> int:
        try:
            count = int(value)
        except (TypeError, ValueError):
            count = 8
        return max(1, min(count, 64))

    @staticmethod
    def empty_slot(index: int) -> Dict[str, Any]:
        return {
            "index": index,
            "name": _default_slot_name(index),
            "envar": {},
            "saved_at": None,
            "is_empty": True,
        }

    def empty_state(self) -> Dict[str, Any]:
        return {
            "version": 1,
            "slot_count": self.slot_count,
            "slots": [self.empty_slot(index) for index in range(self.slot_count)],
        }

    def normalize_state(self, payload: Dict[str, Any] | None) -> Dict[str, Any]:
        state = self.empty_state()
        if not isinstance(payload, dict):
            return state

        raw_slots = payload.get("slots", [])
        if not isinstance(raw_slots, list):
            return state

        normalized_slots: List[Dict[str, Any]] = []
        for index in range(self.slot_count):
            raw_slot = raw_slots[index] if index < len(raw_slots) else None
            normalized = self.empty_slot(index)
            if isinstance(raw_slot, dict):
                raw_envar = raw_slot.get("envar", {})
                normalized_name = str(raw_slot.get("name") or "").strip() or _default_slot_name(index)
                normalized_saved_at = raw_slot.get("saved_at")
                normalized_envar = raw_envar if isinstance(raw_envar, dict) else {}
                normalized.update(
                    {
                        "name": normalized_name,
                        "envar": normalized_envar,
                        "saved_at": normalized_saved_at,
                        "is_empty": len(normalized_envar) == 0,
                    }
                )
            normalized_slots.append(normalized)

        state["slots"] = normalized_slots
        return state

    def load(self) -> Dict[str, Any]:
        if not os.path.exists(self.path):
            return self.empty_state()

        try:
            with open(self.path, "r", encoding="utf-8") as file:
                payload = json.load(file)
        except (OSError, json.JSONDecodeError):
            return self.empty_state()

        return self.normalize_state(payload)

    def write(self, state: Dict[str, Any]) -> Dict[str, Any]:
        normalized = self.normalize_state(state)
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
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

        return normalized

    def get_slots(self) -> Dict[str, Any]:
        return self.load()

    def save_slot(self, index: int, envar: Dict[str, Any], name: str | None = None) -> Dict[str, Any]:
        state = self.load()
        if index < 0 or index >= self.slot_count:
            raise ValueError("slot_index is out of range")
        if not isinstance(envar, dict):
            raise ValueError("envar must be an object")

        slot = state["slots"][index]
        slot["name"] = str(name or slot.get("name") or "").strip() or _default_slot_name(index)
        slot["envar"] = envar
        slot["saved_at"] = time.time()
        slot["is_empty"] = len(envar) == 0
        return self.write(state)

    def rename_slot(self, index: int, name: str | None = None) -> Dict[str, Any]:
        state = self.load()
        if index < 0 or index >= self.slot_count:
            raise ValueError("slot_index is out of range")

        slot = state["slots"][index]
        if slot.get("is_empty", True):
            raise ValueError("Cannot rename an empty slot")

        slot["name"] = str(name or "").strip() or _default_slot_name(index)
        return self.write(state)

    def clear_slot(self, index: int) -> Dict[str, Any]:
        state = self.load()
        if index < 0 or index >= self.slot_count:
            raise ValueError("slot_index is out of range")

        state["slots"][index] = self.empty_slot(index)
        return self.write(state)