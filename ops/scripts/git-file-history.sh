#!/bin/bash
# Git 커밋 내역 추적 유틸
# 사용법: ./git-file-history.sh [file-path] [limit]

FILE_PATH=${1:-""}
LIMIT=${2:-20}

echo "=========================================="
echo "Git 파일 히스토리 확인"
echo "=========================================="

if [ -n "$FILE_PATH" ]; then
    echo "파일: $FILE_PATH"
    echo "최근 ${LIMIT}개 커밋:"
    git log --oneline -$LIMIT -- "$FILE_PATH"
    echo ""
    echo ">>> 마지막 수정 내용 <<<"
    git log -1 --format="%H %an %ai %s" -- "$FILE_PATH"
    echo ""
    echo ">>> 현재 파일 vs 이전 버전 비교 <<<"
    PREV_COMMIT=$(git log -2 --format="%H" -- "$FILE_PATH" | tail -1)
    if [ -n "$PREV_COMMIT" ]; then
        git diff $PREV_COMMIT -- "$FILE_PATH" | head -30
    fi
else
    echo "최근 ${LIMIT}개 커밋 (모든 파일):"
    git log --oneline -$LIMIT
    echo ""
    echo ">>> 오늘 수정된 파일들 <<<"
    git log --since="today" --name-only --format=""
fi

echo ""
echo ">>> 브랜치 상태 <<<"
git branch -v | head -5