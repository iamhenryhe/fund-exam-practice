#!/usr/bin/env python3
"""Convert the public question-bank JSON files into the static site's format.

This importer intentionally keeps source/year metadata on every question. The
upstream repository is a useful public study resource, but its "真题" label is
not the same as an official 2026 exam release.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
from collections import OrderedDict
from pathlib import Path


SUBJECTS = (
    (
        "fund1",
        "基金法律法规_真题",
        "基金基础知识与法律法规",
        "科目一",
    ),
    (
        "fund2",
        "证券投资基金基础知识_真题",
        "证券投资基金基础知识",
        "科目二",
    ),
)


def clean_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text).replace("\xa0", " ").replace("\u3000", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    return text.strip()


def key_text(value: str) -> str:
    return re.sub(r"\s+", "", value).lower()


def chapter_label(relative_path: Path, fallback: str) -> str:
    if relative_path.parts:
        return relative_path.parts[0]
    return fallback


def topic_label(item: dict, path: Path) -> str:
    knowledge = item.get("knowledge") or []
    if knowledge and knowledge[0].get("knowLedgeName"):
        return clean_text(knowledge[0]["knowLedgeName"])
    if len(path.parts) > 1:
        return clean_text(path.parts[-2])
    return "综合"


def answer_indices(answer: object, option_count: int) -> list[int]:
    letters = re.findall(r"[A-D]", str(answer or "").upper())
    indices = sorted({ord(letter) - ord("A") for letter in letters})
    return [index for index in indices if 0 <= index < option_count]


def load_subject(source_root: Path, subject_id: str, folder: str, title: str, short_name: str) -> list[dict]:
    root = source_root / folder
    # The upstream bank repeats the same question in an overview file and a
    # topic file. Keep option-order variants, but drop byte-for-byte duplicates.
    records: "OrderedDict[tuple[str, tuple[str, ...]], dict]" = OrderedDict()
    for path in sorted(root.rglob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data.get("examDtoList", []):
            prompt = clean_text(item.get("content"))
            options = [clean_text(option) for option in (item.get("optionList") or [])]
            explanation = clean_text(item.get("analysis"))
            if not prompt or len(options) < 2:
                continue
            key = (key_text(prompt), tuple(key_text(option) for option in options))
            answer = answer_indices(item.get("answer"), len(options))
            if not answer:
                continue
            source = clean_text(item.get("source")) or "公开题库未注明来源"
            relative = path.relative_to(root)
            chapter = chapter_label(relative, folder)
            question_key = f"{subject_id}|{prompt}|{'|'.join(options)}"
            question_id = f"{subject_id}-{hashlib.sha1(question_key.encode('utf-8')).hexdigest()[:12]}"
            record = {
                "id": question_id,
                "subject": subject_id,
                "chapter": chapter,
                "topic": topic_label(item, relative),
                "type": "single",
                "prompt": prompt,
                "options": options,
                "answer": answer,
                "explanation": explanation or "原题库未提供解析，请结合对应章节和官方考试大纲复习。",
                "sourceType": "历史题库 / 考生回忆题",
                "source": source,
                "year": item.get("officialYear"),
            }
            records.setdefault(key, record)
    questions = list(records.values())
    questions.sort(key=lambda item: (item["chapter"], item["topic"], item["id"]))
    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True, help="Path to the cloned upstream repository")
    parser.add_argument("--output", type=Path, required=True, help="Static site's data directory")
    args = parser.parse_args()

    source_root = args.source / "tiku" / "src" / "assets" / "tiku" / "原始版题库"
    args.output.mkdir(parents=True, exist_ok=True)

    all_counts: dict[str, int] = {}
    for subject_id, folder, title, short_name in SUBJECTS:
        questions = load_subject(source_root, subject_id, folder, title, short_name)
        all_counts[subject_id] = len(questions)
        destination = args.output / f"{subject_id}.json"
        destination.write_text(json.dumps(questions, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"{short_name}: {len(questions)} questions -> {destination}")

    print("total:", sum(all_counts.values()))


if __name__ == "__main__":
    main()
